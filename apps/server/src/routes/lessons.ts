import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { Channel, validateReference, validateTrack, type IstepTrack } from '@instep/istep-format';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Deps } from '../deps';
import { logger } from '../log';
import { creatorGuard, parse } from './util';

const run = promisify(execFile);
const log = logger('lessons');

const DEFAULT_DISCLAIMERS: Partial<Record<z.infer<typeof Channel>, string>> = {
  fall_prevention:
    'Use exercises prescribed or approved by your physiotherapist. Stop if you feel pain, dizziness or unsteadiness.',
  stroke_rehab:
    'Use exercises prescribed or approved by your physiotherapist. Stop if you feel pain, dizziness or unsteadiness.',
  sign_language: 'A practice aid created with Deaf signers. Learn with Deaf teachers and community too.',
  cpr: 'Practice aid for rhythm and straight arms only. It does not measure compression depth and is not certification. Take a certified CPR course.',
};
const TRACKING: Record<z.infer<typeof Channel>, IstepTrack['tracking']> = {
  fall_prevention: ['pose', 'objects'],
  stroke_rehab: ['hands'],
  sign_language: ['hands'],
  cpr: ['pose'],
  kids: ['pose'],
};

const CreateLesson = z.object({
  title: z.string().trim().min(1).max(120),
  channel: Channel,
  language: z.string().default('en-US'),
  needs: z.array(z.string().max(60)).max(6).default([]),
  cameraView: z.enum(['front', 'side', 'hands']).default('front'),
  cameraHint: z.string().max(200).default('Place the camera where it can see you.'),
  disclaimer: z.string().max(400).optional(),
  creator: z.string().trim().min(1).max(80),
});

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'lesson';

