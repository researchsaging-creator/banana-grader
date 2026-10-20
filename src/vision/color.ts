import { CRITERIA } from '../grading/criteria';
import type { LabColor } from '../ml/types';
import { rgbToLabFast } from './labBuffers';

export function rgbToLab(r: number, g: number, b: number): LabColor {
  return rgbToLabFast(r, g, b);
}

/** CIE Lab hue angle in degrees [0, 360) */
export function labHue(lab: LabColor): number {
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return h;
}

/**
 * Map peel mean Lab (+ hue) to Von Loesecke stage 1–7
 * by nearest weighted distance to stage anchors.
 */
export function labToStage(lab: LabColor, hue = labHue(lab)): number {
  const anchors = CRITERIA.stageAnchors;
  let best: number = anchors[0].stage;
  let bestDist = Infinity;

  for (const a of anchors) {
    const dL = lab.L - a.L;
    const da = lab.a - a.a;
    const db = lab.b - a.b;
    let dh = hue - a.hue;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    // Weight a* and hue more — primary green→yellow signals
    const dist = Math.sqrt(0.5 * dL * dL + 2 * da * da + db * db + 0.8 * dh * dh);
    if (dist < bestDist) {
      bestDist = dist;
      best = a.stage;
    }
  }

  // Hard rule: strongly yellow (positive a*, high b*, low hue) cannot be stage 1–2
  if (lab.a > 0 && lab.b > 45 && hue < 75 && best <= 2) {
    return 3;
  }

  return best;
}

export interface PeelColorStats {
  meanLab: LabColor;
  hue: number;
  /** Std-dev of a* across samples */
  colorVariance: number;
  stage: number;
  sampleCount: number;
}

/**
 * Aggregate Lab stats from masked pixels.
 * `mask` is 0/1 per pixel (length = width*height).
 */
export function computePeelColorStats(
  imageData: ImageData,
  mask: Uint8Array,
): PeelColorStats {
  const { data, width, height } = imageData;
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  const aSamples: number[] = [];
  let n = 0;

  for (let i = 0; i < width * height; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    const lab = rgbToLab(data[o], data[o + 1], data[o + 2]);
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    aSamples.push(lab.a);
    n++;
  }

  if (n === 0) {
    return {
      meanLab: { L: 0, a: 0, b: 0 },
      hue: 0,
      colorVariance: 0,
      stage: 1,
      sampleCount: 0,
    };
  }

  const meanLab: LabColor = { L: sumL / n, a: sumA / n, b: sumB / n };
  const hue = labHue(meanLab);
  const meanA = meanLab.a;
  let varSum = 0;
  for (const a of aSamples) {
    const d = a - meanA;
    varSum += d * d;
  }
  const colorVariance = Math.sqrt(varSum / n);
  const stage = labToStage(meanLab, hue);

  return { meanLab, hue, colorVariance, stage, sampleCount: n };
}
