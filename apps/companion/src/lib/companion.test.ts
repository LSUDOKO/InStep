import { makeHand, makePose } from '@instep/gate-engine/fixtures';
import { parseMessage, encode } from '@instep/protocol';
import { describe, expect, it } from 'vitest';
import { route } from '../App';
import { anatomicalSide, buildLandmarksMessage, RateLimiter, type VisionResult } from './landmarks';
import { ByteMeter, formatRate } from './meter';
import { placementAdvice } from './placement';

const mpPose = (spec = {}) => makePose(spec).map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.v }));
const mpHand = (curl?: [number, number, number, number, number]) => makeHand(curl ? { curl } : {});

describe('landmarks message', () => {
  const r: VisionResult = {
    pose: mpPose(),
    hands: [
      { landmarks: mpHand([0, 0, 1, 1, 0]), handedness: { score: 0.97, categoryName: 'Left' } },
      { landmarks: mpHand(), handedness: { score: 0.6, categoryName: 'Right' } },
    ],
    objects: [{ label: 'chair', score: 0.812345, box: [0.61234, 0.4, 0.25, 0.55] }],
  };
  it('includes only the requested trackers and validates against the protocol', () => {
    const m = buildLandmarksMessage(r, {
      seq: 7,
      ts: 1000.4,
      role: 'host',
      tracking: ['pose', 'objects'],
      fps: 29.94,
    });
    expect(m.hands).toBeUndefined();
    expect(m.pose).toHaveLength(33);
    expect(m.objects).toEqual([{ label: 'chair', score: 0.81, box: [0.612, 0.4, 0.25, 0.55] }]);
    expect(m).toMatchObject({ seq: 7, ts: 1000, fps: 29.9, mirrored: false });
    expect(parseMessage(encode(m)).ok).toBe(true);
  });
  it('maps MediaPipe (selfie-convention) handedness to anatomical sides', () => {
    expect(anatomicalSide('Left')).toBe('right');
    expect(anatomicalSide('Right')).toBe('left');
    const m = buildLandmarksMessage(r, { seq: 1, ts: 1, role: 'guest', tracking: ['hands'], fps: 30 });
    expect(m.handScores).toEqual({ right: 0.97, left: 0.6 });
    expect(m.hands?.right).toHaveLength(21);
    expect(m.pose).toBeUndefined();
  });
  it('keeps the more confident hand when both claim the same side', () => {
    const both: VisionResult = {
      hands: [
        { landmarks: mpHand(), handedness: { score: 0.5, categoryName: 'Left' } },
        { landmarks: mpHand(), handedness: { score: 0.9, categoryName: 'Left' } },
      ],
    };
    expect(
      buildLandmarksMessage(both, { seq: 1, ts: 1, role: 'host', tracking: ['hands'], fps: 30 }).handScores,
    ).toEqual({ right: 0.9 });
  });
  it('sends pose: null when nobody is in view (camera alive, person absent)', () => {
    expect(
      buildLandmarksMessage({ pose: null }, { seq: 1, ts: 1, role: 'host', tracking: ['pose'], fps: 30 })
        .pose,
    ).toBeNull();
  });
  it('pose + chair message stays within 1.5 KB', () => {
    const m = buildLandmarksMessage(r, {
      seq: 99999,
      ts: Date.now(),
      role: 'host',
      tracking: ['pose', 'objects'],
      fps: 30,
    });
    expect(new TextEncoder().encode(encode(m)).length).toBeLessThanOrEqual(1536);
  });
});

describe('rate limiter', () => {
  it('allows at most 30 sends per second from a 60 fps loop', () => {
    const l = new RateLimiter(30);
    let n = 0;
    for (let t = 0; t < 1000; t += 1000 / 60) if (l.allow(t)) n++;
    expect(n).toBeLessThanOrEqual(31);
    expect(n).toBeGreaterThanOrEqual(29);
  });
});

describe('byte meter', () => {
  it('measures a rolling one-second rate and a total', () => {
    const m = new ByteMeter();
    m.add(500, 0);
    m.add(700, 600);
    expect(m.rate(900)).toBe(1200);
    expect(m.rate(1500)).toBe(700);
    expect(m.total).toBe(1200);
    expect(new ByteMeter().rate(0)).toBe(0);
    expect(formatRate(2048)).toBe('2.0 KB/s');
  });
});

describe('placement helper', () => {
  it('front view: asks to step back when feet are out of frame', () => {
    const p = mpPose();
    p[27]!.visibility = 0.1;
    expect(placementAdvice('front', { pose: p }, ['pose']).message).toBe(
      'Step back until your feet are visible',
    );
    expect(placementAdvice('front', { pose: mpPose() }, ['pose'])).toEqual({
      ok: true,
      message: 'Great — I can see all of you',
    });
    expect(placementAdvice('front', { pose: null }, ['pose']).ok).toBe(false);
  });
  it('side view: wants a narrow shoulder line', () => {
    expect(placementAdvice('side', { pose: mpPose() }, ['pose']).message).toBe(
      'Turn the camera to your side for this lesson',
    );
    const side = mpPose();
    side[12]!.x = side[11]!.x - 0.01; // shoulders overlap from the side
    side[24]!.x = side[23]!.x - 0.01;
    expect(placementAdvice('side', { pose: side }, ['pose'])).toEqual({
      ok: true,
      message: 'Great — side view looks good',
    });
  });
  it('hands view: asks to show a hand, then to adjust distance', () => {
    expect(placementAdvice('hands', { hands: [] }, ['hands']).message).toBe('Show your hand to the camera');
    expect(
      placementAdvice(
        'hands',
        { hands: [{ landmarks: mpHand(), handedness: { score: 1, categoryName: 'Left' } }] },
        ['hands'],
      ).ok,
    ).toBe(true);
  });
});

describe('router', () => {
  it('routes /c/ to the camera and unknown paths to not-found', () => {
    expect(route('/c/')).toEqual({ name: 'camera' });
    expect(route('/c')).toEqual({ name: 'camera' });
    expect(route('/c/nope')).toEqual({ name: 'not-found' });
  });
});
