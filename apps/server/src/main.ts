import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildApp } from './app';
import { createAiBudget } from './ai/budget';
import { createBedrockText } from './ai/bedrock';
import { createLabeler } from './ai/labeler';
import { createVoice } from './ai/voice';
import { bedrockTipGenerator, createCoach } from './coach/coach';
import { loadConfig } from './config';
import { openDb } from './db';
import { createLessonStore } from './lessons';
import { logger } from './log';
import { createRelay } from './relay';

const log = logger('main');
const envFile = resolve(process.cwd(), '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config = loadConfig();

const dataDir = resolve(config.DATA_DIR);
const db = openDb(join(dataDir, 'instep.sqlite'));
const lessons = createLessonStore(db, join(dataDir, 'media'));
lessons.seed(config.CONTENT_DIR);
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  log.warn('ffmpeg not found: Creator Studio uploads cannot be converted (install ffmpeg)');
}
const relay = createRelay({ publicUrl: config.PUBLIC_URL });
const budget = createAiBudget(config.COACH_MAX_CALLS_PER_DAY);
// Real AWS only when MOCK_AI=false (AWS usage is billed to you). The model id comes from BEDROCK_MODEL_ID.
const model = config.MOCK_AI
  ? undefined
  : await createBedrockText(config.BEDROCK_MODEL_ID, config.AWS_REGION);
const coach = createCoach({
  db,
  mock: config.MOCK_AI,
  ...(model ? { generate: bedrockTipGenerator(model) } : {}),
  minIntervalSec: config.COACH_MIN_INTERVAL_SEC,
  budget,
});
const labeler = createLabeler({ ...(model ? { model } : {}), budget });
const voice =
  !config.MOCK_AI && config.POLLY_ENABLED
    ? await createVoice({ dir: join(dataDir, 'voice'), region: config.AWS_REGION, budget })
    : null;
const deps = { config, db, lessons, coach, labeler, voice, relay, now: Date.now };

const tls =
  config.HTTPS_CERT && config.HTTPS_KEY && existsSync(config.HTTPS_CERT) && existsSync(config.HTTPS_KEY)
    ? { cert: readFileSync(config.HTTPS_CERT), key: readFileSync(config.HTTPS_KEY) }
    : null;
if (!tls)
  log.warn('no HTTPS cert: phones need HTTPS for the camera (see README → mkcert); localhost still works');

// Companion (phones/laptops): HTTPS so getUserMedia works on the LAN.
const main = await buildApp(deps, tls);
relay.attach(main.server);
await main.listen({ port: config.PORT, host: config.HOST });

// TV (Vega): plain HTTP/WS, so the device never has to trust a self-signed certificate.
const tv = await buildApp(deps);
relay.attach(tv.server);
await tv.listen({ port: config.TV_HTTP_PORT, host: config.HOST });

log.info('ready', {
  companion: `${tls ? 'https' : 'http'}://${config.HOST}:${config.PORT}/c/`,
  tv: `http://${config.HOST}:${config.TV_HTTP_PORT}`,
  publicUrl: config.PUBLIC_URL,
  mockAi: config.MOCK_AI,
  polly: !!voice,
  aiCallsPerDay: config.COACH_MAX_CALLS_PER_DAY,
});

for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, async () => {
    relay.close();
    await Promise.all([main.close(), tv.close()]);
    db.close();
    process.exit(0);
  });
