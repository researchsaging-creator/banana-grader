import type { AnalyzeOptions, GradeResult } from './types';

/**
 * Stub for a future TensorFlow.js (or similar) model.
 * Keep the same signature as analyzeWithHeuristics so the UI can swap analyzers.
 */
export async function predictWithModel(
  _imageData: ImageData,
  _options: AnalyzeOptions = {},
): Promise<GradeResult> {
  throw new Error(
    'ML model not loaded — train a model on labeled peel crops and wire weights here. Use analyzeWithHeuristics until then.',
  );
}

export const MODEL_READY = false;
