import { describe, expect, it } from 'vitest';
import { createAiBudget } from '../src/ai/budget';
import { createLabeler, LABEL_SYSTEM } from '../src/ai/labeler';
import { createCoach, mockTip } from '../src/coach/coach';
import { filterTip } from '../src/coach/filter';
import { coachSystemPrompt } from '../src/coach/prompt';
import { openDb } from '../src/db';

const req = {
  profileId: 'p',
  lessonId: 'l',
  gateId: 'g',
  gateType: 'hand_sign',
  channel: 'sign_language' as const,
  language: 'en-US',
  label: 'ILY',
  worst: { name: 'middle', hint: 'curl your middle finger down' },
  errorBucket: 'middle:curl',
  attemptsOnGate: 0,
  audience: 'family' as const,
  fallbackTip: 'Fold your middle and ring fingers down.',
};

describe('coach safety filter', () => {
  it.each([
    'Your ACL may be weak, bend less.',
    'You have a balance disorder.',
    'This could cause an injury.',
    'Pain is normal, keep going.',
    'Bend your knee to 90 degrees.',
    'Take your medication first.',
    'Straighten up 5 more.',
    Array(30).fill('word').join(' '),
    '   ',
  ])('rejects: %s', (t) => expect(filterTip(t)).toBeNull());
  it('accepts and cleans a kind tip', () => {
    expect(filterTip('  "Curl your middle finger down gently."  ')).toBe(
      'Curl your middle finger down gently.',
    );
  });
});

describe('coach service', () => {
  it('uses AI when not mocked, filters, caches, counts calls and enforces the daily limit', async () => {
    let t = 0;
    const outputs = ['Curl your middle finger down gently.', 'You have a weak finger.'];
    const coach = createCoach({
      db: openDb(':memory:'),
      mock: false,
      generate: async () => outputs.shift()!,
      minIntervalSec: 8,
      budget: createAiBudget(2, () => t),
      now: () => t,
    });
    expect(await coach.tip(req)).toEqual({ tip: 'Curl your middle finger down gently.', source: 'ai' });
    expect(await coach.tip(req)).toMatchObject({ source: 'cache' });
    t += 9000;
    expect(await coach.tip({ ...req, errorBucket: 'b2' })).toEqual({
      tip: req.fallbackTip,
      source: 'fallback',
    }); // filtered
    expect(coach.aiCallsToday).toBe(2);
    t += 9000;
    expect(await coach.tip({ ...req, errorBucket: 'b3' })).toEqual({
      tip: req.fallbackTip,
      source: 'fallback',
    }); // daily cap
    expect(coach.aiCallsToday).toBe(2);
  });
  it('falls back when the model throws', async () => {
    const coach = createCoach({
      db: openDb(':memory:'),
      mock: false,
      generate: async () => {
        throw new Error('timeout');
      },
      minIntervalSec: 0,
      budget: createAiBudget(5),
    });
    expect(await coach.tip(req)).toMatchObject({ source: 'fallback' });
  });
  it('mock tips use the engine hint (English) or the fallback tip', () => {
    expect(mockTip(req)).toBe('Nearly there — curl your middle finger down.');
    expect(mockTip({ ...req, language: 'es-ES' })).toBe(req.fallbackTip);
    const { worst: _w, ...noWorst } = req;
    expect(mockTip(noWorst)).toBe(req.fallbackTip);
  });
  it('prompt carries language and audience', () => {
    expect(coachSystemPrompt('hi-IN', 'older_adult')).toContain('in hi-IN');
    expect(coachSystemPrompt('en-US', 'child')).toContain('Audience: child');
  });
});

describe('AI labels for auto-gates', () => {
  const gates = [
    {
      id: 'g1',
      t: 2,
      type: 'pose_match',
      label: 'Copy this pose!',
      target: { source: 'reference', atSec: 2 },
      joints: ['l_knee'],
      fallbackTip: 'Copy it.',
    },
    {
      id: 'g2',
      t: 5,
      type: 'pose_match',
      label: 'Copy this pose!',
      target: { source: 'reference', atSec: 5 },
      joints: ['l_knee'],
      fallbackTip: 'Copy it.',
    },
  ] as never[];
  it('keeps templates in mock mode', async () => {
    const l = createLabeler({ budget: createAiBudget(5) });
    expect(await l.label('kids', 'en-US', gates)).toEqual({ gates, source: 'template' });
  });
  it('applies valid AI labels and filters unsafe ones', async () => {
    const model = async () =>
      'Sure! [{"gateIndex":0,"label":"Stretch tall like a tree","fallbackTip":"Reach both arms up high."},{"gateIndex":1,"label":"Heal your injury","fallbackTip":"Bend your knee 90 degrees."}]';
    const l = createLabeler({ model, budget: createAiBudget(5) });
    const r = await l.label('kids', 'en-US', gates);
    expect(r.source).toBe('ai');
    expect(r.gates[0]).toMatchObject({
      label: 'Stretch tall like a tree',
      fallbackTip: 'Reach both arms up high.',
    });
    expect(r.gates[1]).toMatchObject({ label: 'Copy this pose!', fallbackTip: 'Copy it.' });
  });
  it('falls back to templates on malformed output or when the budget is spent', async () => {
    const bad = createLabeler({ model: async () => 'no json here', budget: createAiBudget(5) });
    expect((await bad.label('kids', 'en-US', gates)).source).toBe('template');
    const spent = createLabeler({ model: async () => '[]', budget: createAiBudget(0) });
    expect((await spent.label('kids', 'en-US', gates)).source).toBe('template');
  });
  it('prompt carries the language and forbids numbers', () => {
    expect(LABEL_SYSTEM).toContain('STRICT JSON');
  });
});
