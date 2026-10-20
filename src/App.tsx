import { useState, useTransition } from 'react';
import { fileToImageData, useCamera } from './camera/useCamera';
import type { GradeResult } from './ml/types';
import { ConfirmView } from './ui/ConfirmView';
import { ResultView } from './ui/ResultView';
import { ScanView } from './ui/ScanView';
import { analyzeBanana } from './vision/analyzeHeuristics';
import type { Roi } from './vision/segment';

type Step = 'scan' | 'confirm' | 'result';

export default function App() {
  const camera = useCamera();
  const [step, setStep] = useState<Step>('scan');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.55);
  const [roi, setRoi] = useState<Roi | null>(null);
  const [result, setResult] = useState<(GradeResult & { analysisMs?: number }) | null>(
    null,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function resetToScan() {
    setStep('scan');
    setImageData(null);
    setDataUrl(null);
    setRoi(null);
    setResult(null);
    setShowAdvanced(false);
    setBusy(false);
    void camera.start();
  }

  function runGrade(
    img: ImageData,
    url: string,
    opts?: { threshold?: number; roi?: Roi | null },
  ) {
    setBusy(true);
    // Yield a frame so the UI can show “Grading…” before heavy work
    requestAnimationFrame(() => {
      const graded = analyzeBanana(img, {
        threshold: opts?.threshold ?? threshold,
        roi: opts?.roi ?? roi ?? undefined,
      });
      startTransition(() => {
        setImageData(img);
        setDataUrl(url);
        setResult(graded);
        setStep('result');
        setBusy(false);
      });
    });
  }

  function handleCapture() {
    const frame = camera.capture();
    if (!frame) return;
    camera.stop();
    setRoi(null);
    setResult(null);
    setDataUrl(frame.dataUrl);
    setImageData(frame.imageData);
    setStep('result');
    runGrade(frame.imageData, frame.dataUrl, { roi: null });
  }

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      const frame = await fileToImageData(file);
      camera.stop();
      setRoi(null);
      setDataUrl(frame.dataUrl);
      setImageData(frame.imageData);
      runGrade(frame.imageData, frame.dataUrl, { roi: null });
    } catch {
      setBusy(false);
      alert('Could not read that image.');
    }
  }

  function handleAnalyze() {
    if (!imageData || !dataUrl) return;
    runGrade(imageData, dataUrl, { threshold, roi });
  }

  function handleAdjust() {
    setStep('confirm');
  }

  return (
    <div className="app">
      <div className="app__glow" aria-hidden />
      {busy && (
        <div className="busy-bar" role="status">
          Grading…
        </div>
      )}
      {step === 'scan' && (
        <ScanView
          videoRef={camera.videoRef}
          camera={camera.state}
          onStartCamera={() => void camera.start()}
          onCapture={handleCapture}
          onUpload={(f) => void handleUpload(f)}
        />
      )}
      {step === 'confirm' && imageData && dataUrl && (
        <ConfirmView
          dataUrl={dataUrl}
          imageData={imageData}
          threshold={threshold}
          onThreshold={setThreshold}
          roi={roi}
          onRoi={setRoi}
          onAnalyze={handleAnalyze}
          onBack={resetToScan}
        />
      )}
      {step === 'result' && dataUrl && (
        <ResultView
          dataUrl={dataUrl}
          result={
            result ?? {
              grade: 'Reject',
              reasons: [],
              metrics: {
                stage: 1,
                meanLab: { L: 0, a: 0, b: 0 },
                hue: 0,
                colorVariance: 0,
                blemishPercent: 0,
                hasSevereBruise: false,
                maskCoverage: 0,
              },
              source: 'heuristics',
            }
          }
          onRetake={resetToScan}
          onAdjust={handleAdjust}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          busy={busy || !result}
        />
      )}
      <footer className="footer">
        Instant grade · Lab + blemish CV · Adjust detection if needed
      </footer>
    </div>
  );
}
