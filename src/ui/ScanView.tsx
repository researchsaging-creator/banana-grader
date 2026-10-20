import { useRef, type RefObject } from 'react';
import type { CameraState } from '../camera/useCamera';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  camera: CameraState;
  onStartCamera: () => void;
  onCapture: () => void;
  onUpload: (file: File) => void;
}

export function ScanView({
  videoRef,
  camera,
  onStartCamera,
  onCapture,
  onUpload,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="panel scan">
      <header className="panel__header">
        <h1 className="brand">Banana Export Grader</h1>
        <p className="lede">
          Frame a single finger in daylight. We score peel color (Von Loesecke) and
          blemish area for Extra / Class I / Class II / Reject.
        </p>
      </header>

      <div className="viewfinder">
        <video
          ref={videoRef}
          className="viewfinder__video"
          playsInline
          muted
          autoPlay
        />
        <div className="viewfinder__guide" aria-hidden />
        {!camera.streaming && (
          <div className="viewfinder__idle">
            <p>Camera off</p>
            <button type="button" className="btn btn--primary" onClick={onStartCamera}>
              Enable camera
            </button>
          </div>
        )}
      </div>

      {camera.error && (
        <p className="msg msg--warn">
          Camera unavailable ({camera.error}). You can upload a photo instead.
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!camera.streaming}
          onClick={onCapture}
        >
          Capture
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => fileRef.current?.click()}
        >
          Upload photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}
