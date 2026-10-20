import type { AddressInfo } from 'node:net';
import { makePose } from '@instep/gate-engine/fixtures';
import { encode, packPose, type Message } from '@instep/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { makeServer } from './helpers';

let url = '';
let srv: Awaited<ReturnType<typeof makeServer>>;

beforeAll(async () => {
  srv = await makeServer();
  await srv.app.listen({ port: 0, host: '127.0.0.1' });
  url = `ws://127.0.0.1:${(srv.app.server.address() as AddressInfo).port}/ws`;
});
afterAll(async () => {
  srv.deps.relay.close();
  await srv.app.close();
});

/** A test client that records every message it receives. */
async function client() {
  const ws = new WebSocket(url);
  const inbox: Message[] = [];
  const waiters: [(m: Message) => boolean, (m: Message) => void][] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d)) as Message;
    inbox.push(m);
    for (const w of [...waiters])
      if (w[0](m)) {
        waiters.splice(waiters.indexOf(w), 1);
        w[1](m);
      }
  });
  await new Promise((r) => ws.once('open', r));
  return {
    ws,
    inbox,
    send: (m: unknown) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    next<T extends Message['type']>(type: T, timeout = 2000): Promise<Extract<Message, { type: T }>> {
      const hit = inbox.find((m) => m.type === type);
      if (hit) {
        inbox.splice(inbox.indexOf(hit), 1);
        return Promise.resolve(hit as Extract<Message, { type: T }>);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
        waiters.push([
          (m) => m.type === type,
          (m) => {
            clearTimeout(timer);
            inbox.splice(inbox.indexOf(m), 1);
            resolve(m as Extract<Message, { type: T }>);
          },
        ]);
      });
    },
    close: () => ws.close(),
  };
}

async function room() {
  const tv = await client();
  tv.send({ type: 'hello', v: 1, role: 'tv', deviceId: 'tv' });
  const created = await tv.next('room_created');
  await tv.next('joined');
  const host = await client();
  host.send({ type: 'hello', v: 1, role: 'host', room: created.room, deviceId: 'phone' });
  await host.next('joined');
  expect(await host.next('peer_joined')).toMatchObject({ role: 'tv' });
  await tv.next('peer_joined');
  return { tv, host, code: created.room, joinUrl: created.joinUrl };
}

describe('relay', () => {
  it('creates a room with a join URL and announces peers', async () => {
    const { tv, host, code, joinUrl } = await room();
    expect(joinUrl).toBe(`https://example.test:8787/c/?room=${code}`);
    const guest = await client();
    guest.send({ type: 'hello', v: 1, role: 'guest', room: code, name: 'Tom', deviceId: 'g' });
    expect(await tv.next('peer_joined')).toMatchObject({ role: 'guest', name: 'Tom' });
    expect(await guest.next('peer_joined')).toMatchObject({ role: 'tv' }); // joiner learns who is there
    expect(await host.next('peer_joined')).toMatchObject({ role: 'guest' });
    guest.close();
    expect(await tv.next('peer_left')).toMatchObject({ role: 'guest', name: 'Tom' });
    tv.close();
    host.close();
  });

  it('rejects unknown rooms, bad messages and messages before hello', async () => {
    const c = await client();
    c.send({ type: 'hello', v: 1, role: 'host', room: '0000', deviceId: 'x' });
    const e1 = await c.next('error');
    expect(['ROOM_NOT_FOUND']).toContain(e1.code);
    c.send('{nope');
    expect((await c.next('error')).code).toBe('BAD_MESSAGE');
    c.send({ type: 'control', action: 'pause', source: 'button' });
    expect((await c.next('error')).code).toBe('NOT_JOINED');
    c.send({ type: 'catalog_updated', lessonId: 'x' });
    expect((await c.next('error')).message).toMatch(/server-only/);
    c.send({ type: 'ping', ts: 5 });
    expect(await c.next('pong')).toEqual({ type: 'pong', ts: 5 });
    c.close();
  });

  it('forwards landmarks only to the TV, tagged with the sender', async () => {
    const { tv, host } = await room();
    const pose = packPose(makePose());
    host.send({ type: 'landmarks', seq: 1, ts: Date.now(), role: 'guest', mirrored: false, pose });
    const m = await tv.next('landmarks');
    expect(m.role).toBe('host'); // relay trusts the joined role, not the payload
    expect(m.from).toBeTypeOf('string');
    tv.send({ type: 'gate_result', gateId: 'g1', passed: true, ms: 1200 });
    expect(await host.next('gate_result')).toMatchObject({ gateId: 'g1' });
    tv.send({ type: 'landmarks', seq: 1, ts: 1, role: 'host', mirrored: false });
    await new Promise((r) => setTimeout(r, 100));
    expect(host.inbox.some((x) => x.type === 'landmarks')).toBe(false);
    tv.close();
    host.close();
  });

  it('a reconnecting phone replaces the old host, whose socket is closed', async () => {
    const { tv, host, code } = await room();
    const closed = new Promise<number>((r) => host.ws.once('close', (c) => r(c)));
    const host2 = await client();
    host2.send({ type: 'hello', v: 1, role: 'host', room: code, deviceId: 'phone2' });
    await host2.next('joined');
    expect(await closed).toBe(4001);
    tv.close();
    host2.close();
  });

  it('broadcasts catalog_updated to every TV', async () => {
    const a = await room();
    srv.deps.relay.broadcastCatalog('new-lesson');
    expect(await a.tv.next('catalog_updated')).toEqual({ type: 'catalog_updated', lessonId: 'new-lesson' });
    await new Promise((r) => setTimeout(r, 50));
    expect(a.host.inbox.some((x) => x.type === 'catalog_updated')).toBe(false);
    a.tv.close();
    a.host.close();
  });

  const soakSec = Number(process.env.RELAY_SOAK_SEC ?? 10);
  it(`soak: 30 msgs/s for ${soakSec} s, no drops, p95 latency < 20 ms`, async () => {
    const { tv, host } = await room();
    const pose = packPose(makePose());
    const total = soakSec * 30;
    const lat: number[] = [];
    let seen = 0;
    tv.ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.type !== 'landmarks') return;
      seen++;
      lat.push(performance.timeOrigin + performance.now() - m.ts);
    });
    for (let seq = 0; seq < total; seq++) {
      const msg = {
        type: 'landmarks',
        seq,
        ts: performance.timeOrigin + performance.now(),
        role: 'host',
        mirrored: false,
        pose,
      } as const;
      host.send(encode(msg));
      await new Promise((r) => setTimeout(r, 1000 / 30));
    }
    await new Promise((r) => setTimeout(r, 300));
    lat.sort((a, b) => a - b);
    const p95 = lat[Math.floor(lat.length * 0.95)]!;
    console.log(
      `[soak] ${seen}/${total} received · p50 ${lat[Math.floor(lat.length / 2)]!.toFixed(2)} ms · p95 ${p95.toFixed(2)} ms`,
    );
    expect(seen).toBe(total);
    expect(p95).toBeLessThan(20);
    tv.close();
    host.close();
  });
});
