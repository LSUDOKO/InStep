import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import { TV_PORT } from '../playwright.config';

/** A fake TV that creates a room and collects landmarks messages. */
async function fakeTv() {
  const ws = new WebSocket(`ws://localhost:${TV_PORT}/ws`);
  const landmarks: { pose?: unknown; ts: number }[] = [];
  const room = await new Promise<string>((resolve, reject) => {
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', v: 1, role: 'tv', deviceId: 'e2e-tv' })));
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.type === 'room_created') resolve(m.room);
      if (m.type === 'peer_joined')
        ws.send(
          JSON.stringify({
            type: 'lesson_tracking',
            lessonId: 'e2e',
            tracking: ['pose'],
            cameraView: 'front',
            gesturesEnabled: false,
          }),
        );
      if (m.type === 'landmarks') landmarks.push(m);
    });
  });
  return { ws, room, landmarks };
}

test('joins by room code, streams landmarks to the TV, and measures 0 video bytes', async ({ page }) => {
  const tv = await fakeTv();
  const framesSent: (string | Buffer)[] = [];
  const uploads: string[] = [];
  page.on('websocket', (s) => s.on('framesent', (f) => framesSent.push(f.payload)));
  const thirdParty: string[] = [];
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH'].includes(r.method()) && new URL(r.url()).hostname === 'localhost')
      uploads.push(`${r.method()} ${r.url()}`);
  });
  page.on('response', (r) => {
    if (new URL(r.url()).hostname !== 'localhost') thirdParty.push(r.url());
  });

  const res = await page.goto(`/c/?room=${tv.room}`);
  // Privacy firewall: the page may only talk to this InStep server.
  expect(res?.headers()['content-security-policy']).toContain("connect-src 'self'");
  await expect(page.getByRole('heading', { name: 'Use this phone as the camera' })).toBeVisible();
  await expect(page.getByText('Your camera stays on this device')).toBeVisible();
  await expect(page.getByLabel('Room code on your TV')).toHaveValue(tv.room);
  await page.getByRole('button', { name: 'Start camera' }).click();

  await expect(page.getByTestId('connection')).toHaveText(/Connected to TV/, { timeout: 90_000 });
  // CI runners do software inference at ~1 fps: this checks the flow, not speed (fps is checked on devices).
  await expect.poll(() => tv.landmarks.length, { timeout: 60_000 }).toBeGreaterThan(5);

  // Privacy pill: measured values, video always 0.
  await expect(page.getByTestId('body-rate')).not.toHaveText('0.0 KB/s', { timeout: 10_000 });
  await expect(page.getByTestId('video-rate')).toHaveText('0.0 KB/s');
  await page.getByTestId('privacy-pill').click();
  await expect(page.getByRole('dialog', { name: 'What leaves this phone' })).toBeVisible();
  await expect(page.getByTestId('privacy-sample')).toContainText('"type": "landmarks"');
  await page.getByRole('button', { name: 'Close' }).click();

  // Network: only JSON text frames over the WebSocket, no HTTP uploads, nothing reaches a third party.
  expect(uploads).toEqual([]);
  expect(thirdParty).toEqual([]);
  const external = await page.evaluate(() =>
    fetch('https://odml.pa.googleapis.com/v1/log', { method: 'POST' }).then(
      () => 'sent',
      () => 'blocked',
    ),
  );
  expect(external).toBe('blocked');
  expect(framesSent.length).toBeGreaterThan(0);
  for (const p of framesSent) {
    expect(typeof p).toBe('string');
    expect(() => JSON.parse(p as string)).not.toThrow();
  }

  // Rate ≤ 30 msgs/s over the last two seconds.
  const now = Date.now();
  const recent = tv.landmarks.filter((m) => now - m.ts < 2000).length;
  expect(recent).toBeLessThanOrEqual(62);
  tv.ws.close();
});

test('unknown room code shows a clear error', async ({ page }) => {
  const tv = await fakeTv(); // make sure the server is up; use a different code
  const wrong = tv.room === '0000' ? '0001' : '0000';
  await page.goto(`/c/?room=${wrong}`);
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByRole('alert')).toContainText(`No room ${wrong}`, { timeout: 90_000 });
  tv.ws.close();
});

test('unknown pages show a designed not-found screen', async ({ page }) => {
  await page.goto('/c/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
