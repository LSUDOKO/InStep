import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Deps } from './deps';
import { mountMcp } from './mcp';
import { aiRoutes } from './routes/ai';
import { learnerRoutes } from './routes/learners';
import { lessonRoutes } from './routes/lessons';

export const COMPANION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Builds one Fastify app; main.ts runs two (HTTPS for phones, plain HTTP for the TV) on the same deps. */
export async function buildApp(deps: Deps, tls?: { cert: Buffer; key: Buffer } | null) {
  const bodyLimit = 1024 * 1024;
  const app = (tls
    ? Fastify({ https: tls, bodyLimit })
    : Fastify({ bodyLimit })) as unknown as FastifyInstance;
  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024, files: 3 } });

  // Lesson media is served by the /media route via reply.sendFile (needs a registered static root).
  const companion = resolve(deps.config.COMPANION_DIST);
  await app.register(fastifyStatic, {
    root: existsSync(companion) ? companion : resolve(deps.lessons.mediaDir),
    prefix: '/c/',
    serve: existsSync(companion),
  });
  if (existsSync(resolve(companion, 'models')))
    await app.register(fastifyStatic, {
      root: resolve(companion, 'models'),
      prefix: '/models/',
      decorateReply: false,
    });

  // Privacy firewall for the companion (/c/): the browser may only talk to this InStep server.
  // MediaPipe tasks-vision 1.1.1 always posts usage logs to a Google endpoint; connect-src 'self' blocks that
  // (and anything else) at the browser level. 'wasm-unsafe-eval' is required to run MediaPipe's WASM.
  app.addHook('onSend', async (req, reply, payload) => {
    if (req.url.startsWith('/c/') || req.url === '/c')
      reply.header('content-security-policy', COMPANION_CSP).header('referrer-policy', 'no-referrer');
    return payload;
  });

  app.get('/api/health', async () => ({ ok: true, version: pkg.version, mockAi: deps.config.MOCK_AI }));
  await app.register(lessonRoutes, deps);
  await app.register(learnerRoutes, deps);
  await app.register(aiRoutes, deps);
  if (deps.config.MCP_ENABLED) await mountMcp(app, deps);

  // Companion is a single-page app: unknown /c/* paths get index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && req.url.startsWith('/c/') && existsSync(resolve(companion, 'index.html')))
      return reply.sendFile('index.html', companion);
    return reply
      .code(404)
      .send({ error: 'NOT_FOUND', message: `No route ${req.method} ${req.url.split('?')[0]}` });
  });
  return app;
}
