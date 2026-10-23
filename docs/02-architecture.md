# 02 — Architecture

<p align="center"><img src="architecture/architecture.png" width="960" alt="InStep architecture: the phone (camera node, MediaPipe in the browser, video sent 0.0 KB/s) sends body points over a WebSocket relay on the InStep server (Render: Fastify, ws, node:sqlite; relay, REST, coach, MCP) to the Fire TV app (React Native for Vega: W3C media player, gate engine, HUD). Creator Studio uploads a demo video and reference.json; lesson content (video, .istep, reference) is loaded at start; Bedrock and Polly are switched off; four shared TypeScript packages; and a six-step gate sequence." /></p>

The diagram is [`architecture/architecture.html`](architecture/architecture.html) (1920×1080, Blue Hour). It is also the
animated architecture shot in the demo film: `window.seek(seconds)` draws the build-up deterministically and the
diagram settles at 14 s. `node docs/architecture/render.mjs` (Playwright + ImageMagick 7) re-renders `architecture.png` and the close-up
[`gate-sequence.png`](architecture/gate-sequence.png).

## How it works, step by step (as built)

**Pairing**

1. The TV opens a WebSocket to the server's relay and says `hello` as `tv`; the relay creates a 4-digit room and
   returns a join URL, which the TV shows as a QR code (`apps/tv/src/lib/tvRelay.ts`, `apps/tv/src/screens/Pair.tsx`,
   `apps/server/src/relay.ts`, `apps/server/src/rooms.ts`). Rooms expire after 2 h idle.
2. The phone (or laptop) opens `/c/?room=…`, joins as `host` (or `guest` in Together mode) and starts the camera
   (`apps/companion/src/screens/CameraNode.tsx`, `apps/companion/src/lib/relay.ts`). The phone is the camera; the TV
   has none.

**Lesson start**

3. The TV fetches the catalog, the lesson and its `.istep` track over HTTPS and plays `video.mp4` with the W3C media
   player on a Kepler video surface (`apps/tv/src/lib/api.ts`, `apps/tv/src/video/VegaVideo.tsx`). The track is
   validated with zod by `@instep/istep-format`.
4. The TV sends `lesson_tracking` to the room so the phone loads only the models the lesson needs: MediaPipe Pose
   Landmarker (lite), Hand Landmarker and the chair detector, all running in the phone's browser
   (`apps/tv/src/lib/lessonSession.ts`, `apps/companion/src/lib/vision.ts`).

**Body points, never video**

5. For every camera frame the phone builds a `landmarks` message: normalised points quantised to 3 decimals, JSON
   text, about 1 KB for a full pose, sent at most 30 times a second and never queued
   (`apps/companion/src/lib/landmarks.ts`, `packages/protocol/src/wire.ts`). Camera frames are never uploaded,
   recorded or relayed.
6. Every byte the page sends passes through a byte meter; the privacy pill shows the measured rates. Video sent is
   measured as 0.0 KB/s because the camera page has no upload path, not because the number is hard-coded
   (`apps/companion/src/lib/meter.ts`, `apps/companion/src/components/PrivacyPill.tsx`). A strict CSP
   (`connect-src 'self'`) lets the browser talk only to the InStep server (`apps/server/src/app.ts`). With a person
   in view, body points run at up to about 30 KB/s. The 0.1 KB/s in `docs/screenshots/companion-privacy.png` was
   captured with nobody in frame (`"pose": null`).
7. The relay validates every message with zod, forwards `landmarks` only to the TV in the room, drops anything over
   40 a second and never logs the payload (`apps/server/src/relay.ts`).

**One gate**

8. The Player screen calls the controller's `tick()` at least every 100 ms. When the video time reaches a gate's `t`,
   the controller pauses the video (`apps/tv/src/screens/Player.tsx`, `packages/gated-player/src/controller.ts`).
