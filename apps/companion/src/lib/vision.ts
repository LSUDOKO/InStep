import { FilesetResolver, HandLandmarker, ObjectDetector, PoseLandmarker } from '@mediapipe/tasks-vision';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
import type { VisionResult } from './landmarks';

export type Tracker = 'pose' | 'hands' | 'objects';
const MODELS = '/models';
const OBJECT_INTERVAL_MS = 1000 / 3; // chairs rarely move: ≤ 3 fps
const OBJECT_LABELS = ['chair', 'couch', 'bench'];

/**
 * Runs only the MediaPipe trackers the current lesson asks for, entirely in this browser.
 * Models and WASM are served by the InStep server from /models/ (no third-party CDN at runtime).
 */
export class Vision {
  private fileset: Promise<WasmFileset> | null = null;
  private pose: PoseLandmarker | null = null;
  private hands: HandLandmarker | null = null;
  private objects: ObjectDetector | null = null;
  private lastObjects: VisionResult['objects'] = [];
  private lastObjectTs = -Infinity;
  private lastTs = -1;
  delegate: 'GPU' | 'CPU' = 'GPU';

  /** Loads any missing trackers; reports progress as (loaded, total). */
  async ensure(trackers: readonly Tracker[], onProgress?: (done: number, total: number) => void) {
    this.fileset ??= FilesetResolver.forVisionTasks(`${MODELS}/wasm`);
    const fs = await this.fileset;
    const todo = trackers.filter((t) => !this[t === 'pose' ? 'pose' : t === 'hands' ? 'hands' : 'objects']);
    let done = trackers.length - todo.length;
    onProgress?.(done, trackers.length);
    for (const t of todo) {
      await this.withDelegate(async (delegate) => {
        if (t === 'pose')
          this.pose = await PoseLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: `${MODELS}/pose_landmarker_lite.task`, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          });
        else if (t === 'hands')
          this.hands = await HandLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: `${MODELS}/hand_landmarker.task`, delegate },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        else
          this.objects = await ObjectDetector.createFromOptions(fs, {
            baseOptions: { modelAssetPath: `${MODELS}/efficientdet_lite0.tflite`, delegate },
            runningMode: 'VIDEO',
            scoreThreshold: 0.3,
            maxResults: 5,
            categoryAllowlist: OBJECT_LABELS,
          });
      });
      onProgress?.(++done, trackers.length);
    }
  }

  /** GPU first; fall back to CPU once if the GPU delegate is unavailable (e.g. some phones, headless tests). */
  private async withDelegate(create: (d: 'GPU' | 'CPU') => Promise<void>) {
    try {
      await create(this.delegate);
    } catch (e) {
      if (this.delegate === 'CPU') throw e;
      this.delegate = 'CPU';
      await create('CPU');
    }
  }

  detect(video: HTMLVideoElement, trackers: readonly Tracker[], nowMs: number): VisionResult {
    // MediaPipe VIDEO mode needs strictly increasing timestamps.
    const ts = Math.max(Math.round(nowMs), this.lastTs + 1);
    this.lastTs = ts;
    const out: VisionResult = {};
    if (trackers.includes('pose') && this.pose)
      out.pose = this.pose.detectForVideo(video, ts).landmarks[0] ?? null;
    if (trackers.includes('hands') && this.hands) {
      const r = this.hands.detectForVideo(video, ts);
      out.hands = r.landmarks.map((landmarks, i) => ({ landmarks, handedness: r.handedness[i]![0]! }));
    }
    if (trackers.includes('objects') && this.objects) {
      if (ts - this.lastObjectTs >= OBJECT_INTERVAL_MS) {
        this.lastObjectTs = ts;
        const w = video.videoWidth || 1;
        const h = video.videoHeight || 1;
        this.lastObjects = this.objects.detectForVideo(video, ts).detections.flatMap((d) => {
          const c = d.categories[0];
          const b = d.boundingBox;
          return c && b
            ? [
                {
                  label: c.categoryName,
                  score: c.score,
                  box: [b.originX / w, b.originY / h, b.width / w, b.height / h] as [
                    number,
                    number,
                    number,
                    number,
                  ],
                },
              ]
            : [];
        });
      }
      out.objects = this.lastObjects;
    }
    return out;
  }

  close() {
    this.pose?.close();
    this.hands?.close();
    this.objects?.close();
  }
}
