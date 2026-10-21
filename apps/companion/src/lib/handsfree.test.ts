import { makePose } from '@instep/gate-engine/fixtures';
import { describe, expect, it } from 'vitest';
import { parseVoiceCommand, RaiseHandDetector } from './handsfree';

const mp = (spec = {}) => makePose(spec).map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.v }));

describe('raise-hand gesture', () => {
  it('fires once after 1.5 s with a wrist above the nose, then cools down 3 s', () => {
    const d = new RaiseHandDetector();
    const up = mp({ r_shoulder: 175, r_elbow: 178 });
    const fired: number[] = [];
    for (let t = 0; t <= 6000; t += 100) if (d.push(up, t)) fired.push(t);
    expect(fired).toEqual([1500, 6000]); // 1.5 s hold → fire; 3 s cool-down; a fresh 1.5 s hold → fire
  });
  it('lowering the hand resets the timer; arms down never fire', () => {
    const d = new RaiseHandDetector();
    const up = mp({ r_shoulder: 175, r_elbow: 178 });
    expect(d.push(up, 0)).toBe(false);
    expect(d.push(mp(), 1000)).toBe(false);
    expect(d.push(up, 1100)).toBe(false);
    expect(d.push(up, 2500)).toBe(false);
    expect(d.progress(2500)).toBeCloseTo(0.93, 1);
    expect(d.push(up, 2600)).toBe(true);
    const e = new RaiseHandDetector();
    for (let t = 0; t < 5000; t += 100) expect(e.push(mp(), t)).toBe(false);
    expect(e.push(null, 0)).toBe(false);
  });
});

describe('voice commands', () => {
  it.each([
    ['Pause please', 'pause'],
    ['OK resume', 'play'],
    ['can you repeat that', 'repeat'],
    ['this is too hard', 'easier'],
    ['skip', 'next'],
    ["I'm fine", 'ok'],
    ['hello there', null],
  ])('%s → %s', (text, action) => expect(parseVoiceCommand(text)).toBe(action));
});
