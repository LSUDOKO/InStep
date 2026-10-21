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
import { chair, makeHand, makePose, type PoseSpec } from '@instep/gate-engine/fixtures';

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

/** Pose per gate id (built-in lessons). Anything unknown: stand still. */
const POSES: Record<string, PoseSpec> = {
  // kids-forest-walk-v1
  tree: { l_shoulder: 165, r_shoulder: 165, l_elbow: 165, r_elbow: 165 },
  mouse: { l_knee: 90, r_knee: 90 },
  flamingo: { torso: 0, footLift: { left: 0.15 } },
  wave: { r_shoulder: 130 },
  // fall-prevention
  stand: { torso: 0, l_knee: 175, r_knee: 175 },
  'final-hold': { torso: 0, l_knee: 175, r_knee: 175, heelLift: 0.07 },
  'right-up': { torso: 0, footLift: { right: 0.12 } },
  'left-up': { torso: 0, footLift: { left: 0.12 } },
};
/** Finger curls per hand-sign gate id / sequence letter: [thumb, index, middle, ring, pinky]. */
const SIGNS: Record<string, [number, number, number, number, number]> = {
  a: [0.2, 1, 1, 1, 1],
  b: [0.8, 0, 0, 0, 0],
  c: [0.3, 0.5, 0.5, 0.5, 0.5],
  l: [0, 0, 1, 1, 1],
  y: [0, 1, 1, 1, 0],
  ily: [0, 0, 1, 1, 0],
};
const SEQUENCES: Record<string, string[]> = { cab: ['c', 'a', 'b'] };

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

type H = [number, number, number];
const packHand = (spec: Parameters<typeof makeHand>[0]) => makeHand(spec).map((p) => [p.x, p.y, p.z] as H);

function tick() {
  const now = Date.now();
  const active = gate && gate.status !== 'passed' && now - gate.since > delayMs ? gate : null;
  const t = active ? now - active.since - delayMs : 0;
  const sway = Math.sin(now / 900) * 0.004; // a little natural movement
  let poseSpec: PoseSpec = { dx: sway, visibility: 0.95 };
  let hands: { left?: H[]; right?: H[] } | undefined;
  if (active) {
    const id = active.id;
    if (POSES[id]) poseSpec = { ...poseSpec, ...POSES[id] };
    switch (active.type) {
      case 'rep_count':
        if (id.includes('open')) {
          // hand open/close, one rep every 2 s (both hands, so "affected" resolves either way)
          const c = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2000);
          hands = { left: packHand({ curl: [c, c, c, c, c] }), right: packHand({ curl: [c, c, c, c, c] }) };
        } else {
          // heel raises, one rep every 2.4 s
          poseSpec = { ...poseSpec, torso: 0, heelLift: 0.04 + 0.04 * Math.sin((2 * Math.PI * t) / 2400) };
        }
        break;
      case 'rhythm_bpm':
        // CPR compressions at 110/min with straight arms: wrists move up and down
        poseSpec = {
          ...poseSpec,
          l_elbow: 175,
          r_elbow: 175,
          wristsDy: 0.025 * Math.sin((2 * Math.PI * 110 * t) / 60000),
        };
        break;
      case 'hand_sign':
        if (SIGNS[id]) hands = { right: packHand({ curl: SIGNS[id] }) };
        break;
      case 'sequence_order': {
        const seq = SEQUENCES[id];
        if (seq) {
          const letter = seq[Math.floor(t / 2500) % seq.length]!;
          hands = { right: packHand({ curl: SIGNS[letter]! }) };
        }
        break;
      }
      default:
        break;
    }
  }
  // wire format: pose [x, y, z, visibility]; hands [x, y, z]; a chair beside the hips for the safety check
  const pose = makePose(poseSpec).map(
    (p) => [p.x, p.y, p.z, p.v ?? 0.95] as [number, number, number, number],
  );
  const msg: LandmarksMsg = {
    type: 'landmarks',
    seq: seq++,
    ts: now,
    role: 'host',
    mirrored: false,
    pose,
    objects: [chair()],
    fps,
    ...(hands ? { hands, handScores: { left: hands.left ? 0.9 : 0, right: hands.right ? 0.9 : 0 } } : {}),
  };
  ws.send(encode(msg));
}
