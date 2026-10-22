import { meanVisibility, type Frame } from '@instep/gate-engine';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus } from 'react-tv-space-navigation';
import { HandLines, Skeleton } from '../components/Skeleton';
import { Button, Screen, StateScreen, T, useTheme } from '../components/ui';
import { nav, services } from '../lib/app';
import { useLesson } from '../lib/useLesson';
import { px } from '../theme/tokens';
import { useApp } from '../useStore';

type Check = { label: string; ok: boolean };

function checksFor(view: 'front' | 'side' | 'hands', f: Frame | undefined): Check[] {
  const pose = f?.pose;
  const inFrame = (i: number[]) =>
    !!pose &&
    i.every(
      (k) =>
        (pose[k]?.v ?? 0) >= 0.5 &&
        pose[k]!.x > 0.02 &&
        pose[k]!.x < 0.98 &&
        pose[k]!.y > 0.02 &&
        pose[k]!.y < 0.98,
    );
  if (view === 'hands') return [{ label: 'Hand clearly in view', ok: !!(f?.hands?.left || f?.hands?.right) }];
  if (view === 'side')
    return [
      { label: 'Shoulders in view', ok: !!pose && meanVisibility(pose, [11, 12]) >= 0.5 },
      { label: 'Arms and hands in view', ok: inFrame([11, 13, 15]) || inFrame([12, 14, 16]) },
    ];
  return [
    { label: 'Head in view', ok: inFrame([0]) },
    { label: 'Shoulders and hips in view', ok: inFrame([11, 12, 23, 24]) },
    { label: 'Feet in view', ok: inFrame([27, 28]) },
  ];
}

export function CameraCheck({ lessonId }: { lessonId: string }) {
  const c = useTheme();
  const { lesson, error, retry } = useLesson(lessonId);
  const peers = useApp((s) => s.peers);
  const host = peers.find((p) => p.role === 'host');
  const [frame, setFrame] = useState<Frame>();
  const [count, setCount] = useState<number | null>(null);
  const okSince = useRef<number | null>(null);
  const latest = useRef<Frame>();

  useEffect(() => {
    const relay = services.relay;
    if (!relay || !lesson) return;
    const t = lesson.track;
    relay.send({
      type: 'lesson_tracking',
      lessonId,
      tracking: t.tracking,
      cameraView: t.camera.view,
      gesturesEnabled: false,
      hint: t.camera.hint,
    });
    const off = relay.listen({ onFrame: (p, f) => p.role === 'host' && (latest.current = f) });
    const id = setInterval(() => latest.current && setFrame(latest.current), 50); // ≤ 20 fps redraw, latest only
    return () => {
      off();
      clearInterval(id);
    };
  }, [lesson, lessonId]);

  const checks = lesson ? checksFor(lesson.track.camera.view, frame) : [];
  const allOk = checks.length > 0 && checks.every((k) => k.ok);

  useEffect(() => {
    if (!allOk) {
      okSince.current = null;
      setCount(null);
      return;
    }
    okSince.current ??= Date.now();
    const id = setInterval(() => {
      const held = Date.now() - okSince.current!;
      if (held < 1500) return;
      const n = 3 - Math.floor((held - 1500) / 1000);
      if (n <= 0) {
        clearInterval(id);
        nav.replace({ name: 'player', lessonId });
      } else setCount(n);
    }, 100);
    return () => clearInterval(id);
  }, [allOk, lessonId]);

  if (error)
    return (
      <StateScreen
        icon="!"
        title="Couldn't open this lesson"
        body={error}
        actions={<Button primary label="Try again" onSelect={retry} />}
      />
    );
  if (!lesson) return <StateScreen icon="…" title="Getting the lesson ready" />;
  if (!host)
    return (
      <StateScreen
        icon="📷"
        title="Camera disconnected"
        body="Open the InStep page on your phone again."
        actions={
          <DefaultFocus>
            <Button
              primary
              label="Show pairing code"
              onSelect={() => nav.replace({ name: 'pair', lessonId, together: false })}
            />
          </DefaultFocus>
        }
      />
    );

  const W = px(640);
  const H = px(860);
  const hand = frame?.hands?.right ?? frame?.hands?.left;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: px(80), flex: 1, alignItems: 'center' }}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: c.surface,
            borderRadius: px(28),
            overflow: 'hidden',
            borderWidth: px(allOk ? 4 : 1),
            borderColor: allOk ? c.ok : c.hairline,
          }}
        >
          {lesson.track.camera.view === 'hands' && hand ? (
            <HandLines hand={hand} width={W} height={H} color={c.ok} />
          ) : (
            <Skeleton pose={frame?.pose} gate={null} width={W} height={H} />
          )}
          {!frame && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <T color={c.muted}>Waiting for the camera…</T>
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: px(28) }}>
          <T size="caption" weight="600" color={c.muted}>
            Camera check
          </T>
          <T size="h1">{count !== null ? 'Looks good' : 'Step into view'}</T>
          <T color={c.muted}>{lesson.track.camera.hint}</T>
          <View style={{ gap: px(18), marginTop: px(8) }}>
            {checks.map((k) => (
              <View key={k.label} style={{ flexDirection: 'row', alignItems: 'center', gap: px(18) }}>
                <View
                  style={{
                    width: px(40),
                    height: px(40),
                    borderRadius: px(20),
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: k.ok ? c.ok : c.surface2,
                  }}
                >
                  <T size="caption" weight="700" color={k.ok ? c.onFocus : c.muted}>
                    {k.ok ? '✓' : '·'}
                  </T>
                </View>
                <T color={k.ok ? c.text : c.muted}>{k.label}</T>
              </View>
            ))}
          </View>
          {count !== null ? (
            <T size="display" color={c.ok}>
              Starting in {count}
            </T>
          ) : (
            <T color={c.faint}>The lesson starts by itself when every check is done.</T>
          )}
          <DefaultFocus>
            <Button label="Back" width={300} onSelect={nav.back} />
          </DefaultFocus>
        </View>
      </View>
    </Screen>
  );
}
