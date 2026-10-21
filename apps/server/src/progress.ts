import type { rest } from '@instep/protocol';
import type { Db } from './db';

export const DAY_MS = 24 * 60 * 60 * 1000;

export type ProfileRow = {
  id: string;
  name: string;
  avatar: string;
  affected_hand: string;
  plan_sessions_per_week: number;
  created_at: string;
};
export type SessionRow = {
  id: string;
  lesson_id: string;
  started_at: string;
  ended_at: string;
  gates_passed: number;
  gates_total: number;
  reps: number;
  best_hold_sec: number;
  avg_bpm: number | null;
  sway_stops: number;
  coach_tips: number;
  easier_mode: number;
};

export const toProfile = (r: ProfileRow): rest.Profile => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  affectedHand: r.affected_hand as rest.Profile['affectedHand'],
  planSessionsPerWeek: r.plan_sessions_per_week,
  createdAt: r.created_at,
});

/** Profile + session aggregates shared by the REST API and the MCP server. Aggregates only, never video. */
export function createProgressQueries(db: Db, now: () => number) {
  const getProfile = (id: string) =>
    db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined;
  const findProfileByName = (name: string) =>
    db.prepare('SELECT * FROM profiles WHERE lower(name) = lower(?)').get(name.trim()) as
      ProfileRow | undefined;
  const sessionsSince = (profileId: string, since: number) =>
    db
      .prepare('SELECT * FROM sessions WHERE profile_id = ? AND started_at >= ? ORDER BY started_at')
      .all(profileId, new Date(since).toISOString()) as SessionRow[];

  /** Daily buckets for the last `days` days (UTC dates), plus totals and current streak. */
  function progress(profileId: string, days: number): rest.Progress {
    const today = Math.floor(now() / DAY_MS) * DAY_MS;
    const start = today - (days - 1) * DAY_MS;
    const rows = sessionsSince(profileId, start);
    const buckets = Array.from({ length: days }, (_, i) => ({
      date: new Date(start + i * DAY_MS).toISOString().slice(0, 10),
      sessions: 0,
      reps: 0,
      holdSec: 0,
    }));
    for (const s of rows) {
      const b = buckets.find((d) => d.date === s.started_at.slice(0, 10));
      if (!b) continue;
      b.sessions++;
      b.reps += s.reps;
      b.holdSec += s.best_hold_sec;
    }
    let streakDays = 0;
    for (let i = buckets.length - 1; i >= 0 && buckets[i]!.sessions > 0; i--) streakDays++;
    return {
      days: buckets,
      totals: {
        sessions: rows.length,
        reps: rows.reduce((a, s) => a + s.reps, 0),
        holdSec: Math.round(rows.reduce((a, s) => a + s.best_hold_sec, 0) * 10) / 10,
        streakDays,
      },
    };
  }
  return { getProfile, findProfileByName, sessionsSince, progress };
}
