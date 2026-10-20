# 11 — Testing and QA

## 1. Automated tests

| Package/app | Tool | Must cover |
|---|---|---|
| `gate-engine` | vitest | All 13 cases in `04-gate-engine.md` §8; ≥ 90% line coverage |
| `istep-format` | vitest | Valid examples pass; invalid cases fail with path-specific errors (unsorted gates, duplicate ids, safety gate with `learning:true`, CPR without disclaimer, unknown gate type) |
| `protocol` | vitest | Round-trip parse of every message type; rejects malformed |
| `server` | vitest + supertest/ws | Rooms (create/join/full/expire), relay throughput, REST endpoints, coach mock/cache/rate-limit/filters, publish broadcast |
| `companion` | vitest + Playwright | Join flow with fake camera (`--use-fake-device-for-media-stream`), privacy pill counts, creator wizard happy path |
| `gated-player` | vitest + React Native Testing Library (if available for Vega; else logic tests via extracted hooks) | Pause at gate, resume on pass, camera-lost pause, safety stop, loop segment |

Run all with `pnpm test`; CI via GitHub Actions on push (lint + typecheck + tests).

## 2. Landmark replay testing

- Record real landmark sessions from the companion (`?record=1` saves a JSONL file locally on the companion device — landmarks only).
- `scripts/replay.ts session.jsonl --room 1234` replays to a room at real speed. Use to test the TV without standing in front of the camera and to create regression fixtures for gates (correct and incorrect attempts).
- Keep at least 2 correct + 2 incorrect recordings per demo gate in `packages/gate-engine/fixtures/recorded/`.

## 3. Device checklist (Vega Virtual Device, and real Fire TV if available)

- [ ] App launches < 5 s; no red-box errors
- [ ] D-pad reaches every control; Back works everywhere
- [ ] Video plays, pauses at gates within ±0.1 s
- [ ] Overlay ≥ 20 fps during gates
- [ ] Reconnect after Wi-Fi blip
- [ ] Server URL change in Settings works
- [ ] Memory stable over 20-minute session (no growth > 20%)

## 4. Gate accuracy rehearsal (per demo gate)

For each gate: 10 correct attempts and 10 deliberately wrong attempts, two different people if possible, two lighting conditions.

| Gate | Correct passes (≥ 9/10) | Wrong passes (≤ 1/10) | Notes / tuned values |
|---|---|---|---|
| Chair safety | | | |
| Heel raise reps | | | |
| Single-leg hold | | | |
| Sway stop (should trigger) | | | |
| ILY hand sign | | | |
| Fingerspell A/B/C | | | |
| Hand open/close reps | | | |
| CPR rhythm | | | |
| Kids poses | | | |

Record final thresholds in the `.istep` files and freeze them before recording the demo.

## 5. Safety tests

- [ ] Safety gate never auto-loosens (attempt 10 failures; tolerance unchanged)
- [ ] Skip is unavailable on safety gates
- [ ] Sway stop requires OK/gesture + 2 s stability to resume
- [ ] Camera lost pauses within 2 s
- [ ] Disclaimers present on all required screens
- [ ] Coach filter rejects banned medical terms (unit test with crafted model outputs)

## 6. Privacy tests

- [ ] Network inspection (browser devtools) on the camera page shows only WebSocket JSON frames, no media uploads
- [ ] Privacy pill video counter = 0 throughout a session
- [ ] Server logs contain no landmark payloads
- [ ] Report page shows no images/video

## 7. Demo rehearsal (do 3 full runs)

- [ ] Follow the exact script in `12-submission-kit.md` with a timer
- [ ] Everything works on the recording machine on the recording network
- [ ] Backup: pre-recorded landmark replay ready in case live camera fails during recording
- [ ] `MOCK_AI=false` tested right before recording; budget alert set
