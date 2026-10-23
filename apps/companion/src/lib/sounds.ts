/**
 * Original companion sounds, synthesized in code (no audio files): a soft pass chime, a light tick per counted
 * rep, and the shared context the CPR metronome plays through. Quiet, short and mutable. Every sound has a
 * visual twin on the TV or this screen — sound is never the only feedback.
 * Mute is separate from prefers-reduced-motion (that one only changes visuals).
 */
const KEY = 'instep.sounds.muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

/** Creates/resumes the audio context. Call from a user gesture so browsers allow sound later. */
export function unlockSounds(): AudioContext | null {
  if (!ctx && typeof AudioContext !== 'undefined') {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  void ctx?.resume();
  return ctx;
}

/** Output node every companion sound connects to (muting it silences them all at once). */
export const soundOut = (): AudioNode | null => master;

export const soundsMuted = () => muted;

export function setSoundsMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.01);
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    // private mode / storage blocked: the choice lasts for this page only
  }
}

/** One soft sine note with a fast attack and an exponential tail. */
function note(freq: number, at: number, len: number, peak: number) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

/** Gate passed: two rising notes (E6 → A6), about half a second. */
export function playChime() {
  note(1318.5, 0, 0.35, 0.12);
  note(1760, 0.09, 0.45, 0.1);
}

/** One counted rep: a short, light wood-like tick. */
export function playTick() {
  note(2093, 0, 0.06, 0.08);
}

/**
 * Should this gate_state make a rep tick? Only rep-count gates, only this phone's learner, only when the
 * count goes up (the pass itself gets the chime). `last` tracks the previous progress per gate.
 */
export function repTick(
  m: { gateId: string; gateType: string; status: string; progress: number; peerId?: string },
  self: string,
  last: { gateId: string; progress: number },
): boolean {
  if (m.gateType !== 'rep_count' || (self && m.peerId && m.peerId !== self)) return false;
  const up = m.gateId === last.gateId && m.progress > last.progress;
  last.gateId = m.gateId;
  last.progress = m.progress;
  return up && m.status !== 'passed';
}
