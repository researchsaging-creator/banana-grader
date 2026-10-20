import type { ExportClass } from '../ml/types';

const LABEL: Record<ExportClass, string> = {
  Extra: 'Extra Class',
  'Class I': 'Class I',
  'Class II': 'Class II',
  Reject: 'Reject',
};

export function GradeBadge({ grade }: { grade: ExportClass }) {
  const slug = grade === 'Extra' ? 'extra' : grade === 'Class I' ? 'i' : grade === 'Class II' ? 'ii' : 'reject';
  return (
    <div className={`grade-badge grade-badge--${slug}`} role="status">
      <span className="grade-badge__eyebrow">Export grade</span>
      <span className="grade-badge__label">{LABEL[grade]}</span>
    </div>
  );
}
