/**
 * Synthetic learner: joins a room as the camera and streams a 33-point pose that matches whatever gate the TV
 * is waiting on (after a short delay so the "waiting" state is visible), neutral standing pose otherwise.
 * No camera, no person — for device testing, screenshots and a demo-video fallback.
 *
 *   pnpm demo-learner --room 1234 [--server http://localhost:8788] [--delay 4] [--fps 15]
 */
import WebSocket from 'ws';
import { parseArgs } from 'node:util';
import { encode, parseMessage, type LandmarksMsg } from '@instep/protocol';
import { makePose, type PoseSpec } from '@instep/gate-engine/fixtures';

const { values } = parseArgs({
  options: {
    room: { type: 'string' },
    server: { type: 'string', default: process.env.TV_SERVER ?? 'http://localhost:8788' },
    delay: { type: 'string', default: '4' },
    fps: { type: 'string', default: '15' },
  },
});
if (!values.room) {
  console.error('Usage: pnpm demo-learner --room 1234 [--server http://host:8788] [--delay 4] [--fps 15]');
  process.exit(1);
}
const delayMs = Number(values.delay) * 1000;
const fps = Number(values.fps);

/** What a learner does for each gate id of the built-in lessons (anything unknown: stand still). */
const POSES: Record<string, PoseSpec> = {
  // kids-forest-walk-v1
  tree: { l_shoulder: 165, r_shoulder: 165, l_elbow: 165, r_elbow: 165 },
  mouse: { l_knee: 90, r_knee: 90 },
  flamingo: { torso: 0, footLift: { left: 0.15 } },
  wave: { r_shoulder: 130 },
  // fall-prevention demos
  stand: { torso: 0 },
  heel: { heelLift: 0.08 },
};

let gate: { id: string; since: number; status: string } | null = null;
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
      gate = { id: m.gateId, since: Date.now(), status: m.status };
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

function tick() {
  const active =
    gate && gate.status !== 'passed' && Date.now() - gate.since > delayMs ? POSES[gate.id] : undefined;
  const sway = Math.sin(Date.now() / 900) * 0.004; // a little natural movement
  // wire format: [x, y, z, visibility] per point
  const pose = makePose({ ...(active ?? {}), dx: sway, visibility: 0.95 }).map(
    (p) => [p.x, p.y, p.z, p.v ?? 0.95] as [number, number, number, number],
  );
  const msg: LandmarksMsg = {
    type: 'landmarks',
    seq: seq++,
    ts: Date.now(),
    role: 'host',
    mirrored: false,
    pose,
    fps,
  };
  ws.send(encode(msg));
}
