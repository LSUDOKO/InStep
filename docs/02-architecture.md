# 02 — Architecture

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
