import { meanVisibility, type Frame } from '@instep/gate-engine';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus } from 'react-tv-space-navigation';
import { HandLines, Skeleton } from '../components/Skeleton';
import { Button, Card, Screen, StateScreen, T, useTheme } from '../components/ui';
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

  const W = px(720);
  const H = px(800);
  const hand = frame?.hands?.right ?? frame?.hands?.left;
  return (
    <Screen>
      <T size="h1">Camera check</T>
      <View style={{ flexDirection: 'row', gap: px(64), marginTop: px(32) }}>
        <View
          style={{
            width: W,
            height: H,
            backgroundColor: c.surface,
            borderRadius: px(24),
            overflow: 'hidden',
            borderWidth: px(4),
            borderColor: allOk ? c.ok : c.surface2,
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
          <T size="h2">{lesson.track.camera.hint}</T>
          <Card style={{ gap: px(16) }}>
            {checks.map((k) => (
              <T key={k.label} color={k.ok ? c.ok : c.near} weight="600">
                {k.ok ? '✓' : '!'} {k.label}
              </T>
            ))}
          </Card>
          {count !== null ? (
            <T size="display" color={c.ok}>
              Looks good! {count}
            </T>
          ) : (
            <T color={c.muted}>The lesson starts by itself when everything is ✓.</T>
          )}
          <DefaultFocus>
            <Button label="Back" onSelect={nav.back} />
          </DefaultFocus>
        </View>
      </View>
    </Screen>
  );
}
