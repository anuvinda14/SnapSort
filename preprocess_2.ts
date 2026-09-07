/**
 * Client-side, canvas-based preprocessing for OCR: adaptive (local)
 * thresholding and color-based annotation masking. No new dependency --
 * built entirely on the Canvas 2D API already used in image.ts (see
 * makeThumbnail there for the same draw-to-canvas pattern).
 *
 * Tesseract.js's worker.recognize() accepts an HTMLCanvasElement directly
 * (in addition to a Blob), so this pipeline stays entirely in-memory:
 * draw -> read pixels -> mask/threshold -> write pixels back -> hand the
 * SAME canvas to recognize(). No Blob re-encoding round-trip needed.
 *
 * Drop this file in alongside ocr.ts / image.ts.
 */

export interface PreprocessOptions {
  satThresh?: number; // 0-255, HSV saturation cutoff for annotation detection
  valThresh?: number; // 0-255, minimum brightness to still count as "real" content
  blockSize?: number; // odd number, adaptive threshold neighborhood size (px)
  c?: number; // constant subtracted from the local mean
}

const DEFAULTS: Required<PreprocessOptions> = {
  satThresh: 90,
  valThresh: 60,
  blockSize: 31,
  c: 10,
};

/** Loads a Blob onto a canvas. Same pattern as makeThumbnail in image.ts. */
async function blobToCanvas(
  blob: Blob
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    // willReadFrequently hints the browser to keep this on the CPU path,
    // since we're about to do a getImageData/putImageData round trip.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);
    return { canvas, ctx };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** RGB (0-255 each) -> HSV, with s/v scaled to 0-255 to match OpenCV's convention. */
function rgbToHsv(r: number, g: number, b: number): [h: number, s: number, v: number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : (delta / max) * 255;
  const v = max * 255;
  return [h, s, v];
}

/**
 * Boolean-ish mask (1 = annotation, 0 = native content) of pixels that look
 * like manual markup rather than UI content -- ported from the Python
 * build_annotation_mask. Screenshots are dominated by low-saturation UI
 * chrome; highlighter/marker colors are almost always highly saturated,
 * which is the gap this exploits.
 */
export function buildAnnotationMask(imageData: ImageData, opts: PreprocessOptions = {}): Uint8Array {
  const { satThresh, valThresh } = { ...DEFAULTS, ...opts };
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const [, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    mask[p] = s > satThresh && v > valThresh ? 1 : 0;
  }
  return mask;
}

/**
 * Adaptive (local) mean thresholding via an integral image (summed-area
 * table), so each pixel's local-neighborhood mean is an O(1) lookup instead
 * of re-summing a window per pixel. This is what keeps it fast enough to
 * run on a full screenshot rather than only a small crop.
 */
export function adaptiveThreshold(imageData: ImageData, opts: PreprocessOptions = {}): Uint8ClampedArray {
  const { blockSize, c } = { ...DEFAULTS, ...opts };
  const { data, width, height } = imageData;

  const gray = new Float64Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 1px-padded integral image for simple inclusive-range sums.
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
    }
  }

  const radius = Math.floor(blockSize / 2);
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(width - 1, x + radius);
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      const sum =
        integral[(y1 + 1) * stride + (x1 + 1)] -
        integral[y0 * stride + (x1 + 1)] -
        integral[(y1 + 1) * stride + x0] +
        integral[y0 * stride + x0];
      const localMean = sum / area;
      out[y * width + x] = gray[y * width + x] > localMean - c ? 255 : 0;
    }
  }
  return out;
}

/**
 * Fills masked (annotation) pixels with the average of nearby non-masked
 * pixels. A lightweight stand-in for cv.inpaint -- good enough for THIN
 * strokes (highlighter edges, circle/underline outlines), which is most of
 * what real screenshots hit. Not a substitute for real inpainting over
 * large solid blocks; reach for OpenCV.js's cv.inpaint if that case matters
 * for your users.
 */
export function fillMaskedPixels(imageData: ImageData, mask: Uint8Array, radius = 4): void {
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const np = ny * width + nx;
          if (mask[np]) continue; // don't average in other annotation pixels
          const i = np * 4;
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
          count++;
        }
      }
      if (count > 0) {
        const i = p * 4;
        data[i] = rSum / count;
        data[i + 1] = gSum / count;
        data[i + 2] = bSum / count;
      }
    }
  }
}

/**
 * Full pipeline: draws the screenshot to a canvas, fills in annotation-
 * colored pixels, applies adaptive thresholding, and returns a canvas ready
 * to hand straight to Tesseract's worker.recognize().
 */
export async function preprocessForOcr(
  blob: Blob,
  opts: PreprocessOptions = {}
): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await blobToCanvas(blob);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const mask = buildAnnotationMask(imageData, opts);
  if (mask.some(Boolean)) {
    fillMaskedPixels(imageData, mask);
  }

  const thresholded = adaptiveThreshold(imageData, opts);
  for (let p = 0; p < thresholded.length; p++) {
    const v = thresholded[p];
    const i = p * 4;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Example wiring into ocr.ts's existing recognize(), confidence-gated so the
 * preprocessing cost is only paid when the raw pass actually looks weak.
 * Tesseract.js's result includes data.confidence (0-100 mean confidence) --
 * use that instead of a hand-rolled word-count check where available.
 *
 *   import { recognize } from './ocr';
 *   import { preprocessForOcr } from './preprocess';
 *
 *   export async function recognizeWithFallback(blob: Blob): Promise<string> {
 *     const rawText = await recognize(blob);
 *     if (rawText.split(/\s+/).filter(Boolean).length >= 3) {
 *       return rawText; // good enough, skip the extra pass
 *     }
 *     const canvas = await preprocessForOcr(blob);
 *     const preprocessedText = await recognize(canvas); // note: ocr.ts's
 *       // recognize() type signature needs widening to accept
 *       // Blob | HTMLCanvasElement, since worker.recognize() already does
 *     return preprocessedText.length > rawText.length ? preprocessedText : rawText;
 *   }
 *
 * Note on where this runs: blobToCanvas above uses document/Image, which
 * are main-thread DOM APIs -- fine, since image.ts's makeThumbnail already
 * runs the identical pattern on the main thread today. If profiling shows
 * the per-pixel loops (adaptiveThreshold / fillMaskedPixels) janking the UI
 * on large screenshots, the fix is to move this file into a dedicated
 * worker and swap document.createElement('canvas')/new Image() for
 * OffscreenCanvas + createImageBitmap(blob), which are the worker-safe
 * equivalents -- the pixel-manipulation functions themselves don't change.
 */
