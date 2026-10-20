/**
 * Counts bytes over a rolling 1-second window. Used by the privacy pill: every WebSocket send goes
 * through `bodyPoints`; every media upload function would go through `video` (the camera page has none,
 * so it measures 0 — the number is measured, never hard-coded).
 */
export class ByteMeter {
  private events: { t: number; bytes: number }[] = [];
  total = 0;
  add(bytes: number, t = performance.now()) {
    this.events.push({ t, bytes });
    this.total += bytes;
    this.trim(t);
  }
  /** bytes per second over the last second */
  rate(t = performance.now()): number {
    this.trim(t);
    return this.events.reduce((a, e) => a + e.bytes, 0);
  }
  private trim(t: number) {
    while (this.events.length && t - this.events[0]!.t > 1000) this.events.shift();
  }
}

export const meters = { bodyPoints: new ByteMeter(), video: new ByteMeter() };

export function formatRate(bytesPerSec: number): string {
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}
