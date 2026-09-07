/// <reference lib="webworker" />
self.onmessage = async ({ data }: MessageEvent<{engine: 'tesseract' | 'adaptive'; image: Blob}>) => {
  try {
    const { createWorker } = await import('tesseract.js');
    const start = performance.now();
    const worker = await createWorker('eng', 1);
    await worker.setParameters({ thresholding_method: data.engine === 'adaptive' ? '2' : '0' });
    const setupMs = performance.now() - start;
    try {
      const started = performance.now();
      const result = await worker.recognize(data.image);
      self.postMessage({ result: { text: result.data.text.trim(), setupMs, inferenceMs: performance.now() - started } });
    } finally { await worker.terminate(); }
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