9. Each incoming frame becomes a gate-engine `Frame` (`toFrame`) and goes to the active gate's runner, which smooths
   it, normalises mirroring and scores it with one of seven evaluators (`packages/gate-engine/src/runner.ts`,
   `packages/gate-engine/src/gates/`). Adaptive tolerance (`tolerance.ts`, factor 0.85–1.3, deterministic) applies
   to learning gates only. Safety gates and the sway stop keep the fixed values from the `.istep` file.
10. The TV draws the HUD ring, the learner skeleton and Delta Glow (`apps/tv/src/components/Hud.tsx`, `Skeleton.tsx`,
    `DeltaGlow.tsx`) and sends `gate_state` to the room at most 5 times a second, so the phone can show feedback too.
11. Stuck for longer than `coachAfterSec`? The TV posts a compact summary of numbers (which joint, roughly how far
    off, attempt count) to `POST /api/coach`. The coach checks its cache (lesson | gate | error bucket | language),
    rate-limits to 1 call per learner per 8 s, then answers. The hosted server runs `MOCK_AI=true`, so the tip is
    templated from the engine's own hint. Bedrock (Converse) and Polly are implemented but switched off
    (`apps/server/src/coach/coach.ts`, `apps/server/src/ai/`). The TV shows the tip as a caption; with Polly off,
    the TV relays a `speak` message and the phone says it with browser speech.
12. Pass: the controller emits `gate_passed`, the TV sends `gate_result` (the phone plays a chime) and the video
    resumes (`play()`).
13. No body points for 2 s (`CAMERA_LOST_MS = 2000`): the lesson pauses and the TV shows "Camera disconnected". A
    gated lesson never plays on without camera data.
14. At the end the TV posts a session summary (`POST /api/sessions`): gates passed, reps,
    best hold, sway stops, coach tips and per-gate attempts. No landmarks are
    stored. Caregiver reports and the optional MCP endpoint (`apps/server/src/mcp.ts`) read only these aggregates.

**Creator Studio**

15. The instructor taps **Record demonstration** (visible REC indicator). The video is recorded with
    `MediaRecorder` while MediaPipe samples body points at 15 fps into `reference.json`
    (`apps/companion/src/screens/creator/RecordStep.tsx`, `apps/companion/src/lib/recorder.ts`). This is the only
    place InStep records video, and only the instructor's.
16. Both are uploaded (`POST /api/lessons/:id/assets`, Creator PIN); the server transcodes to H.264 with ffmpeg.
    `POST /api/lessons/:id/autogates` runs `autoGates()` from the gate engine on the reference timeline to find the
    still moments, and the labeler words them (templates in mock mode) (`apps/server/src/routes/lessons.ts`,
    `packages/gate-engine/src/autogates.ts`, `apps/server/src/ai/labeler.ts`).
17. The instructor edits and previews the gates in the browser, using the same gate engine. Publishing validates
    the `.istep` and broadcasts `catalog_updated`, and every connected TV refreshes its catalog
    (`apps/companion/src/screens/creator/GateEditor.tsx`, `GatePreview.tsx`, `apps/tv/src/lib/tvRelay.ts`).

**Content and hosting**

- Demo lessons live in `content/lessons/<id>/` (`lesson.json`, `track.istep`, `video.mp4`, `reference.json`) and
  are loaded into SQLite at start (`apps/server/src/lessons.ts`). Narration is pre-rendered offline with a local
  Kokoro voice and muxed into `video.mp4` (`scripts/audio/`). No cloud call at runtime.
- One Docker service on Render serves the companion (`/c/`), the relay (`/ws`), the REST API, lesson media and
  `/mcp`. The free plan has no persistent disk, so SQLite and uploads reset on each deploy.
- Shared packages are pure TypeScript. `istep-format`, `gate-engine` and `protocol` are used by the phone, the
  server and the TV. `gated-player` (the timing controller and `<GatedPlayer/>`) runs on the TV and is also
  published as the open-source `vega-gated-video-player`.

