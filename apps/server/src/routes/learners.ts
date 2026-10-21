import { randomBytes, randomUUID } from 'node:crypto';
import { rest } from '@instep/protocol';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DAY_MS } from '../progress';
import type { Deps } from '../deps';
import { createProgressQueries, toProfile, type ProfileRow } from '../progress';
import { parse } from './util';

export const MAX_PROFILES = 6;
const REPORT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function learnerRoutes(app: FastifyInstance, { db, lessons, config, now }: Deps) {
  const { getProfile, sessionsSince, progress } = createProgressQueries(db, now);

  app.get('/api/profiles', async () =>
    (db.prepare('SELECT * FROM profiles ORDER BY created_at').all() as ProfileRow[]).map(toProfile),
  );

  app.post('/api/profiles', async (req, reply) => {
    const b = parse(rest.CreateProfile, req.body, reply);
    if (!b) return;
    const count = (db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n;
    if (count >= MAX_PROFILES)
      return reply.code(409).send({ error: 'TOO_MANY_PROFILES', message: `Up to ${MAX_PROFILES} profiles` });
    const id = randomUUID().slice(0, 8);
    db.prepare('INSERT INTO profiles VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      b.name,
      b.avatar,
      b.affectedHand,
      b.planSessionsPerWeek,
      new Date(now()).toISOString(),
    );
    return reply.code(201).send(toProfile(getProfile(id)!));
  });

  app.delete('/api/profiles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!getProfile(id)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such profile' });
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
    return reply.code(204).send();
  });

  app.get('/api/profiles/:id/progress', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = parse(z.object({ days: z.coerce.number().int().min(1).max(90).default(14) }), req.query, reply);
    if (!q) return;
    if (!getProfile(id)) return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such profile' });
    return progress(id, q.days);
  });

  app.post('/api/sessions', async (req, reply) => {
    const s = parse(rest.SessionSummary, req.body, reply);
    if (!s) return;
    if (!getProfile(s.profileId))
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such profile' });
    if (!lessons.get(s.lessonId))
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such lesson' });
    const id = randomUUID();
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id,
      s.profileId,
      s.lessonId,
      s.startedAt,
      s.endedAt,
      s.gatesPassed,
      s.gatesTotal,
      s.reps,
      s.bestHoldSec,
      s.avgBpm,
      s.swayStops,
      s.coachTips,
      s.easierMode ? 1 : 0,
    );
    const ins = db.prepare('INSERT INTO gate_attempts VALUES (?, ?, ?, ?, ?, ?)');
    for (const a of s.attempts)
      ins.run(id, a.gateId, a.type, a.msToPass, a.coached ? 1 : 0, a.passed ? 1 : 0);
    return reply.code(201).send({ id });
  });

  /** Gate-type pass history used by adaptive tolerance (passes in the learner's last 3 sessions). */
  app.get('/api/profiles/:id/recent-passes', async (req) => {
    const { id } = req.params as { id: string };
    const rows = db
      .prepare(
        `SELECT a.type AS type, SUM(a.passed) AS passes FROM gate_attempts a
        WHERE a.session_id IN (SELECT id FROM sessions WHERE profile_id = ? ORDER BY started_at DESC LIMIT 3)
        GROUP BY a.type`,
      )
      .all(id) as { type: string; passes: number }[];
    return Object.fromEntries(rows.map((r) => [r.type, r.passes]));
  });

  app.post('/api/reports', async (req, reply) => {
    const b = parse(rest.CreateReport, req.body, reply);
    if (!b) return;
    if (!getProfile(b.profileId))
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such profile' });
    const token = randomBytes(16).toString('hex'); // 128-bit, unguessable
    const t = now();
    db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?)').run(
      token,
      b.profileId,
      b.days,
      new Date(t).toISOString(),
      new Date(t + REPORT_TTL_MS).toISOString(),
    );
    return reply.code(201).send({ token, url: `${config.PUBLIC_URL.replace(/\/$/, '')}/c/report/${token}` });
  });

  app.get('/api/reports/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const r = db.prepare('SELECT * FROM reports WHERE token = ?').get(token) as
      { profile_id: string; days: number; expires_at: string } | undefined;
    if (!r || Date.parse(r.expires_at) < now())
      return reply
        .code(404)
        .send({ error: 'NOT_FOUND', message: 'This report link has expired or does not exist.' });
    const p = getProfile(r.profile_id);
    if (!p) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Profile removed' });
    const since = now() - r.days * DAY_MS;
    const sessions = sessionsSince(p.id, since);
    const coached = db
      .prepare(
        `SELECT a.gate_id AS gateId, s.lesson_id AS lessonId, SUM(a.coached) AS coachedCount FROM gate_attempts a
        JOIN sessions s ON s.id = a.session_id WHERE s.profile_id = ? AND s.started_at >= ?
        GROUP BY a.gate_id, s.lesson_id HAVING coachedCount > 0 ORDER BY coachedCount DESC LIMIT 5`,
      )
      .all(p.id, new Date(since).toISOString()) as {
      gateId: string;
      lessonId: string;
      coachedCount: number;
    }[];
    const planned = Math.round((p.plan_sessions_per_week * r.days) / 7);
    return {
      learner: { name: p.name, avatar: p.avatar },
      days: r.days,
      progress: progress(p.id, r.days),
      adherence: { done: sessions.length, planned },
      swayStops: sessions.reduce((a, s) => a + s.sway_stops, 0),
      sessions: sessions.map((s) => ({
        lessonId: s.lesson_id,
        lessonTitle: lessons.get(s.lesson_id)?.title ?? s.lesson_id,
        startedAt: s.started_at,
        gatesPassed: s.gates_passed,
        gatesTotal: s.gates_total,
        reps: s.reps,
        bestHoldSec: s.best_hold_sec,
        avgBpm: s.avg_bpm,
        easierMode: !!s.easier_mode,
      })),
      needsCoaching: coached.map((c) => ({
        ...c,
        label: lessons.get(c.lessonId)?.track.gates.find((g) => g.id === c.gateId)?.label ?? c.gateId,
      })),
    };
  });
}
