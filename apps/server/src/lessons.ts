import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CHANNELS, validateTrack, type Channel, type IstepTrack } from '@instep/istep-format';
import type { Catalog, LessonDetail, LessonSummary } from '@instep/protocol';
import type { Db } from './db';
import { logger } from './log';

const log = logger('lessons');

export const CHANNEL_TITLES: Record<Channel, string> = {
  fall_prevention: 'Fall Prevention',
  sign_language: 'Sign Language for Families',
  stroke_rehab: 'Stroke Hand Rehab',
  cpr: 'CPR Practice',
  kids: "Kids' Active Storytime",
};
/** Hero channels first. */
export const CHANNEL_ORDER: Channel[] = ['fall_prevention', 'sign_language', 'stroke_rehab', 'cpr', 'kids'];

export type LessonMeta = { needs: string[]; difficulty: number; source: 'seed' | 'studio'; level?: string };
export type LessonAssets = { dir: string; video?: string; poster?: string; reference?: string };
export type LessonRow = {
  id: string;
  title: string;
  channel: Channel;
  status: 'draft' | 'published';
  creator: string;
  createdAt: string;
  track: IstepTrack;
  assets: LessonAssets;
  meta: LessonMeta;
};

type DbRow = {
  id: string;
  title: string;
  channel: string;
  status: string;
  creator: string;
  created_at: string;
  track_json: string;
  assets_json: string;
  meta_json: string;
};

const NEW_FOR_MS = 3 * 24 * 60 * 60 * 1000;

export function createLessonStore(db: Db, mediaDir: string, now: () => number = Date.now) {
  const toRow = (r: DbRow): LessonRow => ({
    id: r.id,
    title: r.title,
    channel: r.channel as Channel,
    status: r.status as LessonRow['status'],
    creator: r.creator,
    createdAt: r.created_at,
    track: JSON.parse(r.track_json),
    assets: JSON.parse(r.assets_json),
    meta: JSON.parse(r.meta_json),
  });

  const upsert = db.prepare(`INSERT OR REPLACE INTO lessons
    (id, title, channel, status, creator, created_at, track_json, assets_json, meta_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const store = {
    mediaDir,
    get(id: string): LessonRow | undefined {
      const r = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as DbRow | undefined;
      return r && toRow(r);
    },
    list(includeDrafts = false): LessonRow[] {
      const rows = db.prepare('SELECT * FROM lessons ORDER BY created_at').all() as DbRow[];
      return rows.map(toRow).filter((l) => includeDrafts || l.status === 'published');
    },
    save(l: LessonRow) {
      upsert.run(
        l.id,
        l.track.title,
        l.track.channel,
        l.status,
        l.creator,
        l.createdAt,
        JSON.stringify(l.track),
        JSON.stringify(l.assets),
        JSON.stringify(l.meta),
      );
    },
    summary(l: LessonRow): LessonSummary {
      return {
        id: l.id,
        title: l.track.title,
        channel: l.track.channel,
        status: l.status,
        creator: l.track.credits?.creator ?? l.creator,
        durationSec: l.track.video.durationSec,
        gateCount: l.track.gates.length,
        difficulty: l.meta.difficulty,
        isNew: l.meta.source === 'studio' && now() - Date.parse(l.createdAt) < NEW_FOR_MS,
        editable: l.meta.source === 'studio',
        posterUrl: l.assets.poster ? `/media/${l.id}/${l.assets.poster}` : null,
      };
    },
    detail(l: LessonRow): LessonDetail {
      return {
        ...store.summary(l),
        trackUrl: `/api/lessons/${l.id}/track`,
        referenceUrl: l.assets.reference ? `/media/${l.id}/${l.assets.reference}` : null,
        videoUrl: l.assets.video ? `/media/${l.id}/${l.assets.video}` : null,
        needs: l.meta.needs,
        level: l.meta.level ?? null,
        disclaimer: l.track.disclaimer ?? null,
      };
    },
    catalog(includeDrafts = false): Catalog {
      const lessons = store.list(includeDrafts);
      return {
        channels: CHANNEL_ORDER.filter((c) => CHANNELS.includes(c)).map((channel) => ({
          channel,
          title: CHANNEL_TITLES[channel],
          lessons: lessons.filter((l) => l.channel === channel).map(store.summary),
        })),
      };
    },
    /**
     * Loads content/lessons/<id>/ folders (lesson.json + track.istep [+ video.mp4, poster.jpg, reference.json]).
     * A lesson is published only when its video exists — no catalog entries for content that isn't recorded yet.
     * Seed rows are refreshed on every start; Creator Studio lessons are never touched.
     */
    seed(contentDir: string): number {
      const root = resolve(contentDir);
      if (!existsSync(root)) {
        log.warn('content dir missing', { root });
        return 0;
      }
      let n = 0;
      for (const id of readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)) {
        const dir = join(root, id);
        const trackFile = join(dir, 'track.istep');
        if (!existsSync(trackFile)) continue;
        const v = validateTrack(JSON.parse(readFileSync(trackFile, 'utf8')));
        if (!v.ok) {
          log.error('invalid seed track', { id, errors: v.errors.slice(0, 3) });
          continue;
        }
        const existing = store.get(id);
        if (existing && existing.meta.source === 'studio') continue;
        const meta = existsSync(join(dir, 'lesson.json'))
          ? JSON.parse(readFileSync(join(dir, 'lesson.json'), 'utf8'))
          : {};
        const has = (f: string) => (existsSync(join(dir, f)) ? f : undefined);
        const video = has(v.value.video.src);
        store.save({
          id,
          title: v.value.title,
          channel: v.value.channel,
          status: video ? 'published' : 'draft',
          creator: v.value.credits?.creator ?? 'InStep',
          createdAt: existing?.createdAt ?? new Date(now()).toISOString(),
          track: v.value,
          assets: {
            dir,
            ...(video ? { video } : {}),
            ...(has('poster.jpg') ? { poster: 'poster.jpg' } : {}),
            ...(v.value.reference && has(v.value.reference.src) ? { reference: v.value.reference.src } : {}),
          },
          meta: {
            needs: meta.needs ?? [],
            difficulty: meta.difficulty ?? 1,
            source: 'seed',
            ...(meta.level ? { level: meta.level } : {}),
          },
        });
        n++;
      }
      log.info('seeded lessons', { count: n });
      return n;
    },
  };
  return store;
}
export type LessonStore = ReturnType<typeof createLessonStore>;
