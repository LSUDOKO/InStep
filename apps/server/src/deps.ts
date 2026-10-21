import type { Labeler } from './ai/labeler';
import type { Voice } from './ai/voice';
import type { Coach } from './coach/coach';
import type { Config } from './config';
import type { Db } from './db';
import type { LessonStore } from './lessons';
import type { Relay } from './relay';

export type Deps = {
  config: Config;
  db: Db;
  lessons: LessonStore;
  coach: Coach;
  labeler: Labeler;
  /** null when Polly is off (mock mode or POLLY_ENABLED=false) */
  voice: Voice | null;
  relay: Relay;
  now: () => number;
};
