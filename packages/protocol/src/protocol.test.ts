import { makeHand, makePose } from '@instep/gate-engine/fixtures';
import { describe, expect, it } from 'vitest';
import {
  encode,
  packHand,
  packPose,
  parseMessage,
  rest,
  ROOM_MESSAGES,
  toFrame,
  type Message,
} from './index';

const pose = packPose(makePose());
const hand = packHand(makeHand({ curl: [0, 0, 1, 1, 0] }));

const samples: Message[] = [
  { type: 'hello', v: 1, role: 'tv', deviceId: 'tv-1' },
  { type: 'hello', v: 1, role: 'guest', room: '4831', name: 'Tom', deviceId: 'p-2' },
  { type: 'room_created', room: '4831', joinUrl: 'https://h/c/?room=4831' },
  { type: 'joined', room: '4831', peerId: 'p1', role: 'host' },
  { type: 'peer_joined', role: 'host', peerId: 'p1' },
  { type: 'peer_left', role: 'guest', name: 'Tom', peerId: 'p2' },
  { type: 'error', code: 'ROOM_NOT_FOUND', message: 'No room 1234' },
  { type: 'ping', ts: 1 },
  { type: 'pong', ts: 1 },
  {
    type: 'lesson_tracking',
    lessonId: 'l',
    tracking: ['pose', 'objects'],
    cameraView: 'front',
    gesturesEnabled: true,
  },
  {
    type: 'landmarks',
    seq: 1042,
    ts: 1729440000123,
    role: 'host',
    mirrored: false,
    pose,
    hands: { left: null, right: hand },
    handScores: { right: 0.93 },
    objects: [{ label: 'chair', score: 0.81, box: [0.62, 0.4, 0.25, 0.55] }],
    fps: 27.5,
  },
  {
    type: 'gate_state',
    gateId: 'g1',
    gateType: 'hand_sign',
    status: 'waiting',
    progress: 0.2,
    label: 'ILY',
    worst: { name: 'middle', hint: 'curl' },
  },
  { type: 'gate_result', gateId: 'g1', passed: true, ms: 4200 },
  { type: 'control', action: 'toggle_pause', source: 'gesture' },
  { type: 'safety_event', kind: 'sway_stop' },
  { type: 'catalog_updated', lessonId: 'l' },
  { type: 'speak', text: 'Nice!', language: 'en-US' },
  { type: 'lesson_ended', lessonId: 'l' },
];

describe('ws messages', () => {
  it.each(samples.map((s) => [s.type, s] as const))('%s round-trips', (_t, m) => {
    const r = parseMessage(encode(m));
    expect(r).toEqual({ ok: true, msg: m });
  });
  it('covers every message type', () => {
    expect(new Set(samples.map((s) => s.type)).size).toBe(18 - 1); // hello appears twice
  });
  it.each([
    ['not json', '{', /invalid JSON/],
    ['unknown type', JSON.stringify({ type: 'nuke' }), /type/],
    ['bad room', JSON.stringify({ type: 'hello', v: 1, role: 'host', room: '12', deviceId: 'x' }), /room/],
    ['wrong version', JSON.stringify({ type: 'hello', v: 2, role: 'tv', deviceId: 'x' }), /v/],
    ['short pose', JSON.stringify({ ...samples[10], pose: pose.slice(1) }), /pose/],
    ['bad role', JSON.stringify({ ...samples[10], role: 'tv' }), /role/],
  ])('rejects %s', (_n, text, err) => {
    const r = parseMessage(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(err);
  });
  it('relay forwards only room messages', () => {
    expect(ROOM_MESSAGES.has('landmarks')).toBe(true);
    expect(ROOM_MESSAGES.has('hello')).toBe(false);
  });
});

describe('wire format', () => {
  it('pose-only landmarks message is ≤ 1.5 KB', () => {
    const m = {
      type: 'landmarks',
      seq: 99999,
      ts: 1729440000123,
      role: 'host',
      mirrored: true,
      pose,
      objects: [{ label: 'chair', score: 0.81, box: [0.62, 0.4, 0.25, 0.55] }],
      fps: 29.9,
    };
    expect(new TextEncoder().encode(JSON.stringify(m)).length).toBeLessThanOrEqual(1536);
  });
  it('hands-only landmarks message is ≤ 1.5 KB', () => {
    const m = {
      type: 'landmarks',
      seq: 99999,
      ts: 1729440000123,
      role: 'host',
      mirrored: true,
      hands: { left: hand, right: hand },
      fps: 29.9,
    };
    expect(new TextEncoder().encode(JSON.stringify(m)).length).toBeLessThanOrEqual(1536);
  });
  it('quantises to 3 decimals and converts to a Frame', () => {
    expect(packPose([{ x: 0.123456, y: 0.5, z: -0.0004, v: 0.987 }])).toEqual([[0.123, 0.5, 0, 0.99]]);
    const r = parseMessage(encode(samples[10]!));
    if (!r.ok || r.msg.type !== 'landmarks') throw new Error('fixture');
    const f = toFrame(r.msg);
    expect(f.pose).toHaveLength(33);
    expect(f.hands?.right).toHaveLength(21);
    expect(f.hands?.left).toBeNull();
    expect(f.objects?.[0]?.label).toBe('chair');
    expect(f.handScores?.right).toBe(0.93);
    expect(toFrame({ type: 'landmarks', seq: 1, ts: 1, role: 'host', mirrored: false }).pose).toBeNull();
  });
});

describe('rest schemas', () => {
  it('validates a session summary and rejects negatives', () => {
    const s = {
      profileId: 'p',
      lessonId: 'l',
      startedAt: 'a',
      endedAt: 'b',
      gatesPassed: 3,
      gatesTotal: 4,
      reps: 5,
      bestHoldSec: 2,
      avgBpm: null,
      swayStops: 0,
      coachTips: 1,
      easierMode: false,
      attempts: [],
    };
    expect(rest.SessionSummary.safeParse(s).success).toBe(true);
    expect(rest.SessionSummary.safeParse({ ...s, reps: -1 }).success).toBe(false);
  });
  it('profile defaults', () => {
    expect(
      rest.CreateProfile.parse({ name: 'Margaret', avatar: 'sun', affectedHand: 'none' }).planSessionsPerWeek,
    ).toBe(5);
  });
  it('coach request rejects unknown channels', () => {
    const c = {
      profileId: 'p',
      lessonId: 'l',
      gateId: 'g',
      gateType: 'hold_duration',
      channel: 'fall_prevention',
      language: 'en-US',
      label: 'Rise',
      errorBucket: 'x',
      attemptsOnGate: 1,
      audience: 'older_adult',
      fallbackTip: 't',
    };
    expect(rest.CoachRequest.safeParse(c).success).toBe(true);
    expect(rest.CoachRequest.safeParse({ ...c, channel: 'nba' }).success).toBe(false);
  });
});
