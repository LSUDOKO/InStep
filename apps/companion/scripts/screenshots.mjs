// Captures REAL screenshots of the companion for the README (Chrome fake camera, real MediaPipe).
// Run: pnpm --filter @instep/companion screenshots   (starts its own server on :29787)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import WebSocket from 'ws';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const out = join(root, 'docs', 'screenshots');
mkdirSync(out, { recursive: true });
const PORT = 29787;
const TV_PORT = 29788;

const server = spawn('pnpm', ['--filter', '@instep/server', 'start'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    TV_HTTP_PORT: String(TV_PORT),
    PUBLIC_URL: `http://localhost:${PORT}`,
    DATA_DIR: mkdtempSync(join(tmpdir(), 'instep-shots-')),
    HTTPS_CERT: '',
    HTTPS_KEY: '',
  },
  stdio: 'ignore',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${TV_PORT}/api/health`)).ok) break;
  } catch {}
  await sleep(500);
}

// a fake TV: creates a room, sends lesson_tracking + a gate_state so the live screen shows real feedback
const tv = new WebSocket(`ws://localhost:${TV_PORT}/ws`);
const room = await new Promise((resolve) => {
  tv.on('open', () => tv.send(JSON.stringify({ type: 'hello', v: 1, role: 'tv', deviceId: 'shots' })));
  tv.on('message', (d) => {
    const m = JSON.parse(String(d));
    if (m.type === 'room_created') resolve(m.room);
    if (m.type === 'peer_joined') {
      tv.send(
        JSON.stringify({
          type: 'lesson_tracking',
          lessonId: 'fall-heel-raise-v1',
          tracking: ['pose', 'objects'],
          cameraView: 'front',
          gesturesEnabled: true,
          hint: 'Place the camera at hip height, 2–3 m away.',
        }),
      );
      setTimeout(
        () =>
          tv.send(
            JSON.stringify({
              type: 'gate_state',
              gateId: 'chair',
              gateType: 'safety_prerequisite',
              status: 'blocked_safety',
              progress: 0,
              label: 'Stand next to a sturdy chair',
              worst: { name: 'object_near', hint: "I can't see a chair next to you" },
            }),
          ),
        2500,
      );
    }
  });
});

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({
  ...devices['Pixel 7'],
  permissions: ['camera'],
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

// 1 camera node
await page.goto(`http://localhost:${PORT}/c/?room=${room}`);
await sleep(600);
await shot('companion-join');
await page.getByRole('button', { name: 'Start camera' }).click();
await page.getByText('Connected to TV').waitFor({ timeout: 120_000 });
await sleep(4500);
await shot('companion-live');
await page.getByTestId('privacy-pill').click();
await sleep(1200);
await shot('companion-privacy');
await page.getByRole('button', { name: 'Close' }).click();

// 2 creator studio
await page.goto(`http://localhost:${PORT}/c/creator`);
await page.getByLabel('Creator PIN').fill('2468');
await page.getByRole('button', { name: 'Open Creator Studio' }).click();
await page.getByRole('button', { name: 'New lesson' }).waitFor();
await shot('creator-lessons');
await page.getByRole('button', { name: 'New lesson' }).click();
await page.getByLabel('Lesson title').fill('Sit to stand');
await page.getByLabel('Your name and role').fill('Dr. A. Chen, PT');
await shot('creator-new-lesson');
await page.getByRole('button', { name: /Next: record/ }).click();
await page.getByRole('button', { name: 'Record demonstration' }).click();
await page.getByRole('button', { name: 'Start recording' }).click({ timeout: 120_000 });
await sleep(2000);
await shot('creator-recording');
await sleep(2500);
await page.getByRole('button', { name: 'Stop recording' }).click();
await page.getByRole('button', { name: 'Use this take' }).click();
await page.getByText(/InStep suggested/).waitFor({ timeout: 120_000 });
await sleep(800);
await shot('creator-editor');

// 3 report
const post = (path, body) =>
  fetch(`http://localhost:${TV_PORT}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
const p = await post('/api/profiles', { name: 'Margaret', avatar: 'sun', affectedHand: 'none' });
const day = (d, reps, hold, sway = 0) => {
  const t = new Date(Date.now() - d * 86400000).toISOString();
  return post('/api/sessions', {
    profileId: p.id,
    lessonId: 'fall-heel-raise-v1',
    startedAt: t,
    endedAt: t,
    gatesPassed: 4,
    gatesTotal: 4,
    reps,
    bestHoldSec: hold,
    avgBpm: null,
    swayStops: sway,
    coachTips: d % 3 === 0 ? 1 : 0,
    easierMode: d > 8,
    attempts: [
      { gateId: 'chair', type: 'safety_prerequisite', msToPass: 4000, coached: d % 3 === 0, passed: true },
    ],
  });
};
for (const d of [0, 1, 2, 4, 5, 7, 9, 10, 12]) await day(d, 5 + (d % 4), 2 + (d % 3) * 0.5, d === 7 ? 1 : 0);
const { url } = await post('/api/reports', { profileId: p.id, days: 14 });
await page.goto(url.replace(`http://localhost:${PORT}`, `http://localhost:${PORT}`));
await page.getByRole('heading', { name: /practice/ }).waitFor();
await sleep(500);
await page.screenshot({ path: join(out, 'report.png'), fullPage: true });

await browser.close();
tv.close();
server.kill();
console.log(`screenshots written to ${out}`);
process.exit(0);
