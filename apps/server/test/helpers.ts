import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app';
import { createAiBudget } from '../src/ai/budget';
import { createLabeler } from '../src/ai/labeler';
import { createCoach } from '../src/coach/coach';
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { createLessonStore } from '../src/lessons';
import { createRelay } from '../src/relay';

export const PIN = '1357';

/**
 * Temp content dir: all seed lessons, plus a real 2 s video for heel raises. Placeholder videos (video.placeholder)
 * and the "I love you" video are dropped, so at least one lesson is a draft and the drafts-vs-published rules stay
 * testable now that every seed lesson has a video.
 */
export function makeContent() {
  const dir = mkdtempSync(join(tmpdir(), 'instep-content-'));
  cpSync(new URL('../../../content/lessons', import.meta.url), dir, { recursive: true });
  for (const id of readdirSync(dir))
    if (existsSync(join(dir, id, 'video.placeholder'))) rmSync(join(dir, id, 'video.mp4'), { force: true });
  rmSync(join(dir, 'asl-i-love-you-v1', 'video.mp4'), { force: true });
  tinyVideo(join(dir, 'fall-heel-raise-v1', 'video.mp4'));
  return dir;
}

export function tinyVideo(out: string, ext: 'mp4' | 'webm' = 'mp4') {
  const codec =
    ext === 'mp4' ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'] : ['-c:v', 'libvpx', '-b:v', '200k'];
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=320x180:rate=15',
    '-t',
    '2',
    ...codec,
    out,
  ]);
}

export async function makeServer(env: Record<string, string> = {}, now: () => number = Date.now) {
  const data = mkdtempSync(join(tmpdir(), 'instep-data-'));
  const config = loadConfig({
    CREATOR_PIN: PIN,
    PUBLIC_URL: 'https://example.test:8787',
    DATA_DIR: data,
    ...env,
  });
  const db = openDb(':memory:');
  const lessons = createLessonStore(db, join(data, 'media'), now);
  lessons.seed(makeContent());
  const relay = createRelay({ publicUrl: config.PUBLIC_URL });
  const budget = createAiBudget(config.COACH_MAX_CALLS_PER_DAY, now);
  const coach = createCoach({
    db,
    mock: config.MOCK_AI,
    minIntervalSec: config.COACH_MIN_INTERVAL_SEC,
    budget,
    now,
  });
  const deps = { config, db, lessons, coach, labeler: createLabeler({ budget }), voice: null, relay, now };
  const app = await buildApp(deps);
  relay.attach(app.server);
  return { app, deps, data };
}
