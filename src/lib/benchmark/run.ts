export type Engine = 'tesseract' | 'adaptive';
export interface EngineResult { text: string; setupMs: number; inferenceMs: number; elapsedMs: number }
export function runEngine(engine: Engine, image: Blob, signal: AbortSignal): Promise<EngineResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Comparison cancelled.')); return; }
    const started = performance.now();
    const worker = new Worker(new URL('../../workers/benchmark.worker.ts', import.meta.url), {type: 'module'});
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', abort); };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const abort = () => fail('Comparison cancelled.');
    const timer = setTimeout(() => fail('Engine exceeded the 3-minute limit. Check model downloads and try again.'), 180000);
    signal.addEventListener('abort', abort, {once:true});
    worker.onerror = event => fail(event.message || 'OCR worker failed.');
    worker.onmessage = ({ data }) => { cleanup(); if (data.error) reject(new Error(data.error)); else resolve({...data.result, elapsedMs:performance.now()-started}); };
    worker.postMessage({engine, image});
  });
}
