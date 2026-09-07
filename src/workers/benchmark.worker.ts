/// <reference lib="webworker" />
import { runPaddle } from '@snapsort/paddle-engine';
self.onmessage = async ({ data }: MessageEvent<{engine: 'tesseract' | 'paddle'; image: Blob}>) => {
  try {
    if (data.engine === 'paddle') { self.postMessage({ result: await runPaddle(data.image) }); return; }
    const { createWorker } = await import('tesseract.js');
    const start = performance.now();
    const worker = await createWorker('eng', 1);
    const setupMs = performance.now() - start;
    try {
      const started = performance.now();
      const result = await worker.recognize(data.image);
      self.postMessage({ result: { text: result.data.text.trim(), setupMs, inferenceMs: performance.now() - started } });
    } finally { await worker.terminate(); }
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
