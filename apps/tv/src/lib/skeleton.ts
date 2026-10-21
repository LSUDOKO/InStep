import {
  JOINT_EDGES,
  POSE_EDGES,
  hipMid,
  torsoLength,
  type Frame,
  type GateEval,
  type Landmark,
} from '@instep/gate-engine';
import type { Gate, JointName } from '@instep/istep-format';

export type Seg = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: 'ok' | 'near' | 'far' | 'neutral';
};

const VIS = 0.5;

/** Limb colours: joints used by the gate are green/amber/red by error; everything else neutral grey. */
export function limbColours(gate: Gate | null, ev: GateEval | undefined): Map<string, Seg['color']> {
  const out = new Map<string, Seg['color']>();
  if (!gate || !('joints' in gate) || !ev?.jointErrors) return out;
  const tol = gate.tolerance?.angleDeg ?? 20;
  for (const j of gate.joints as JointName[]) {
    const err = Math.abs(ev.jointErrors[j] ?? 0);
    const c: Seg['color'] = err <= tol ? 'ok' : err <= tol * 2 ? 'near' : 'far';
    for (const [a, b] of JOINT_EDGES[j]) out.set(`${a}-${b}`, c);
  }
  return out;
}

/** Pose → segments in a w×h box. `mirror` flips x so the learner sees themselves like in a mirror. */
export function poseSegments(
  pose: Landmark[],
  w: number,
  h: number,
  mirror: boolean,
  colours: Map<string, Seg['color']>,
): Seg[] {
  const X = (x: number) => (mirror ? 1 - x : x) * w;
  return POSE_EDGES.flatMap(([a, b]) => {
    const p = pose[a];
    const q = pose[b];
    if (!p || !q || (p.v ?? 1) < VIS || (q.v ?? 1) < VIS) return [];
    return [
      {
        x1: X(p.x),
        y1: p.y * h,
        x2: X(q.x),
        y2: q.y * h,
        color: colours.get(`${a}-${b}`) ?? colours.get(`${b}-${a}`) ?? 'neutral',
      },
    ];
  });
}

/**
 * Instructor ghost aligned to the learner: translate to the learner's hip midpoint and scale by torso length,
 * so the learner sees where to move rather than where the instructor stood.
 */
export function alignGhost(ghost: Landmark[], learner: Landmark[]): Landmark[] {
  const gh = hipMid(ghost);
  const lh = hipMid(learner);
  const k = torsoLength(learner) / torsoLength(ghost);
  return ghost.map((p) => ({ ...p, x: lh.x + (p.x - gh.x) * k, y: lh.y + (p.y - gh.y) * k }));
}

export function hostFrame(frames: Record<string, Frame>, hostId: string | undefined): Frame | undefined {
  return hostId ? frames[hostId] : Object.values(frames)[0];
}
