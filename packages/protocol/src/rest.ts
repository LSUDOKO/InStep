import { CHANNELS } from '@instep/istep-format';
import { z } from 'zod';

export const Channel = z.enum(CHANNELS);

export const Profile = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  avatar: z.string().max(40),
  affectedHand: z.enum(['left', 'right', 'none']),
  planSessionsPerWeek: z.number().int().min(0).max(21),
  createdAt: z.string(),
});
export const CreateProfile = Profile.pick({ name: true, avatar: true, affectedHand: true }).extend({
  planSessionsPerWeek: z.number().int().min(0).max(21).default(5),
});

export const LessonSummary = z.object({
  id: z.string(),
  title: z.string(),
  channel: Channel,
  status: z.enum(['draft', 'published']),
  creator: z.string(),
  durationSec: z.number(),
  gateCount: z.number().int(),
  difficulty: z.number().int().min(1).max(3),
  isNew: z.boolean(),
  /** created in Creator Studio (seed lessons are read-only) */
  editable: z.boolean(),
  posterUrl: z.string().nullable(),
});
export const Catalog = z.object({
  channels: z.array(z.object({ channel: Channel, title: z.string(), lessons: z.array(LessonSummary) })),
});
export const LessonDetail = LessonSummary.extend({
  trackUrl: z.string(),
  referenceUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  needs: z.array(z.string()),
  /** progression level chosen by the physiotherapist (fall prevention) */
  level: z.string().nullable(),
  disclaimer: z.string().nullable(),
});

export const GateAttempt = z.object({
  gateId: z.string(),
  type: z.string(),
  msToPass: z.number().nonnegative().nullable(),
  coached: z.boolean(),
  passed: z.boolean(),
});
export const SessionSummary = z.object({
  profileId: z.string(),
  lessonId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  gatesPassed: z.number().int().nonnegative(),
  gatesTotal: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  bestHoldSec: z.number().nonnegative(),
  avgBpm: z.number().nonnegative().nullable(),
  swayStops: z.number().int().nonnegative(),
  coachTips: z.number().int().nonnegative(),
  easierMode: z.boolean(),
  attempts: z.array(GateAttempt).max(100),
});

export const Progress = z.object({
  days: z.array(z.object({ date: z.string(), sessions: z.number(), reps: z.number(), holdSec: z.number() })),
  totals: z.object({ sessions: z.number(), reps: z.number(), holdSec: z.number(), streakDays: z.number() }),
});

export const CoachRequest = z.object({
  profileId: z.string(),
  lessonId: z.string(),
  gateId: z.string(),
  gateType: z.string(),
  channel: Channel,
  language: z.string().max(16),
  label: z.string().max(80),
  worst: z.object({ name: z.string().max(40), hint: z.string().max(120) }).optional(),
  jointErrors: z.record(z.string(), z.number()).optional(),
  fingerErrors: z
    .array(z.object({ finger: z.string(), hint: z.enum(['curl', 'extend']) }))
    .max(5)
    .optional(),
  errorBucket: z.string().max(80),
  attemptsOnGate: z.number().int().nonnegative(),
  audience: z.enum(['older_adult', 'adult', 'child', 'family']),
  fallbackTip: z.string().max(200),
});
export const CoachResponse = z.object({
  tip: z.string(),
  source: z.enum(['ai', 'cache', 'fallback', 'mock']),
});

export const VoiceRequest = z.object({ text: z.string().min(1).max(300), language: z.string().max(16) });

export const CreateReport = z.object({
  profileId: z.string(),
  days: z.number().int().min(1).max(90).default(14),
});

export type Profile = z.infer<typeof Profile>;
export type CreateProfile = z.infer<typeof CreateProfile>;
export type LessonSummary = z.infer<typeof LessonSummary>;
export type LessonDetail = z.infer<typeof LessonDetail>;
export type Catalog = z.infer<typeof Catalog>;
export type SessionSummary = z.infer<typeof SessionSummary>;
export type Progress = z.infer<typeof Progress>;
export type CoachRequest = z.infer<typeof CoachRequest>;
export type CoachResponse = z.infer<typeof CoachResponse>;
