import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makePose } from '@instep/gate-engine/fixtures';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PIN, makeServer, tinyVideo } from './helpers';

let app: FastifyInstance;
let srv: Awaited<ReturnType<typeof makeServer>>;
beforeAll(async () => {
  srv = await makeServer();
  app = srv.app;
});
afterAll(() => app.close());

const json = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) => app.inject({ method, url, ...(payload !== undefined ? { payload: payload as object } : {}), headers });

/** Builds a multipart body without extra dependencies. */
function multipart(files: { field: string; name: string; type: string; data: Buffer }[]) {
  const boundary = '----instep' + Math.random().toString(16).slice(2);
  const parts = files.map((f) =>
    Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`,
      ),
      f.data,
      Buffer.from('\r\n'),
    ]),
  );
  return {
    body: Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)]),
    type: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('health and catalog', () => {
  it('health reports mock mode', async () => {
    expect((await json('GET', '/api/health')).json()).toEqual({ ok: true, version: '0.1.0', mockAi: true });
  });
  it('catalog lists only lessons with recorded video, hero channels first', async () => {
    const c = (await json('GET', '/api/lessons')).json();
    expect(c.channels.map((x: { channel: string }) => x.channel)).toEqual([
      'fall_prevention',
      'sign_language',
      'stroke_rehab',
      'cpr',
      'kids',
    ]);
    const ids = c.channels.flatMap((x: { lessons: { id: string }[] }) => x.lessons.map((l) => l.id));
    expect(ids).toEqual([
      'fall-heel-raise-v1',
      'fall-single-leg-stand-v1',
      'rehab-hand-open-close-v1',
      'cpr-rhythm-v1',
      'kids-forest-walk-v1',
    ]); // animated demos (scripts/make-animated-lesson.py), Pexels CPR, generated kids video
  });
  it('?all=1 also includes the drafts waiting for video', async () => {
    const c = (await json('GET', '/api/lessons?all=1')).json();
    expect(c.channels.flatMap((x: { lessons: unknown[] }) => x.lessons)).toHaveLength(7);
  });
  it('lesson detail, track and media', async () => {
    const d = (await json('GET', '/api/lessons/fall-heel-raise-v1')).json();
    expect(d).toMatchObject({
      videoUrl: '/media/fall-heel-raise-v1/video.mp4',
      gateCount: 4,
      needs: ['A sturdy chair', 'Room to stand'],
    });
    expect(d.disclaimer).toMatch(/physiotherapist/);
    const t = await json('GET', d.trackUrl);
    expect(t.headers['content-type']).toContain('application/vnd.instep+json');
    expect(t.json().istep).toBe('1.0');
    const v = await app.inject({ method: 'GET', url: d.videoUrl, headers: { range: 'bytes=0-99' } });
    expect(v.statusCode).toBe(206);
    expect((await json('GET', '/media/fall-heel-raise-v1/track.istep')).statusCode).toBe(404); // only listed assets
    expect((await json('GET', '/media/fall-heel-raise-v1/..%2F..%2Fetc%2Fpasswd')).statusCode).toBe(404);
    expect((await json('GET', '/api/lessons/nope')).statusCode).toBe(404);
  });
});

describe('profiles, sessions, progress, reports', () => {
  let pid = '';
  it('creates profiles with validation and a limit of 6', async () => {
    expect(
      (await json('POST', '/api/profiles', { name: '', avatar: 'sun', affectedHand: 'none' })).statusCode,
    ).toBe(400);
    const r = await json('POST', '/api/profiles', { name: 'Margaret', avatar: 'sun', affectedHand: 'none' });
    expect(r.statusCode).toBe(201);
    pid = r.json().id;
    for (let i = 0; i < 5; i++)
      await json('POST', '/api/profiles', { name: `P${i}`, avatar: 'leaf', affectedHand: 'left' });
    expect(
      (await json('POST', '/api/profiles', { name: 'X', avatar: 'leaf', affectedHand: 'left' })).statusCode,
    ).toBe(409);
    expect((await json('GET', '/api/profiles')).json()).toHaveLength(6);
    const last = (await json('GET', '/api/profiles')).json().at(-1).id;
    expect((await json('DELETE', `/api/profiles/${last}`)).statusCode).toBe(204);
    expect((await json('DELETE', `/api/profiles/${last}`)).statusCode).toBe(404);
  });
  const session = () => ({
    profileId: pid,
    lessonId: 'fall-heel-raise-v1',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    gatesPassed: 4,
    gatesTotal: 4,
    reps: 5,
    bestHoldSec: 2.4,
    avgBpm: null,
    swayStops: 1,
    coachTips: 1,
    easierMode: false,
    attempts: [
      { gateId: 'chair', type: 'safety_prerequisite', msToPass: 4000, coached: true, passed: true },
      { gateId: 'raises', type: 'rep_count', msToPass: 20000, coached: false, passed: true },
    ],
  });
  it('stores sessions and returns progress with a streak', async () => {
    expect((await json('POST', '/api/sessions', session())).statusCode).toBe(201);
    expect((await json('POST', '/api/sessions', { ...session(), lessonId: 'nope' })).statusCode).toBe(404);
    expect((await json('POST', '/api/sessions', { ...session(), reps: -2 })).statusCode).toBe(400);
    const p = (await json('GET', `/api/profiles/${pid}/progress?days=14`)).json();
    expect(p.days).toHaveLength(14);
    expect(p.totals).toMatchObject({ sessions: 1, reps: 5, streakDays: 1 });
    expect((await json('GET', `/api/profiles/${pid}/recent-passes`)).json()).toEqual({
      safety_prerequisite: 1,
      rep_count: 1,
    });
    expect((await json('GET', `/api/profiles/zzz/progress`)).statusCode).toBe(404);
  });
  it('creates a share report with real session data', async () => {
    const r = (await json('POST', '/api/reports', { profileId: pid, days: 7 })).json();
    expect(r.token).toMatch(/^[0-9a-f]{32}$/);
    expect(r.url).toBe(`https://example.test:8787/c/report/${r.token}`);
    const rep = (await json('GET', `/api/reports/${r.token}`)).json();
    expect(rep.learner).toEqual({ name: 'Margaret', avatar: 'sun' });
    expect(rep.adherence).toEqual({ done: 1, planned: 5 });
    expect(rep.swayStops).toBe(1);
    expect(rep.needsCoaching[0]).toMatchObject({
      gateId: 'chair',
      label: 'Stand next to a sturdy chair',
      coachedCount: 1,
    });
    expect((await json('GET', '/api/reports/deadbeef')).statusCode).toBe(404);
  });
});

