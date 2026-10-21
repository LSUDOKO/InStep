/**
 * Replays a landmarks recording (JSONL saved by the companion with ?record=1) into a room at real speed —
 * for testing the TV without standing in front of a camera, and as a demo backup.
 *
 *   pnpm replay session.jsonl --room 1234 [--server http://localhost:8788] [--loop]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { encode, parseMessage, type LandmarksMsg } from '@instep/protocol';
import WebSocket from 'ws';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    room: { type: 'string' },
    server: { type: 'string', default: process.env.TV_SERVER ?? 'http://localhost:8788' },
    loop: { type: 'boolean', default: false },
  },
});
const file = positionals[0];
if (!file || !values.room) {
  console.error('Usage: pnpm replay <session.jsonl> --room 1234 [--server http://host:8788] [--loop]');
  process.exit(2);
}
const frames: LandmarksMsg[] = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .flatMap((line) => {
    const r = parseMessage(line);
    return r.ok && r.msg.type === 'landmarks' ? [r.msg] : [];
  });
if (!frames.length) {
  console.error(`✗ no landmarks messages in ${file}`);
  process.exit(1);
}
console.log(`loaded ${frames.length} frames (${((frames.at(-1)!.ts - frames[0]!.ts) / 1000).toFixed(1)} s)`);

const ws = new WebSocket(values.server!.replace(/^http/, 'ws') + '/ws');
ws.on('error', (e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
ws.on('open', () =>
  ws.send(
    encode({ type: 'hello', v: 1, role: 'host', room: values.room!, deviceId: 'replay', name: 'Replay' }),
  ),
);
ws.on('message', (d) => {
  const r = parseMessage(String(d));
  if (!r.ok) return;
  if (r.msg.type === 'error') {
    console.error(`✗ ${r.msg.message}`);
    process.exit(1);
  }
  if (r.msg.type === 'joined') void play();
});

async function play() {
  let seq = 0;
  do {
    const t0 = Date.now();
    const base = frames[0]!.ts;
    for (const f of frames) {
      const wait = f.ts - base - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      ws.send(encode({ ...f, seq: seq++, ts: Date.now(), role: 'host' }));
    }
    console.log('✓ replay finished' + (values.loop ? ', looping' : ''));
  } while (values.loop);
  ws.close();
}
