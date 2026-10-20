import { encode, parseMessage, type Message } from '@instep/protocol';
import { meters } from './meter';

export type RelayState =
  | { kind: 'connecting' }
  | { kind: 'joined'; peerId: string; tvConnected: boolean }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'failed'; code: 'ROOM_NOT_FOUND' | 'ROOM_FULL'; message: string };

type Opts = {
  url: string;
  room: string;
  role: 'host' | 'guest';
  name?: string;
  onState: (s: RelayState) => void;
  onMessage: (m: Message) => void;
};

const deviceId = (() => {
  try {
    const k = 'instep.deviceId';
    const v = localStorage.getItem(k) ?? crypto.randomUUID();
    localStorage.setItem(k, v);
    return v;
  } catch {
    return crypto.randomUUID();
  }
})();

/** WebSocket client with hello-on-connect, heartbeat and exponential backoff (0.5 s → 5 s). */
export class RelayClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private ping?: ReturnType<typeof setInterval>;
  private retry?: ReturnType<typeof setTimeout>;
  private tvConnected = false;
  private peerId = '';

  constructor(private o: Opts) {
    this.connect();
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN && this.peerId !== '';
  }

  /** Sends a message; every byte is counted by the privacy meter. Returns false if not connected. */
  send(m: Message): boolean {
    if (!this.open) return false;
    const text = encode(m);
    this.ws!.send(text);
    meters.bodyPoints.add(new TextEncoder().encode(text).length);
    return true;
  }

  close() {
    this.stopped = true;
    clearInterval(this.ping);
    clearTimeout(this.retry);
    this.ws?.close();
  }

  private connect() {
    this.o.onState(this.attempt ? { kind: 'reconnecting', attempt: this.attempt } : { kind: 'connecting' });
    const ws = new WebSocket(this.o.url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        encode({
          type: 'hello',
          v: 1,
          role: this.o.role,
          room: this.o.room,
          deviceId,
          ...(this.o.name ? { name: this.o.name } : {}),
        }),
      );
      this.ping = setInterval(
        () => ws.readyState === WebSocket.OPEN && ws.send(encode({ type: 'ping', ts: Date.now() })),
        10_000,
      );
    };
    ws.onmessage = (ev) => {
      const r = parseMessage(String(ev.data));
      if (!r.ok) return;
      const m = r.msg;
      if (m.type === 'joined') {
        this.attempt = 0;
        this.tvConnected = false;
        this.peerId = m.peerId;
        this.emitJoined();
      } else if (m.type === 'peer_joined' && m.role === 'tv') {
        this.tvConnected = true;
        this.emitJoined();
      } else if (m.type === 'peer_left' && m.role === 'tv') {
        this.tvConnected = false;
        this.emitJoined();
      } else if (m.type === 'error' && (m.code === 'ROOM_NOT_FOUND' || m.code === 'ROOM_FULL')) {
        this.stopped = true;
        this.o.onState({ kind: 'failed', code: m.code, message: m.message });
        ws.close();
      }
      this.o.onMessage(m);
    };
    ws.onclose = (ev) => {
      clearInterval(this.ping);
      this.peerId = '';
      if (this.stopped) return;
      if (ev.code === 4001) {
        this.stopped = true;
        this.o.onState({
          kind: 'failed',
          code: 'ROOM_FULL',
          message: 'Another phone took over as the camera for this TV.',
        });
        return;
      }
      this.attempt++;
      this.o.onState({ kind: 'reconnecting', attempt: this.attempt });
      this.retry = setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** (this.attempt - 1)));
    };
  }

  private emitJoined() {
    this.o.onState({ kind: 'joined', peerId: this.peerId, tvConnected: this.tvConnected });
  }
}

export function relayUrl(loc: Location = window.location): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws`;
}
