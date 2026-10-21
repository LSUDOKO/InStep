import type { IstepTrack, ReferenceTimeline } from '@instep/istep-format';
import type { LessonDetail } from '@instep/protocol';
import { services } from './app';

export type LoadedLesson = { detail: LessonDetail; track: IstepTrack; reference?: ReferenceTimeline };
const cache = new Map<string, Promise<LoadedLesson>>();

/** Lesson detail + validated .istep + reference timeline, fetched once per lesson. */
export function loadLesson(id: string): Promise<LoadedLesson> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const detail = await services.api.lesson(id);
      const [track, reference] = await Promise.all([
        services.api.track(detail),
        services.api.reference(detail),
      ]);
      return { detail, track, ...(reference ? { reference } : {}) };
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export function forgetLesson(id: string) {
  cache.delete(id);
}
