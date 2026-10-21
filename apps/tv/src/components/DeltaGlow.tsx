import { FINGER_INDICES, type FingerError, type Landmark } from '@instep/gate-engine';
import { FINGERS } from '@instep/istep-format';
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';
import { px } from '../theme/tokens';
import { T, useMotion, useTheme } from './ui';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Delta Glow (docs/09 §5): the learner's own hand, enlarged. Correct fingers glow green; the single most
 * wrong finger pulses amber with an arrow (↓ curl, ↑ extend); other wrong fingers are steady amber.
 * Works with the sound off — every state also has text.
 */
export function DeltaGlow({
  hand,
  errors,
  size,
  locked,
}: {
  hand: Landmark[] | null;
  errors: FingerError[];
  size: number;
  locked: boolean;
}) {
  const c = useTheme();
  const motion = useMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 500, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [motion, pulse]);

  if (!hand)
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <T color={c.muted}>✋ Show your hand to the camera</T>
      </View>
    );

  // fit the hand into the square, mirrored like a mirror
  const xs = hand.map((p) => 1 - p.x);
  const ys = hand.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const pad = size * 0.12;
  const k = (size - pad * 2) / span;
  const P = (i: number) => ({ x: pad + (1 - hand[i]!.x - minX) * k, y: pad + (hand[i]!.y - minY) * k });
  const worst = errors[0]?.finger;
  const bad = new Set(errors.map((e) => e.finger));

  return (
    <Svg width={size} height={size} accessibilityLabel={worst ? `Fix your ${worst}` : 'Hand shape correct'}>
      {[1, 5, 9, 13, 17].map((i) => (
        <Line
          key={`palm${i}`}
          x1={P(0).x}
          y1={P(0).y}
          x2={P(i).x}
          y2={P(i).y}
          stroke={c.neutral}
          strokeWidth={px(14)}
          strokeLinecap="round"
        />
      ))}
      {FINGERS.map((f) => {
        const idx = FINGER_INDICES[f];
        const d = idx.map((i, n) => `${n ? 'L' : 'M'}${P(i).x},${P(i).y}`).join(' ');
        const color = locked || !bad.has(f) ? c.ok : c.near;
        const isWorst = !locked && f === worst;
        const body = (
          <>
            <Path
              d={d}
              stroke={color}
              strokeOpacity={0.3}
              strokeWidth={px(40)}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d={d}
              stroke={color}
              strokeWidth={px(18) * c.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );
        return isWorst && motion ? (
          <AnimatedG key={f} opacity={pulse}>
            {body}
          </AnimatedG>
        ) : (
          <G key={f}>{body}</G>
        );
      })}
      {!locked &&
        errors.slice(0, 1).map((e) => {
          const tip = P(FINGER_INDICES[e.finger][3]);
          return (
            <SvgText
              key="arrow"
              x={tip.x + px(26)}
              y={tip.y}
              fill={c.near}
              fontSize={px(64)}
              fontWeight="bold"
            >
              {e.hint === 'curl' ? '↓' : '↑'}
            </SvgText>
          );
        })}
    </Svg>
  );
}
