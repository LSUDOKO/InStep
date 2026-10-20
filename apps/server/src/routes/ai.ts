import { rest } from '@instep/protocol';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps';
import { parse } from './util';

export async function aiRoutes(app: FastifyInstance, { coach, config }: Deps) {
  app.post('/api/coach', async (req, reply) => {
    const b = parse(rest.CoachRequest, req.body, reply);
    if (!b) return;
    return coach.tip(b);
  });

  /** Text → speech. Returns 204 when Polly is off: the TV shows the caption and the companion speaks. */
  app.post('/api/voice', async (req, reply) => {
    const b = parse(rest.VoiceRequest, req.body, reply);
    if (!b) return;
    if (config.MOCK_AI || !config.POLLY_ENABLED) return reply.code(204).send();
    return reply
      .code(501)
      .send({ error: 'NOT_IMPLEMENTED', message: 'Polly voice arrives in the AWS milestone' });
  });
}
