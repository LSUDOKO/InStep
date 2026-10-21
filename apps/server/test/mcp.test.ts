import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeServer } from './helpers';

let srv: Awaited<ReturnType<typeof makeServer>>;
beforeAll(async () => {
  srv = await makeServer({ MCP_ENABLED: 'true' });
});
afterAll(() => srv.app.close());

const rpc = (id: number, method: string, params: Record<string, unknown> = {}) =>
  srv.app
    .inject({
      method: 'POST',
      url: '/mcp',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      payload: { jsonrpc: '2.0', id, method, params },
    })
    .then((r) => {
      // stateless transport answers with JSON or a single SSE event
      const text = r.body;
      const json = text.startsWith('event:')
        ? text
            .split('\n')
            .find((l) => l.startsWith('data:'))!
            .slice(5)
        : text;
      return { status: r.statusCode, body: JSON.parse(json) };
    });

describe('MCP server', () => {
  it('initializes and lists the two read-only tools', async () => {
    const init = await rpc(1, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 't', version: '1' },
    });
    expect(init.body.result.serverInfo.name).toBe('instep');
    const tools = await rpc(2, 'tools/list');
    expect(tools.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'get_progress_report',
      'list_lessons',
    ]);
    expect(
      tools.body.result.tools.every(
        (t: { annotations?: { readOnlyHint?: boolean } }) => t.annotations?.readOnlyHint,
      ),
    ).toBe(true);
  });
  it('list_lessons returns published lessons, filtered by channel', async () => {
    const r = await rpc(3, 'tools/call', { name: 'list_lessons', arguments: { channel: 'fall_prevention' } });
    expect(r.body.result.structuredContent.lessons.map((l: { id: string }) => l.id)).toEqual([
      'fall-heel-raise-v1',
    ]);
  });
  it('get_progress_report aggregates a learner by name and never includes media', async () => {
    const p = (
      await srv.app.inject({
        method: 'POST',
        url: '/api/profiles',
        payload: { name: 'Dad', avatar: 'sun', affectedHand: 'none' },
      })
    ).json();
    const now = new Date().toISOString();
    await srv.app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        profileId: p.id,
        lessonId: 'fall-heel-raise-v1',
        startedAt: now,
        endedAt: now,
        gatesPassed: 4,
        gatesTotal: 4,
        reps: 5,
        bestHoldSec: 2,
        avgBpm: null,
        swayStops: 1,
        coachTips: 0,
        easierMode: false,
        attempts: [],
      },
    });
    const r = await rpc(4, 'tools/call', {
      name: 'get_progress_report',
      arguments: { profileName: 'dad', days: 7 },
    });
    expect(r.body.result.structuredContent).toMatchObject({
      learner: 'Dad',
      sessions: { done: 1, planned: 5 },
      reps: 5,
      restBreaks: 1,
      streakDays: 1,
      lessons: ['Heel raises (with chair)'],
    });
    expect(JSON.stringify(r.body)).not.toMatch(/video|\.mp4|pose/);
    const miss = await rpc(5, 'tools/call', {
      name: 'get_progress_report',
      arguments: { profileName: 'Nobody' },
    });
    expect(miss.body.result.isError).toBe(true);
  });
  it('requires the bearer token when MCP_TOKEN is set', async () => {
    const locked = await makeServer({ MCP_ENABLED: 'true', MCP_TOKEN: 's3cret' });
    const body = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
    expect((await locked.app.inject({ method: 'POST', url: '/mcp', payload: body })).statusCode).toBe(401);
    const ok = await locked.app.inject({
      method: 'POST',
      url: '/mcp',
      payload: body,
      headers: { authorization: 'Bearer s3cret', accept: 'application/json, text/event-stream' },
    });
    expect(ok.statusCode).toBe(200);
    await locked.app.close();
  });
  it('is absent when MCP_ENABLED is false', async () => {
    const off = await makeServer();
    expect((await off.app.inject({ method: 'POST', url: '/mcp', payload: {} })).statusCode).toBe(404);
    await off.app.close();
  });
});
