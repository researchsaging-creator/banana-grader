# Banana Export Grader

Web app for Philippine packing-plant style banana grading. Uses the device camera (or photo upload), measures peel color in CIE L\*a\*b\* against the **Von Loesecke 7-stage** chart, estimates **blemish surface %**, and classifies **Extra / Class I / Class II / Reject**.

Computer-vision heuristics run entirely in the browser. A TensorFlow.js (or similar) model can later plug into the same `GradeResult` interface.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (use your phone on the same network for camera testing — `host: true` is enabled).

```bash
npm test      # unit tests for Lab → stage + grading rules
npm run build # production build
```

## How grading works

1. **Segment** green/yellow peel in Lab (optional drag-to-crop ROI + sensitivity slider).
2. **Color** — mean L\*a\*b\* and hue → Von Loesecke stage. Export packing requires **Stage 1–2**; Stage ≥ 3 → **Reject**.
3. **Blemishes** — dark/brown outliers vs peel mean; % of masked area.
4. **Class** — stricter of blemish % and color variance σ(a\*):

| Class   | Blemish % | Color variance σ(a*) |
|---------|-----------|----------------------|
| Extra   | &lt; 1%   | ≤ 4                  |
| Class I | ≤ 5%      | ≤ 8                  |
| Class II| ≤ 10%     | ≤ 14                 |
| Reject  | &gt; 10% or severe bruise blob, or Stage ≥ 3 | |

Thresholds live in [`src/grading/criteria.ts`](src/grading/criteria.ts).

## Lighting tips

- Prefer **diffuse daylight** or consistent packing-house lamps; avoid mixed warm/cool light.
- Fill the guide with **one finger**, peel facing the camera, plain background if possible.
- If the green overlay misses the peel, raise **Peel sensitivity** or drag a crop around the finger.
- Lab readings drift with white-balance — retake if the stage looks wrong by eye.

## Project layout

- `src/camera/` — `getUserMedia`, freeze frame, upload
- `src/vision/` — segment, Lab/stage, blemishes, heuristic analyzer
- `src/grading/` — criteria + pure `gradeFromMetrics`
- `src/ml/` — shared types + `predictWithModel` stub
- `src/ui/` — scan → confirm → result flow

## Phase 2 (not in MVP)

- Length ≥ 18 cm and caliber 39–46 with a scale reference in frame
- Lighting quality warnings
- Offline PWA + labeled crop collector to retrain an ML model

## License

Private research / packing-aid prototype — adjust as needed for your organization.