> Sections 1–8 below are the original design spec. Where they differ from the code, the code is right. SQLite is
> Node's built-in `node:sqlite`, not `better-sqlite3`. The server runs on Node 22. Media is on the server's local
> disk, not S3. The TV app is installed with npm, outside the pnpm workspace.

## 1. System overview

```
┌──────────────────────────┐        ┌───────────────────────────┐
│  Companion (phone/laptop)│        │   TV app (Vega OS / VVD)  │
│  Browser, React + Vite   │        │   React Native for Vega   │
│                          │        │                           │
│  Camera → MediaPipe      │  WS    │  Gated player + overlays  │
│  Pose/Hands/Chair        │◄──────►│  Gate engine (shared pkg) │
│  (frames never leave)    │        │  HUD, coach captions      │
│  Creator Studio          │        └─────────────▲─────────────┘
└────────────▲─────────────┘                      │ WS + REST
             │ WS + REST                          │
        ┌────┴────────────────────────────────────┴────┐
        │            InStep Server (Node 20)           │
        │  WebSocket relay (rooms)  ·  REST API         │
        │  Lessons + .istep store  ·  Sessions/reports │
        │  Coach service ──► Amazon Bedrock (or mock)  │
        │  Voice service ──► Amazon Polly (or browser) │
        │  Media: lesson videos (local disk / S3)      │
        │  Optional: MCP server (Streamable HTTP)      │
        └──────────────────────────────────────────────┘
```

**Key decision: the gate engine runs on the TV app.** The companion sends landmarks; the TV evaluates gates, because the TV owns playback time. The engine is a pure TypeScript package so the companion can also run it (for Creator Studio preview and Together mode guest feedback) and tests run in Node.

## 2. Data flow during a lesson

1. TV opens lesson → fetches lesson JSON + `.istep` + video URL from server.
2. TV creates/joins room `R` (4-digit code) on the WebSocket relay; shows QR code `https://<server>/c/?room=R`.
3. Companion joins room `R` as `host` (or `guest` for Together mode), opens camera, runs MediaPipe at 30 fps (target; min 15 fps).
4. Companion sends `landmarks` messages (~30/s) to relay → relay forwards to TV in the same room.
5. TV player reaches `gate.t` → pauses → gate engine evaluates each landmarks frame → HUD updates.
6. Gate passed → TV resumes; TV sends `gate_result` to the room (companion shows confetti/haptic).
7. Stuck > `coachAfterSec` → TV calls `POST /api/coach` with a compact error summary (no landmarks streams, no images) → caption + audio.
8. Lesson end → TV posts session summary to `POST /api/sessions`.

## 3. Repository layout (monorepo)

Use **pnpm workspaces**. If the Vega toolchain conflicts with pnpm (verify in Milestone 0), keep `apps/tv` outside the workspace and consume packages by relative path or `file:` dependency; record this in the friction log.

