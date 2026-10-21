# Progress log

Newest first. Each entry: what works, what doesn't, what changed from the spec and why.

## 2026-10-21 — Milestone 4 (part 1): gated-player controller

**Works (platform-independent, tested in Node):** `@instep/gated-player` `createGatedPlayer()` — the timing core of
`<GatedPlayer>`. It pauses and seeks exactly to `gate.t`, feeds frames to per-participant runners, resumes after a
400 ms pass feedback, loops `[rewindTo, t]` muted after the first loop, applies pace-follow rates (keeps 1× when the
platform refuses a rate change), pauses on camera loss (> 2 s without host frames) and resumes after a 3-2-1
countdown, runs the lesson-wide sway stop for every participant (resume needs OK **and** 2 s stability; Play cannot
resume it), emits `gate_stuck` after `coachAfterSec` and loosens only learning gates deterministically, allows Skip
only after `timeoutSec` and never on safety gates, supports Repeat, Together mode (all present people must pass
within 5 s; a guest leaving does not block the host) and produces the session summary. 15 tests; 97% line coverage.

**Next:** the React Native `<GatedPlayer>` wrapper and TV screens — blocked on the Milestone 0 Vega spike results.

## 2026-10-21 — Milestone 3 (companion camera node)

**Works**

- `apps/companion` (Vite + React 19 + TS), served by the server at `/c/`. Mobile-first, dark theme from
  docs/09, Inter bundled locally, Lucide icons bundled.
- Join flow: room code from the QR link or typed, guest role + name for Together mode, clear privacy explanation.
- Camera: `getUserMedia` 1280×720, front/back switch, mirrored local-only preview with skeleton, hand and chair
  overlay, "Hide preview" option (keeps frames decoding at 1 px so tracking continues).
- MediaPipe in the browser: Pose Landmarker lite, Hand Landmarker (2 hands), EfficientDet-Lite0 (chair / couch /
  bench, ≤ 3 fps). Only the trackers the TV asks for via `lesson_tracking` are loaded/run. GPU delegate with CPU
  fallback. Models + WASM are downloaded at build time into `/models/` (no runtime CDN). MediaPipe is lazy-loaded
  (separate chunk) so the join screen opens fast.
- Landmarks sent ≤ 30/s, quantised, anatomical left/right (MediaPipe's selfie-convention handedness is swapped
  because we feed the unmirrored frame), `pose: null` when nobody is in view so the TV can tell "no person" from
  "camera lost". Pose + chair message ≤ 1.5 KB (tested).
- **Privacy pill measured:** every WebSocket send goes through a byte meter; the video meter is only incremented by
  media-upload code, which this page does not have → it reads 0.0 KB/s. Tap → sheet with live rates, totals and the
  latest message as JSON.
- Placement helper (front / side / hands), gate status from the TV, pass toast + haptic, companion speech for
  `speak` messages, reconnect with backoff (0.5 → 5 s), designed screens for: insecure context, no camera support,
  camera denied / busy / missing, model loading progress, room not found / full, replaced by another phone,
  reconnecting, not found.
- `pnpm test-tv`: terminal TV that prints the join QR and reports msgs/s per camera (for the ≥ 15 fps AC).
- Server now tells a joining phone which peers are already in the room (so "Connected to TV" is real).
- **Playwright e2e** (Chrome fake camera, real MediaPipe on CPU): join → landmarks reach a fake TV → privacy pill
  shows video 0.0 KB/s and non-zero body points → only JSON text WebSocket frames, zero HTTP uploads. Plus room-not-
  found and not-found screens. Runs in CI as a separate job.
- 189 unit/integration tests + 3 e2e tests pass.

**Still to verify on real devices (needs you):** ≥ 15 fps on a phone over HTTPS and on a laptop (AC). Headless CI
runs MediaPipe in software at ~2 fps, which is not representative.

**Changes from the spec (and why)**

| Change | Why |
| --- | --- |
| React 19 instead of 18 | Current stable; no API we rely on changed. |
| Placement "side view" check uses shoulder width relative to torso length | Absolute widths depend on distance from the camera. |
| Server sends existing peers to a joining phone | The phone could not otherwise know the TV is present. |

## 2026-10-21 — Milestone 2 (server)

**Works**

- `apps/server`: Fastify + `ws` relay + SQLite + static hosting. Two listeners on shared state: HTTPS (`PORT`,
  companion) and plain HTTP/WS (`TV_HTTP_PORT`, Vega TV). `scripts/dev-cert.sh` makes an mkcert cert for the LAN IP.
- Relay: rooms (1 TV, 1 host, ≤ 3 guests), 4-digit codes not reused for 24 h, 2 h idle expiry, heartbeat, TV
  rejoin, reconnecting phone replaces the old host (old socket closed), zod-validated messages, landmarks only to the
  TV tagged with the sender, per-sender cap of 40 landmark msgs/s (dropped, never queued). Payloads are never logged.
