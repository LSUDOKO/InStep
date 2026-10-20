# 07 — Server, Protocol and AWS (`apps/server`)

Node 20 + Fastify + `ws` + `better-sqlite3`. One process serves: REST API, WebSocket relay, companion static files (`/c/`), MediaPipe model files (`/models/`), lesson media (`/media/`), and optional MCP endpoint (`/mcp`).

## 1. Environment variables (`.env.example`)

```
PORT=8787
PUBLIC_URL=https://192.168.1.20:8787     # used in QR codes
HTTPS_CERT=./certs/dev.pem               # optional (mkcert)
HTTPS_KEY=./certs/dev-key.pem
DATA_DIR=./data                          # sqlite + media
MOCK_AI=true                             # true = no AWS calls
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=                        # set to a model available in your account/region
POLLY_ENABLED=false
COACH_MAX_CALLS_PER_DAY=300
COACH_MIN_INTERVAL_SEC=8
MEDIA_STORE=local                        # local | s3
S3_BUCKET=
MCP_ENABLED=false
REPORT_TOKEN_SECRET=change-me
CREATOR_PIN=2468                         # demo-only protection for Creator Studio
```
AWS credentials come from the standard AWS credential chain (never committed).

## 2. WebSocket protocol (`packages/protocol`)

Endpoint: `wss://<host>/ws`. All messages are JSON `{ "type": string, ... }`, validated with zod on both ends. Version field `v: 1` in `hello`.

### 2.1 Room lifecycle
| Type | From → To | Payload |
|---|---|---|
| `hello` | any → server | `{ v:1, role: 'tv'|'host'|'guest', room?: string, name?: string, deviceId }` |
| `room_created` | server → tv | `{ room: '4831', joinUrl }` |
| `peer_joined` / `peer_left` | server → room | `{ role, name, peerId }` |
| `error` | server → client | `{ code: 'ROOM_NOT_FOUND'|'ROOM_FULL'|'BAD_MESSAGE', message }` |
| `ping` / `pong` | both | `{ ts }` |

Room: max 1 tv, 1 host, 3 guests. Expires after 2 h idle. Room codes 4 digits, random, not reused for 24 h.

### 2.2 Lesson and frames
| Type | From → To | Payload |
|---|---|---|
| `lesson_tracking` | tv → room | `{ lessonId, tracking: ['pose','hands','objects'], cameraView, gesturesEnabled }` |
| `landmarks` | host/guest → tv | see 2.3 |
| `gate_state` | tv → room | `{ gateId, type, status, progress, worst?, label }` (≤ 5/s, for companion feedback) |
| `gate_result` | tv → room | `{ gateId, passed: true, ms }` |
| `control` | host/guest → tv | `{ action: 'toggle_pause'|'play'|'pause'|'repeat'|'easier'|'next' , source: 'gesture'|'voice'|'button' }` |
| `safety_event` | tv → room | `{ kind: 'sway_stop'|'camera_lost'|'resumed' }` |
| `catalog_updated` | server → all tv | `{ lessonId }` |

### 2.3 `landmarks` message
```json
{ "type": "landmarks", "seq": 1042, "ts": 1729440000123, "role": "host", "mirrored": true,
  "pose": [[0.512,0.201,-0.31,0.99], ...33] ,
  "hands": { "left": null, "right": [[0.61,0.44,-0.02], ...21] },
  "objects": [{ "label": "chair", "score": 0.81, "box": [0.62,0.40,0.25,0.55] }],
  "fps": 27.5 }
```
Omit `pose`/`hands`/`objects` keys not requested by `lesson_tracking`. The relay forwards without logging content. TV drops messages with `seq` older than the last seen.

## 3. REST API

| Method + path | Purpose |
|---|---|
| `GET /api/health` | `{ ok, version, mockAi }` |
| `GET /api/lessons` | Catalog grouped by channel |
| `GET /api/lessons/:id` | Lesson metadata + URLs for `track.istep`, `reference.json`, video, poster |
| `POST /api/lessons` | Create draft (creator) |
| `POST /api/lessons/:id/assets` | Multipart: video, reference.json, poster (creator) |
| `PUT /api/lessons/:id/track` | Save `.istep` (validated) |
| `POST /api/lessons/:id/publish` | Validate + publish + broadcast `catalog_updated` |
| `POST /api/creator/autogates` | Body: compact reference summary → proposed gates (deterministic + optional AI labels) |
| `GET/POST /api/profiles` | Learner profiles |
| `POST /api/sessions` | Session summary from TV |
| `GET /api/profiles/:id/progress?days=14` | Aggregates for TV "My progress" |
| `POST /api/reports` | Create share token → `{ url }` |
| `GET /api/reports/:token` | Report data |
| `POST /api/coach` | Coach tip (section 5) |
| `POST /api/voice` | Text → audio (Polly) or `204` if disabled |

