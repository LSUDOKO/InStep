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
  relay: Relay;
  now: () => number;
};
