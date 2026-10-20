import { CRITERIA } from '../grading/criteria';
import { gradeFromMetrics } from '../grading/gradeFromMetrics';
import type { AnalyzeOptions, BananaMetrics, GradeResult, LabColor } from '../ml/types';
import { labHue, labToStage } from './color';
import { writeLab } from './labBuffers';

export interface Roi {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Target width for grading — enough detail, much faster than 640+. */
export const ANALYZE_MAX_WIDTH = 360;

function clampRoi(roi: Roi, width: number, height: number): Roi {
  const x = Math.max(0, Math.min(width - 1, Math.floor(roi.x)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(roi.y)));
  const w = Math.max(1, Math.min(width - x, Math.floor(roi.width)));
  const h = Math.max(1, Math.min(height - y, Math.floor(roi.height)));
  return { x, y, width: w, height: h };
}

function peelBounds(t: number) {
  return {
    aMax: CRITERIA.peel.aMax + (1 - t) * -8 + t * 12,
    bMin: CRITERIA.peel.bMin - t * 4,
    LMin: CRITERIA.peel.LMin - t * 5,
    LMax: CRITERIA.peel.LMax + t * 5,
  };
}

/** Shrink image for analysis (keeps aspect). No-op if already small or no canvas. */
export function downscaleForAnalyze(
  imageData: ImageData,
  maxWidth = ANALYZE_MAX_WIDTH,
): ImageData {
  if (imageData.width <= maxWidth) return imageData;
  if (typeof document === 'undefined') return imageData;
  const scale = maxWidth / imageData.width;
  const w = Math.round(imageData.width * scale);
  const h = Math.round(imageData.height * scale);
  const src = document.createElement('canvas');
  src.width = imageData.width;
  src.height = imageData.height;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  if (!sctx) return imageData;
  sctx.putImageData(imageData, 0, 0);
  const dst = document.createElement('canvas');
  dst.width = w;
  dst.height = h;
  const dctx = dst.getContext('2d', { willReadFrequently: true });
  if (!dctx) return imageData;
  dctx.drawImage(src, 0, 0, w, h);
  return dctx.getImageData(0, 0, w, h);
}

/**
 * Single-pass style pipeline: Lab once → mask → stats + blemish.
 * Typically 3–10× faster than separate segment/color/blemish RGB→Lab loops.
 */
export function analyzeFast(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): GradeResult & { analysisMs: number } {
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  const src = downscaleForAnalyze(imageData);
  const { data, width, height } = src;
  const nPix = width * height;
  const t = options.threshold ?? 0.55;
  const roi = options.roi
    ? scaleRoi(options.roi, imageData.width, width)
    : { x: 0, y: 0, width, height };
  const box = clampRoi(roi, width, height);
  const { aMax, bMin, LMin, LMax } = peelBounds(t);

  const L = new Float32Array(nPix);
  const A = new Float32Array(nPix);
  const B = new Float32Array(nPix);
  let mask = new Uint8Array(nPix);

  const x1 = box.x + box.width;
  const y1 = box.y + box.height;

  // Pass 1: Lab + peel mask (ROI only)
  for (let y = box.y; y < y1; y++) {
    const row = y * width;
    for (let x = box.x; x < x1; x++) {
      const i = row + x;
      const o = i << 2;
      if (data[o + 3] < 128) continue;
      writeLab(L, A, B, i, data[o], data[o + 1], data[o + 2]);
      const l = L[i];
      const a = A[i];
      const b = B[i];
      const chroma2 = a * a + b * b;
      if (
        l >= LMin &&
        l <= LMax &&
        a <= aMax &&
        b >= bMin &&
        chroma2 > 64
      ) {
        mask[i] = 1;
      }
    }
  }

  mask = quickCleanMask(mask, width, height);

  // Pass 2: mean Lab + coverage
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let maskCount = 0;
  for (let i = 0; i < nPix; i++) {
    if (!mask[i]) continue;
    maskCount++;
    sumL += L[i];
    sumA += A[i];
    sumB += B[i];
  }

  const maskCoverage = nPix ? maskCount / nPix : 0;

  if (maskCount === 0) {
    const empty: BananaMetrics = {
      stage: 1,
      meanLab: { L: 0, a: 0, b: 0 },
      hue: 0,
      colorVariance: 0,
      blemishPercent: 0,
      hasSevereBruise: false,
      maskCoverage: 0,
    };
    const graded = gradeFromMetrics(empty, 'heuristics');
    return { ...graded, analysisMs: elapsed(t0) };
  }

  const meanLab: LabColor = {
    L: sumL / maskCount,
    a: sumA / maskCount,
    b: sumB / maskCount,
  };
  const hue = labHue(meanLab);
  const stage = labToStage(meanLab, hue);

  // Pass 3: variance + blemish (reuse Lab)
  const { deltaL, aBoost, severeBruiseFraction } = CRITERIA.blemishDetect;
  const blemishMask = new Uint8Array(nPix);
  let defectCount = 0;
  let varSum = 0;
  const meanA = meanLab.a;

  for (let i = 0; i < nPix; i++) {
    if (!mask[i]) continue;
    const da = A[i] - meanA;
    varSum += da * da;
    const l = L[i];
    const a = A[i];
    const b = B[i];
    const darker = meanLab.L - l >= deltaL;
    const browner = a - meanLab.a >= aBoost && l < meanLab.L - 8;
    const blackSpot = l < 28 && a * a + b * b < 625;
    if (darker || browner || blackSpot) {
      blemishMask[i] = 1;
      defectCount++;
    }
  }

  const colorVariance = Math.sqrt(varSum / maskCount);
  const blemishPercent = (defectCount / maskCount) * 100;

  // Only flood-fill when defects are large enough to matter
  let hasSevereBruise = false;
  if (defectCount / maskCount >= severeBruiseFraction * 0.5) {
    const largest = largestBlob(blemishMask, mask, width, height);
    hasSevereBruise = largest / maskCount >= severeBruiseFraction;
  }

  const metrics: BananaMetrics = {
    stage,
    meanLab,
    hue,
    colorVariance,
    blemishPercent,
    hasSevereBruise,
    maskCoverage,
  };

  const graded = gradeFromMetrics(metrics, 'heuristics');
  return { ...graded, analysisMs: elapsed(t0) };
}

function elapsed(t0: number): number {
  const t1 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.round(t1 - t0);
}

function scaleRoi(roi: Roi, fromWidth: number, toWidth: number): Roi {
  if (fromWidth === toWidth) return roi;
  const s = toWidth / fromWidth;
  return {
    x: roi.x * s,
    y: roi.y * s,
    width: roi.width * s,
    height: roi.height * s,
  };
}

/** Cheap open: clear isolated pixels (1 pass, in-place neighbor check). */
function quickCleanMask(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      // Keep if ≥3 of 4-neighbors are peel (noise killer, cheap)
      const n =
        mask[i - 1] + mask[i + 1] + mask[i - width] + mask[i + width];
      if (n >= 3) out[i] = 1;
    }
  }
  return out;
}

