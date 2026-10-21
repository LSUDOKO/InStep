# Submission kit (draft)

Fill the parts marked **[after device test]** only with real experience. Every statistic must be in `SOURCES.md`.

## Devpost

**Tagline:** The video that waits for you.

**Inspiration.** How-to videos play at the same speed whether you keep up or not. For people doing prescribed home
exercises, parents learning sign language for their deaf child, or anyone practising CPR, that means doing it wrong —
or giving up. Falls are the second leading cause of unintentional injury death worldwide (about 684,000 deaths a
year), and at least 90% of deaf children are born to hearing parents.

**What it does.** InStep turns any video into a lesson that waits for you, on the Fire TV you already have. A phone or
laptop is the camera; MediaPipe runs in its browser and only body points (numbers) are sent — never video. At each key
moment the TV pauses and continues when your pose, hand shape, rhythm, hold or repetitions are right. A kind coach
gives one short tip when you're stuck.

- **Fall Prevention:** chair safety check before balance work, holds and heel raises, automatic sway stop.
- **Sign Language for Families:** static ASL handshapes with Delta Glow — the one finger to fix glows amber with an
  arrow, no sound needed; Together mode so two people practise together, even from different homes.
- **Stroke Hand Rehab:** quality reps (full range only) with pace-follow.
- **CPR Practice:** rhythm (100–120/min) and straight arms — a practice aid, not certification, no depth measurement.
- **Kids' Active Storytime:** act out a story to move it forward.
- **Creator Studio:** a physiotherapist or Deaf signer records once on a phone; InStep finds the still moments and
  proposes the steps; edit, try them live, publish — the lesson appears on every TV.
- **Open format:** `.istep` is like WebVTT for movement; `vega-gated-video-player` is the open-source Vega player.

**How we built it.** React Native for Vega (Vega Developer Tools, W3C media player, react-tv-space-navigation);
companion web app (React + MediaPipe Tasks in the browser); Node relay (Fastify + ws + SQLite); a pure-TypeScript gate
engine shared by TV, browser and server; Amazon Bedrock (Converse API) for coaching tips and Creator Studio step
labels; Amazon Polly for voice; zod-validated protocol; 235+ unit/integration tests and Playwright e2e in CI.

**Honesty notes.** The camera is an external phone/laptop. CPR does not measure compression depth and is not
certification. Lessons are demonstrations — reviewed by: **[names]**. InStep has not been clinically tested; it is
designed to support practice, not to treat or diagnose. Related work: Kemtai, Fingerspelling.xyz, DRAX Inc. patent
EP 4458432 (see README).

**Challenges / learned / next:** from `PROGRESS.md` and `FRICTION_LOG.md`. Next: movement-based signs reviewed by
Deaf educators, clinician pilot, Fire TV camera support, more languages.

## Demo video checklist (≤ 3:00)

- [ ] Script timing from `docs/12-submission-kit.md` rehearsed 3× with a timer
- [ ] Say clearly: "the camera is an external phone/laptop camera"
- [ ] Vega Virtual Device large on screen; real person inset
- [ ] Privacy pill "Video sent: 0.0 KB/s" visible
- [ ] Backup landmark replay ready (`pnpm test-tv` / replay) in case the live camera fails
- [ ] `MOCK_AI=false` tested right before recording; AWS Budgets alert set
- [ ] No copyrighted music; captions on

## Product feedback (one per tool) — **[after device test]**

Template: what I used it for · what worked · what needs work · zero-to-hello-world · would I build with it again.

- **Vega Developer Tools + VVD:** _so far:_ not supported on Arch Linux hosts; Ubuntu 24.04 distrobox used (F-01).
- **Vega CLI / react-native build-kepler:** _[after device test]_
- **react-native-multi-tv-app-sample / vega-video-sample:** used as the reference for the W3C media `VideoPlayer` +
  `KeplerVideoSurfaceView` pattern, `TVEventHandler` key mapping, metro aliasing and the manifest. Clear and current.
- **Amazon Devices Builder Tools (MCP + Agent Skills):** _[after device test]_
- **W3C media APIs on Vega:** _[after device test: seek precision, playbackRate, second player for audio]_
- **react-tv-space-navigation:** _[after device test]_
- **Amazon Bedrock (Converse API):** coach tips (≤ 80 tokens, 4 s timeout, safety filter, cache, rate limits) and
  strict-JSON step labels. _[latency/cost observed with MOCK_AI=false]_
- **Amazon Polly:** neural voice per language with disk cache. _[after AWS test]_

## Friction logs

`docs/FRICTION_LOG.md` — F-01 (Arch host), F-02 (RN 0.72 Babel vs shared TS packages). Add device findings.

## Feature requests

1. Documented, stable way for the Vega Virtual Device to reach the host network (important).
2. Camera / pose API on Fire TV devices with a camera (important).
3. A Babel preset for Vega that covers ES2021+ syntax used by common libraries (nice-to-have).

## Mini challenges

- **Open Source:** contribution URL `https://github.com/LSUDOKO/vega-gated-video-player` (exported by
  `node scripts/export-oss.mjs`). Description: _"A React Native component and open JSON format (.istep) that make any
  video body-aware: the player pauses at timed gates and resumes when live pose or hand landmarks satisfy the gate.
  Pure-TypeScript gate engine (7 gate types), JSON Schema, validator, examples. Any Vega app — fitness, rehab,
  education, accessibility — can add interactive, camera-aware lessons in a few lines."_
- **AWS Builder:** Bedrock Converse for tips + Creator Studio labels; Polly for multilingual voice; code links:
  `apps/server/src/ai/`, `apps/server/src/coach/`.

## Compliance checklist

- [ ] Repo **public**, MIT `LICENSE` at root (currently private — owner decision pending)
- [x] README: setup, `.env.example`, mock mode, budget alert
- [ ] Demo video < 3:00, public, English, shows the app on the Vega Virtual Device
- [x] No third-party footage/music in the repo; kids video is original illustration (`content/CREDITS.md`)
- [ ] Consent for every person in recorded lessons (`content/CREDITS.md`)
- [ ] Product feedback for every tool, incl. AWS
- [ ] Friction logs (4–6) and feature requests added on Devpost
- [x] Every statistic in README appears in `SOURCES.md`
- [ ] Submitted ≥ 2 h before 12:00 PM PDT, Oct 23
