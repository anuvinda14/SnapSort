// This adapter is selected by Vite only when the optional SDK is installed.
export async function runPaddle(image: Blob) {
  const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
  const start = performance.now();
  const engine = await PaddleOCR.create({
    textDetectionModelName: 'PP-OCRv5_mobile_det',
    textRecognitionModelName: 'PP-OCRv5_mobile_rec',
    worker: false,
    ortOptions: { backend: 'wasm', numThreads: 1 },
  });
  const setupMs = performance.now() - start;
  try {
    const started = performance.now();
    const [result] = await engine.predict(image);
    if (!result || !Array.isArray(result.items)) throw new Error('PaddleOCR returned an unexpected result.');
    return { text: result.items.map((line: {text:string}) => line.text).join('\n'), setupMs, inferenceMs: performance.now() - started };
  } finally { await engine.dispose(); }
}
