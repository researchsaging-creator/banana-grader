import { CRITERIA } from '../grading/criteria';
import { rgbToLab } from './color';
import type { AnalyzeOptions } from '../ml/types';

export interface Roi {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clampRoi(roi: Roi, width: number, height: number): Roi {
  const x = Math.max(0, Math.min(width - 1, Math.floor(roi.x)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(roi.y)));
  const w = Math.max(1, Math.min(width - x, Math.floor(roi.width)));
  const h = Math.max(1, Math.min(height - y, Math.floor(roi.height)));
  return { x, y, width: w, height: h };
}

/**
 * Build a banana peel mask using Lab thresholds (green peel bias).
 * `threshold` 0–1: higher includes more yellow/lighter pixels.
 */
export function segmentBanana(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): Uint8Array {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  const t = options.threshold ?? 0.55;
  const roi = options.roi
    ? clampRoi(options.roi, width, height)
    : { x: 0, y: 0, width, height };

  // Soften peel bounds with threshold
  const aMax = CRITERIA.peel.aMax + (1 - t) * -8 + t * 12; // ~ -3 .. 17
  const bMin = CRITERIA.peel.bMin - t * 4;
  const LMin = CRITERIA.peel.LMin - t * 5;
  const LMax = CRITERIA.peel.LMax + t * 5;

  const x1 = roi.x + roi.width;
  const y1 = roi.y + roi.height;

  for (let y = roi.y; y < y1; y++) {
    for (let x = roi.x; x < x1; x++) {
      const i = y * width + x;
      const o = i * 4;
      const alpha = data[o + 3];
      if (alpha < 128) continue;

      const lab = rgbToLab(data[o], data[o + 1], data[o + 2]);
      // Green-to-yellow peel: not too red, enough yellow chroma, mid lightness
      const isPeel =
        lab.L >= LMin &&
        lab.L <= LMax &&
        lab.a <= aMax &&
        lab.b >= bMin &&
        // Exclude near-gray / blue backgrounds
        Math.hypot(lab.a, lab.b) > 8;

      if (isPeel) mask[i] = 1;
    }
  }

  // Light morphological cleanup: remove isolated pixels
  return erodeDilate(mask, width, height);
}

function erodeDilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const tmp = new Uint8Array(mask.length);
  // Erode
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (
        mask[i] &&
        mask[i - 1] &&
        mask[i + 1] &&
        mask[i - width] &&
        mask[i + width]
      ) {
        tmp[i] = 1;
      }
    }
  }
  // Dilate
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (
        tmp[i] ||
        tmp[i - 1] ||
        tmp[i + 1] ||
        tmp[i - width] ||
        tmp[i + width]
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

/** Overlay mask as semi-transparent green for UI preview */
export function maskToOverlay(
  imageData: ImageData,
  mask: Uint8Array,
  rgba: [number, number, number, number] = [46, 125, 70, 90],
): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );
  const d = out.data;
  const [r, g, b, a] = rgba;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const alpha = a / 255;
    d[o] = Math.round(d[o] * (1 - alpha) + r * alpha);
    d[o + 1] = Math.round(d[o + 1] * (1 - alpha) + g * alpha);
    d[o + 2] = Math.round(d[o + 2] * (1 - alpha) + b * alpha);
  }
  return out;
}
