/**
 * Field-tunable export grading thresholds.
 * Based on Von Loesecke color stages + Philippine packing-plant style % blemish rules.
 */

export const CRITERIA = {
  /** Stages allowed for export packing (green life). Stage ≥ 3 → Reject. */
  maxExportStage: 2,

  /** Blemish % of finger surface */
  blemish: {
    extraMax: 1,
    classIMax: 5,
    classIIMax: 10,
  },

  /**
   * Color variance (std-dev of a* on peel).
   * Lower = more uniform green coloring.
   */
  colorVariance: {
    extraMax: 4,
    classIMax: 8,
    classIIMax: 14,
  },

  /**
   * Approximate Lab/hue anchors for Von Loesecke stages (peel mean).
   * Used as reference when mapping continuous Lab → discrete stage.
   */
  stageAnchors: [
    // stage, L, a, b, hue
    { stage: 1, L: 40, a: -16, b: 22, hue: 110 },
    { stage: 2, L: 48, a: -12, b: 30, hue: 100 },
    { stage: 3, L: 55, a: -4, b: 42, hue: 85 },
    { stage: 4, L: 62, a: 2, b: 52, hue: 70 },
    { stage: 5, L: 68, a: 6, b: 58, hue: 50 },
    { stage: 6, L: 72, a: 10, b: 62, hue: 35 },
    { stage: 7, L: 70, a: 8, b: 55, hue: 40 },
  ] as const,

  /** Green export hue band (degrees) */
  greenHueMin: 80,
  greenHueMax: 120,

  /** Segmentation: Lab a* upper bound for green peel candidates */
  peel: {
    aMax: 5,
    bMin: 8,
    LMin: 25,
    LMax: 85,
  },

  /** Blemish detection relative to peel mean L* */
  blemishDetect: {
    /** Pixels darker than mean L by this amount are candidate defects */
    deltaL: 18,
    /** a* above this (less green / more red-brown) helps flag scars */
    aBoost: 4,
    /** Contiguous dark region larger than this fraction of mask → severe bruise */
    severeBruiseFraction: 0.03,
  },
} as const;

export type Criteria = typeof CRITERIA;