export async function lessonRoutes(app: FastifyInstance, { lessons, relay, config }: Deps) {
  const guard = creatorGuard(config.CREATOR_PIN);

  app.get('/api/lessons', async (req) => lessons.catalog((req.query as { all?: string }).all === '1'));

  app.get('/api/lessons/:id', async (req, reply) => {
    const l = lessons.get((req.params as { id: string }).id);
    return l ? lessons.detail(l) : reply.code(404).send({ error: 'NOT_FOUND', message: 'No such lesson' });
  });

  app.get('/api/lessons/:id/track', async (req, reply) => {
    const l = lessons.get((req.params as { id: string }).id);
    if (!l) return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such lesson' });
    return reply.type('application/vnd.instep+json').send(l.track);
  });

  app.get('/media/:id/:file', async (req, reply) => {
    const { id, file } = req.params as { id: string; file: string };
    const l = lessons.get(id);
    const allowed = l && [l.assets.video, l.assets.poster, l.assets.reference].includes(file);
    if (!l || !allowed || !existsSync(join(l.assets.dir, file))) return reply.code(404).send();
    return reply.sendFile(file, l.assets.dir);
  });

  app.post('/api/lessons', { preHandler: guard }, async (req, reply) => {
    const b = parse(CreateLesson, req.body, reply);
    if (!b) return;
    const id = `${slug(b.title)}-${randomBytes(3).toString('hex')}`;
    const track: IstepTrack = {
      istep: '1.0',
      id,
      title: b.title,
      channel: b.channel,
      language: b.language,
      video: { src: 'video.mp4', durationSec: 1 },
      tracking: TRACKING[b.channel],
      camera: { view: b.cameraView, hint: b.cameraHint },
      ...((b.disclaimer ?? DEFAULT_DISCLAIMERS[b.channel])
        ? { disclaimer: b.disclaimer ?? DEFAULT_DISCLAIMERS[b.channel] }
        : {}),
      reference: { src: 'reference.json' },
      ...(b.channel === 'fall_prevention'
        ? { safety: { swayStop: { enabled: true, maxLateralSway: 0.06, windowSec: 1.5 } } }
        : {}),
      gates: [],
      credits: { creator: b.creator, license: 'CC-BY-4.0' },
    };
    lessons.save({
      id,
      title: b.title,
      channel: b.channel,
      status: 'draft',
      creator: b.creator,
      createdAt: new Date().toISOString(),
      track,
      assets: { dir: join(lessons.mediaDir, id) },
      meta: { needs: b.needs, difficulty: 1, source: 'studio' },
    });
    return reply.code(201).send(lessons.detail(lessons.get(id)!));
  });

  app.post('/api/lessons/:id/assets', { preHandler: guard }, async (req, reply) => {
    const l = lessons.get((req.params as { id: string }).id);
    if (!l) return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such lesson' });
    if (l.meta.source !== 'studio')
      return reply.code(409).send({ error: 'READ_ONLY', message: 'Seed lessons are read-only' });
    const dir = l.assets.dir;
    mkdirSync(dir, { recursive: true });
    const assets = { ...l.assets };
    for await (const part of req.parts()) {
      if (part.type !== 'file') continue;
      if (part.fieldname === 'video') {
        const tmp = join(dir, `upload-${randomBytes(4).toString('hex')}`);
        await pipeline(part.file, createWriteStream(tmp));
        try {
          // Always re-encode to H.264/AAC MP4 so the Vega player gets a format it plays.
          await run('ffmpeg', [
            '-y',
            '-loglevel',
            'error',
            '-i',
            tmp,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-pix_fmt',
            'yuv420p',
            '-vf',
            'scale=-2:min(1080\\,ih)',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            join(dir, 'video.mp4'),
          ]);
          await run('ffmpeg', [
            '-y',
            '-loglevel',
            'error',
            '-ss',
            '1',
            '-i',
            join(dir, 'video.mp4'),
            '-frames:v',
            '1',
            '-vf',
            'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
            join(dir, 'poster.jpg'),
          ]);
          assets.video = 'video.mp4';
          assets.poster ??= 'poster.jpg';
        } catch (e) {
          log.error('transcode failed', { id: l.id, error: (e as Error).message });
          return reply
            .code(422)
            .send({ error: 'TRANSCODE_FAILED', message: 'Could not convert this video. Try MP4 or WebM.' });
        } finally {
          rmSync(tmp, { force: true });
        }
      } else if (part.fieldname === 'reference') {
        const buf = await part.toBuffer();
        const v = validateReference(JSON.parse(buf.toString('utf8')));
        if (!v.ok)
          return reply
            .code(400)
            .send({ error: 'BAD_REFERENCE', message: `${v.errors[0]!.path}: ${v.errors[0]!.message}` });
        writeFileSync(join(dir, 'reference.json'), buf);
        assets.reference = 'reference.json';
      } else if (part.fieldname === 'poster') {
        await pipeline(part.file, createWriteStream(join(dir, 'poster.jpg')));
        assets.poster = 'poster.jpg';
      } else part.file.resume();
    }
    lessons.save({ ...l, assets });
    return lessons.detail(lessons.get(l.id)!);
  });

  app.put('/api/lessons/:id/track', { preHandler: guard }, async (req, reply) => {
    const l = lessons.get((req.params as { id: string }).id);
    if (!l) return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such lesson' });
    if (l.meta.source !== 'studio')
      return reply.code(409).send({ error: 'READ_ONLY', message: 'Seed lessons are read-only' });
    const v = validateTrack(req.body);
    if (!v.ok) return reply.code(400).send({ error: 'INVALID_TRACK', errors: v.errors });
    if (v.value.id !== l.id)
      return reply
        .code(400)
        .send({ error: 'INVALID_TRACK', errors: [{ path: 'id', message: 'id must match the lesson' }] });
    lessons.save({ ...l, track: v.value });
    return { ok: true };
  });

  app.post('/api/lessons/:id/publish', { preHandler: guard }, async (req, reply) => {
    const l = lessons.get((req.params as { id: string }).id);
    if (!l) return reply.code(404).send({ error: 'NOT_FOUND', message: 'No such lesson' });
    const problems: string[] = [];
    if (!l.assets.video) problems.push('Record or upload a demonstration video first.');
    if (l.track.gates.length === 0) problems.push('Add at least one gate.');
    const v = validateTrack(l.track);
    if (!v.ok) problems.push(...v.errors.map((e) => `${e.path}: ${e.message}`));
    if (problems.length) return reply.code(400).send({ error: 'NOT_READY', message: problems[0], problems });
    lessons.save({ ...l, status: 'published' });
    relay.broadcastCatalog(l.id);
    log.info('published', { id: l.id });
    return lessons.detail(lessons.get(l.id)!);
  });
}
