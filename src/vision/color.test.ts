import { describe, expect, it } from 'vitest';
import { labHue, labToStage, rgbToLab } from './color';
import { gradeFromMetrics } from '../grading/gradeFromMetrics';
import type { BananaMetrics } from '../ml/types';

describe('rgbToLab', () => {
  it('maps mid green toward negative a* and positive b*', () => {
    const lab = rgbToLab(60, 140, 50);
    expect(lab.a).toBeLessThan(-5);
    expect(lab.b).toBeGreaterThan(10);
    expect(lab.L).toBeGreaterThan(30);
    expect(lab.L).toBeLessThan(70);
  });

  it('maps yellow toward higher L* and less-negative / positive a*', () => {
    const green = rgbToLab(50, 120, 40);
    const yellow = rgbToLab(220, 200, 40);
    expect(yellow.L).toBeGreaterThan(green.L);
    expect(yellow.a).toBeGreaterThan(green.a);
    expect(yellow.b).toBeGreaterThan(30);
  });
});

describe('labToStage', () => {
  it('classifies deep green as stage 1 or 2', () => {
    const lab = rgbToLab(45, 110, 40);
    const stage = labToStage(lab, labHue(lab));
    expect(stage).toBeLessThanOrEqual(2);
  });

  it('classifies ripe yellow as stage >= 3', () => {
    const lab = rgbToLab(230, 210, 50);
    const stage = labToStage(lab, labHue(lab));
    expect(stage).toBeGreaterThanOrEqual(3);
  });
});

describe('gradeFromMetrics', () => {
  const base: BananaMetrics = {
    stage: 1,
    meanLab: { L: 42, a: -14, b: 24 },
    hue: 105,
    colorVariance: 2,
    blemishPercent: 0.4,
    hasSevereBruise: false,
    maskCoverage: 0.2,
  };

  it('grades clean green as Extra', () => {
    const r = gradeFromMetrics(base);
    expect(r.grade).toBe('Extra');
  });

  it('rejects stage >= 3', () => {
    const r = gradeFromMetrics({ ...base, stage: 4 });
    expect(r.grade).toBe('Reject');
    expect(r.reasons[0]).toMatch(/Stage 4/);
  });

  it('assigns Class I for slight blemish', () => {
    const r = gradeFromMetrics({ ...base, blemishPercent: 3 });
    expect(r.grade).toBe('Class I');
  });

  it('assigns Class II for moderate blemish', () => {
    const r = gradeFromMetrics({ ...base, blemishPercent: 7 });
    expect(r.grade).toBe('Class II');
  });

  it('rejects heavy blemish', () => {
    const r = gradeFromMetrics({ ...base, blemishPercent: 15 });
    expect(r.grade).toBe('Reject');
  });

  it('takes stricter of color variance and blemish', () => {
    const r = gradeFromMetrics({
      ...base,
      blemishPercent: 0.2,
      colorVariance: 10,
    });
    expect(r.grade).toBe('Class II');
  });
});
