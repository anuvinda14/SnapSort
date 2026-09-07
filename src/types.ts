export type ScreenshotStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface Screenshot {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  thumbnailUrl: string;
  createdAt: number;
  status: ScreenshotStatus;
  text: string;
  progress: number;
  error?: string;
  previousOcrText?: string;
  ocrMethod?: 'adaptive';
}

export interface OcrProgress {
  status: string;
  progress: number;
}
