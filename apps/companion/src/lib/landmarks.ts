import { packHand, packPose, type LandmarksMsg } from '@instep/protocol';

/** Minimal shapes of MediaPipe results (keeps this module pure and testable). */
export type MpPoint = { x: number; y: number; z: number; visibility?: number };
export type MpCategory = { score: number; categoryName: string };
export type VisionResult = {
  pose?: MpPoint[] | null;
  hands?: { landmarks: MpPoint[]; handedness: MpCategory }[];
  objects?: { label: string; score: number; box: [number, number, number, number] }[];
};

/**
 * MediaPipe's hand classifier assumes a mirrored (selfie) image. We feed the raw, unmirrored camera
 * frame, so its "Left" label is the learner's right hand. We swap here so the wire format is anatomical
 * and `mirrored` stays false. Pose landmarks are already anatomical.
 */
export function anatomicalSide(label: string): 'left' | 'right' {
  return label.toLowerCase() === 'left' ? 'right' : 'left';
}

export function buildLandmarksMessage(
  r: VisionResult,
  opts: { seq: number; ts: number; role: 'host' | 'guest'; tracking: readonly string[]; fps: number },
): LandmarksMsg {
  const msg: LandmarksMsg = {
    type: 'landmarks',
    seq: opts.seq,
    ts: Math.round(opts.ts),
    role: opts.role,
    mirrored: false,
    fps: Math.round(opts.fps * 10) / 10,
  };
  if (opts.tracking.includes('pose'))
    msg.pose = r.pose
      ? packPose(r.pose.map((p) => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 0 })))
      : null;
  if (opts.tracking.includes('hands')) {
    const hands: NonNullable<LandmarksMsg['hands']> = { left: null, right: null };
    const scores: NonNullable<LandmarksMsg['handScores']> = {};
    for (const h of r.hands ?? []) {
      const side = anatomicalSide(h.handedness.categoryName);
      // keep the more confident detection if both claim the same side
      if (hands[side] && (scores[side] ?? 0) >= h.handedness.score) continue;
      hands[side] = packHand(h.landmarks);
      scores[side] = Math.round(h.handedness.score * 100) / 100;
    }
    msg.hands = hands;
    msg.handScores = scores;
  }
  if (opts.tracking.includes('objects'))
    msg.objects = (r.objects ?? []).slice(0, 5).map((o) => ({
      label: o.label,
      score: Math.round(o.score * 100) / 100,
      box: o.box.map((v) => Math.round(v * 1000) / 1000) as [number, number, number, number],
    }));
  return msg;
}

/** Allows at most `perSec` events per second, evenly spaced. */
export class RateLimiter {
  private next = 0;
  constructor(private perSec: number) {}
  allow(now: number): boolean {
    if (now < this.next) return false;
    this.next = Math.max(now, this.next) + 1000 / this.perSec - 2; // 2 ms slack for frame jitter
    return true;
  }
}
