import { HAND_EDGES, type GateEval, type Landmark } from '@instep/gate-engine';
import type { Gate } from '@instep/istep-format';
import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { alignGhost, limbColours, poseSegments } from '../lib/skeleton';
import { useTheme } from './ui';
import { px } from '../theme/tokens';

/** Learner skeleton (solid, coloured by correctness) with the instructor ghost (dashed teal). */
export function Skeleton({
  pose,
  ghost,
  gate,
  ev,
  width,
  height,
  mirror = true,
}: {
  pose: Landmark[] | null | undefined;
  ghost?: Landmark[] | null;
  gate: Gate | null;
  ev?: GateEval;
  width: number;
  height: number;
  mirror?: boolean;
}) {
  const c = useTheme();
  const colour = { ok: c.ok, near: c.near, far: c.far, neutral: c.neutral };
  const learner = pose ? poseSegments(pose, width, height, mirror, limbColours(gate, ev)) : [];
  const g = ghost && pose ? poseSegments(alignGhost(ghost, pose), width, height, mirror, new Map()) : [];
  const worst = ev?.worst?.name;
  return (
    <Svg width={width} height={height}>
      {g.map((s, i) => (
        <Line
          key={`g${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={c.brand}
          strokeOpacity={0.7}
          strokeWidth={px(6)}
          strokeDasharray={`${px(12)} ${px(8)}`}
          strokeLinecap="round"
        />
      ))}
      {learner.map((s, i) => (
        <Line
          key={`l${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={colour[s.color]}
          strokeWidth={px(8) * c.stroke}
          strokeLinecap="round"
        />
      ))}
      {pose &&
        [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map((i) => {
          const p = pose[i];
          if (!p || (p.v ?? 1) < 0.5) return null;
          const x = (mirror ? 1 - p.x : p.x) * width;
          return <Circle key={`j${i}`} cx={x} cy={p.y * height} r={px(6)} fill={c.text} />;
        })}
      {worst && pose && (
        <WorstRing pose={pose} name={worst} width={width} height={height} mirror={mirror} color={c.near} />
      )}
    </Svg>
  );
}

const JOINT_POINT: Record<string, number> = {
  l_knee: 25,
  r_knee: 26,
  l_elbow: 13,
  r_elbow: 14,
  l_hip: 23,
  r_hip: 24,
  l_shoulder: 11,
  r_shoulder: 12,
  l_ankle: 27,
  r_ankle: 28,
};

function WorstRing({
  pose,
  name,
  width,
  height,
  mirror,
  color,
}: {
  pose: Landmark[];
  name: string;
  width: number;
  height: number;
  mirror: boolean;
  color: string;
}) {
  const i = JOINT_POINT[name];
  const p = i !== undefined ? pose[i] : undefined;
  if (!p) return null;
  return (
    <Circle
      cx={(mirror ? 1 - p.x : p.x) * width}
      cy={p.y * height}
      r={px(26)}
      stroke={color}
      strokeWidth={px(5)}
      fill="none"
    />
  );
}

/** Small hand skeleton (used in the camera check and for sign gates' learner panel). */
export function HandLines({
  hand,
  width,
  height,
  mirror = true,
  color,
}: {
  hand: Landmark[];
  width: number;
  height: number;
  mirror?: boolean;
  color: string;
}) {
  return (
    <Svg width={width} height={height}>
      {HAND_EDGES.map(([a, b], i) => {
        const p = hand[a]!;
        const q = hand[b]!;
        const X = (x: number) => (mirror ? 1 - x : x) * width;
        return (
          <Line
            key={i}
            x1={X(p.x)}
            y1={p.y * height}
            x2={X(q.x)}
            y2={q.y * height}
            stroke={color}
            strokeWidth={px(5)}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}
