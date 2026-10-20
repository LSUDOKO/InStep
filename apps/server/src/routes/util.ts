import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

/** Parses a body/query with zod; replies 400 with the first issue's path on failure. */
export function parse<T>(schema: z.ZodType<T>, input: unknown, reply: FastifyReply): T | undefined {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const i = r.error.issues[0]!;
  reply.code(400).send({ error: 'BAD_REQUEST', message: `${i.path.join('.') || 'body'}: ${i.message}` });
  return undefined;
}

/** Demo-only creator protection (CREATOR_PIN). Production needs real auth. */
export function creatorGuard(pin: string) {
  const expected = Buffer.from(pin);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const got = Buffer.from(String(req.headers['x-creator-pin'] ?? ''));
    if (got.length !== expected.length || !timingSafeEqual(got, expected))
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Creator PIN required' });
  };
}
