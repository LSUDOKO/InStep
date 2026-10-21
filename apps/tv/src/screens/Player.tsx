import { referencePoseAt } from '@instep/gate-engine';
import type { MediaAdapter } from '@instep/gated-player';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { DeltaGlow } from '../components/DeltaGlow';
import { GateWidget } from '../components/Hud';
import { Skeleton } from '../components/Skeleton';
import { Button, Card, Chip, Screen, StateScreen, T, useMotion, useTheme } from '../components/ui';
import { nav, services, store } from '../lib/app';
import { createLessonSession, TICK_MS, type LessonSession, type SessionView } from '../lib/lessonSession';
import { useLesson } from '../lib/useLesson';
import { remote } from '../remote/remote';
import { px, type } from '../theme/tokens';
import { useApp } from '../useStore';
import { VegaVideo, playAudioUrl } from '../video/VegaVideo';

const PASS_GLOW_MS = 400;

export function Player({ lessonId }: { lessonId: string }) {
  const c = useTheme();
  const motion = useMotion();
  const { lesson, error, retry } = useLesson(lessonId);
  const settings = useApp((s) => s.settings);
  const profile = useApp((s) => s.profile);
  const [view, setView] = useState<SessionView | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [beatOn, setBeatOn] = useState(false);
  const session = useRef<LessonSession | null>(null);
  const media = useRef<MediaAdapter | null>(null);

  // ---- session lifecycle ---------------------------------------------------
  const onReady = async (m: MediaAdapter) => {
    if (!lesson || !profile || !services.relay || session.current) return;
    media.current = m;
    const recentPasses = await services.api.recentPasses(profile.id).catch(() => ({}));
    const s = createLessonSession({
      lessonId,
      track: lesson.track,
      ...(lesson.reference ? { reference: lesson.reference } : {}),
      media: m,
      relay: services.relay,
      api: services.api,
      profile,
      recentPasses,
      voiceOn: settings.voice,
      playAudio: playAudioUrl,
      now: Date.now,
      onChange: () => undefined,
    });
    session.current = s;
    s.start();
  };

  useEffect(() => {
    const id = setInterval(() => {
      const s = session.current;
      if (!s) return;
      s.tick();
      const v = s.view();
      setView(v);
      if (v.phase === 'ended') {
        clearInterval(id);
        void s.finish().then((summary) => nav.replace({ name: 'summary', lessonId, summary }));
      }
    }, TICK_MS);
    return () => {
      clearInterval(id);
      session.current?.dispose();
    };
  }, [lessonId]);

  // ---- metronome pulse (visual; never the only cue) -------------------------
  const gate = view?.gate ?? null;
  const metronome = gate?.type === 'rhythm_bpm' ? gate.metronomeBpm : undefined;
  useEffect(() => {
    if (!metronome || !motion) return;
    const id = setInterval(() => {
      setBeatOn(true);
      setTimeout(() => setBeatOn(false), 120);
    }, 60000 / metronome);
    return () => clearInterval(id);
  }, [metronome, motion]);

  // ---- remote keys (consumed here while the player is shown) ---------------
  useEffect(
    () =>
      remote.on((k) => {
        const s = session.current;
        if (confirmExit) return k === 'back' ? (setConfirmExit(false), true) : false;
        if (!s) return k === 'back' ? (nav.back(), true) : false;
        const phase = s.player.snapshot().phase;
        switch (k) {
          case 'playpause':
            s.player.control('toggle_pause');
            return true;
          case 'left':
            if (phase === 'safety_stop') return false;
            s.player.control('repeat');
            return true;
          case 'right':
            s.player.control('next');
            return true;
          case 'menu':
            s.player.control('easier');
            return true;
          case 'select':
            if (phase === 'safety_stop') {
              s.player.control('ok');
              return true;
            }
            return false;
          case 'back':
            s.player.control('pause');
            setConfirmExit(true);
            return true;
          default:
            return false;
        }
      }),
    [confirmExit],
  );

  // ---- states ------------------------------------------------------------------
  if (error)
    return (
      <StateScreen
        icon="!"
        title="Couldn't load this lesson"
        body={error}
        actions={<Button primary label="Try again" onSelect={retry} />}
      />
    );
  if (videoError)
    return (
      <StateScreen
        icon="!"
        title="The video couldn't be played"
        body={videoError}
        actions={
          <>
            <Button primary label="Try again" onSelect={() => setVideoError(null)} />
            <Button label="Back" onSelect={nav.back} />
          </>
        }
      />
    );
  if (!lesson || !lesson.detail.videoUrl) return <StateScreen icon="…" title="Loading the lesson" />;

  const { track, reference } = lesson;
  const hostPeer = view?.participants.find((p) => p.role === 'host');
  const hostFrame = hostPeer ? view?.frames[hostPeer.peerId] : undefined;
  const hostEval = hostPeer ? view?.evals[hostPeer.peerId] : undefined;
  const isHandGate =
    gate?.type === 'hand_sign' ||
    (gate?.type === 'sequence_order' && gate.steps[hostEval?.step ?? 0]?.type === 'hand_sign');
  const ghost = reference && media.current ? referencePoseAt(reference, media.current.currentTime()) : null;
  const passing = view && Date.now() - view.justPassedAt < PASS_GLOW_MS;
  const captionScale = settings.captionScale;
  const overlay = settings.overlayMode === 'overlay';
  const PW = px(560);
  const PH = px(720);
  const VW = overlay ? px(1728) : px(1280);
  const VH = overlay ? px(972) - px(200) : px(720);

  const learnerPanel = (w: number, h: number) =>
    isHandGate ? (
      <DeltaGlow
        hand={hostFrame?.hands?.right ?? hostFrame?.hands?.left ?? null}
        errors={hostEval?.fingerErrors ?? []}
        size={Math.min(w, h)}
        locked={hostEval?.status === 'passed' || !!passing}
      />
    ) : (
      <Skeleton
        pose={hostFrame?.pose}
        ghost={gate ? ghost : null}
        gate={gate}
        ev={hostEval}
        width={w}
        height={h}
      />
    );

  return (
    <Screen style={{ paddingVertical: px(40), paddingHorizontal: px(64) }} active={confirmExit}>
      <View style={{ flexDirection: 'row', gap: px(24) }}>
        <View style={{ width: VW, height: VH, borderRadius: px(16), overflow: 'hidden' }}>
          <VegaVideo
            uri={services.api.url(lesson.detail.videoUrl)}
            style={{ width: VW, height: VH }}
            onReady={(m) => void onReady(m)}
            onError={setVideoError}
            onEnded={() => session.current?.player.end()}
          />
          {overlay && <View style={{ position: 'absolute', top: 0, left: 0 }}>{learnerPanel(VW, VH)}</View>}
          {track.channel === 'cpr' && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: c.scrim,
                padding: px(14),
              }}
            >
              <T size="caption">{track.disclaimer}</T>
            </View>
          )}
        </View>
        {!overlay && (
          <View
            style={{
              width: PW,
              height: PH,
              backgroundColor: c.surface,
              borderRadius: px(16),
              overflow: 'hidden',
              borderWidth: px(4),
              borderColor: hostEval?.status === 'blocked_safety' ? c.far : c.surface,
            }}
          >
            {learnerPanel(PW, PH)}
          </View>
        )}
      </View>

      {/* ---- HUD ---- */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: px(32),
          marginTop: px(24),
          minHeight: px(160),
        }}
      >
        {gate ? (
          <>
            <View style={{ flex: 1, gap: px(8) }}>
              <T size="h1">{gate.label}</T>
              {hostEval?.message && hostEval.status !== 'passed' ? (
                <T color={c.near}>{hostEval.message}</T>
              ) : hostEval?.worst ? (
                <T color={c.near}>{cap(hostEval.worst.hint)}</T>
              ) : null}
              {view && view.participants.length > 1 && (
                <View style={{ flexDirection: 'row', gap: px(12) }}>
                  {view.participants.map((p) => {
                    const st = view.evals[p.peerId]?.status;
                    return (
                      <Chip
                        key={p.peerId}
                        tone={st === 'passed' ? 'ok' : st === 'progress' ? 'brand' : 'info'}
                        label={`${p.name ?? (p.role === 'host' ? 'You' : 'Guest')} ${st === 'passed' ? '✓' : ''}`}
                      />
                    );
                  })}
                </View>
              )}
            </View>
            <GateWidget gate={gate} ev={hostEval} rate={view?.playbackRate ?? 1} beatOn={beatOn} />
          </>
        ) : (
          <T size="h2" color={c.muted} style={{ flex: 1 }}>
            {track.title}
          </T>
        )}
        <View style={{ gap: px(10), alignItems: 'flex-end' }}>
          <Chip tone={hostPeer ? 'ok' : 'far'} label={hostPeer ? 'Camera' : 'No camera'} />
          <Chip tone="ok" label="Privacy: body points only" />
          {view?.easier && <Chip tone="info" label="Easier mode" />}
          {view?.canSkip && <Chip tone="info" label="→ Skip step" />}
        </View>
      </View>

      {view?.caption && (
        <Card
          style={{
            position: 'absolute',
            left: px(64),
            right: px(64),
            bottom: px(40),
            backgroundColor: c.surface2,
            borderLeftWidth: px(8),
            borderLeftColor: c.brand,
          }}
        >
          <T
            style={{
              fontSize: px(type.body * captionScale),
              lineHeight: px(type.body * captionScale * 1.25),
            }}
          >
            💬 {view.caption.text}
          </T>
        </Card>
      )}

      {passing && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: px(16),
            borderColor: c.ok,
          }}
        />
      )}
      {passing && track.channel === 'kids' && motion && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: px(200), left: 0, right: 0, alignItems: 'center' }}
        >
          <T size="display" color={c.near} style={{ fontSize: px(160), lineHeight: px(180) }}>
            ★ ★ ★
          </T>
        </View>
      )}

      {view?.phase === 'safety_stop' && (
        <Overlay>
          <T size="display">Let's sit down and rest.</T>
          <T color={c.muted}>Take a seat and breathe. When you feel steady, stand still for a moment.</T>
          <T color={view.stableForResume ? c.ok : c.muted} weight="700">
            {view.stableForResume
              ? '✓ Steady — press OK on the remote to continue'
              : 'Waiting until you are steady…'}
          </T>
        </Overlay>
      )}
      {view?.phase === 'camera_lost' && (
        <Overlay>
          <T size="display">Camera disconnected</T>
          <T color={c.muted}>Open the InStep page on your phone again. Room code: {store.get().room}</T>
          {view.countdownMs > 0 && (
            <T size="display" color={c.ok}>
              {Math.ceil(view.countdownMs / 1000)}
            </T>
          )}
        </Overlay>
      )}
      {view?.phase === 'paused' && !confirmExit && (
        <Overlay>
          <T size="display">Paused</T>
          <T color={c.muted}>Press Play on the remote, or raise your hand, to continue.</T>
        </Overlay>
      )}
      {confirmExit && (
        <Overlay>
          <T size="h1">Leave this lesson?</T>
          <T color={c.muted}>Your progress so far will be saved.</T>
          <SpatialNavigationNode orientation="horizontal">
            <View style={{ flexDirection: 'row', gap: px(24) }}>
              <DefaultFocus>
                <Button label="Keep going" primary onSelect={() => setConfirmExit(false)} />
              </DefaultFocus>
              <Button label="Leave lesson" onSelect={() => session.current?.player.end()} />
            </View>
          </SpatialNavigationNode>
        </Overlay>
      )}
    </Screen>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(14,17,22,0.94)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: px(28),
        padding: px(96),
      }}
    >
      <View style={{ maxWidth: px(1300), gap: px(28), alignItems: 'center' }}>{children}</View>
      <View style={{ width: px(120), height: px(8), borderRadius: px(4), backgroundColor: c.brand }} />
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
