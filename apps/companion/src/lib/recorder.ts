import { packHand, packPose } from '@instep/protocol';
import type { ReferenceTimeline } from '@instep/istep-format';
import { anatomicalSide, type VisionResult } from './landmarks';
import type { Tracker, Vision } from './vision';

export const REFERENCE_FPS = 15;
export const MAX_RECORD_SEC = 60;

/** Builds a reference timeline from vision results sampled at 15 fps. */
export class ReferenceBuilder {
  frames: ReferenceTimeline['frames'] = [];
  constructor(private tracking: Tracker[]) {}
  add(t: number, r: VisionResult) {
    const f: ReferenceTimeline['frames'][number] = { t: Math.round(t * 1000) / 1000 };
    if (this.tracking.includes('pose'))
      f.pose = r.pose ? packPose(r.pose.map((p) => ({ ...p, v: p.visibility ?? 0 }))) : null;
    if (this.tracking.includes('hands')) {
      const hands: { left: [number, number, number][] | null; right: [number, number, number][] | null } = {
        left: null,
        right: null,
      };
      for (const h of r.hands ?? []) hands[anatomicalSide(h.handedness.categoryName)] = packHand(h.landmarks);
      f.hands = hands;
    }
    this.frames.push(f);
  }
  build(): ReferenceTimeline {
    return {
      fps: REFERENCE_FPS,
      tracking: this.tracking.filter((t) => t !== 'objects'),
      frames: this.frames,
    };
  }
}

export function pickMimeType(): string {
  const options = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

/**
 * Runs MediaPipe over an uploaded video file in the browser (seeking frame by frame at 15 fps),
 * so uploaded demonstrations get a reference timeline too.
 */
export async function extractReference(
  file: Blob,
  vision: Vision,
  tracking: Tracker[],
  onProgress: (p: number) => void,
): Promise<ReferenceTimeline> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);
  await new Promise<void>((ok, fail) => {
    video.onloadedmetadata = () => ok();
    video.onerror = () => fail(new Error('This video format cannot be read by the browser.'));
  });
  const duration = Math.min(video.duration, MAX_RECORD_SEC);
  const builder = new ReferenceBuilder(tracking);
  const seek = (t: number) =>
    new Promise<void>((ok) => {
      video.onseeked = () => ok();
      video.currentTime = t;
    });
  for (let t = 0; t < duration; t += 1 / REFERENCE_FPS) {
    await seek(t);
    builder.add(t, vision.detect(video, tracking, t * 1000 + 1));
    onProgress(t / duration);
  }
  URL.revokeObjectURL(video.src);
  return builder.build();
}
