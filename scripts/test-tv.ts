/**
 * Terminal "TV" for testing the companion without Vega: creates a room, prints the join QR code,
 * sends lesson_tracking, and reports landmark fps / message size / content per connected camera.
 *
 *   pnpm test-tv                                   # against http://localhost:8788
 *   pnpm test-tv --server http://192.168.1.20:8788 --tracking pose,objects --view front
 *   pnpm test-tv --tracking hands --view hands
 */
import { parseArgs } from 'node:util';
import { encode, parseMessage, toFrame } from '@instep/protocol';
import QRCode from 'qrcode';
import WebSocket from 'ws';

const { values } = parseArgs({
  options: {
    server: { type: 'string', default: process.env.TV_SERVER ?? 'http://localhost:8788' },
    tracking: { type: 'string', default: 'pose,objects' },
    view: { type: 'string', default: 'front' },
  },
});
const tracking = values.tracking!.split(',') as ('pose' | 'hands' | 'objects')[];
const ws = new WebSocket(values.server!.replace(/^http/, 'ws') + '/ws');
const stats = new Map<
  string,
  { n: number; bytes: number; pose: number; hands: number; chair: number; fps?: number }
>();
const names = new Map<string, string>();

ws.on('open', () =>
  ws.send(encode({ type: 'hello', v: 1, role: 'tv', deviceId: 'test-tv', name: 'Test TV' })),
);
ws.on('error', (e) => {
  console.error(`✗ cannot reach ${values.server}: ${e.message}`);
  process.exit(1);
});
ws.on('message', async (data) => {
  const text = String(data);
  const r = parseMessage(text);
  if (!r.ok) return console.error('✗ bad message from relay:', r.error);
  const m = r.msg;
  if (m.type === 'room_created') {
    console.log(await QRCode.toString(m.joinUrl, { type: 'terminal', small: true }));
    console.log(`Room ${m.room} · open ${m.joinUrl}\n`);
  } else if (m.type === 'peer_joined') {
    names.set(m.peerId, `${m.role}${m.name ? ` (${m.name})` : ''}`);
    console.log(
      `→ ${names.get(m.peerId)} joined; sending lesson_tracking ${tracking.join('+')} / ${values.view}`,
    );
    ws.send(
      encode({
        type: 'lesson_tracking',
        lessonId: 'test',
        tracking,
        cameraView: values.view as 'front',
        gesturesEnabled: false,
      }),
    );
  } else if (m.type === 'peer_left') console.log(`← ${names.get(m.peerId) ?? m.role} left`);
  else if (m.type === 'landmarks') {
    const s = stats.get(m.from ?? '?') ?? { n: 0, bytes: 0, pose: 0, hands: 0, chair: 0 };
    const f = toFrame(m);
    s.n++;
    s.bytes += Buffer.byteLength(text);
    if (f.pose) s.pose++;
    if (f.hands?.left || f.hands?.right) s.hands++;
    if (f.objects?.some((o) => o.label === 'chair')) s.chair++;
    if (m.fps !== undefined) s.fps = m.fps;
    stats.set(m.from ?? '?', s);
  }
});

setInterval(() => {
  for (const [peer, s] of stats) {
    const ok = s.n >= 15 ? '✓' : '✗';
    console.log(
      `${ok} ${names.get(peer) ?? peer}: ${s.n} msg/s (≥ 15 needed) · avg ${s.n ? Math.round(s.bytes / s.n) : 0} B · ` +
        `pose ${s.pose} · hands ${s.hands} · chair ${s.chair} · phone inference ${s.fps ?? '?'} fps`,
    );
    stats.set(peer, { n: 0, bytes: 0, pose: 0, hands: 0, chair: 0 });
  }
}, 1000);