describe('coach and voice', () => {
  const req = (over: object = {}) => ({
    profileId: 'p-coach',
    lessonId: 'fall-heel-raise-v1',
    gateId: 'stand',
    gateType: 'pose_match',
    channel: 'fall_prevention',
    language: 'en-US',
    label: 'Stand tall',
    worst: { name: 'l_knee', hint: 'straighten your left knee' },
    errorBucket: 'l_knee:-20..-10',
    attemptsOnGate: 1,
    audience: 'older_adult',
    fallbackTip: 'Stand up straight with soft knees.',
    ...over,
  });
  it('mock tip, then cache, then rate-limited fallback', async () => {
    const a = (await json('POST', '/api/coach', req())).json();
    expect(a).toEqual({ tip: "You're close — straighten your left knee.", source: 'mock' });
    expect((await json('POST', '/api/coach', req())).json().source).toBe('cache');
    expect((await json('POST', '/api/coach', req({ errorBucket: 'other' }))).json()).toEqual({
      tip: 'Stand up straight with soft knees.',
      source: 'fallback',
    });
  });
  it('rejects malformed coach requests', async () => {
    expect((await json('POST', '/api/coach', req({ channel: 'nba' }))).statusCode).toBe(400);
  });
  it('voice returns 204 when Polly is off', async () => {
    expect((await json('POST', '/api/voice', { text: 'Nice!', language: 'en-US' })).statusCode).toBe(204);
  });
});

