/**
 * Synthetic learner: joins a room as the camera and streams a 33-point pose that matches whatever gate the TV
 * is waiting on (after a short delay so the "waiting" state is visible), neutral standing pose otherwise.
 * No camera, no person — for device testing, screenshots and a demo-video fallback.
 *
 *   pnpm demo-learner --room 1234 [--server http://localhost:8788] [--delay 4] [--fps 15] [--role guest --name Mia]
 */
import WebSocket from 'ws';
import { parseArgs } from 'node:util';
import { encode, parseMessage, type LandmarksMsg } from '@instep/protocol';
import { behaviourFrame } from './lib/learnerBehaviour';

const { values } = parseArgs({
  options: {
    room: { type: 'string' },
    server: { type: 'string', default: process.env.TV_SERVER ?? 'http://localhost:8788' },
    delay: { type: 'string', default: '4' },
    fps: { type: 'string', default: '15' },
    role: { type: 'string', default: 'host' },
    name: { type: 'string', default: 'Demo' },
  },
});
if (!values.room) {
  console.error(
    'Usage: pnpm demo-learner --room 1234 [--server http://host:8788] [--delay 4] [--fps 15] [--role guest --name Mia]',
  );
  process.exit(1);
}
const delayMs = Number(values.delay) * 1000;
const role = values.role === 'guest' ? 'guest' : 'host';
const fps = Number(values.fps);

let gate: { id: string; type: string; since: number; status: string } | null = null;
let seq = 0;

const ws = new WebSocket(values.server!.replace(/^http/, 'ws') + '/ws');
ws.on('error', (e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
ws.on('open', () =>
  ws.send(
    encode({ type: 'hello', v: 1, role: 'host', room: values.room!, deviceId: 'demo-learner', name: 'Demo' }),
  ),
);
ws.on('message', (d) => {
  const r = parseMessage(String(d));
  if (!r.ok) return;
  const m = r.msg;
  if (m.type === 'error') {
    console.error(`✗ ${m.message}`);
    process.exit(1);
  }
  if (m.type === 'joined') {
    console.log(`joined room ${m.room} as ${m.peerId}; streaming ${fps} fps`);
    setInterval(tick, 1000 / fps);
  }
  if (m.type === 'gate_state') {
    if (!gate || gate.id !== m.gateId) {
      gate = { id: m.gateId, type: m.gateType, since: Date.now(), status: m.status };
      console.log(`gate ${m.gateId} (${m.gateType}) → ${m.status}`);
    } else if (gate.status !== m.status) {
      gate.status = m.status;
      console.log(`gate ${m.gateId} → ${m.status}${m.worst ? ` (${m.worst.hint})` : ''}`);
    }
  }
  if (m.type === 'lesson_ended') {
    console.log('lesson ended');
    setTimeout(() => process.exit(0), 1500);
  }
});

const packHand = (h: { x: number; y: number; z: number }[]) =>
  h.map((p) => [p.x, p.y, p.z] as [number, number, number]);

function tick() {
  const now = Date.now();
  const active = gate && gate.status !== 'passed' && now - gate.since > delayMs ? gate : null;
  const f = behaviourFrame(
    active ? { id: active.id, type: active.type } : null,
    active ? now - active.since - delayMs : null,
    now,
  );
  // wire format: pose [x, y, z, visibility]; hands [x, y, z]
  const msg: LandmarksMsg = {
    type: 'landmarks',
    seq: seq++,
    ts: now,
    role,
    mirrored: false,
    pose: (f.pose ?? []).map((p) => [p.x, p.y, p.z, p.v ?? 0.95] as [number, number, number, number]),
    ...(f.objects ? { objects: f.objects } : {}),
    fps,
    ...(f.hands
      ? {
          hands: {
            ...(f.hands.left ? { left: packHand(f.hands.left) } : {}),
            ...(f.hands.right ? { right: packHand(f.hands.right) } : {}),
          },
          handScores: f.handScores,
        }
      : {}),
  };
  ws.send(encode(msg));
}
