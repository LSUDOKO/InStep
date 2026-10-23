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
labels; Amazon Polly for voice; zod-validated protocol; 240 unit/integration tests and Playwright e2e in CI.
Lesson teacher videos: animated demonstrations drawn to each gate (pycairo + ffmpeg), real CPR footage (Pexels,
credited) and illustrated sign-language handshapes, all narrated with a local voice model.

**Honesty notes.** The camera is an external phone/laptop. CPR does not measure compression depth and is not
certification. The teacher videos are animated demonstrations (labelled on screen), one credited stock CPR clip and
illustrated sign-language handshapes — no clinician or Deaf signer has reviewed them yet. InStep has not been clinically tested; it is
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

## Product feedback (one per tool)

Template: what I used it for · what worked · what needs work · zero-to-hello-world · would I build with it again.

- **Vega Developer Tools + Virtual Device (SDK 0.24.12112):** used for every device run. *Worked:* once up, the
  VVD boots in ~20 s, `run-app` installs in seconds, the emulator console gives scriptable screenshots, and the
  device reaches both the host (`10.0.2.2`) and the public internet with TLS. *Needs work:* zero-to-hello-world
  took ~75 minutes on Ubuntu 24.04 because of four undocumented repairs (F-05: `jq` missing from the dependency
  list, the SDK's bundled Node rejecting the developer's `NODE_OPTIONS`, a broken `vvd/bin/virtualdevice` symlink,
  and the emulator needing `libpulse0` + X11/Mesa libraries) and the CLI never surfaced the emulator's stderr.
  No `vega device screenshot`, and the on-device screenshooters fail for `app_user`. *Again:* yes — the runtime
  itself was solid; the installer and diagnostics are what cost time.
- **Vega CLI / `react-native build-kepler`:** three-architecture debug build in ~90 s, clear manifest validation,
  autolinking just worked for `react-native-svg` and async-storage. Would like `run-app` to accept a glob or pick
  the right arch for the target.
- **react-native-multi-tv-app-sample / vega-video-sample:** the reference for the W3C media `VideoPlayer` +
  `KeplerVideoSurfaceView` pattern, `TVEventHandler` key mapping, metro aliasing and the manifest. Clear and current;
  the one thing it doesn't say is that the media element refuses `http://` sources (F-06).
- **Amazon Devices Builder Tools (MCP + Agent Skills):** not reachable from this session (the plugin's MCP server
  failed to connect), so the device facts above come from the official docs pages plus the device itself.
- **W3C media APIs on Vega:** `play`/`pause`/seek responded within a frame of the gate engine's requests across a
  40 s lesson with four pauses; `loadstart`/`error` events fire as in a browser. HTTPS-only sources is the one
  surprise (F-06), and a debug build logs `Unsupported top level event type topOnKeplerVideoSurfaceViewCreated`.
- **react-tv-space-navigation:** works with the Vega remote out of the box (D-pad, Select, Back). Its vertical
  root default bit us: two side-by-side columns need an explicit horizontal node or Left/Right never cross — found
  on device, not in the Metro bundle.
- **Amazon Bedrock (Converse API):** coach tips (≤ 80 tokens, 4 s timeout, safety filter, cache, rate limits) and
  strict-JSON step labels. Real-account test hit the new-account daily token allowance on the first call (F-04);
  the fallback path handled it. Model id is configuration, not code.
- **Amazon Polly:** neural voice per language with disk cache; all four voices (Joanna, Lucia, Kajal, Lea) listed
  as available on the account; synthesis itself not exercised to keep spend at zero.

## Friction logs

`docs/FRICTION_LOG.md` — F-01 (Arch host), F-02 (RN 0.72 Babel vs shared TS packages), F-03 (MediaPipe telemetry
with no opt-out), F-04 (daily token cap surfaces as a generic throttle), F-05 (SDK install on Ubuntu 24.04: four
manual repairs), F-06 (media player refuses `http://` sources), F-07 (VVD hangs under 1080p screen recording), F-08
(no documented TV font list or blur), F-09 (VVD silently fails to boot on low host memory).

## Feature requests

1. `vega device screenshot` and emulator stderr in `virtual-device start` output (important — every bug above was
   found by screenshots and logs we had to reverse-engineer).
2. Document and allow `http://10.0.2.2` media in debug builds, or state the HTTPS-only rule on the Video page
   (important).
3. Camera / pose API on Fire TV devices with a camera (important).
4. `jq` and the emulator's shared-library dependencies in the Ubuntu install page; tolerate unsupported
   `NODE_OPTIONS` (nice-to-have).

## Mini challenges

- **Open Source:** contribution URL `https://github.com/LSUDOKO/vega-gated-video-player` (exported by
  `node scripts/export-oss.mjs`). Description: _"A React Native component and open JSON format (.istep) that make any
  video body-aware: the player pauses at timed gates and resumes when live pose or hand landmarks satisfy the gate.
  Pure-TypeScript gate engine (7 gate types), JSON Schema, validator, examples. Any Vega app — fitness, rehab,
  education, accessibility — can add interactive, camera-aware lessons in a few lines."_
- **AWS Builder:** Bedrock Converse for tips + Creator Studio labels; Polly for multilingual voice; code links:
  `apps/server/src/ai/`, `apps/server/src/coach/`.

## Compliance checklist

- [x] Repo **public**, MIT `LICENSE` at root
- [x] README: setup, `.env.example`, mock mode, budget alert
- [ ] Demo video < 3:00, public, English, shows the app on the Vega Virtual Device
- [x] Only third-party footage is one credited Pexels CPR clip; no music; the rest is original (`content/CREDITS.md`)
- [x] No recorded people of our own yet, so no consent forms needed (`content/CREDITS.md`)
- [ ] Product feedback for every tool, incl. AWS
- [ ] Friction logs (4–6) and feature requests added on Devpost
- [x] Every statistic in README appears in `SOURCES.md`
- [ ] Submitted ≥ 2 h before 12:00 PM PDT, Oct 23
