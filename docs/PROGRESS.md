# Progress log

Newest first. Each entry: what works, what doesn't, what changed from the spec and why.

## 2026-10-21 — Companion redesign, hosting, hardened MCP

- **Companion redesign** (docs/09 tokens kept): the camera preview is a full-bleed hero with the connection badge
  and the TV's current step on it; status is a quiet list with coloured markers instead of stacked cards; the
  privacy pill became a bottom **ledger** with the two measured numbers set large; four-digit segmented room code;
  Creator Studio steps are a numbered sequence over a scrubber; report chart and rows restyled. Screenshots
  re-captured and reviewed.
- **Hosting:** `Dockerfile` (node 22 + ffmpeg, models baked in at build) and `render.yaml` Blueprint (web service +
  1 GB disk). Verified locally: health, companion with CSP, models, MCP auth, ffmpeg, SQLite on `/data`.
  `PUBLIC_URL` falls back to `RENDER_EXTERNAL_URL`. First local build failed because `pnpm prune --prod` removed
  `tsx`; fixed by starting Node directly.
- **MCP:** optional `MCP_TOKEN` bearer auth for hosted deployments (test added).
- Disk-full incident on the dev machine during the Docker build truncated one source file; restored from git,
  Docker build cache pruned. Nothing was lost.

## 2026-10-21 — MCP server, real screenshots, README

- Optional **MCP server** (`MCP_ENABLED=true`, Streamable HTTP at `/mcp`, stateless): `list_lessons` and
  `get_progress_report` (read-only, aggregates only). 4 tests incl. initialize → tools/list → tools/call.
- `pnpm screenshots` captures real companion screenshots (fake camera, real MediaPipe) into `docs/screenshots/`;
  README now shows them. TV screenshots deliberately absent until the device run.
- Related-work claims in the README verified against the sources (Kemtai, Fingerspelling.xyz, EP 4458432 A1).
- Report page: session rows stack on narrow screens (found via the screenshot).
- CHANGELOG, version 0.4.0.

## 2026-10-21 — Privacy finding: MediaPipe telemetry blocked

The camera e2e test on CI caught `POST https://odml.pa.googleapis.com/v1/log` from the camera page: MediaPipe
`tasks-vision` 1.1.1 always creates a usage logger that sends protobuf usage stats (not images) to Google every 60 s,
with no option to turn it off. That contradicts "only body points leave the device", so the server now sends a strict
**Content-Security-Policy** on `/c/*` (`connect-src 'self'`, `wasm-unsafe-eval` for MediaPipe): the browser blocks
every request to any host other than the InStep server. The e2e test now asserts the CSP header, that no third-party
response is ever received, and that a deliberate fetch to that endpoint is blocked. MediaPipe works unchanged.

## 2026-10-21 — Milestones 11 and 12 (prepared)

- **M11:** `<GatedPlayer>` React Native component for Vega (`packages/gated-player/react-native/GatedPlayer.tsx`,
  type-checked against the real `@amazon-devices/*` typings) + `createFrameStream()`. `node scripts/export-oss.mjs`
  assembles the standalone `vega-gated-video-player` repo (format + engine + player, README with 5-line usage,
  demo `example/App.tsx` driven by a synthetic landmark stream, CI, MIT). The exported repo type-checks and its
  125 tests pass on their own. **Not yet published** — creating the public GitHub repo waits for the owner's OK.
- **M12:** `docs/SUBMISSION.md` — Devpost text, demo checklist, product-feedback skeleton (device parts marked to
  fill after testing), friction logs, feature requests, mini-challenge fields, compliance checklist.

## 2026-10-21 — Milestones 7, 9, 10 + parts of 5 and 8

