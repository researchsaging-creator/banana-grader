import type { AnalyzeOptions } from '../ml/types';
import {
  maskToOverlayFast,
  segmentBananaFast,
  type Roi,
} from './pipeline';

export type { Roi };

/** Peel mask (fast path used by UI + grading). */
export function segmentBanana(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): Uint8Array {
  return segmentBananaFast(imageData, options);
}

export function maskToOverlay(
  imageData: ImageData,
  mask: Uint8Array,
  rgba: [number, number, number, number] = [46, 125, 70, 90],
): ImageData {
  return maskToOverlayFast(imageData, mask, rgba);
}
