import { useState } from 'react';
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
  const [result, setResult] = useState<GradeResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function resetToScan() {
    setStep('scan');
    setImageData(null);
    setDataUrl(null);
    setRoi(null);
    setResult(null);
    setShowAdvanced(false);
    void camera.start();
  }

  function goConfirm(img: ImageData, url: string) {
    camera.stop();
    setImageData(img);
    setDataUrl(url);
    setRoi(null);
    setResult(null);
    setStep('confirm');
  }

  function handleCapture() {
    const img = camera.captureFrame();
    const url = camera.captureDataUrl();
    if (!img || !url) return;
    goConfirm(img, url);
  }

  async function handleUpload(file: File) {
    try {
      const { imageData: img, dataUrl: url } = await fileToImageData(file);
      goConfirm(img, url);
    } catch {
      alert('Could not read that image.');
    }
  }

  function handleAnalyze() {
    if (!imageData) return;
    const graded = analyzeBanana(imageData, {
      threshold,
      roi: roi ?? undefined,
    });
    setResult(graded);
    setStep('result');
  }

  return (
    <div className="app">
      <div className="app__glow" aria-hidden />
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
      {step === 'result' && result && dataUrl && (
        <ResultView
          dataUrl={dataUrl}
          result={result}
          onRetake={resetToScan}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        />
      )}
      <footer className="footer">
        Heuristic Lab color + blemish % · ML hook ready · Size calibration phase 2
      </footer>
    </div>
  );
}
