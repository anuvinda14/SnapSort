export async function runPaddle(_image: Blob): Promise<{text:string; setupMs:number; inferenceMs:number}> {
  throw new Error('PaddleOCR is not installed in this build. Run pnpm setup:paddle in the project terminal, then restart the development server (or rebuild).');
}
