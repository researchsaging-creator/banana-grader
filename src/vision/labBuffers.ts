import type { LabColor } from '../ml/types';

/** Precomputed sRGB 0–255 → linear (avoids pow per channel per pixel). */
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const s = i / 255;
  SRGB_TO_LINEAR[i] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

const DELTA = 6 / 29;
const DELTA3 = DELTA ** 3;
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

function labF(t: number): number {
  return t > DELTA3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29;
}

/** Fast RGB → Lab without intermediate objects. */
export function rgbToLabFast(
  r: number,
  g: number,
  b: number,
): LabColor {
  const R = SRGB_TO_LINEAR[r];
  const G = SRGB_TO_LINEAR[g];
  const B = SRGB_TO_LINEAR[b];
  const x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  const fx = labF(x / Xn);
  const fy = labF(y / Yn);
  const fz = labF(z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Write Lab into parallel buffers at index i. */
export function writeLab(
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  i: number,
  r: number,
  g: number,
  b: number,
): void {
  const Rl = SRGB_TO_LINEAR[r];
  const Gl = SRGB_TO_LINEAR[g];
  const Bl = SRGB_TO_LINEAR[b];
  const x = Rl * 0.4124564 + Gl * 0.3575761 + Bl * 0.1804375;
  const y = Rl * 0.2126729 + Gl * 0.7151522 + Bl * 0.072175;
  const z = Rl * 0.0193339 + Gl * 0.119192 + Bl * 0.9503041;
  const fx = labF(x / Xn);
  const fy = labF(y / Yn);
  const fz = labF(z / Zn);
  L[i] = 116 * fy - 16;
  A[i] = 500 * (fx - fy);
  B[i] = 200 * (fy - fz);
}