Creator endpoints are protected by a simple creator PIN (`CREATOR_PIN` env) for the demo; document that production needs real auth.

## 4. Storage (SQLite)

Tables: `profiles(id, name, avatar, affected_hand, created_at)`, `lessons(id, title, channel, status, creator, created_at, track_json, assets_json)`, `sessions(id, profile_id, lesson_id, started_at, ended_at, gates_passed, gates_total, reps, best_hold_sec, avg_bpm, sway_stops, coach_tips, easier_mode)`, `gate_attempts(session_id, gate_id, type, ms_to_pass, coached, passed)`, `coach_cache(key, tip, lang, created_at)`, `reports(token, profile_id, created_at, expires_at)`. Media files under `DATA_DIR/media/<lessonId>/`. Seed demo lessons from `content/lessons/` on first start.

## 5. Coach service (Amazon Bedrock)

### 5.1 Request from TV
```json
{ "profileId": "p1", "lessonId": "fall-heel-raise-v1", "gateId": "g2", "gateType": "hold_duration",
  "channel": "fall_prevention", "language": "en-US", "label": "Rise onto your toes",
  "worst": { "name": "l_ankle", "hint": "lift your heels higher" },
  "jointErrors": { "l_ankle": -14, "r_ankle": -12 }, "attemptsOnGate": 2, "audience": "older_adult" }
```
No landmarks streams, no images, no names.

### 5.2 Processing
1. Rate limit (per profile `COACH_MIN_INTERVAL_SEC`; global daily `COACH_MAX_CALLS_PER_DAY`) → on limit return fallback tip.
2. Cache key `lessonId|gateId|errorBucket|language` → return cached tip if present.
3. `MOCK_AI=true` → template tip built from `worst.hint` + gate `fallbackTip`.
4. Else call Bedrock **Converse API** with `modelId = BEDROCK_MODEL_ID`, `maxTokens 80`, `temperature 0.4`, system prompt below. Timeout 4 s → fallback.
5. Post-filter: max 25 words; reject if it contains banned terms (diagnose, injury, disease, pain is normal, ACL, surgery, medication) or numbers of degrees; on reject → fallback tip.
6. Store in cache, return `{ tip, source: 'ai'|'cache'|'fallback'|'mock' }`.

### 5.3 System prompt (store in `apps/server/src/coach/prompt.ts`)
```
You are InStep's coach. You give ONE short, kind, specific movement tip (max 20 words)
in {language} for the learner's current step. Audience: {audience}.
Rules: encouraging tone; describe what to do with the body, not what is wrong with the person;
never diagnose, never mention injury, disease, medication or medical conditions;
no numbers or degrees; for sign language, describe hand shape only and respect Deaf culture;
for CPR, only rhythm and straight arms. Output only the tip text.
```
User content: the JSON from 5.1 (minus profileId).

### 5.4 Auto-gate labelling (Creator Studio)
Same Bedrock client, separate prompt asking for strict JSON `[{ "gateIndex": n, "label": "...", "fallbackTip": "..." }]`, validated with zod. Mock mode returns templates.

## 6. Voice service (Amazon Polly)
- `POLLY_ENABLED=true` → `SynthesizeSpeech` (neural engine, MP3, voice per language from a map, e.g. en-US `Joanna`, es-ES `Lucia`, hi-IN `Kajal`, fr-FR `Lea`; verify availability in your region). Cache audio by text hash on disk.
- TV plays the returned audio URL. If the Vega player cannot play a second audio stream while video is paused (verify), send `speak` to companion and use browser `speechSynthesis` there.
- Disabled → `204`; TV shows caption and companion speaks with browser speech.

## 7. Cost guards (credits are no longer available — usage bills your account)
- Default `MOCK_AI=true`. Turn off only for integration tests and demo recording.
- Caching + rate limits above. Log a daily count of real AI calls.
- README section "Set an AWS Budgets alert" (e.g. $5 monthly with email alert) — steps in AWS console.
- Expected usage for the demo is tiny (short prompts, ≤ 80 output tokens), but never leave a loop calling the API.

## 8. Optional: MCP server (only after everything else works)
- `MCP_ENABLED=true` exposes Streamable HTTP MCP at `/mcp` using `@modelcontextprotocol/sdk`.
- Tools: `list_lessons({ channel? })`, `get_progress_report({ profileName, days })` (read-only, aggregates only).
- Lets a caregiver ask an AI assistant "Did Dad finish his balance exercises this week?". Document with a screenshot using MCP Inspector. This is a bonus, not part of the Fire TV requirement.

## 9. Security basics
- zod-validate every input; limit body size (video upload ≤ 200 MB, JSON ≤ 1 MB).
- Serve over HTTPS in demo; CORS allow only `PUBLIC_URL` origins.
- Report tokens: random 128-bit, expire in 30 days.
- No PII beyond profile display name.
