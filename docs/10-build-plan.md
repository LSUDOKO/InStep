# 10 — Build Plan and Milestones

Deadline: **Oct 23, 2026, 12:00 PM PDT (Oct 24, 12:30 AM IST)**. Plan to have a full working demo **12 hours before** the deadline, leaving time for video recording and submission.

Work in order. Each milestone has acceptance criteria (AC); do not move on until they pass. Log progress in `docs/PROGRESS.md` and friction in `docs/FRICTION_LOG.md`.

## Milestone 0 — Day-1 spike (risk check, ~3 h)

Goal: prove the riskiest Vega assumptions before building features.

1. Install Vega Developer Tools; start the Vega Virtual Device; run `react-native-multi-tv-app-sample` (or `vega-video-sample`) unmodified.
2. Add a screen that plays a local MP4 and pauses/seeks programmatically at t = 5 s.
3. From the TV app, open a WebSocket to a tiny Node server on the host; send 30 msgs/s of a 1.2 KB JSON; measure receive rate and latency on the VVD.
4. Draw a 33-point skeleton (SVG or Views) over/next to the playing video, updated from those messages; measure render fps.
5. Try changing playback rate (0.75×). Record whether supported.
6. Try playing a short MP3 while video is paused.

**AC:** written results in `PROGRESS.md` for each item (works / doesn't / workaround). Decide: overlay vs side-by-side, rate change vs loop segment, TV audio vs companion speech. Add friction log entries.

## Milestone 1 — Packages (~4 h)

- `istep-format`: zod schema, types, JSON Schema export, CLI validator, 7 example files.
- `gate-engine`: everything in `04-gate-engine.md` with tests (≥ 90% coverage).
- `protocol`: message schemas.

**AC:** `pnpm test` green; `npx istep validate` passes all examples and fails 5 crafted invalid files with clear messages.

## Milestone 2 — Server (~3 h)

- Fastify + ws relay with rooms, REST endpoints for lessons/profiles/sessions, SQLite, static hosting for companion + models + media, HTTPS dev cert, seed content, coach + voice in **mock mode**.

**AC:** integration test: fake TV + fake host connect to a room, 30 msgs/s for 60 s, no drops, p95 relay latency < 20 ms locally; `GET /api/lessons` returns seeded lessons.

## Milestone 3 — Companion camera node (~4 h)

- Join flow, MediaPipe pose/hands/objects, landmarks messages, local preview, privacy pill (measured), placement helper, connection states.

**AC:** on a laptop and a phone (HTTPS), landmarks arrive at a test TV client at ≥ 15 fps; privacy pill shows real numbers with video 0.

## Milestone 4 — TV app core + gated player (~8 h)

- Splash/server check, profiles, home catalog (5 rows), lesson detail, pairing (QR + code), camera check, `<GatedPlayer>` with gates, HUD widgets, ghost + learner skeleton, coach captions (mock), session summary, settings.

**AC:** heel-raise lesson end to end on VVD with the laptop camera: chair gate blocks/passes correctly; holds and reps work; summary saved.

## Milestone 5 — Hero lesson polish: Fall Prevention (~3 h)

- Record real content; sway stop; camera lost; progression levels; tune thresholds with 10× rehearsal.

**AC:** content checklist items for fall lessons done; sway stop triggers on deliberate sway only.

## Milestone 6 — Hero lesson polish: Sign Language + Delta Glow (~4 h)

- Hand rendering, Delta Glow, ILY and fingerspelling lessons, sequence gate, Together mode (guest role, dual runners, both-must-pass).

**AC:** wrong finger correctly highlighted in ≥ 9/10 trials; Together mode works with two phones.

## Milestone 7 — Creator Studio (~5 h)

- Wizard, recording with landmarks, upload + server transcode, auto-gates (deterministic), timeline editor, live gate preview, publish + `catalog_updated`.

**AC:** record → publish → plays on TV in < 60 s.

## Milestone 8 — Light channels: CPR + Kids + Rehab (~3 h)

- Rhythm gate HUD + metronome + disclaimer; kids lesson with confetti; hand open/close rehab with pace-follow (or loop fallback).

**AC:** each lesson runs end to end.

## Milestone 9 — AWS integration (~2 h)

- Bedrock coach (Converse API) with prompt, filters, cache, rate limits; auto-gate labels; Polly voice with fallback; budget alert docs.

**AC:** with `MOCK_AI=false`, a stuck gate yields an AI tip < 3 s; turning AWS off falls back gracefully; daily call counter visible in logs.

## Milestone 10 — Reports, hands-free, accessibility (~3 h)

- Progress screen, share report QR + report page, raise-hand gesture, voice commands, high-contrast + caption size + reduce motion.

**AC:** report page shows real session data; gesture pauses/resumes reliably; accessibility checklist in `09` passes.

## Milestone 11 — Open-source package + docs (~2 h)

- Extract `packages/gated-player` + `istep-format` into public repo `vega-gated-video-player` (MIT, README with 5-line usage, example `.istep`, screenshots, contribution guide).

**AC:** fresh project can install and render `<GatedPlayer>` with a demo landmark stream.

## Milestone 12 — Submission (~4 h)

- Rehearse demo 3×, record video (see `12-submission-kit.md`), write Devpost text, product feedback, friction logs, feature requests, verify repo public + LICENSE, final checklist.

## Optional (only if all above are done)

- MCP server tools; Strands agent for auto-gate labelling; more languages.

## Cut list (if time runs short, cut in this order)

1. MCP server · 2. Voice commands · 3. Wrist-turn lesson · 4. Report page (keep summary screen) · 5. Kids lesson · 6. Pace-follow (use loop segment) · 7. Polly (use browser speech).
**Never cut:** gate engine quality, the two hero channels, safety behaviour, privacy pill, Creator Studio basic flow.
