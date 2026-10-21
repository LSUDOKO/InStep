import { errorBucket, type Frame } from '@instep/gate-engine';
import {
  createGatedPlayer,
  type MediaAdapter,
  type PlayerEvent,
  type SessionSummary,
  type Snapshot,
} from '@instep/gated-player';
import type { IstepTrack, ReferenceTimeline } from '@instep/istep-format';
import type { CoachRequest, Profile, SessionSummary as SessionBody } from '@instep/protocol';
import type { Api } from './api';
import type { Peer, TvRelay } from './tvRelay';

export const GATE_STATE_MIN_MS = 200; // ≤ 5 gate_state messages / s to the room
export const TICK_MS = 50;

export type Caption = { text: string; source: string } | null;

export type SessionView = Snapshot & {
  caption: Caption;
  /** briefly true after a pass, for the chime / glow */
  justPassedAt: number;
  /** latest frame per participant, for skeleton drawing */
  frames: Record<string, Frame>;
  peers: Peer[];
};

const AUDIENCE: Record<IstepTrack['channel'], CoachRequest['audience']> = {
  fall_prevention: 'older_adult',
  stroke_rehab: 'adult',
  sign_language: 'family',
  cpr: 'adult',
  kids: 'child',
};

/**
 * Glue between the gated-player controller, the relay and the server for one lesson. Pure TS (no React):
 * the Player screen drives `tick()` on a timer and renders `view()`.
 */
