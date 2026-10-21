import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CHANNELS } from '@instep/istep-format';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Deps } from './deps';
import { logger } from './log';
import { createProgressQueries, DAY_MS } from './progress';

const log = logger('mcp');

/**
 * Optional MCP server (Streamable HTTP at /mcp, stateless) so an AI assistant can answer
 * "Did Dad finish his balance exercises this week?". Read-only, aggregates only — never video,
 * never landmark streams. Enabled with MCP_ENABLED=true.
 */
export function createMcpServer({ db, lessons, now }: Pick<Deps, 'db' | 'lessons' | 'now'>) {
  const q = createProgressQueries(db, now);
  const server = new McpServer({ name: 'instep', version: '0.1.0' });

  server.registerTool(
    'list_lessons',
    {
      title: 'List InStep lessons',
      description:
        'Lists the published InStep lessons (title, channel, duration, number of steps), optionally for one channel.',
      inputSchema: { channel: z.enum(CHANNELS).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ channel }) => {
      const rows = lessons
        .list()
        .filter((l) => !channel || l.channel === channel)
        .map((l) => {
          const s = lessons.summary(l);
          return {
            id: s.id,
            title: s.title,
            channel: s.channel,
            durationSec: s.durationSec,
            steps: s.gateCount,
            creator: s.creator,
          };
        });
      return {
        content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
        structuredContent: { lessons: rows },
      };
    },
  );

  server.registerTool(
    'get_progress_report',
    {
      title: 'Get a learner progress report',
      description:
        'Aggregated practice report for a learner profile by name over the last N days (sessions vs plan, reps, holds, streak, rest breaks). Numbers only; InStep never records video.',
      inputSchema: {
        profileName: z.string().min(1).max(40),
        days: z.number().int().min(1).max(90).default(7),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ profileName, days }) => {
      const p = q.findProfileByName(profileName);
      if (!p)
        return {
          content: [{ type: 'text', text: `No learner profile named "${profileName}".` }],
          isError: true,
        };
      const progress = q.progress(p.id, days);
      const sessions = q.sessionsSince(p.id, now() - days * DAY_MS);
      const report = {
        learner: p.name,
        days,
        sessions: { done: sessions.length, planned: Math.round((p.plan_sessions_per_week * days) / 7) },
        reps: progress.totals.reps,
        bestHoldSec: Math.max(0, ...sessions.map((s) => s.best_hold_sec)),
        streakDays: progress.totals.streakDays,
        restBreaks: sessions.reduce((a, s) => a + s.sway_stops, 0),
        lessons: [...new Set(sessions.map((s) => lessons.get(s.lesson_id)?.title ?? s.lesson_id))],
        lastSession: sessions.at(-1)?.started_at ?? null,
        note: 'Aggregates from body points only. InStep is a practice aid, not a medical device.',
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        structuredContent: report,
      };
    },
  );
  return server;
}

/** Mounts the MCP endpoint on a Fastify app (stateless transport, one per request). */
export async function mountMcp(
  app: FastifyInstance,
  deps: Pick<Deps, 'db' | 'lessons' | 'now'> & { token?: string },
) {
  const handle = async (req: FastifyRequest, reply: FastifyReply) => {
    if (deps.token && req.headers.authorization !== `Bearer ${deps.token}`)
      return reply
        .code(401)
        .send({ error: 'UNAUTHORIZED', message: 'MCP token required (Authorization: Bearer …)' });
    const server = createMcpServer(deps);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    const url = `http://${req.headers.host ?? 'localhost'}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const body = req.method === 'POST' ? JSON.stringify(req.body) : undefined;
    const res = await transport.handleRequest(
      new Request(url, { method: req.method, headers, ...(body ? { body } : {}) }),
    );
    reply.code(res.status);
    res.headers.forEach((v, k) => reply.header(k, v));
    const text = await res.text();
    await server.close();
    return reply.send(text);
  };
  app.post('/mcp', handle);
  app.get('/mcp', handle);
  app.delete('/mcp', handle);
  log.info('MCP endpoint enabled at /mcp');
}
