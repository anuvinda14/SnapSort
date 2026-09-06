import type { OcrProgress } from '@/types';

interface OcrWorker {
  recognize(image: Blob): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

let workerPromise: Promise<OcrWorker> | null = null;
let activeProgressCb: ((p: OcrProgress) => void) | null = null;

async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<OcrWorker> {
  if (!workerPromise) {
    activeProgressCb = onProgress ?? null;
    workerPromise = (async () => {
      const mod = await import('tesseract.js');
      const createWorker = mod.default?.createWorker ?? mod.createWorker;
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (activeProgressCb)
            activeProgressCb({ status: m.status, progress: m.progress });
        },
      });
      return worker as unknown as OcrWorker;
    })();
    // If creation fails, clear the cached promise so retry can try again
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  activeProgressCb = onProgress ?? null;
  return workerPromise;
}

export async function recognize(
  image: Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const worker = await getWorker(onProgress);
  activeProgressCb = onProgress ?? null;
  const { data } = await worker.recognize(image);
  return data.text.trim();
}

export async function preloadWorker(
  onProgress?: (p: OcrProgress) => void
): Promise<void> {
  await getWorker(onProgress);
}

export function resetWorker(): void {
  workerPromise = null;
  activeProgressCb = null;
}
