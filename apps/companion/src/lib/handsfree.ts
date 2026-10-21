import type { MpPoint } from './landmarks';

export const RAISE_HOLD_MS = 1500;
export const GESTURE_DEBOUNCE_MS = 3000;

/** Raise-hand gesture: a wrist above the nose for 1.5 s → one toggle, then a 3 s cool-down. */
export class RaiseHandDetector {
  private since: number | null = null;
  private coolUntil = 0;
  /** Returns true exactly once per completed gesture. */
  push(pose: MpPoint[] | null | undefined, now: number): boolean {
    const nose = pose?.[0];
    const up =
      !!pose &&
      !!nose &&
      (nose.visibility ?? 0) >= 0.5 &&
      [15, 16].some((i) => (pose[i]?.visibility ?? 0) >= 0.5 && pose[i]!.y < nose.y);
    if (!up || now < this.coolUntil) {
      if (!up) this.since = null;
      return false;
    }
    this.since ??= now;
    if (now - this.since >= RAISE_HOLD_MS) {
      this.since = null;
      this.coolUntil = now + GESTURE_DEBOUNCE_MS;
      return true;
    }
    return false;
  }
  /** 0..1 while the hand is held up (for a progress ring). */
  progress(now: number): number {
    return this.since === null ? 0 : Math.min(1, (now - this.since) / RAISE_HOLD_MS);
  }
}

export type VoiceAction = 'pause' | 'play' | 'repeat' | 'easier' | 'next' | 'ok';

const WORDS: [RegExp, VoiceAction][] = [
  [/\b(pause|stop|wait)\b/, 'pause'],
  [/\b(play|resume|continue|go)\b/, 'play'],
  [/\b(repeat|again|back)\b/, 'repeat'],
  [/\b(easier|too hard)\b/, 'easier'],
  [/\b(next|skip)\b/, 'next'],
  [/\b(ok|okay|ready|i'?m fine)\b/, 'ok'],
];

/** Maps a recognised phrase to a control action (first match wins). */
export function parseVoiceCommand(text: string): VoiceAction | null {
  const t = text.toLowerCase();
  for (const [re, action] of WORDS) if (re.test(t)) return action;
  return null;
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function speechRecognitionAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    )
  );
}

/** Push-to-talk: listens for one phrase. Uses the browser's speech recognition (may use the vendor's service). */
export function listenOnce(lang: string): Promise<string> {
  const W = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new Error('Voice commands are not supported in this browser.'));
  const r = new Ctor();
  r.lang = lang;
  r.interimResults = false;
  r.maxAlternatives = 1;
  return new Promise((resolve, reject) => {
    let done = false;
    r.onresult = (e) => {
      done = true;
      resolve(e.results[0]?.[0]?.transcript ?? '');
    };
    r.onerror = (e) => {
      done = true;
      reject(
        new Error(
          e.error === 'not-allowed' ? 'Microphone access was blocked.' : "Didn't catch that — try again.",
        ),
      );
    };
    r.onend = () => !done && reject(new Error("Didn't catch that — try again."));
    r.start();
  });
}