- **AC soak test:** fake TV + fake host, 30 msgs/s for 60 s → **1800/1800 received, p50 0.77 ms, p95 1.22 ms**
  (target < 20 ms). CI runs a 10 s version; `RELAY_SOAK_SEC=60 pnpm test` runs the full one.
- REST: health, catalog (hero channels first), lesson detail/track/media (range requests; only listed assets
  served), creator create/assets/track/publish (PIN-protected) with WebM→H.264 MP4 transcode + poster via ffmpeg,
  `catalog_updated` broadcast; profiles (max 6), sessions + gate attempts, 14-day progress with streak, recent passes
  per gate type (for adaptive tolerance), share reports (128-bit tokens, 30-day expiry, adherence, sway stops,
  gates that needed coaching).
- Coach in mock mode: cache by `lessonId|gateId|errorBucket|language`, 1 call / learner / 8 s, daily AI cap, banned
  medical terms / numbers / > 25 words filtered. `/api/voice` returns 204 while Polly is off.
- `GET /api/lessons` returns the 7 seeded lessons with `?all=1`; without it, only lessons whose video exists.
- 178 tests pass across the repo.

**Changes from the spec (and why)**

| Change | Why |
| --- | --- |
| `node:sqlite` (Node ≥ 22.13) instead of `better-sqlite3` | Built into Node: no native build step on any machine. |
| Seed lessons without a recorded video are `draft` (hidden from the TV catalog) | AGENTS.md: no catalog entries for content that doesn't exist yet. |
| Cached coach tips are served before the rate-limit check | A cache hit costs nothing; rate limits protect AI calls. |
| `REPORT_TOKEN_SECRET` removed | Report tokens are random 128-bit values stored server-side; nothing needs signing. |
| Uploaded videos are always re-encoded to H.264/AAC MP4 (not only WebM) | iPhones may upload HEVC; one known-good format for the Vega player. |
| Added `GET /api/profiles/:id/recent-passes`, `DELETE /api/profiles/:id` | Adaptive tolerance needs recent passes; profile picker needs removal. |

## 2026-10-21 — Repo setup + Milestone 1 (packages)

**Works**

- Monorepo (pnpm 11 workspaces), TypeScript strict, ESLint + Prettier, vitest, GitHub Actions CI.
- `@instep/istep-format`: zod schema (source of truth), JSON Schema export, `istep validate` CLI, 7 example
  tracks, 5 crafted invalid files. All examples pass; all invalid files fail with JSON-path errors
  (e.g. `gates[0].learning: safety_prerequisite gates can never be learning gates`).
- `@instep/gate-engine`: all 7 gate types, One-Euro smoothing, mirroring, visibility/`no_person` freeze,
  lesson-wide sway monitor with 2 s resume check, deterministic adaptive tolerance, error buckets, pace-follow,
  reference-timeline interpolation, synthetic fixtures (`makePose`, `makeHand`). All 13 required test groups
  pass; line coverage ≈ 98% (target ≥ 90%). 10,000 frames evaluate well under 2 s.
- `@instep/protocol`: zod schemas for every WebSocket message and REST body, landmark quantisation and
  `toFrame` conversion. Pose-only and hands-only landmark messages are ≤ 1.5 KB.

**Changes from the spec (and why)**

| Change | Why |
| --- | --- |
| Added `rep_count` metric `heel_lift` | docs/08 uses it for heel raises; docs/03's metric list lacked it. |
| Added pose `conditions` (`heel_lift`, `foot_lift`) to `pose_match` / `hold_duration` / steps | Heel raises and single-leg stands are not visible as joint angles from a front camera. |
| Added safety checks `upper_body_visible`, `hands_visible` | The CPR placement check (side view) can't be expressed with `full_body_visible`. |
| Added `handScores` to frames / `landmarks` messages | `hand: "any"` must pick the hand with the higher detection score. |
| Disclaimer required (non-empty) for fall, rehab, sign and CPR channels in the validator | Mirrors AGENTS.md §3 and Creator Studio rules. |
| Rhythm peak prominence 0.05 × torso (spec 0.15) and a faster smoothing filter for rhythm gates | Real compressions on a cushion move the wrists ~0.1 torso lengths; 0.15 would miss them. To be re-tuned in rehearsal. |
| Runner timing uses frame timestamps (sender clock) instead of an injected `now()` | Equally deterministic in tests and immune to relay jitter. |
| Added `joined`, `speak`, `lesson_ended` WS messages and a relay-set `from` field | Needed for guest routing in Together mode and companion speech fallback. |
| `control` action `ok` | Remote/companion OK is required to resume after a sway stop. |

**Not yet done:** Milestone 0 (Vega spike) — waiting for the Vega SDK in an Ubuntu 24.04 distrobox on the
developer machine (Arch Linux is not an officially supported host).
