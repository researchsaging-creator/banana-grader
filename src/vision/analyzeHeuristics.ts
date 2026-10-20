import type { AnalyzeOptions, GradeResult } from '../ml/types';
import { analyzeFast } from './pipeline';

export type TimedGradeResult = GradeResult & { analysisMs: number };

/** Client-side CV pipeline → GradeResult (optimized single-pass Lab). */
export function analyzeWithHeuristics(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): TimedGradeResult {
  return analyzeFast(imageData, options);
}

export function analyzeBanana(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): TimedGradeResult {
  return analyzeWithHeuristics(imageData, options);
}
