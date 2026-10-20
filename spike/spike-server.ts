/**
 * Milestone 0 spike server (host side). Run: pnpm tsx spike/spike-server.ts
 *
 * - HTTP  GET /media/test.mp4, /media/chime.mp3   (video + audio for the TV spike screen)
 * - HTTP  GET /ping                                (reachability check from the VVD)
 * - WS    /ws  sends 30 msgs/s of ~1.2 KB pose JSON; the TV echoes {type:'ack', seq, ts}.
 *         The server prints received-ack rate and round-trip latency (p50/p95) every 5 s.
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.SPIKE_PORT ?? 8788);
const media = new URL('./media/', import.meta.url);

const server = createServer((req, res) => {
  console.log(`[http] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
  if (req.url === '/ping') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('pong');
    return;
  }
  const m = req.url?.match(/^\/media\/(test\.mp4|chime\.mp3)$/);
  if (!m) {
    res.writeHead(404).end();
    return;
  }
  const file = new URL(m[1]!, media);
  const size = statSync(file).size;
  const type = m[1]!.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = Number(range[1] || 0);
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, {
      'content-type': type,
      'content-range': `bytes ${start}-${end}/${size}`,
      'accept-ranges': 'bytes',
      'content-length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
    createReadStream(file).pipe(res);
  }
});

/** ~1.2 KB message shaped like a real `landmarks` frame. */
function fakeLandmarks(seq: number) {
  const t = Date.now();
  const pose = Array.from({ length: 33 }, (_, i) => [
    +(0.5 + 0.2 * Math.sin(t / 500 + i)).toFixed(3),
    +(0.2 + i * 0.02).toFixed(3),
    -0.123,
    0.99,
  ]);
  // pad to the ~1.2 KB budget used in docs/10 (pose + chair box + handScores)
  return JSON.stringify({
    type: 'landmarks',
    seq,
    ts: t,
    role: 'host',
    mirrored: false,
    pose,
    fps: 30,
    objects: [{ label: 'chair', score: 0.81, box: [0.62, 0.4, 0.25, 0.55] }],
    pad: 'x'.repeat(220),
  });
}

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws: WebSocket, req) => {
  console.log(
    `[ws] TV connected from ${req.socket.remoteAddress}; first message size ${fakeLandmarks(0).length} B`,
  );
  let seq = 0;
  let acks = 0;
  let rtts: number[] = [];
  const send = setInterval(() => ws.send(fakeLandmarks(seq++)), 1000 / 30);
  const report = setInterval(() => {
    const s = [...rtts].sort((a, b) => a - b);
    const pct = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN;
    console.log(
      `[ws] sent ${seq} · acks/s ${(acks / 5).toFixed(1)} · rtt p50 ${pct(0.5)} ms · p95 ${pct(0.95)} ms`,
    );
    acks = 0;
    rtts = [];
  }, 5000);
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(String(data));
      if (m.type === 'ack') {
        acks++;
        rtts.push(Date.now() - m.ts);
      } else console.log('[ws] from TV:', m);
    } catch {
      console.log('[ws] non-JSON from TV:', String(data).slice(0, 200));
    }
  });
  ws.on('close', () => {
    clearInterval(send);
    clearInterval(report);
    console.log('[ws] TV disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4')
    .map((n) => n!.address);
  console.log(
    `[spike] listening on :${PORT}. Try from the VVD: ${[...ips, '10.0.2.2'].map((ip) => `http://${ip}:${PORT}/ping`).join('  ')}`,
  );
});
