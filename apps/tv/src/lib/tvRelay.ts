import type { Frame } from '@instep/gate-engine';
import { encode, parseMessage, toFrame, type Message, type Role } from '@instep/protocol';

export type Peer = { peerId: string; role: Role; name?: string };
export type RelayStatus = 'connecting' | 'online' | 'offline';

export type RelayListener = {
  onStatus?(s: RelayStatus): void;
  onRoom?(room: string, joinUrl: string): void;
  onPeers?(peers: Peer[]): void;
  onFrame?(peer: Peer, frame: Frame): void;
  onControl?(action: Extract<Message, { type: 'control' }>['action'], peer: Peer): void;
  onCatalogUpdated?(lessonId: string): void;
};

type WsLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
};

/**
 * TV-side relay client: creates a room, keeps it across reconnects (exponential backoff 0.5 → 5 s,
 * heartbeat every 10 s), tracks peers and turns `landmarks` into engine Frames (dropping stale seq).
 */
export class TvRelay {
  status: RelayStatus = 'connecting';
  room = '';
  joinUrl = '';
  peers = new Map<string, Peer>();
  private ws: WsLike | null = null;
  private attempt = 0;
  private stopped = false;
  private lastSeq = new Map<string, number>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<RelayListener>();

  constructor(
    private url: string,
    private makeSocket: (url: string) => WsLike = (u) => new WebSocket(u) as unknown as WsLike,
  ) {}

  listen(l: RelayListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit<K extends keyof RelayListener>(k: K, ...args: Parameters<NonNullable<RelayListener[K]>>) {
    for (const l of this.listeners) (l[k] as ((...a: unknown[]) => void) | undefined)?.(...args);
  }

  connect() {
    this.stopped = false;
    this.setStatus('connecting');
    const ws = this.makeSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.raw({
        type: 'hello',
        v: 1,
        role: 'tv',
        deviceId: 'instep-tv',
        name: 'TV',
        ...(this.room ? { room: this.room } : {}),
      });
      const ping = setInterval(() => this.raw({ type: 'ping', ts: Date.now() }), 10_000);
      this.timers.push(ping as unknown as ReturnType<typeof setTimeout>);
    };
    ws.onmessage = (ev) => this.handle(String(ev.data));
    ws.onerror = () => undefined;
    ws.onclose = () => {
      this.timers.forEach((t) => clearInterval(t));
      this.timers = [];
      this.peers.clear();
      this.emit('onPeers', []);
      if (this.stopped) return;
      this.setStatus('offline');
      this.attempt++;
      setTimeout(() => !this.stopped && this.connect(), Math.min(5000, 500 * 2 ** (this.attempt - 1)));
    };
  }

  close() {
    this.stopped = true;
    this.ws?.close();
  }

  /** Sends a room message; returns false while disconnected. */
  send(m: Message): boolean {
    return this.raw(m);
  }

  private raw(m: Message): boolean {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(encode(m));
    return true;
  }

  private setStatus(s: RelayStatus) {
    this.status = s;
    this.emit('onStatus', s);
  }

  private handle(text: string) {
    const r = parseMessage(text);
    if (!r.ok) return;
    const m = r.msg;
    switch (m.type) {
      case 'room_created':
        this.room = m.room;
        this.joinUrl = m.joinUrl;
        this.attempt = 0;
        this.setStatus('online');
        this.emit('onRoom', m.room, m.joinUrl);
        return;
      case 'error':
        if (m.code === 'ROOM_NOT_FOUND' && this.room) {
          // our room expired while we were away: start a fresh one
          this.room = '';
          this.raw({ type: 'hello', v: 1, role: 'tv', deviceId: 'instep-tv', name: 'TV' });
        }
        return;
      case 'peer_joined':
        if (m.role === 'tv') return;
        this.peers.set(m.peerId, { peerId: m.peerId, role: m.role, ...(m.name ? { name: m.name } : {}) });
        this.emit('onPeers', [...this.peers.values()]);
        return;
      case 'peer_left':
        this.peers.delete(m.peerId);
        this.lastSeq.delete(m.peerId);
        this.emit('onPeers', [...this.peers.values()]);
        return;
      case 'landmarks': {
        const peer = m.from ? this.peers.get(m.from) : undefined;
        if (!peer) return;
        const last = this.lastSeq.get(peer.peerId) ?? -1;
        if (m.seq <= last && last - m.seq < 1000) return; // stale (allow a sender restart)
        this.lastSeq.set(peer.peerId, m.seq);
        this.emit('onFrame', peer, toFrame(m));
        return;
      }
      case 'control': {
        const peer = [...this.peers.values()].find((p) => p.role === 'host') ?? {
          peerId: '?',
          role: 'host' as const,
        };
        this.emit('onControl', m.action, peer);
        return;
      }
      case 'catalog_updated':
        this.emit('onCatalogUpdated', m.lessonId);
        return;
    }
  }
}
