import { randomInt, randomUUID } from 'node:crypto';
import type { Role } from '@instep/protocol';

export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
export const CODE_REUSE_MS = 24 * 60 * 60 * 1000;
export const MAX_GUESTS = 3;

export type Peer<S> = { peerId: string; role: Role; name?: string; socket: S };
export type Room<S> = { code: string; peers: Map<string, Peer<S>>; lastActive: number };

export type JoinError = 'ROOM_NOT_FOUND' | 'ROOM_FULL';

/** Room bookkeeping, independent of the transport (S = socket type). */
export class RoomManager<S> {
  private rooms = new Map<string, Room<S>>();
  private retired = new Map<string, number>(); // code → time it may be reused

  constructor(private now: () => number = Date.now) {}

  get size() {
    return this.rooms.size;
  }

  get(code: string): Room<S> | undefined {
    return this.rooms.get(code);
  }

  /** New room with a random, not-recently-used 4-digit code; the TV is its first peer. */
  create(tv: S, name?: string): { room: Room<S>; peer: Peer<S> } {
    this.sweep();
    let code = '';
    for (let i = 0; i < 10_000; i++) {
      code = String(randomInt(0, 10_000)).padStart(4, '0');
      if (!this.rooms.has(code) && (this.retired.get(code) ?? 0) <= this.now()) break;
    }
    const room: Room<S> = { code, peers: new Map(), lastActive: this.now() };
    this.rooms.set(code, room);
    const peer = this.addPeer(room, 'tv', tv, name);
    return { room, peer };
  }

  join(
    code: string,
    role: Exclude<Role, 'tv'>,
    socket: S,
    name?: string,
  ): { room: Room<S>; peer: Peer<S>; replaced?: Peer<S> } | JoinError {
    this.sweep();
    const room = this.rooms.get(code);
    if (!room) return 'ROOM_NOT_FOUND';
    const peers = [...room.peers.values()];
    if (role === 'host') {
      // a reconnecting phone replaces the previous host
      const old = peers.find((p) => p.role === 'host');
      if (old) {
        room.peers.delete(old.peerId);
        return { room, peer: this.addPeer(room, role, socket, name), replaced: old };
      }
    } else if (peers.filter((p) => p.role === 'guest').length >= MAX_GUESTS) return 'ROOM_FULL';
    return { room, peer: this.addPeer(room, role, socket, name) };
  }

  /** Reattach a TV to its existing room (e.g. after a Wi-Fi blip). */
  rejoinTv(code: string, socket: S, name?: string): { room: Room<S>; peer: Peer<S> } | JoinError {
    const room = this.rooms.get(code);
    if (!room) return 'ROOM_NOT_FOUND';
    for (const p of room.peers.values()) if (p.role === 'tv') room.peers.delete(p.peerId);
    return { room, peer: this.addPeer(room, 'tv', socket, name) };
  }

  leave(code: string, peerId: string): Peer<S> | undefined {
    const room = this.rooms.get(code);
    const peer = room?.peers.get(peerId);
    room?.peers.delete(peerId);
    return peer;
  }

  touch(code: string) {
    const r = this.rooms.get(code);
    if (r) r.lastActive = this.now();
  }

  /** Expires rooms idle for 2 h; their codes are not reused for 24 h. Returns expired rooms. */
  sweep(): Room<S>[] {
    const t = this.now();
    const expired: Room<S>[] = [];
    for (const [code, r] of this.rooms) {
      if (t - r.lastActive > ROOM_IDLE_MS) {
        this.rooms.delete(code);
        this.retired.set(code, t + CODE_REUSE_MS);
        expired.push(r);
      }
    }
    for (const [code, until] of this.retired) if (until <= t) this.retired.delete(code);
    return expired;
  }

  private addPeer(room: Room<S>, role: Role, socket: S, name?: string): Peer<S> {
    const peer: Peer<S> = { peerId: randomUUID().slice(0, 8), role, socket, ...(name ? { name } : {}) };
    room.peers.set(peer.peerId, peer);
    room.lastActive = this.now();
    return peer;
  }
}
