import { resolve } from 'node:path';
import { rest } from '@instep/protocol';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps';
import { parse } from './util';

export async function aiRoutes(app: FastifyInstance, { coach, voice, config }: Deps) {
  app.get('/voice/:file', async (req, reply) => {
    const { file } = req.params as { file: string };
    if (!/^[0-9a-f]{32}\.mp3$/.test(file)) return reply.code(404).send();
    return reply.sendFile(file, resolve(config.DATA_DIR, 'voice'));
  });

  app.post('/api/coach', async (req, reply) => {
    const b = parse(rest.CoachRequest, req.body, reply);
    if (!b) return;
    return coach.tip(b);
  });

  /** Text → speech. Returns 204 when Polly is off: the TV shows the caption and the companion speaks. */
  app.post('/api/voice', async (req, reply) => {
    const b = parse(rest.VoiceRequest, req.body, reply);
    if (!b) return;
    if (!voice) return reply.code(204).send();
    const url = await voice(b.text, b.language);
    return url ? { url } : reply.code(204).send();
  });
}
