import { useCallback, useEffect, useRef, useState } from 'react';
import { ANALYZE_MAX_WIDTH } from '../vision/pipeline';

export interface CameraState {
  ready: boolean;
  error: string | null;
  streaming: boolean;
}

export interface CapturedFrame {
  imageData: ImageData;
  dataUrl: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<CameraState>({
    ready: false,
    error: null,
    streaming: false,
  });

  const getCanvas = () => {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    return canvasRef.current;
  };

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

  /** One draw: analysis-sized ImageData + JPEG preview. */
  const capture = useCallback(
    (maxWidth = ANALYZE_MAX_WIDTH): CapturedFrame | null => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return null;

      const scale = Math.min(1, maxWidth / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = getCanvas();
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      return {
        imageData: ctx.getImageData(0, 0, w, h),
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
      };
    },
    [],
  );

  return { videoRef, state, start, stop, capture };
}

/** Load a File / Blob into ImageData (analysis-sized). */
export async function fileToImageData(
  file: File,
  maxWidth = ANALYZE_MAX_WIDTH,
): Promise<CapturedFrame> {
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
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
  };
}
