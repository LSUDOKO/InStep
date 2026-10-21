import type { IncomingMessage, Server } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { Duplex } from 'node:stream';
import { encode, parseMessage, ROOM_MESSAGES, type Message } from '@instep/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from './log';
import { RoomManager, type Peer, type Room } from './rooms';

const log = logger('relay');
const HEARTBEAT_MS = 10_000;
const MAX_LANDMARKS_PER_SEC = 40;

type Conn = {
  ws: WebSocket;
  room?: string;
  peer?: Peer<WebSocket>;
  alive: boolean;
  sec: number;
  count: number;
};

/**
 * WebSocket relay: rooms of one TV, one camera host and up to three guests.
 * Validates every message with zod and forwards room messages. Landmark payloads are never logged.
 */
export function createRelay(opts: { publicUrl: string; now?: () => number }) {
  const rooms = new RoomManager<WebSocket>(opts.now);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const conns = new Set<Conn>();

  const send = (ws: WebSocket, m: Message) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(encode(m));
  };
  const others = (room: Room<WebSocket>, peerId: string) =>
    [...room.peers.values()].filter((p) => p.peerId !== peerId);
  const joinUrl = (code: string) => `${opts.publicUrl.replace(/\/$/, '')}/c/?room=${code}`;

  function handle(c: Conn, text: string) {
    const r = parseMessage(text);
    if (!r.ok) return send(c.ws, { type: 'error', code: 'BAD_MESSAGE', message: r.error });
    const m = r.msg;

    if (m.type === 'ping') return send(c.ws, { type: 'pong', ts: m.ts });
    if (m.type === 'hello') {
      if (c.peer && c.room) rooms.leave(c.room, c.peer.peerId);
      if (m.role === 'tv') {
        const res = m.room ? rooms.rejoinTv(m.room, c.ws, m.name) : rooms.create(c.ws, m.name);
        if (typeof res === 'string')
          return send(c.ws, { type: 'error', code: res, message: `No room ${m.room}` });
        c.room = res.room.code;
        c.peer = res.peer;
        send(c.ws, { type: 'room_created', room: res.room.code, joinUrl: joinUrl(res.room.code) });
        send(c.ws, { type: 'joined', room: res.room.code, peerId: res.peer.peerId, role: 'tv' });
        for (const p of others(res.room, res.peer.peerId))
          send(c.ws, {
            type: 'peer_joined',
            role: p.role,
            peerId: p.peerId,
            ...(p.name ? { name: p.name } : {}),
          });
        log.info('tv in room', { room: res.room.code, rooms: rooms.size });
        return;
      }
      if (!m.room)
        return send(c.ws, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room code required' });
      const res = rooms.join(m.room, m.role, c.ws, m.name);
      if (res === 'ROOM_NOT_FOUND')
        return send(c.ws, {
          type: 'error',
          code: res,
          message: `No room ${m.room}. Check the code on your TV.`,
        });
      if (res === 'ROOM_FULL')
        return send(c.ws, {
          type: 'error',
          code: res,
          message: 'This room already has the maximum number of people.',
        });
      if (res.replaced) {
        // the old camera is already out of the room, so its socket-close won't announce it: tell the room now
        for (const p of others(res.room, res.peer.peerId))
          send(p.socket, {
            type: 'peer_left',
            role: res.replaced.role,
            peerId: res.replaced.peerId,
            ...(res.replaced.name ? { name: res.replaced.name } : {}),
          });
        res.replaced.socket.close(4001, 'replaced by a new camera');
      }
      c.room = res.room.code;
      c.peer = res.peer;
      send(c.ws, { type: 'joined', room: res.room.code, peerId: res.peer.peerId, role: m.role });
      for (const p of others(res.room, res.peer.peerId))
        send(c.ws, {
          type: 'peer_joined',
          role: p.role,
          peerId: p.peerId,
          ...(p.name ? { name: p.name } : {}),
        });
      for (const p of others(res.room, res.peer.peerId))
        send(p.socket, {
          type: 'peer_joined',
          role: m.role,
          peerId: res.peer.peerId,
          ...(m.name ? { name: m.name } : {}),
        });
      log.info('peer joined', { room: res.room.code, role: m.role });
      return;
    }

    if (!ROOM_MESSAGES.has(m.type))
      return send(c.ws, { type: 'error', code: 'BAD_MESSAGE', message: `${m.type} is server-only` });
    const room = c.room ? rooms.get(c.room) : undefined;
    // A peer replaced by a reconnecting host is no longer a member of the room.
    if (!room || !c.peer || !room.peers.has(c.peer.peerId))
      return send(c.ws, { type: 'error', code: 'NOT_JOINED', message: 'Send hello first' });
    rooms.touch(room.code);

    if (m.type === 'landmarks') {
      if (c.peer.role === 'tv') return;
      const sec = Math.floor(Date.now() / 1000);
      if (sec !== c.sec) {
        c.sec = sec;
        c.count = 0;
      }
      if (++c.count > MAX_LANDMARKS_PER_SEC) return; // drop, never queue
      const out = { ...m, role: c.peer.role === 'guest' ? 'guest' : 'host', from: c.peer.peerId } as const;
      for (const p of room.peers.values()) if (p.role === 'tv') send(p.socket, out);
      return;
    }
    for (const p of others(room, c.peer.peerId)) send(p.socket, m);
  }

  wss.on('connection', (ws: WebSocket) => {
    const c: Conn = { ws, alive: true, sec: 0, count: 0 };
    conns.add(c);
    ws.on('pong', () => (c.alive = true));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return send(ws, { type: 'error', code: 'BAD_MESSAGE', message: 'text frames only' });
      handle(c, data.toString());
    });
    ws.on('close', () => {
      conns.delete(c);
      if (!c.room || !c.peer) return;
      const room = rooms.get(c.room);
      const left = rooms.leave(c.room, c.peer.peerId);
      if (room && left)
        for (const p of room.peers.values())
          send(p.socket, {
            type: 'peer_left',
            role: left.role,
            peerId: left.peerId,
            ...(left.name ? { name: left.name } : {}),
          });
    });
  });

  const heartbeat = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
    for (const r of rooms.sweep()) for (const p of r.peers.values()) p.socket.close(4000, 'room expired');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    rooms,
    /** Route `/ws` upgrades on an HTTP(S) server to the relay. */
    attach(server: Server | HttpsServer) {
      server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (new URL(req.url ?? '/', 'http://x').pathname !== '/ws') return socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
      });
    },
    /** Tell every connected TV that the catalog changed (Creator Studio publish). */
    broadcastCatalog(lessonId: string) {
      for (const c of conns) if (c.peer?.role === 'tv') send(c.ws, { type: 'catalog_updated', lessonId });
    },
    close() {
      clearInterval(heartbeat);
      for (const c of conns) c.ws.terminate();
      wss.close();
    },
  };
}
export type Relay = ReturnType<typeof createRelay>;
