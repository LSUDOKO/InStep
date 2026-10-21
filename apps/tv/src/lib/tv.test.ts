import { chair, makePose } from '@instep/gate-engine/fixtures';
import { IstepTrack } from '@instep/istep-format';
import { encode, packPose, type Message } from '@instep/protocol';
import { describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from './api';
import { createLessonSession } from './lessonSession';
import { createStore } from './store';
import { TvRelay } from './tvRelay';

/** In-memory WebSocket stand-in. */
function fakeSocketFactory() {
  const sockets: ReturnType<typeof make>[] = [];
  function make() {
    const s = {
      readyState: 0,
      sent: [] as Message[],
      onopen: null as null | (() => void),
      onmessage: null as null | ((ev: { data: unknown }) => void),
      onclose: null as null | (() => void),
      onerror: null as null | ((e: unknown) => void),
      send(d: string) {
        s.sent.push(JSON.parse(d));
      },
      close() {
        s.readyState = 3;
        s.onclose?.();
      },
      open() {
        s.readyState = 1;
        s.onopen?.();
      },
      receive(m: Message) {
        s.onmessage?.({ data: encode(m) });
      },
    };
    sockets.push(s);
    return s;
  }
  return { sockets, make };
}

describe('store', () => {
  it('merges patches and notifies subscribers', () => {
    const st = createStore({ a: 1, b: 'x' });
    const fn = vi.fn();
    const off = st.subscribe(fn);
    st.set({ a: 2 });
    st.set((s) => ({ b: s.b + 'y' }));
    expect(st.get()).toEqual({ a: 2, b: 'xy' });
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    st.set({ a: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('api client', () => {
  const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  it('joins the base URL and parses JSON', async () => {
    const f = vi.fn(() => ok({ ok: true, version: '1', mockAi: true }));
    const api = new Api('http://10.0.2.2:8788/', f as unknown as typeof fetch);
    expect(await api.health()).toEqual({ ok: true, version: '1', mockAi: true });
    expect((f.mock.calls[0] as unknown[])[0]).toBe('http://10.0.2.2:8788/api/health');
  });
  it('turns server errors and network failures into ApiError', async () => {
    const api = new Api('http://h', (() =>
      ok({ message: 'No such lesson' }, 404)) as unknown as typeof fetch);
    await expect(api.lesson('x')).rejects.toMatchObject({ status: 404, message: 'No such lesson' });
    const down = new Api('http://h', (() => Promise.reject(new TypeError('net'))) as unknown as typeof fetch);
    await expect(down.health()).rejects.toBeInstanceOf(ApiError);
    await expect(down.health()).rejects.toMatchObject({
      status: 0,
      message: "Can't reach the InStep server at http://h",
    });
  });
  it('voice returns null on 204', async () => {
    const api = new Api('http://h', (() =>
      Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch);
    expect(await api.voice('hi', 'en-US')).toBeNull();
  });
  it('rejects an invalid track file', async () => {
    const api = new Api('http://h', (() => ok({ istep: '9' })) as unknown as typeof fetch);
    await expect(api.track({ trackUrl: '/t' } as never)).rejects.toMatchObject({ status: 422 });
  });
});

describe('tv relay client', () => {
  it('creates a room, tracks peers, converts landmarks and drops stale frames', () => {
    const f = fakeSocketFactory();
    const relay = new TvRelay('ws://h/ws', f.make as never);
    const frames: number[] = [];
    const peers: number[] = [];
    relay.listen({ onFrame: (_p, fr) => frames.push(fr.ts), onPeers: (p) => peers.push(p.length) });
    relay.connect();
    const s = f.sockets[0]!;
    s.open();
    expect(s.sent[0]).toMatchObject({ type: 'hello', role: 'tv' });
    s.receive({ type: 'room_created', room: '4831', joinUrl: 'https://x/c/?room=4831' });
    expect(relay.status).toBe('online');
    s.receive({ type: 'peer_joined', role: 'host', peerId: 'p1' });
    const lm = (seq: number, ts: number): Message => ({
      type: 'landmarks',
      seq,
      ts,
      role: 'host',
      from: 'p1',
      mirrored: false,
      pose: packPose(makePose()),
    });
    s.receive(lm(2, 200));
    s.receive(lm(1, 100)); // stale
    s.receive(lm(3, 300));
    s.receive({ ...lm(4, 400), from: 'stranger' } as Message);
    expect(frames).toEqual([200, 300]);
    s.receive({ type: 'peer_left', role: 'host', peerId: 'p1' });
    expect(peers).toEqual([1, 0]);
  });
  it('reconnects with backoff and rejoins its room', () => {
    vi.useFakeTimers();
    const f = fakeSocketFactory();
    const relay = new TvRelay('ws://h/ws', f.make as never);
    relay.connect();
    f.sockets[0]!.open();
    f.sockets[0]!.receive({ type: 'room_created', room: '1111', joinUrl: 'u' });
    f.sockets[0]!.close();
    expect(relay.status).toBe('offline');
    vi.advanceTimersByTime(600);
    f.sockets[1]!.open();
    expect(f.sockets[1]!.sent[0]).toMatchObject({ type: 'hello', role: 'tv', room: '1111' });
    // room expired meanwhile → start a fresh one
    f.sockets[1]!.receive({ type: 'error', code: 'ROOM_NOT_FOUND', message: 'x' });
    expect(f.sockets[1]!.sent.at(-1)).toMatchObject({ type: 'hello', role: 'tv' });
    expect(f.sockets[1]!.sent.at(-1)).not.toHaveProperty('room');
    relay.close();
    vi.useRealTimers();
  });
});

describe('lesson session', () => {
  const track = IstepTrack.parse({
    istep: '1.0',
    id: 'l',
    title: 'Heel',
    channel: 'fall_prevention',
    language: 'en-US',
    video: { src: 'v.mp4', durationSec: 10 },
    tracking: ['pose', 'objects'],
    camera: { view: 'front', hint: 'hip height' },
    disclaimer:
      'Use exercises prescribed or approved by your physiotherapist. Stop if you feel pain, dizziness or unsteadiness.',
    defaults: { coachAfterSec: 2 },
    gates: [
      {
        id: 'chair',
        t: 1,
        type: 'safety_prerequisite',
        label: 'Stand next to a chair',
        fallbackTip: 'Add a chair.',
        minFrames: 3,
        checks: [{ kind: 'object_near', object: 'chair', near: 'hips', maxDistance: 0.35, minScore: 0.5 }],
      },
    ],
  });

  function setup() {
    let clock = 0;
    const f = fakeSocketFactory();
    const relay = new TvRelay('ws://h/ws', f.make as never);
    relay.connect();
    const s = f.sockets[0]!;
    s.open();
    s.receive({ type: 'room_created', room: '2222', joinUrl: 'u' });
    s.receive({ type: 'peer_joined', role: 'host', peerId: 'p1' });
    const media = {
      t: 0,
      playing: false,
      play() {
        this.playing = true;
      },
      pause() {
        this.playing = false;
      },
      seek(x: number) {
        this.t = x;
      },
      currentTime() {
        return this.t;
      },
    };
    const api = {
      coach: vi.fn(async () => ({ tip: 'Place a sturdy chair beside you.', source: 'mock' as const })),
      voice: vi.fn(async () => null),
      saveSession: vi.fn(async () => ({ id: 's1' })),
    };
    const session = createLessonSession({
      lessonId: 'l',
      track,
      media,
      relay,
      api: api as unknown as Api,
      profile: {
        id: 'p',
        name: 'M',
        avatar: 'sun',
        affectedHand: 'none',
        planSessionsPerWeek: 5,
        createdAt: '',
      },
      voiceOn: true,
      now: () => clock,
      onChange: () => undefined,
    });
    let seq = 0;
    const step = (ms: number, objects: ReturnType<typeof chair>[] = []) => {
      for (let i = 0; i < ms / 33; i++) {
        clock += 33;
        if (media.playing) media.t += 0.033;
        s.receive({
          type: 'landmarks',
          seq: seq++,
          ts: clock,
          role: 'host',
          from: 'p1',
          mirrored: false,
          pose: packPose(makePose()),
          objects,
        });
        session.tick();
      }
    };
    return { s, session, api, media, step };
  }

  it('sends lesson_tracking, gate_state, coach caption + companion speech, gate_result, and saves the session', async () => {
    const { s, session, api, step } = setup();
    expect(s.sent.find((m) => m.type === 'lesson_tracking')).toMatchObject({
      tracking: ['pose', 'objects'],
      cameraView: 'front',
      gesturesEnabled: true,
    });
    session.start();
    step(1200);
    expect(session.view().phase).toBe('gate');
    step(2200);
    expect(api.coach).toHaveBeenCalledWith(
      expect.objectContaining({
        gateId: 'chair',
        channel: 'fall_prevention',
        audience: 'older_adult',
        errorBucket: expect.any(String),
      }),
    );
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(session.view().caption).toEqual({ text: 'Place a sturdy chair beside you.', source: 'mock' });
    expect(s.sent.some((m) => m.type === 'speak')).toBe(true);
    const states = s.sent.filter((m) => m.type === 'gate_state');
    expect(states.length).toBeGreaterThan(0);
    expect(states.length).toBeLessThanOrEqual(Math.ceil(3400 / 200) + 1); // ≤ 5/s
    step(600, [chair()]);
    expect(s.sent.some((m) => m.type === 'gate_result')).toBe(true);
    const summary = await session.finish();
    expect(summary.gatesPassed).toBe(1);
    expect(api.saveSession).toHaveBeenCalledTimes(1);
    expect(api.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'p', lessonId: 'l', coachTips: 1 }),
    );
    expect(s.sent.some((m) => m.type === 'lesson_ended')).toBe(true);
    await session.finish(); // idempotent
    expect(api.saveSession).toHaveBeenCalledTimes(1);
  });

  it('forwards companion controls and reports camera loss to the room', () => {
    const { s, session, step, media } = setup();
    session.start();
    step(300);
    s.receive({ type: 'control', action: 'pause', source: 'gesture' });
    expect(session.view().phase).toBe('paused');
    expect(media.playing).toBe(false);
    s.receive({ type: 'control', action: 'play', source: 'voice' });
    expect(session.view().phase).toBe('playing');
    for (let i = 0; i < 70; i++) session.tick(); // no frames, clock frozen → no loss
    expect(session.view().phase).toBe('playing');
  });
});
