import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const Role = z.enum(['tv', 'host', 'guest']);
export type Role = z.infer<typeof Role>;

export const RoomCode = z.string().regex(/^\d{4}$/, 'room code is 4 digits');

const PosePoint = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const HandPoint = z.tuple([z.number(), z.number(), z.number()]);
const Hand = z.array(HandPoint).length(21).nullable();

export const DetectedObject = z.object({
  label: z.string().max(40),
  score: z.number().min(0).max(1),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

// ---- room lifecycle -------------------------------------------------------
export const Hello = z.object({
  type: z.literal('hello'),
  v: z.literal(PROTOCOL_VERSION),
  role: Role,
  room: RoomCode.optional(),
  name: z.string().max(40).optional(),
  deviceId: z.string().min(1).max(80),
});
export const RoomCreated = z.object({ type: z.literal('room_created'), room: RoomCode, joinUrl: z.string() });
export const Joined = z.object({ type: z.literal('joined'), room: RoomCode, peerId: z.string(), role: Role });
export const PeerJoined = z.object({
  type: z.literal('peer_joined'),
  role: Role,
  name: z.string().optional(),
  peerId: z.string(),
});
export const PeerLeft = z.object({
  type: z.literal('peer_left'),
  role: Role,
  name: z.string().optional(),
  peerId: z.string(),
});
export const ErrorMsg = z.object({
  type: z.literal('error'),
  code: z.enum(['ROOM_NOT_FOUND', 'ROOM_FULL', 'BAD_MESSAGE', 'NOT_JOINED']),
  message: z.string(),
});
export const Ping = z.object({ type: z.literal('ping'), ts: z.number() });
export const Pong = z.object({ type: z.literal('pong'), ts: z.number() });

// ---- lesson and frames ----------------------------------------------------
export const Tracker = z.enum(['pose', 'hands', 'objects']);
export const LessonTracking = z.object({
  type: z.literal('lesson_tracking'),
  lessonId: z.string(),
  tracking: z.array(Tracker),
  cameraView: z.enum(['front', 'side', 'hands']),
  gesturesEnabled: z.boolean(),
  hint: z.string().optional(),
});
export const Landmarks = z.object({
  type: z.literal('landmarks'),
  seq: z.number().int().nonnegative(),
  ts: z.number(),
  role: z.enum(['host', 'guest']),
  /** set by the relay: sending peer */
  from: z.string().optional(),
  mirrored: z.boolean(),
  pose: z.array(PosePoint).length(33).nullable().optional(),
  hands: z.object({ left: Hand.optional(), right: Hand.optional() }).optional(),
  handScores: z.object({ left: z.number().optional(), right: z.number().optional() }).optional(),
  objects: z.array(DetectedObject).max(10).optional(),
  fps: z.number().nonnegative().optional(),
});
export const GateState = z.object({
  type: z.literal('gate_state'),
  gateId: z.string(),
  gateType: z.string(),
  status: z.enum(['waiting', 'progress', 'passed', 'blocked_safety', 'no_person']),
  progress: z.number(),
  worst: z.object({ name: z.string(), hint: z.string() }).optional(),
  label: z.string(),
  /** for Together mode: whose state this is */
  peerId: z.string().optional(),
});
export const GateResult = z.object({
  type: z.literal('gate_result'),
  gateId: z.string(),
  passed: z.literal(true),
  ms: z.number(),
});
export const ControlAction = z.enum(['toggle_pause', 'play', 'pause', 'repeat', 'easier', 'next', 'ok']);
export const Control = z.object({
  type: z.literal('control'),
  action: ControlAction,
  source: z.enum(['gesture', 'voice', 'button']),
});
export const SafetyEvent = z.object({
  type: z.literal('safety_event'),
  kind: z.enum(['sway_stop', 'camera_lost', 'resumed']),
});
export const CatalogUpdated = z.object({ type: z.literal('catalog_updated'), lessonId: z.string() });
/** TV asks the companion to speak a line with browser speech (Polly off / unavailable on TV). */
export const Speak = z.object({ type: z.literal('speak'), text: z.string().max(300), language: z.string() });
export const LessonEnded = z.object({ type: z.literal('lesson_ended'), lessonId: z.string() });

export const Message = z.discriminatedUnion('type', [
  Hello,
  RoomCreated,
  Joined,
  PeerJoined,
  PeerLeft,
  ErrorMsg,
  Ping,
  Pong,
  LessonTracking,
  Landmarks,
  GateState,
  GateResult,
  Control,
  SafetyEvent,
  CatalogUpdated,
  Speak,
  LessonEnded,
]);
export type Message = z.infer<typeof Message>;
export type MessageOf<T extends Message['type']> = Extract<Message, { type: T }>;
export type LandmarksMsg = z.infer<typeof Landmarks>;

/** Messages a client may send that the relay forwards to the room. */
export const ROOM_MESSAGES: ReadonlySet<Message['type']> = new Set([
  'lesson_tracking',
  'landmarks',
  'gate_state',
  'gate_result',
  'control',
  'safety_event',
  'speak',
  'lesson_ended',
]);

export type ParseResult = { ok: true; msg: Message } | { ok: false; error: string };

/** Parses and validates one WebSocket text frame. */
export function parseMessage(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const r = Message.safeParse(data);
  if (r.success) return { ok: true, msg: r.data };
  const i = r.error.issues[0]!;
  return { ok: false, error: `${i.path.join('.') || 'message'}: ${i.message}` };
}

export const encode = (m: Message) => JSON.stringify(m);
