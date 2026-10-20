import { useCallback, useEffect, useRef, useState } from 'react';

export interface CameraState {
  ready: boolean;
  error: string | null;
  streaming: boolean;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({
    ready: false,
    error: null,
    streaming: false,
  });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((s) => ({ ...s, streaming: false, ready: false }));
  }, []);

  const start = useCallback(async () => {
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setState({ ready: true, error: null, streaming: true });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Camera permission denied or unavailable';
      setState({ ready: false, error: message, streaming: false });
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  /** Freeze current video frame to ImageData (downscaled for speed). */
  const captureFrame = useCallback((maxWidth = 640): ImageData | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const scale = Math.min(1, maxWidth / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }, []);

  const captureDataUrl = useCallback((maxWidth = 640): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  return { videoRef, state, start, stop, captureFrame, captureDataUrl };
}

/** Load a File / Blob into ImageData */
export async function fileToImageData(
  file: File,
  maxWidth = 640,
): Promise<{ imageData: ImageData; dataUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return {
    imageData: ctx.getImageData(0, 0, w, h),
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
  };
}
