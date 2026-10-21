import { logger } from '../log';

const log = logger('ai');

/** One daily cap for every real AI call (coach tips, gate labels, voice). Resets at UTC midnight. */
export function createAiBudget(maxPerDay: number, now: () => number = Date.now) {
  let day = '';
  let used = 0;
  return {
    get used() {
      return used;
    },
    /** Reserves one call; false when the daily limit is reached. */
    take(kind: string): boolean {
      const today = new Date(now()).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used >= maxPerDay) {
        log.warn('daily AI limit reached', { kind, limit: maxPerDay });
        return false;
      }
      used++;
      log.info('ai call', { kind, usedToday: used, limit: maxPerDay });
      return true;
    },
  };
}
export type AiBudget = ReturnType<typeof createAiBudget>;
