import { soundOut, unlockSounds } from './sounds';

/**
 * Original metronome click (a short synthesized tick — no recorded or copyrighted audio).
 * Plays through the shared companion sound output, so the mute toggle silences it too.
 * Created from a user gesture (Start camera) so browsers allow sound.
 */
export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  bpm = 0;

  unlock() {
    this.ctx = unlockSounds();
  }

  set(bpm: number | null) {
    if ((bpm ?? 0) === this.bpm) return;
    this.stop();
    if (!bpm || !this.ctx) return;
    this.bpm = bpm;
    this.timer = setInterval(() => this.tick(), 60000 / bpm);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.bpm = 0;
  }

  private tick() {
    const ctx = this.ctx;
    const out = soundOut();
    if (!ctx || !out) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1000;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    o.connect(g).connect(out);
    o.start();
    o.stop(ctx.currentTime + 0.06);
  }
}