export function createLessonSession(o: {
  lessonId: string;
  track: IstepTrack;
  reference?: ReferenceTimeline;
  media: MediaAdapter;
  relay: TvRelay;
  api: Api;
  profile: Profile;
  recentPasses?: Record<string, number>;
  voiceOn: boolean;
  /** plays a TV audio URL; return false if the platform cannot (companion then speaks) */
  playAudio?: (url: string) => boolean;
  now: () => number;
  onChange: () => void;
}) {
  const { track, relay, api } = o;
  let caption: Caption = null;
  let justPassedAt = 0;
  let lastGateState = 0;
  let saved: Promise<unknown> | null = null;
  let summary: SessionSummary | null = null;
  const frames: Record<string, Frame> = {};
  const startedAtIso = new Date(o.now()).toISOString();

  const player = createGatedPlayer({
    track,
    media: o.media,
    now: o.now,
    ...(o.reference ? { reference: o.reference } : {}),
    ...(o.profile.affectedHand !== 'none' ? { affectedHand: o.profile.affectedHand } : {}),
    ...(o.recentPasses ? { recentPasses: o.recentPasses } : {}),
    onEvent: (e) => void onEvent(e),
  });

  async function speak(text: string) {
    if (!o.voiceOn) return;
    try {
      const url = await api.voice(text, track.language);
      if (url && o.playAudio?.(url)) return;
    } catch {
      // fall through to companion speech
    }
    relay.send({ type: 'speak', text, language: track.language });
  }

  async function onEvent(e: PlayerEvent) {
    switch (e.type) {
      case 'gate_start':
        caption = null;
        break;
      case 'gate_passed':
        justPassedAt = o.now();
        caption = null;
        relay.send({ type: 'gate_result', gateId: e.gate.id, passed: true, ms: e.ms });
        break;
      case 'safety_stop':
        relay.send({ type: 'safety_event', kind: 'sway_stop' });
        void speak("Let's sit down and rest.");
        break;
      case 'camera_lost':
        relay.send({ type: 'safety_event', kind: 'camera_lost' });
        break;
      case 'resumed':
        relay.send({ type: 'safety_event', kind: 'resumed' });
        break;
      case 'gate_stuck': {
        const ev = e.eval;
        const req: CoachRequest = {
          profileId: o.profile.id,
          lessonId: o.lessonId,
          gateId: e.gate.id,
          gateType: e.gate.type,
          channel: track.channel,
          language: track.language,
          label: e.gate.label,
          ...(ev.worst ? { worst: ev.worst } : {}),
          ...(ev.jointErrors ? { jointErrors: ev.jointErrors as Record<string, number> } : {}),
          ...(ev.fingerErrors?.length
            ? { fingerErrors: ev.fingerErrors.map(({ finger, hint }) => ({ finger, hint })) }
            : {}),
          errorBucket: errorBucket(ev),
          attemptsOnGate: e.attempts,
          audience: AUDIENCE[track.channel],
          fallbackTip: e.gate.fallbackTip,
        };
        try {
          const r = await o.api.coach(req);
          caption = { text: r.tip, source: r.source };
        } catch {
          caption = { text: e.gate.fallbackTip, source: 'fallback' };
        }
        o.onChange();
        void speak(caption.text);
        break;
      }
      case 'ended':
        summary = e.summary;
        relay.send({ type: 'lesson_ended', lessonId: o.lessonId });
        saved ??= api.saveSession(toBody(e.summary)).catch(() => undefined);
        break;
      default:
        break;
    }
    o.onChange();
  }

  function toBody(s: SessionSummary): SessionBody {
    return {
      profileId: o.profile.id,
      lessonId: o.lessonId,
      startedAt: startedAtIso,
      endedAt: new Date(s.endedAt).toISOString(),
      gatesPassed: s.gatesPassed,
      gatesTotal: s.gatesTotal,
      reps: s.reps,
      bestHoldSec: Math.round(s.bestHoldSec * 10) / 10,
      avgBpm: s.avgBpm,
      swayStops: s.swayStops,
      coachTips: s.coachTips,
      easierMode: s.easierMode,
      attempts: s.attempts,
    };
  }

  const gesturesEnabled = track.channel !== 'kids'; // kids poses raise arms, which is the pause gesture
  const unlisten = relay.listen({
    onPeers(peers) {
      for (const p of peers)
        player.join({
          peerId: p.peerId,
          role: p.role === 'guest' ? 'guest' : 'host',
          ...(p.name ? { name: p.name } : {}),
        });
      const ids = new Set(peers.map((p) => p.peerId));
      for (const p of player.snapshot().participants) if (!ids.has(p.peerId)) player.leave(p.peerId);
      sendTracking();
    },
    onFrame(peer, f) {
      frames[peer.peerId] = f;
      player.pushFrame(peer.peerId, f);
    },
    onControl(action) {
      player.control(action);
      o.onChange();
    },
  });

  function sendTracking() {
    relay.send({
      type: 'lesson_tracking',
      lessonId: o.lessonId,
      tracking: track.tracking,
      cameraView: track.camera.view,
      gesturesEnabled,
      hint: track.camera.hint,
    });
  }

  for (const p of relay.peers.values())
    player.join({
      peerId: p.peerId,
      role: p.role === 'guest' ? 'guest' : 'host',
      ...(p.name ? { name: p.name } : {}),
    });
  sendTracking();

  return {
    player,
    start() {
      player.start();
      o.onChange();
    },
    tick() {
      player.tick();
      const s = player.snapshot();
      const t = o.now();
      if (s.gate && t - lastGateState >= GATE_STATE_MIN_MS) {
        lastGateState = t;
        for (const [peerId, ev] of Object.entries(s.evals))
          relay.send({
            type: 'gate_state',
            gateId: s.gate.id,
            gateType: s.gate.type,
            status: ev.status,
            progress: Math.round(ev.progress * 100) / 100,
            label: s.gate.label,
            peerId,
            ...(ev.worst ? { worst: ev.worst } : {}),
          });
      }
    },
    view(): SessionView {
      return {
        ...player.snapshot(),
        caption,
        justPassedAt,
        frames: { ...frames },
        peers: [...relay.peers.values()],
      };
    },
    /** End early (Back) or at video end; saves the session once. */
    async finish(): Promise<SessionSummary> {
      if (!summary) player.end();
      await saved;
      return summary!;
    },
    dispose() {
      unlisten();
    },
  };
}
export type LessonSession = ReturnType<typeof createLessonSession>;
