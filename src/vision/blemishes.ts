import { CRITERIA } from '../grading/criteria';
import { rgbToLab } from './color';
import type { LabColor } from '../ml/types';

export interface BlemishResult {
  blemishPercent: number;
  hasSevereBruise: boolean;
  blemishMask: Uint8Array;
  defectCount: number;
}

/**
 * Flag dark / brown peel outliers vs mean peel Lab.
 * Severe bruise = largest contiguous dark blob > fraction of mask.
 */
export function detectBlemishes(
  imageData: ImageData,
  mask: Uint8Array,
  meanLab: LabColor,
): BlemishResult {
  const { data, width, height } = imageData;
  const blemishMask = new Uint8Array(width * height);
  const { deltaL, aBoost, severeBruiseFraction } = CRITERIA.blemishDetect;

  let maskCount = 0;
  let defectCount = 0;

  for (let i = 0; i < width * height; i++) {
    if (!mask[i]) continue;
    maskCount++;
    const o = i * 4;
    const lab = rgbToLab(data[o], data[o + 1], data[o + 2]);
    const darker = meanLab.L - lab.L >= deltaL;
    const browner = lab.a - meanLab.a >= aBoost && lab.L < meanLab.L - 8;
    // Near-black spots
    const blackSpot = lab.L < 28 && Math.hypot(lab.a, lab.b) < 25;

    if (darker || browner || blackSpot) {
      blemishMask[i] = 1;
      defectCount++;
    }
  }

  const blemishPercent = maskCount === 0 ? 0 : (defectCount / maskCount) * 100;
  const largestBlob = largestComponent(blemishMask, mask, width);
  const hasSevereBruise =
    maskCount > 0 && largestBlob / maskCount >= severeBruiseFraction;

  return { blemishPercent, hasSevereBruise, blemishMask, defectCount };
}

function largestComponent(
  blemish: Uint8Array,
  peel: Uint8Array,
  width: number,
): number {
  const visited = new Uint8Array(blemish.length);
  let largest = 0;

  const stack: number[] = [];

  for (let start = 0; start < blemish.length; start++) {
    if (!blemish[start] || !peel[start] || visited[start]) continue;
    let size = 0;
    stack.push(start);
    visited[start] = 1;

    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % width;
      const y = (i / width) | 0;
      const neighbors = [i - 1, i + 1, i - width, i + width];
      for (const n of neighbors) {
        if (n < 0 || n >= blemish.length || visited[n]) continue;
        const nx = n % width;
        const ny = (n / width) | 0;
        // 4-connected, stay in bounds without wrap
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        if (blemish[n] && peel[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (size > largest) largest = size;
  }

  return largest;
}
