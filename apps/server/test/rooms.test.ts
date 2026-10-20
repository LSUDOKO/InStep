import { describe, expect, it } from 'vitest';
import { CODE_REUSE_MS, MAX_GUESTS, ROOM_IDLE_MS, RoomManager } from '../src/rooms';

describe('RoomManager', () => {
  it('creates 4-digit rooms with the TV as first peer', () => {
    const m = new RoomManager<string>();
    const { room, peer } = m.create('tv');
    expect(room.code).toMatch(/^\d{4}$/);
    expect(peer.role).toBe('tv');
    expect(m.size).toBe(1);
  });
  it('joins host and guests, enforces 3 guests, reports unknown rooms', () => {
    const m = new RoomManager<string>();
    const { room } = m.create('tv');
    expect(m.join(room.code, 'host', 'h')).toMatchObject({ peer: { role: 'host' } });
    for (let i = 0; i < MAX_GUESTS; i++) expect(typeof m.join(room.code, 'guest', `g${i}`)).toBe('object');
    expect(m.join(room.code, 'guest', 'g4')).toBe('ROOM_FULL');
    expect(m.join('0000' === room.code ? '0001' : '0000', 'host', 'x')).toBe('ROOM_NOT_FOUND');
  });
  it('a reconnecting host replaces the old host', () => {
    const m = new RoomManager<string>();
    const { room } = m.create('tv');
    m.join(room.code, 'host', 'h1');
    m.join(room.code, 'host', 'h2');
    expect([...room.peers.values()].filter((p) => p.role === 'host').map((p) => p.socket)).toEqual(['h2']);
  });
  it('TV can rejoin its room', () => {
    const m = new RoomManager<string>();
    const { room } = m.create('tv1');
    expect(m.rejoinTv(room.code, 'tv2')).toMatchObject({ peer: { socket: 'tv2' } });
    expect([...room.peers.values()].filter((p) => p.role === 'tv')).toHaveLength(1);
    expect(m.rejoinTv('9999' === room.code ? '9998' : '9999', 'x')).toBe('ROOM_NOT_FOUND');
  });
  it('leave removes the peer', () => {
    const m = new RoomManager<string>();
    const { room } = m.create('tv');
    const j = m.join(room.code, 'host', 'h');
    if (typeof j === 'string') throw new Error();
    expect(m.leave(room.code, j.peer.peerId)?.socket).toBe('h');
    expect(room.peers.size).toBe(1);
  });
  it('expires after 2 h idle; the code is not reused for 24 h', () => {
    let t = 0;
    const m = new RoomManager<string>(() => t);
    const { room } = m.create('tv');
    t = ROOM_IDLE_MS - 1;
    m.touch(room.code);
    t += ROOM_IDLE_MS;
    expect(m.sweep()).toHaveLength(0);
    t += 2;
    expect(m.sweep().map((r) => r.code)).toEqual([room.code]);
    for (let i = 0; i < 200; i++) expect(m.create('x').room.code).not.toBe(room.code);
    t += CODE_REUSE_MS;
    m.sweep();
  });
});
