import type { VisionResult } from './landmarks';

export type CameraView = 'front' | 'side' | 'hands';
export type Placement = { ok: boolean; message: string };

const VIS = 0.5;
const inFrame = (p: { x: number; y: number; visibility?: number } | undefined) =>
  !!p && (p.visibility ?? 0) >= VIS && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98;

/** Plain-language framing advice for the lesson's camera view (docs/06 §2.4). */
export function placementAdvice(view: CameraView, r: VisionResult, tracking: readonly string[]): Placement {
  if (view === 'hands' || (!tracking.includes('pose') && tracking.includes('hands'))) {
    const n = r.hands?.length ?? 0;
    if (n === 0) return { ok: false, message: 'Show your hand to the camera' };
    const h = r.hands![0]!.landmarks;
    const xs = h.map((p) => p.x);
    const ys = h.map((p) => p.y);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (size < 0.12) return { ok: false, message: 'Bring your hand a little closer' };
    if (size > 0.7) return { ok: false, message: 'Move your hand a little further away' };
    return { ok: true, message: 'Great — your hand is clearly visible' };
  }
  const p = r.pose;
  if (!p) return { ok: false, message: 'Step into view so the camera can see you' };
  if (view === 'side') {
    const arms = [11, 13, 15].every((i) => inFrame(p[i])) || [12, 14, 16].every((i) => inFrame(p[i]));
    if (!arms)
      return { ok: false, message: 'Turn the camera to your side so it sees your arms and shoulders' };
    // From the side the shoulders overlap; from the front they are ~0.6–0.8 torso lengths apart.
    const torso =
      Math.hypot(
        (p[11]!.x + p[12]!.x - p[23]!.x - p[24]!.x) / 2,
        (p[11]!.y + p[12]!.y - p[23]!.y - p[24]!.y) / 2,
      ) || 1;
    if (Math.abs(p[11]!.x - p[12]!.x) / torso > 0.45)
      return { ok: false, message: 'Turn the camera to your side for this lesson' };
    return { ok: true, message: 'Great — side view looks good' };
  }
  if (!inFrame(p[0])) return { ok: false, message: 'Tilt the camera up so your head is in the frame' };
  if (![27, 28].every((i) => inFrame(p[i])))
    return { ok: false, message: 'Step back until your feet are visible' };
  if (![11, 12, 23, 24].every((i) => inFrame(p[i])))
    return { ok: false, message: 'Step into the middle of the frame' };
  return { ok: true, message: 'Great — I can see all of you' };
}
