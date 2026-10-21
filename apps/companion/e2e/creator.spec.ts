import { expect, test } from '@playwright/test';
import WebSocket from 'ws';
import { PORT, TV_PORT } from '../playwright.config';

const PIN = '2468';
const api = `http://localhost:${PORT}`;

test('creator records a demonstration, gets suggested steps, publishes, and TVs are told', async ({
  page,
}) => {
  test.setTimeout(240_000);
  // a TV that listens for catalog_updated
  const tv = new WebSocket(`ws://localhost:${TV_PORT}/ws`);
  const updates: string[] = [];
  await new Promise((r) => tv.on('open', r));
  tv.send(JSON.stringify({ type: 'hello', v: 1, role: 'tv', deviceId: 'e2e-creator-tv' }));
  tv.on('message', (d) => {
    const m = JSON.parse(String(d));
    if (m.type === 'catalog_updated') updates.push(m.lessonId);
  });

  await page.goto('/c/creator');
  await page.getByLabel('Creator PIN').fill(PIN);
  await page.getByRole('button', { name: 'Open Creator Studio' }).click();
  await page.getByRole('button', { name: 'New lesson' }).click();
  await page.getByLabel('Lesson title').fill('E2E sit to stand');
  await page.getByLabel('Your name and role').fill('Test Physio, PT');
  await expect(page.getByLabel(/Safety note/)).toHaveValue(/physiotherapist/);
  await page.getByRole('button', { name: /Next: record/ }).click();

  await page.getByRole('button', { name: 'Record demonstration' }).click();
  await page.getByRole('button', { name: 'Start recording' }).click({ timeout: 120_000 });
  await expect(page.getByRole('status').filter({ hasText: 'REC' })).toBeVisible();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByRole('button', { name: 'Use this take' }).click();

  // uploaded + transcoded → editor with suggested steps (fall prevention always starts with the chair check)
  await expect(page.getByText(/InStep suggested \d+ steps?/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Step 1 of 1: Safety check')).toBeVisible();
  await page.getByRole('button', { name: 'Publish to TV' }).click();
  await expect(page.getByText(/Published in [\d.]+ s/)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => updates.length).toBeGreaterThan(0);

  const lessons = await (await fetch(`${api}/api/lessons`)).json();
  const mine = lessons.channels[0].lessons.find((l: { title: string }) => l.title === 'E2E sit to stand');
  expect(mine).toMatchObject({ status: 'published', isNew: true, editable: true });
  tv.close();
});

test('wrong creator PIN is refused', async ({ page }) => {
  await page.goto('/c/creator');
  await page.getByLabel('Creator PIN').fill('0000');
  await page.getByRole('button', { name: 'Open Creator Studio' }).click();
  await expect(page.getByRole('alert')).toContainText('That PIN is not right');
});

test('share report shows real session data and no video', async ({ page }) => {
  const post = (path: string, body: unknown) =>
    fetch(`${api}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const p = await post('/api/profiles', { name: 'Report Test', avatar: 'sun', affectedHand: 'none' });
  const lessons = await (await fetch(`${api}/api/lessons?all=1`)).json();
  const lessonId = lessons.channels[0].lessons[0].id;
  const now = new Date().toISOString();
  await post('/api/sessions', {
    profileId: p.id,
    lessonId,
    startedAt: now,
    endedAt: now,
    gatesPassed: 3,
    gatesTotal: 4,
    reps: 12,
    bestHoldSec: 2.5,
    avgBpm: null,
    swayStops: 1,
    coachTips: 2,
    easierMode: true,
    attempts: [{ gateId: 'chair', type: 'safety_prerequisite', msToPass: 4000, coached: true, passed: true }],
  });
  const { url } = await post('/api/reports', { profileId: p.id, days: 14 });
  await page.goto(new URL(url).pathname);
  await expect(page.getByRole('heading', { name: "Report Test's practice — last 14 days" })).toBeVisible();
  await expect(page.getByText('No video is ever recorded or stored.')).toBeVisible();
  await expect(page.getByText('Repetitions', { exact: true }).locator('..')).toContainText('12');
  await expect(page.getByText('Rest breaks (sway stops)').locator('..')).toContainText('1');
  await page.goto('/c/report/00000000000000000000000000000000');
  await expect(page.getByRole('heading', { name: 'Report not available' })).toBeVisible();
});
