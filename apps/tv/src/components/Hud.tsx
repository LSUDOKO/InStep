import type { GateEval } from '@instep/gate-engine';
import type { Gate } from '@instep/istep-format';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { px } from '../theme/tokens';
import { T, useTheme } from './ui';

/** Hold progress ring: 120 px, 10 px stroke, centre shows seconds left. */
export function ProgressRing({ progress, label }: { progress: number; label: string }) {
  const c = useTheme();
  const s = px(120);
  const r = (s - px(10)) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} style={{ position: 'absolute' }}>
        <Circle cx={s / 2} cy={s / 2} r={r} stroke={c.surface2} strokeWidth={px(10)} fill="none" />
        <Circle
          cx={s / 2}
          cy={s / 2}
          r={r}
          stroke={c.ok}
          strokeWidth={px(10)}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - Math.min(1, progress))}
          strokeLinecap="round"
          transform={`rotate(-90 ${s / 2} ${s / 2})`}
        />
      </Svg>
      <T size="h2">{label}</T>
    </View>
  );
}

export function RepCounter({
  reps,
  target,
  partial,
  rate,
}: {
  reps: number;
  target: number;
  partial: number;
  rate: number;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: px(20) }}>
      <T size="display">{reps}</T>
      <T size="h2" color={c.muted} style={{ marginBottom: px(8) }}>
        / {target}
      </T>
      {partial > 0 && (
        <T size="caption" color={c.muted} style={{ marginBottom: px(12) }}>
          +{partial} partial
        </T>
      )}
      {rate < 1 && (
        <T size="caption" color={c.info} style={{ marginBottom: px(12) }}>
          Slowed to {rate}×
        </T>
      )}
    </View>
  );
}

/** BPM band 60–160 with the target zone shaded; needle = current BPM; metronome dot pulses at the beat. */
export function BpmMeter({
  bpm,
  min,
  max,
  armsStraight,
  beatOn,
}: {
  bpm?: number;
  min: number;
  max: number;
  armsStraight?: boolean;
  beatOn: boolean;
}) {
  const c = useTheme();
  const w = px(520);
  const lo = 60;
  const hi = 160;
  const X = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * w;
  const inBand = bpm !== undefined && bpm >= min && bpm <= max;
  return (
    <View style={{ gap: px(10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(16) }}>
        <View
          style={{
            width: px(28),
            height: px(28),
            borderRadius: px(14),
            backgroundColor: beatOn ? c.brand : c.surface2,
          }}
        />
        <T size="h2" color={inBand ? c.ok : c.near}>
          {bpm !== undefined ? `${bpm} /min` : '— /min'}
        </T>
        {armsStraight !== undefined && (
          <T size="caption" color={armsStraight ? c.ok : c.far}>
            {armsStraight ? '✓ Arms straight' : '✗ Lock your elbows'}
          </T>
        )}
      </View>
      <View style={{ width: w, height: px(28), backgroundColor: c.surface2, borderRadius: px(14) }}>
        <View
          style={{
            position: 'absolute',
            left: X(min),
            width: X(max) - X(min),
            top: 0,
            bottom: 0,
            backgroundColor: c.ok,
            opacity: 0.35,
            borderRadius: px(6),
          }}
        />
        {bpm !== undefined && (
          <View
            style={{
              position: 'absolute',
              left: X(bpm) - px(3),
              width: px(6),
              top: -px(8),
              bottom: -px(8),
              backgroundColor: c.text,
            }}
          />
        )}
      </View>
    </View>
  );
}

/** The lesson's steps as a compact rail: done, current, upcoming. Shown under the HUD during a lesson. */
export function StepRail({ labels, current }: { labels: string[]; current: number }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: px(12), alignItems: 'center' }}>
      {labels.map((l, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: px(10),
              paddingLeft: px(8),
              paddingRight: px(18),
              paddingVertical: px(8),
              borderRadius: px(999),
              backgroundColor: now ? c.brand : c.surface2,
              maxWidth: px(420),
              opacity: done || now ? 1 : 0.7,
            }}
          >
            <View
              style={{
                width: px(34),
                height: px(34),
                borderRadius: px(17),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? c.ok : now ? '#0D0E2C' : c.surface,
              }}
            >
              <T size="caption" weight="700" color={done ? '#0D0E2C' : now ? c.brand : c.muted}>
                {done ? '✓' : String(i + 1)}
              </T>
            </View>
            <T
              size="caption"
              weight={now ? '700' : '600'}
              color={now ? '#0D0E2C' : done ? c.text : c.muted}
              lines={1}
            >
              {l}
            </T>
          </View>
        );
      })}
    </View>
  );
}

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: px(16) }}>
      {labels.map((l, i) => (
        <View
          key={i}
          style={{
            paddingHorizontal: px(24),
            paddingVertical: px(10),
            borderRadius: px(16),
            backgroundColor: i < current ? c.ok : i === current ? c.brand : c.surface2,
          }}
        >
          <T size="h2" color={i <= current ? '#0D0E2C' : c.muted}>
            {i < current ? `✓ ${l}` : l}
          </T>
        </View>
      ))}
    </View>
  );
}

const CHECK_LABEL: Record<string, string> = {
  object_near: 'Sturdy chair beside you',
  full_body_visible: 'Whole body in view',
  upper_body_visible: 'Arms and shoulders in view',
  hands_visible: 'Hands in view',
  stable: 'Standing steady',
};

export function SafetyChecklist({ checks }: { checks: NonNullable<GateEval['checks']> }) {
  const c = useTheme();
  return (
    <View style={{ gap: px(10) }}>
      {checks.map((k) => (
        <T key={k.kind} color={k.ok ? c.ok : c.far} weight="600">
          {k.ok ? '✓' : '✗'} {CHECK_LABEL[k.kind] ?? k.kind}
        </T>
      ))}
    </View>
  );
}

/** Picks the right widget for the gate type. */
export function GateWidget({
  gate,
  ev,
  rate,
  beatOn,
}: {
  gate: Gate;
  ev?: GateEval;
  rate: number;
  beatOn: boolean;
}) {
  switch (gate.type) {
    case 'hold_duration': {
      const left = Math.max(0, gate.holdSec - (ev?.holdSec ?? 0));
      return <ProgressRing progress={ev?.progress ?? 0} label={`${Math.ceil(left)}s`} />;
    }
    case 'rep_count':
      return (
        <RepCounter reps={ev?.reps ?? 0} target={gate.reps} partial={ev?.partialReps ?? 0} rate={rate} />
      );
    case 'rhythm_bpm':
      return (
        <View style={{ gap: px(8) }}>
          <RepCounter reps={ev?.reps ?? 0} target={gate.count} partial={0} rate={1} />
          <BpmMeter
            bpm={ev?.bpm}
            min={gate.bpm.min}
            max={gate.bpm.max}
            armsStraight={gate.armsStraight ? ev?.armsStraight : undefined}
            beatOn={beatOn}
          />
        </View>
      );
    case 'sequence_order':
      return <Steps labels={gate.steps.map((s) => s.label)} current={ev?.step ?? 0} />;
    case 'safety_prerequisite':
      return ev?.checks ? <SafetyChecklist checks={ev.checks} /> : null;
    default:
      return <ProgressRing progress={ev?.progress ?? 0} label={ev?.status === 'progress' ? '…' : ''} />;
  }
}