```
instep/
├─ AGENTS.md  README.md  LICENSE (MIT)  .env.example
├─ docs/                          # this spec pack + PROGRESS.md + FRICTION_LOG.md
├─ packages/
│  ├─ istep-format/               # zod schema, types, JSON Schema export, validator CLI
│  ├─ gate-engine/                # pure TS: geometry, gates, state machines, adaptive tolerance
│  ├─ protocol/                   # WebSocket + REST message schemas (zod)
│  └─ gated-player/               # React Native component <GatedPlayer/> (becomes the OSS package)
├─ apps/
│  ├─ tv/                         # Vega OS app (from react-native-multi-tv-app-sample or vega-video-sample)
│  ├─ companion/                  # Vite + React + TS web app (camera node, creator, reports)
│  └─ server/                     # Node 20 + Fastify + ws + better-sqlite3
├─ content/
│  ├─ lessons/<lessonId>/         # lesson.json, track.istep, video.mp4, poster.jpg, reference.json
│  └─ seed.ts                     # loads demo lessons into DB
└─ scripts/                       # dev.sh, make-qr, record-demo helpers, budget-alert.md
```

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| TV app | React Native for Vega (Vega Developer Tools, Vega Virtual Device) | Start from official sample; keep its focus/navigation library |
| TV video | Player used in the official Vega sample | H.264 MP4, 1080p, 30 fps |
| TV overlay | `react-native-svg` if supported on Vega; else absolutely-positioned Views | Verify in Milestone 0 |
| Companion | Vite, React 18, TypeScript, `@mediapipe/tasks-vision` | Pose Landmarker (lite), Hand Landmarker, Object Detector (EfficientDet-Lite0, COCO "chair") |
| Server | Node 20, Fastify, `ws`, `better-sqlite3`, zod | Single process; local disk for media in dev |
| AI | Amazon Bedrock Converse API (`@aws-sdk/client-bedrock-runtime`) | Model from `BEDROCK_MODEL_ID` |
| Voice | Amazon Polly (`@aws-sdk/client-polly`), neural voice | Fallback: browser `speechSynthesis` on companion |
| Optional | `@modelcontextprotocol/sdk` (Streamable HTTP) | Caregiver report tool |
| Tests | vitest, Playwright (companion), manual device checklist | |

## 5. Network setup

- Dev: server on host machine `0.0.0.0:8787`. Companion and TV connect to `http(s)://<host-LAN-IP>:8787`.
- **Camera access requires a secure context.** `localhost` works on the laptop; a phone on LAN needs HTTPS. Options (implement option A, document B):
  - A. Server serves HTTPS with a self-signed cert via `mkcert`; document trusting it on the phone.
  - B. A tunnel (e.g. `cloudflared tunnel --url`) giving a public HTTPS URL; set `PUBLIC_URL`.
- The TV app reads the server address from Settings (default from build-time env), so the VVD can reach the host. **Verify in Milestone 0 how the VVD reaches the host network** (host IP vs special alias) and document it.

## 6. Privacy design

| Data | Where processed | Leaves device? | Stored? |
|---|---|---|---|
| Learner camera frames | Companion browser | **Never** | Never |
| Learner landmarks | Companion → relay → TV | Yes (LAN/server relay, not persisted) | No (only aggregated session stats) |
| Gate errors summary | TV → server coach | Yes (numbers only) | Cached tip text only |
| Session summary | Server SQLite | — | Yes (reps, times, gates, sway max) |
| Creator demo video | Creator phone → server | Yes, intentionally | Yes (lesson asset) |

The relay must **not log** landmark payloads. Rooms expire after 2 hours idle.

## 7. Performance budgets

| Metric | Target |
|---|---|
| Companion inference | ≥ 24 fps on a mid-range laptop; ≥ 15 fps on phone (send at most 30 msgs/s) |
| Landmark message size | ≤ 1.5 KB (quantise to 3 decimals; send only needed landmark sets per gate) |
| Companion → TV latency | < 150 ms p95 on LAN |
| TV overlay redraw | ≥ 20 fps; drop frames rather than queue (always render latest) |
| Gate evaluation | < 2 ms per frame |
| Coach tip | < 3 s (real), < 200 ms (mock/cache) |

## 8. Failure handling

| Failure | Behaviour |
|---|---|
| Companion disconnects / no landmarks > 2 s | TV pauses, shows "Camera disconnected — reconnect your phone" with room code |
| Person not visible (pose confidence < 0.5) | HUD: "Step into view"; gate timers do not advance |
| Server unreachable at start | TV shows retry screen with server address and Settings shortcut |
| Coach error / rate-limited | Use template tip from `.istep` (`fallbackTip`) |
| Polly error | Caption only + companion speaks via browser speech |
| Video fails to load | Error card with retry; log to friction log if Vega-specific |