**Milestone 7 — Creator Studio (works, browser e2e test green):** `/c/creator` PIN gate → lesson list (yours +
built-in read-only) → new lesson (channel presets incl. required safety notes) → record demonstration (MediaRecorder
MP4/WebM + MediaPipe landmarks at 15 fps, visible REC + timer, 60 s cap) or upload a video (landmarks extracted in the
browser) → upload with progress (counted by the video meter) → server re-encodes to H.264, makes a poster and reads
the duration with ffprobe → **auto-gates** (deterministic still-moment detection in `gate-engine/autogates.ts`;
fall lessons always start with the chair safety check; rehab detects the repetition period by autocorrelation) →
timeline editor (markers, dashed reference skeleton over the video, per-step fields, add/delete, "use current
time") → live "try this step with my camera" using the same engine → save / publish → `catalog_updated` to TVs.
Playwright test: record → upload → suggested steps → publish → a TV receives `catalog_updated` (1.2 min on CI CPU).

**Milestone 9 — AWS (code done, not yet run against AWS):** Bedrock Converse client (dynamic import, model from
`BEDROCK_MODEL_ID`, abort timeout), coach tips, AI step labels (strict JSON + zod + safety filter, templates on
failure), Polly neural voice with disk cache and `/voice/*.mp3`, one shared daily AI budget with logged counter.
Default remains `MOCK_AI=true`. **Needs you:** `MOCK_AI=false` test with your AWS account + a $5 budget alert.

**Milestone 10 — reports, hands-free, accessibility:** report page `/c/report/:token` (adherence vs plan, reps per
day, rest breaks, steps that needed tips, sessions; print-friendly; "No video is ever recorded or stored");
raise-hand gesture (wrist above nose 1.5 s, 3 s cool-down, only when the lesson's poses don't raise arms) and
push-to-talk voice commands (pause / play / repeat / easier / next / OK) on the companion; TV accessibility settings
(high contrast, caption size, reduce motion) were done in M4.

**Milestone 8 (part):** CPR metronome — the TV sends `metronomeBpm` in `gate_state` and the phone plays an original
synthesized click (Web Audio); the TV shows a visual beat. **Kids lesson video generated** by
`scripts/make-kids-video.sh`: original illustrated title cards (no people) timed to the four gates — the first lesson
that is published end to end without recording anyone.

**Milestone 5 (part):** progression level per fall lesson (`lesson.json` → shown on the TV lesson page).

**Changes from the spec**

| Change | Why |
| --- | --- |
| Still detection uses the fastest joint's speed, not the mean | Averaging over nine joints hid single-joint movements in tests. |
| Auto-gates endpoint is `POST /api/lessons/:id/autogates` (uses the uploaded reference) | No need to send the reference twice. |
| Added `GET /api/creator/check`, `editable` and `level` lesson fields, `metronomeBpm` in `gate_state` | PIN check, Creator Studio and the CPR metronome need them. |
| Metronome sound plays on the phone, not the TV | Playing short clips on the TV is unverified until the Vega spike. |

**Still needs real content / devices:** fall, sign, rehab and CPR videos (recorded by you / a physio / a Deaf
signer), the Vega Virtual Device run (M0/M4), gate tuning rehearsals (10× per gate), and the real-phone fps check.
235 unit/integration tests + 6 Playwright e2e tests pass.

## 2026-10-21 — Milestone 4 (part 2): TV app (Vega) — built, not yet run on the VVD

**Built** (`apps/tv`, React Native 0.72 for Vega, wiring copied from `react-native-multi-tv-app-sample`: W3C media
`VideoPlayer` + `KeplerVideoSurfaceView`, `TVEventHandler` remote keys, `react-tv-space-navigation` focus,
`@amazon-devices/react-native-svg`, Vega async-storage):

- Splash + server health check → designed retry screen with the server address and a Settings shortcut.
- Profile picker (max 6) and Add profile (D-pad keyboard, colour, affected hand).
- Home: header (relay status, My progress, Settings, profile), rotating hero for the two hero channels, one row per
  channel with lesson cards (poster, duration, steps, difficulty, "New"). Empty channels are hidden; live refresh on
  `catalog_updated`.
- Lesson detail: poster, creator, what you need, camera placement, required disclaimer, steps list, Start /
  Practice together.
- Pair: QR + room code + URL, privacy line, peers as they join, auto-advance; Together mode shows a second QR for the
  family member (guest role).
- Camera check: live skeleton (or hand) with per-view checklist; "Looks good! 3-2-1" then the player.
- Player: video 1280×720 + learner panel 560×720 (or skeleton over the video, from Settings); dashed teal instructor
  ghost aligned to the learner's hips and torso; limbs coloured by joint error with a ring on the worst joint;
  Delta Glow hand for sign gates; gate HUD (hold ring, rep counter with partials and pace chip, BPM meter with target
  band and visual metronome, sequence breadcrumbs, safety checklist); coach caption (scaled by caption size) + voice
  via companion speech; pass glow (+ stars for kids); sway-stop rest screen (OK + 2 s steady); camera-lost screen with
  room code and countdown; pause overlay; Back → "Leave this lesson?"; CPR disclaimer always on screen; remote: Play/
  Pause, Left = repeat, Right = skip (only when allowed), Menu = easier, OK = resume after rest.
- Session summary (time, steps, reps, best hold, rhythm, rest breaks, easier mode, disclaimer, share-report QR),
  My progress (14-day bars, totals, streak), Settings (server URL, coach language, caption size, voice, skeleton view,
  high contrast, reduce motion, about) persisted with Vega async-storage.

**Verified here (no Vega SDK on this machine):** `tsc` passes against the real `@amazon-devices/*` typings; Metro
bundles the app for `--platform kepler` (now a CI job); 9 Node tests for the TV logic (store, API client, relay
client with reconnect/room rejoin/stale-frame drop, lesson session: lesson_tracking, ≤ 5 gate_state/s, coach caption +
companion speech, gate_result, session saved once, companion controls).

**Not verified yet — needs the Vega Virtual Device (Milestone 0):** that the video surface, seek/pause precision,
WebSocket to the host, SVG overlay frame rate and the 10.0.2.2 host address work as assumed. The TV app has not been
launched yet. Fonts: system font for now (bundling Inter on Vega not yet tried).

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
