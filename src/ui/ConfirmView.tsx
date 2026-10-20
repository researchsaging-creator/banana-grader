import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { maskToOverlay, segmentBanana } from '../vision/segment';
import type { Roi } from '../vision/segment';

interface Props {
  dataUrl: string;
  imageData: ImageData;
  threshold: number;
  onThreshold: (v: number) => void;
  roi: Roi | null;
  onRoi: (roi: Roi | null) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export function ConfirmView({
  dataUrl,
  imageData,
  threshold,
  onThreshold,
  roi,
  onRoi,
  onAnalyze,
  onBack,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mask = segmentBanana(imageData, { threshold, roi: roi ?? undefined });
    const overlay = maskToOverlay(imageData, mask);
    ctx.putImageData(overlay, 0, 0);

    if (roi) {
      ctx.strokeStyle = '#f0e6c8';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);
      ctx.setLineDash([]);
    }
  }, [imageData, threshold, roi]);

  function canvasPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  return (
    <section className="panel confirm">
      <header className="panel__header">
        <h2>Check the banana</h2>
        <ol className="steps">
          <li>
            Look for a <strong>green tint</strong> on the peel — that is what the app will
            grade.
          </li>
          <li>
            If the tint covers too much (or too little), drag a box around <strong>one
            banana only</strong>.
          </li>
          <li>
            Use the slider if needed, then tap <strong>Grade banana</strong>.
          </li>
        </ol>
      </header>

      <div className="preview-wrap">
        <img src={dataUrl} alt="Captured banana" className="preview-bg" />
        <canvas
          ref={canvasRef}
          className="preview-canvas"
          onPointerDown={(e) => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            dragStart.current = canvasPoint(e);
            onRoi(null);
          }}
          onPointerMove={(e) => {
            if (!dragStart.current) return;
            const p = canvasPoint(e);
            const x = Math.min(dragStart.current.x, p.x);
            const y = Math.min(dragStart.current.y, p.y);
            const width = Math.abs(p.x - dragStart.current.x);
            const height = Math.abs(p.y - dragStart.current.y);
            if (width > 8 && height > 8) onRoi({ x, y, width, height });
          }}
          onPointerUp={() => {
            dragStart.current = null;
          }}
        />
      </div>

      <label className="slider">
        <span>
          Detect more peel ← → Detect less peel
        </span>
        <input
          type="range"
          min={0.2}
          max={0.9}
          step={0.05}
          value={threshold}
          onChange={(e) => onThreshold(Number(e.target.value))}
          aria-label="How much green peel to detect"
        />
      </label>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onAnalyze}>
          Grade banana
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onRoi(null)}
        >
          Clear box
        </button>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Take new photo
        </button>
      </div>
    </section>
  );
}