describe('creator flow', () => {
  const pin = { 'x-creator-pin': PIN };
  let id = '';
  it('requires the creator PIN', async () => {
    expect((await json('GET', '/api/creator/check')).statusCode).toBe(401);
    expect((await json('GET', '/api/creator/check', undefined, pin)).statusCode).toBe(204);
    expect(
      (await json('POST', '/api/lessons', { title: 'x', channel: 'kids', creator: 'me' })).statusCode,
    ).toBe(401);
    expect(
      (
        await json(
          'POST',
          '/api/lessons',
          { title: 'x', channel: 'kids', creator: 'me' },
          { 'x-creator-pin': '0000' },
        )
      ).statusCode,
    ).toBe(401);
  });
  it('creates a draft with channel defaults (disclaimer, tracking, sway stop)', async () => {
    const r = await json(
      'POST',
      '/api/lessons',
      {
        title: 'Sit to stand!',
        channel: 'fall_prevention',
        creator: 'Dr. A. Chen, PT',
        needs: ['A sturdy chair'],
      },
      pin,
    );
    expect(r.statusCode).toBe(201);
    id = r.json().id;
    expect(id).toMatch(/^sit-to-stand-[0-9a-f]{6}$/);
    const track = (await json('GET', `/api/lessons/${id}/track`)).json();
    expect(track).toMatchObject({ tracking: ['pose', 'objects'], safety: { swayStop: { enabled: true } } });
    expect(track.disclaimer).toMatch(/physiotherapist/);
  });
  it('publish is refused until there is a video and gates', async () => {
    const r = await json('POST', `/api/lessons/${id}/publish`, undefined, pin);
    expect(r.statusCode).toBe(400);
    expect(r.json().problems).toEqual([
      'Record or upload a demonstration video first.',
      'Add at least one gate.',
    ]);
  });
  it('uploads WebM + reference, transcodes to H.264 MP4 and makes a poster', async () => {
    const webm = join(srv.data, 'demo.webm');
    tinyVideo(webm, 'webm');
    const ref = {
      fps: 15,
      tracking: ['pose'],
      frames: [{ t: 0, pose: makePose().map((p) => [p.x, p.y, p.z, p.v]) }],
    };
    const mp = multipart([
      { field: 'video', name: 'demo.webm', type: 'video/webm', data: readFileSync(webm) },
      {
        field: 'reference',
        name: 'reference.json',
        type: 'application/json',
        data: Buffer.from(JSON.stringify(ref)),
      },
    ]);
    const r = await app.inject({
      method: 'POST',
      url: `/api/lessons/${id}/assets`,
      payload: mp.body,
      headers: { ...pin, 'content-type': mp.type },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({
      videoUrl: `/media/${id}/video.mp4`,
      posterUrl: `/media/${id}/poster.jpg`,
      referenceUrl: `/media/${id}/reference.json`,
    });
    const head = (await app.inject({ method: 'GET', url: `/media/${id}/video.mp4` })).rawPayload
      .subarray(4, 8)
      .toString();
    expect(head).toBe('ftyp');
  }, 30_000);
  it('rejects an invalid reference', async () => {
    const mp = multipart([
      {
        field: 'reference',
        name: 'r.json',
        type: 'application/json',
        data: Buffer.from('{"fps":15,"tracking":[],"frames":[{"t":0,"pose":[[1]]}]}'),
      },
    ]);
    const r = await app.inject({
      method: 'POST',
      url: `/api/lessons/${id}/assets`,
      payload: mp.body,
      headers: { ...pin, 'content-type': mp.type },
    });
    expect(r.statusCode).toBe(400);
  });
  it('probes the video duration and proposes auto-gates from the reference', async () => {
    const track = (await json('GET', `/api/lessons/${id}/track`)).json();
    expect(track.video.durationSec).toBeCloseTo(2, 0);
    expect((await json('POST', `/api/lessons/fall-heel-raise-v1/autogates`, undefined, pin)).statusCode).toBe(
      400,
    );
    const r = await json('POST', `/api/lessons/${id}/autogates`, undefined, pin);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().labels).toBe('template');
    expect(r.json().gates[0]).toMatchObject({ type: 'safety_prerequisite' }); // fall prevention always starts with the chair check
    expect((await json('GET', `/api/lessons/${id}`)).json().editable).toBe(true);
  });
  it('validates the track, publishes and broadcasts catalog_updated', async () => {
    const track = (await json('GET', `/api/lessons/${id}/track`)).json();
    const bad = await json(
      'PUT',
      `/api/lessons/${id}/track`,
      { ...track, gates: [{ id: 'g', t: 1, type: 'nope' }] },
      pin,
    );
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors[0].path).toBe('gates[0].type');
    const good = {
      ...track,
      video: { src: 'video.mp4', durationSec: 2 },
      gates: [
        {
          id: 'g1',
          t: 1,
          type: 'hold_duration',
          label: 'Stand tall',
          target: { source: 'reference', atSec: 0 },
          joints: ['l_knee', 'r_knee'],
          holdSec: 2,
          fallbackTip: 'Stand up tall.',
        },
      ],
    };
    expect((await json('PUT', `/api/lessons/${id}/track`, good, pin)).statusCode).toBe(200);
    const spy = vi.spyOn(srv.deps.relay, 'broadcastCatalog');
    const pub = await json('POST', `/api/lessons/${id}/publish`, undefined, pin);
    expect(pub.statusCode).toBe(200);
    expect(pub.json()).toMatchObject({ status: 'published', isNew: true });
    expect(spy).toHaveBeenCalledWith(id);
    const ids = (await json('GET', '/api/lessons'))
      .json()
      .channels[0].lessons.map((l: { id: string }) => l.id);
    expect(ids).toContain(id);
  });
  it('seed lessons are read-only', async () => {
    expect((await json('PUT', '/api/lessons/fall-heel-raise-v1/track', {}, pin)).statusCode).toBe(409);
  });
  it('unknown routes return JSON 404', async () => {
    expect((await json('GET', '/api/nope')).json().error).toBe('NOT_FOUND');
  });
});
