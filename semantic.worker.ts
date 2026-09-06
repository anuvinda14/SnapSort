import { env, pipeline } from '@huggingface/transformers';

// Only public model assets are downloaded. Text is evaluated inside this worker.
env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
const MODEL = 'Xenova/all-MiniLM-L6-v2';
type Entry = { id: string; text: string; vectors: number[][]; model: string };
let entries: Entry[] = [];
type Extractor = (text: string, options: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>;
const createExtractor = pipeline as unknown as (task: string, model: string, options: { dtype: string; device: string; progress_callback: (p: { status: string; progress: number; file: string }) => void }) => Promise<Extractor>;
let extractor: Promise<Extractor> | null = null;

async function model() {
  if (!extractor) {
    extractor = createExtractor('feature-extraction', MODEL, {
      dtype: 'q8', device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress') self.postMessage({ type: 'status', message: `Downloading search model: ${Math.round(p.progress)}% (${p.file})` });
      },
    });
    extractor.catch(() => { extractor = null; });
  }
  return extractor;
}

async function cache() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('snapsort-semantic', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('vectors', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache(): Promise<Entry[]> {
  const db = await cache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vectors', 'readonly');
    const req = tx.objectStore('vectors').getAll();
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function saveCache(values: Entry[]) {
  const db = await cache();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('vectors', 'readwrite');
    const store = tx.objectStore('vectors');
    store.clear();
    for (const value of values) store.put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

function chunks(text: string) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const result: string[] = [];
  for (let i = 0; i < words.length; i += 60) {
    result.push(words.slice(i, i + 90).join(' '));
    if (i + 90 >= words.length) break;
  }
  return result;
}

async function embed(text: string): Promise<number[]> {
  const run = await model();
  const output = await run(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

type Request = { id: number; type: 'index'; docs: { id: string; text: string }[] } | { id: number; type: 'search'; query: string };
async function handle(request: Request) {
  try {
    if (request.type === 'index') {
      const cached = await readCache();
      const next: Entry[] = [];
      for (const doc of request.docs) {
        self.postMessage({ type: 'status', message: `Preparing semantic search: ${next.length + 1} of ${request.docs.length}` });
        const existing = cached.find(e => e.id === doc.id && e.text === doc.text && e.model === MODEL);
        if (existing) next.push(existing);
        else {
          const vectors: number[][] = [];
          for (const chunk of chunks(doc.text)) vectors.push(await embed(chunk));
          next.push({ ...doc, vectors, model: MODEL });
        }
      }
      await saveCache(next);
      entries = next;
      self.postMessage({ id: request.id, type: 'indexed', count: next.length });
    } else {
      const start = performance.now();
      const vector = await embed(request.query);
      const matches = entries.map(entry => ({
        id: entry.id,
        score: Math.max(...entry.vectors.map(v => v.reduce((sum, value, i) => sum + value * vector[i], 0))),
      })).filter(m => m.score >= 0.22).sort((a, b) => b.score - a.score).slice(0, 6);
      self.postMessage({ id: request.id, type: 'results', matches, elapsed: Math.round(performance.now() - start) });
    }
  } catch (error) {
    self.postMessage({ id: request.id, type: 'error', error: error instanceof Error ? error.message : String(error) });
  }
}

// ONNX inference is serialized; new queries never run concurrently with indexing.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
  queue = queue.then(() => handle(event.data));
};
