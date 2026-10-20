import { CRITERIA } from './criteria';
import type { BananaMetrics, ExportClass, GradeResult } from '../ml/types';

function classFromBlemish(pct: number): ExportClass {
  const { extraMax, classIMax, classIIMax } = CRITERIA.blemish;
  if (pct < extraMax) return 'Extra';
  if (pct <= classIMax) return 'Class I';
  if (pct <= classIIMax) return 'Class II';
  return 'Reject';
}

function classFromVariance(v: number): ExportClass {
  const { extraMax, classIMax, classIIMax } = CRITERIA.colorVariance;
  if (v <= extraMax) return 'Extra';
  if (v <= classIMax) return 'Class I';
  if (v <= classIIMax) return 'Class II';
  return 'Reject';
}

const RANK: Record<ExportClass, number> = {
  Extra: 0,
  'Class I': 1,
  'Class II': 2,
  Reject: 3,
};

function stricter(a: ExportClass, b: ExportClass): ExportClass {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Pure grading rules: ripeness reject first, then stricter of blemish vs color uniformity.
 */
export function gradeFromMetrics(
  metrics: BananaMetrics,
  source: GradeResult['source'] = 'heuristics',
): GradeResult {
  const reasons: string[] = [];

  if (metrics.maskCoverage < 0.02) {
    return {
      grade: 'Reject',
      reasons: ['No banana peel detected — adjust framing or threshold'],
      metrics,
      source,
    };
  }

  if (metrics.stage > CRITERIA.maxExportStage) {
    reasons.push(
      `Stage ${metrics.stage} yellowing / early ripening — packing requires Stage 1–2`,
    );
    return { grade: 'Reject', reasons, metrics, source };
  }

  if (metrics.hasSevereBruise) {
    reasons.push('Large dark bruise region — may affect flesh');
    return { grade: 'Reject', reasons, metrics, source };
  }

  const byBlemish = classFromBlemish(metrics.blemishPercent);
  const byColor = classFromVariance(metrics.colorVariance);
  const grade = stricter(byBlemish, byColor);

  reasons.push(
    `Von Loesecke Stage ${metrics.stage} (L*${metrics.meanLab.L.toFixed(0)} a*${metrics.meanLab.a.toFixed(1)} b*${metrics.meanLab.b.toFixed(0)}, hue ${metrics.hue.toFixed(0)}°)`,
  );
  reasons.push(
    `Blemish ${metrics.blemishPercent.toFixed(1)}% → ${byBlemish}`,
  );
  reasons.push(
    `Color variance σ(a*)=${metrics.colorVariance.toFixed(1)} → ${byColor}`,
  );

  if (grade !== byBlemish || grade !== byColor) {
    reasons.push(`Final class limited by stricter metric → ${grade}`);
  }

  return { grade, reasons, metrics, source };
}
