import type { GradeResult } from '../ml/types';
import { GradeBadge } from './GradeBadge';

interface Props {
  dataUrl: string;
  result: GradeResult;
  onRetake: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export function ResultView({
  dataUrl,
  result,
  onRetake,
  showAdvanced,
  onToggleAdvanced,
}: Props) {
  const { metrics, grade, reasons, source } = result;

  return (
    <section className="panel result">
      <GradeBadge grade={grade} />

      <div className="result__photo">
        <img src={dataUrl} alt="Graded banana" />
      </div>

      <ul className="metrics">
        <li>
          <span>Ripeness stage</span>
          <strong>Stage {metrics.stage}</strong>
        </li>
        <li>
          <span>Blemish area</span>
          <strong>{metrics.blemishPercent.toFixed(1)}%</strong>
        </li>
        <li>
          <span>Color σ(a*)</span>
          <strong>{metrics.colorVariance.toFixed(1)}</strong>
        </li>
        <li>
          <span>Hue</span>
          <strong>{metrics.hue.toFixed(0)}°</strong>
        </li>
      </ul>

      <div className="reasons">
        <h3>Why this grade</h3>
        <ul>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <button type="button" className="linkish" onClick={onToggleAdvanced}>
        {showAdvanced ? 'Hide' : 'Show'} Lab readout &amp; source
      </button>

      {showAdvanced && (
        <dl className="advanced">
          <div>
            <dt>L*</dt>
            <dd>{metrics.meanLab.L.toFixed(1)}</dd>
          </div>
          <div>
            <dt>a*</dt>
            <dd>{metrics.meanLab.a.toFixed(1)}</dd>
          </div>
          <div>
            <dt>b*</dt>
            <dd>{metrics.meanLab.b.toFixed(1)}</dd>
          </div>
          <div>
            <dt>Mask coverage</dt>
            <dd>{(metrics.maskCoverage * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Analyzer</dt>
            <dd>{source}</dd>
          </div>
          <div>
            <dt>Severe bruise</dt>
            <dd>{metrics.hasSevereBruise ? 'yes' : 'no'}</dd>
          </div>
        </dl>
      )}

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onRetake}>
          Scan another
        </button>
      </div>
    </section>
  );
}
