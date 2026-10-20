import { gradeFromMetrics } from '../grading/gradeFromMetrics';
import type { AnalyzeOptions, BananaMetrics, GradeResult } from '../ml/types';
import { detectBlemishes } from './blemishes';
import { computePeelColorStats } from './color';
import { segmentBanana } from './segment';

/** Client-side CV pipeline → GradeResult */
export function analyzeWithHeuristics(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): GradeResult {
  const mask = segmentBanana(imageData, options);
  const color = computePeelColorStats(imageData, mask);
  const blemish = detectBlemishes(imageData, mask, color.meanLab);
  const maskCoverage = mask.length
    ? mask.reduce((s, v) => s + v, 0) / mask.length
    : 0;

  const metrics: BananaMetrics = {
    stage: color.stage,
    meanLab: color.meanLab,
    hue: color.hue,
    colorVariance: color.colorVariance,
    blemishPercent: blemish.blemishPercent,
    hasSevereBruise: blemish.hasSevereBruise,
    maskCoverage,
  };

  return gradeFromMetrics(metrics, 'heuristics');
}

export function analyzeBanana(
  imageData: ImageData,
  options: AnalyzeOptions = {},
): GradeResult {
  return analyzeWithHeuristics(imageData, options);
}
