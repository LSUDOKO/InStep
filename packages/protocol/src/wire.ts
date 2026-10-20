import type { Frame, Landmark } from '@instep/gate-engine';
import type { LandmarksMsg } from './ws';

const q3 = (n: number) => Math.round(n * 1000) / 1000 || 0; // no -0 on the wire
const q2 = (n: number) => Math.round(n * 100) / 100 || 0;

/** Quantises landmarks to 3 decimals (visibility 2) for the wire. */
export function packPose(pose: Landmark[]): [number, number, number, number][] {
  return pose.map((p) => [q3(p.x), q3(p.y), q3(p.z), q2(p.v ?? 1)]);
}
export function packHand(hand: Landmark[]): [number, number, number][] {
  return hand.map((p) => [q3(p.x), q3(p.y), q3(p.z)]);
}

const unpackPose = (pts: number[][]): Landmark[] =>
  pts.map(([x, y, z, v]) => ({ x: x!, y: y!, z: z!, v: v! }));
const unpackHand = (pts: number[][] | null | undefined): Landmark[] | null =>
  pts ? pts.map(([x, y, z]) => ({ x: x!, y: y!, z: z!, v: 1 })) : null;

/** Converts a validated `landmarks` message into a gate-engine Frame. */
export function toFrame(m: LandmarksMsg): Frame {
  return {
    ts: m.ts,
    mirrored: m.mirrored,
    pose: m.pose ? unpackPose(m.pose) : null,
    hands: { left: unpackHand(m.hands?.left), right: unpackHand(m.hands?.right) },
    ...(m.handScores ? { handScores: m.handScores } : {}),
    ...(m.objects ? { objects: m.objects } : {}),
  };
}