function largestBlob(
  blemish: Uint8Array,
  peel: Uint8Array,
  width: number,
  height: number,
): number {
  const visited = new Uint8Array(blemish.length);
  const stack = new Int32Array(blemish.length);
  let largest = 0;

  for (let start = 0; start < blemish.length; start++) {
    if (!blemish[start] || !peel[start] || visited[start]) continue;
    let size = 0;
    let sp = 0;
    stack[sp++] = start;
    visited[start] = 1;

    while (sp) {
      const i = stack[--sp];
      size++;
      const x = i % width;
      const y = (i / width) | 0;
      // left
      if (x > 0) {
        const n = i - 1;
        if (blemish[n] && peel[n] && !visited[n]) {
          visited[n] = 1;
          stack[sp++] = n;
        }
      }
      // right
      if (x + 1 < width) {
        const n = i + 1;
        if (blemish[n] && peel[n] && !visited[n]) {
          visited[n] = 1;
          stack[sp++] = n;
        }
      }
      // up
      if (y > 0) {
        const n = i - width;
        if (blemish[n] && peel[n] && !visited[n]) {
          visited[n] = 1;
          stack[sp++] = n;
        }
      }
      // down
      if (y + 1 < height) {
        const n = i + width;
        if (blemish[n] && peel[n] && !visited[n]) {
          visited[n] = 1;
          stack[sp++] = n;
        }
      }
    }
    if (size > largest) largest = size;
  }
  return largest;
}

/** Fast peel mask for UI preview (no full morph open). */
export function segmentBananaFast(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): Uint8Array {
  const { data, width, height } = imageData;
  const nPix = width * height;
  const t = options.threshold ?? 0.55;
  const box = options.roi
    ? clampRoi(options.roi, width, height)
    : { x: 0, y: 0, width, height };
  const { aMax, bMin, LMin, LMax } = peelBounds(t);
  const mask = new Uint8Array(nPix);
  const L = new Float32Array(1);
  const A = new Float32Array(1);
  const B = new Float32Array(1);

  const x1 = box.x + box.width;
  const y1 = box.y + box.height;
  // Stride 2 for preview overlay — ~4× fewer Lab conversions
  const stride = width > 280 ? 2 : 1;

  for (let y = box.y; y < y1; y += stride) {
    for (let x = box.x; x < x1; x += stride) {
      const i = y * width + x;
      const o = i << 2;
      if (data[o + 3] < 128) continue;
      writeLab(L, A, B, 0, data[o], data[o + 1], data[o + 2]);
      const l = L[0];
      const a = A[0];
      const b = B[0];
      if (
        l >= LMin &&
        l <= LMax &&
        a <= aMax &&
        b >= bMin &&
        a * a + b * b > 64
      ) {
        mask[i] = 1;
        if (stride === 2) {
          if (x + 1 < x1) mask[i + 1] = 1;
          if (y + 1 < y1) mask[i + width] = 1;
          if (x + 1 < x1 && y + 1 < y1) mask[i + width + 1] = 1;
        }
      }
    }
  }
  return mask;
}

/** Tint mask onto a copy — skips non-mask pixels early. */
export function maskToOverlayFast(
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
  const inv = 1 - a / 255;
  const ar = (r * a) / 255;
  const ag = (g * a) / 255;
  const ab = (b * a) / 255;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const o = i << 2;
    d[o] = (d[o] * inv + ar) | 0;
    d[o + 1] = (d[o + 1] * inv + ag) | 0;
    d[o + 2] = (d[o + 2] * inv + ab) | 0;
  }
  return out;
}
