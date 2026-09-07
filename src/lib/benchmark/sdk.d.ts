declare module '@paddleocr/paddleocr-js' {
  export const PaddleOCR: { create(options: unknown): Promise<{ predict(image: Blob): Promise<Array<{items:Array<{text:string}>}>>; dispose(): void | Promise<void> }> };
}
declare module '@snapsort/paddle-engine' {
  export function runPaddle(image: Blob): Promise<{text:string;setupMs:number;inferenceMs:number}>;
}
