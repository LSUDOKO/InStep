import type { CoachRequest, CoachResponse } from '@instep/protocol';
import type { Db } from '../db';
import { logger } from '../log';
import { filterTip } from './filter';

const log = logger('coach');

/** Generates a tip with a real model. Implemented for Bedrock in the AWS milestone. */
export type TipGenerator = (req: CoachRequest) => Promise<string>;

export type CoachOptions = {
  db: Db;
  mock: boolean;
  generate?: TipGenerator;
  minIntervalSec: number;
  maxCallsPerDay: number;
  now?: () => number;
};

/** Template tip used in mock mode: the engine's hint plus a kind closer. */
export function mockTip(req: CoachRequest): string {
  if (!req.worst || !req.language.startsWith('en')) return req.fallbackTip;
  const openers = ['Nearly there —', "You're close —", 'Nice effort —'];
  return `${openers[req.attemptsOnGate % openers.length]} ${req.worst.hint}.`;
}

/**
 * Coach service: cache → rate limit → mock or AI → safety filter → cache.
 * Cache hits are served even when rate-limited because they cost nothing.
 */
export function createCoach(opts: CoachOptions) {
  const now = opts.now ?? Date.now;
  const lastCall = new Map<string, number>();
  let day = '';
  let aiCallsToday = 0;

  const getCached = opts.db.prepare('SELECT tip FROM coach_cache WHERE key = ?');
  const putCached = opts.db.prepare(
    'INSERT OR REPLACE INTO coach_cache (key, tip, lang, created_at) VALUES (?, ?, ?, ?)',
  );

  return {
    get aiCallsToday() {
      return aiCallsToday;
    },
    async tip(req: CoachRequest): Promise<CoachResponse> {
      const key = [req.lessonId, req.gateId, req.errorBucket, req.language].join('|');
      const cached = getCached.get(key) as { tip: string } | undefined;
      if (cached) return { tip: cached.tip, source: 'cache' };

      const t = now();
      const prev = lastCall.get(req.profileId);
      if (prev !== undefined && t - prev < opts.minIntervalSec * 1000)
        return { tip: req.fallbackTip, source: 'fallback' };
      lastCall.set(req.profileId, t);

      if (opts.mock || !opts.generate) {
        const tip = filterTip(mockTip(req)) ?? req.fallbackTip;
        putCached.run(key, tip, req.language, new Date(t).toISOString());
        return { tip, source: 'mock' };
      }

      const today = new Date(t).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        aiCallsToday = 0;
      }
      if (aiCallsToday >= opts.maxCallsPerDay) {
        log.warn('daily AI limit reached', { limit: opts.maxCallsPerDay });
        return { tip: req.fallbackTip, source: 'fallback' };
      }
      aiCallsToday++;
      log.info('ai call', { aiCallsToday, limit: opts.maxCallsPerDay });
      try {
        const tip = filterTip(await opts.generate(req));
        if (!tip) return { tip: req.fallbackTip, source: 'fallback' };
        putCached.run(key, tip, req.language, new Date(t).toISOString());
        return { tip, source: 'ai' };
      } catch (e) {
        log.warn('ai error, using fallback', { error: (e as Error).message });
        return { tip: req.fallbackTip, source: 'fallback' };
      }
    },
  };
}
export type Coach = ReturnType<typeof createCoach>;
