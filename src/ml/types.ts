/** Shared metrics + grade types — CV heuristics and future ML both produce these. */

export type ExportClass = 'Extra' | 'Class I' | 'Class II' | 'Reject';

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export interface BananaMetrics {
  /** Von Loesecke stage 1–7 */
  stage: number;
  meanLab: LabColor;
  /** Hue angle in degrees (0–360), CIE Lab-derived */
  hue: number;
  /** Spatial std-dev of a* across peel samples (color uniformity) */
  colorVariance: number;
  /** Percent of masked peel area flagged as blemish (0–100) */
  blemishPercent: number;
  /** True if a large dark contiguous region suggests flesh-affecting bruise */
  hasSevereBruise: boolean;
  /** Fraction of image pixels included in banana mask (0–1) */
  maskCoverage: number;
}

export interface GradeResult {
  grade: ExportClass;
  reasons: string[];
  metrics: BananaMetrics;
  /** Which analyzer produced the metrics */
  source: 'heuristics' | 'model';
}

export type Analyzer = (imageData: ImageData, options?: AnalyzeOptions) => GradeResult;

export interface AnalyzeOptions {
  /** Optional rectangular ROI in image pixel coords */
  roi?: { x: number; y: number; width: number; height: number };
  /** Peel segmentation sensitivity 0–1 (higher = more permissive) */
  threshold?: number;
}
