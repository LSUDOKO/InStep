# Devpost answers (paste-ready)

## Are you submitting for the AWS Builder Mini Challenge?

Yes.

## Which AWS services did you incorporate and how?

InStep uses two AWS services, both integrated in the server (`apps/server/src/ai/`, `apps/server/src/coach/`) with
the AWS SDK for JavaScript v3:

1. **Amazon Bedrock (Converse API)** — two jobs:
   - **Coach tips.** When a learner is stuck on a step for a few seconds, the server sends Bedrock the step, the
     lesson and the measured error (for example "left knee 12° short of the target", never video) and asks for ONE
     short, kind coaching tip (≤ 80 tokens, 4 s timeout). A safety filter rejects anything that sounds like a
     diagnosis ("injury", "you have…"). Tips are cached by (lesson, step, error bucket, language), rate-limited
     (one call per learner per 8 s, a daily cap per server process), and the model ID comes from the
     `BEDROCK_MODEL_ID` environment variable — never hard-coded.
   - **Creator Studio step labels.** When an instructor records a demonstration, InStep finds the still moments and
     asks Bedrock for strict-JSON labels ("Stand tall, hand on chair") for each suggested step.
2. **Amazon Polly (neural voices)** — speaks the coach's tip in the learner's language (Joanna, Lucia, Kajal, Léa
   checked as available on the account), with a disk cache so a repeated tip costs nothing.

Cost and safety controls are part of the design: `MOCK_AI=true` (templated tips + browser speech) is the default,
the coach falls back to the lesson's own tip on any model error, and the README explains how to set an AWS Budgets
alert before switching it on.

**Honest status:** the integration is complete and covered by 23 unit tests (model errors, malformed JSON, the
daily cap, banned words, the MCP server). Against the real account, `pnpm aws:check` listed 49 Bedrock models
(including `amazon.nova-micro-v1:0`) and all four Polly neural voices; the first real Converse call hit the new
account's daily token allowance (`ThrottlingException: Too many tokens per day`), which the coach handled with its
fallback (screenshots in the README, "AI on AWS"). Because the account has no remaining credits, the hosted demo
runs in mock mode by choice; turning Bedrock and Polly on is one setting (`MOCK_AI=false`).

## Are you submitting for the Open Source Mini Challenge?

Yes.

- **Contribution URL:** https://github.com/LSUDOKO/vega-gated-video-player
- **Project Repository URL:** https://github.com/LSUDOKO/InStep
- **GitHub Username:** LSUDOKO

**What I did, how it works, why it matters:**

I created `vega-gated-video-player`, a new MIT-licensed repository (created 21 Oct 2026, during the hackathon) that
packages InStep's core so any Vega app can make a video "wait" for the viewer.

How it works:

- **`.istep` — an open, JSON lesson format**, like WebVTT captions but for movement: a list of timed "gates", each
  saying what must be true before the video continues (a pose within N degrees, a hold for N seconds, N reps, a
  rhythm between 100–120 per minute, a hand shape, a sequence, a safety check). It ships a JSON Schema, a zod
  validator and examples.
- **A pure-TypeScript gate engine** (7 gate types, no DOM, no React Native) that scores a stream of body or hand
  landmarks against the current gate, with fixed safety gates that are never loosened and deterministic adaptive
  tolerance for learning gates.
- **A timing controller and `<GatedPlayer>` for React Native for Vega** that pauses the W3C media player at each
  gate time, loops a segment while the learner practises, and resumes when the gate passes.
- A demo driven by a synthetic landmark stream, so it runs without a camera; it type-checks and passes its own 125
  tests. It is exported from the InStep monorepo by `scripts/export-oss.mjs`.

Why it matters: how-to video is passive — it plays at one speed whether you keep up or not. With a few lines, any
Fire TV fitness, rehab, education or accessibility app can turn its existing videos into lessons that respond to
the viewer, using a phone or laptop they already own as the camera, with only body points (numbers) leaving the
device — never video.

## [Optional] Feature Requests

1. **`vega device screenshot` and the emulator's stderr in `vega virtual-device start`** — Important. Every
   problem we hit (missing libraries, a broken symlink, a black frame) was found only by reverse-engineering logs;
   a screenshot command and visible boot errors would have saved hours.
2. **Allow `http://10.0.2.2` media in debug builds, or document the HTTPS-only rule on the Video page** —
   Important. The player rejects http sources with a generic "couldn't be played" error; local development needs
   a public HTTPS certificate today.
3. **A camera / on-device pose API for Fire TV devices with a camera** — Important. InStep uses a phone as the
   camera because the TV has no pose API; an on-device API would remove the second device and keep frames on the
   TV.
4. **A "Typography and materials" page** (bundled fonts, whether blur/vibrancy is supported) and **launcher icon
   size + safe area** next to the manifest `icon` key — Nice-to-have.
5. **Ubuntu install page: add `jq` and the emulator's apt dependencies; ignore unsupported `NODE_OPTIONS`; warn
   when the host has too little memory to boot the Virtual Device** — Nice-to-have (each cost 10–30 minutes).

## [Optional] Friction Log

(Full log with steps: https://github.com/LSUDOKO/InStep/blob/main/docs/FRICTION_LOG.md)

**F-05 — Vega SDK install on Ubuntu 24.04 needed manual repairs.** Task: install Vega Developer Tools 0.24.12112
and start the Virtual Device (Ubuntu 24.04 distrobox on an Arch host, /dev/kvm passed through). Steps/actual:
`get_vvm.sh` aborted with "jq is required" (jq is not in the documented dependencies); every `vega` command failed
with "--no-experimental-strip-types is not allowed in NODE_OPTIONS" (the SDK's bundled Node rejects a flag the
shell exports); `vega virtual-device start` returned silently because `vvd/bin/virtualdevice` was a symlink to `/`;
then the emulator failed on `libpulse.so.0` and other X11/Mesa libraries. Expected: one installer run and a booting
device. Severity: High. Workaround: install jq, `unset NODE_OPTIONS`, relink the binary, `apt install libpulse0 libgl1
libegl1 libgbm1 libx11-xcb1 …`. Suggestion: list these dependencies, ignore unsupported NODE_OPTIONS, verify the
symlink after install and print the emulator's stderr when boot never starts. (~75 minutes to Hello World.)

**F-06 — The media player refuses http:// video sources.** Task: play an H.264 MP4 from the local dev server
(`http://10.0.2.2:8788`). Expected: playback or a codec error. Actual: generic "couldn't be played"; the device log
shows `isUriSchemeSecure Got an insecure protocol/scheme http` → error 50004. Severity: High for local development.
Workaround: serve media over HTTPS from the hosted server (Render). Suggestion: document HTTPS-only on the Video
page, surface an "insecure scheme" error to JavaScript, allow 10.0.2.2 in debug builds.

**F-07 — The Virtual Device hangs under its own 1080p screen recording.** Task: record lessons with the emulator
console's `screenrecord` at 1920×1080. Actual: QEMU main-loop/CPU threads stopped responding, the console closed and
the device had to be restarted. Severity: Medium. Workaround: record at 1280×720, 12 fps, 3 Mbps and restart the
device from the script when the console stops answering. Suggestion: cap the recorder or warn; report the hang in
`vega virtual-device status`.

**F-04 — Bedrock daily token cap surfaces as a generic throttle.** Task: one real coach tip via the Converse API
(`amazon.nova-micro-v1:0`). Expected: a reply or "model access not granted". Actual: `ThrottlingException: Too many
tokens per day` on the first call of the day. Severity: Medium. Workaround: the coach falls back to the lesson's
template tip; `pnpm aws:check` probes access. Suggestion: a distinct error code with the reset time, and the
allowance shown in the Bedrock console.

**F-09 — The Virtual Device silently fails to boot when the host is short of memory.** Expected: boot or a memory
error. Actual: the boot wait never finishes or the device freezes mid-session; nothing points at memory. Severity:
Medium. Workaround: keep ~4 GB free. Suggestion: check memory in `vega virtual-device start` and warn.

**F-10 — The launcher centre-crops a square app icon; the manifest docs give no size.** A 512×512 icon (as in
Amazon's sample) is cropped to a wide tile, cutting the logo. Severity: Low. Workaround: keep the mark in the middle
16:9 band. Suggestion: document tile size and safe area next to the `icon` key.

Also logged: F-01 (Arch hosts unsupported — solved with an Ubuntu 24.04 distrobox), F-02 (RN 0.72 Babel needs extra
plugins for modern TS packages), F-03 (MediaPipe web telemetry with no opt-out — blocked by a strict CSP),
F-08 (no documented TV font list or blur component).

## [Optional] Project Testing Link

- Phone / laptop camera (companion): https://instep-wfcr.onrender.com/c/ (free hosting: the first request after
  idle can take ~1 minute to wake).
- TV app: clone https://github.com/LSUDOKO/InStep and follow the README "Quick start" → "TV app (Vega Virtual
  Device)" (`cd apps/tv && npm run build:debug`, then `vega run-app build/x86_64-debug/tv_x86_64.vpkg
  com.instep.tv.main -d VirtualDevice`). It connects to the hosted server by default.
- On the TV: create a profile → pick a lesson → Start → open the address on the TV on a phone and enter the 4-digit
  room code (or scan the QR).
- Without a camera: `pnpm demo-learner --room <code> --server https://instep-wfcr.onrender.com` streams a simulated
  learner that passes each step.
- No credentials needed for lessons. Creator Studio (`/c/creator`) is protected by a `CREATOR_PIN`; run the server
  locally (README "Quick start") and set your own PIN to try it.

## Feedback Question 1: Which developer tools, APIs, and SDKs did you use and for what?

- **Vega Developer Tools / Vega SDK 0.24 + Vega Virtual Device** — building, installing and running the TV app;
  every screenshot and recording in the project.
- **Vega CLI (`build-kepler`, `run-app`, `virtual-device`, `device run-cmd`)** — builds, installs, remote-key
  automation (`inputd-cli`) for scripted test runs.
- **React Native for Vega (RN 0.72), W3C media player (`@amazon-devices/react-native-w3cmedia`),
  react-tv-space-navigation, react-native-svg, AsyncStorage** — the TV app, lesson player, D-pad focus, skeleton
  overlays, settings.
- **Official samples** (`react-native-multi-tv-app-sample`, `vega-video-sample`, `vega-tv-interfaces-sample`) —
  reference for the video surface, key handling, manifest and launcher icon.
- **Amazon Bedrock (Converse API) and Amazon Polly, AWS SDK for JavaScript v3, AWS Budgets / Free Tier APIs** —
  coach tips, Creator Studio labels, voice; budget and credit checks.
- **Other:** MediaPipe Tasks (pose/hands in the phone browser), Node 22 + Fastify + ws + node:sqlite (relay and API),
  Render (hosting), Vitest + Playwright + GitHub Actions (tests/CI), Kokoro-82M (local narration), ffmpeg.

## Feedback Question 2: What worked well?

- **Vega Virtual Device:** once installed, boots in ~20 s; `run-app` installs in seconds; reaches both the host
  (`10.0.2.2`) and the internet with TLS; the emulator console made screenshots and recordings scriptable.
- **Vega CLI / build:** three-architecture debug build in ~90 s, clear manifest validation, autolinking of
  `react-native-svg` and AsyncStorage just worked.
- **W3C media player:** `play`/`pause`/seek responded within a frame of the gate engine across lessons with several
  pauses and loops; standard media events, like a browser.
- **react-tv-space-navigation:** worked with the Vega remote out of the box.
- **Samples:** clear, current, and the fastest way to the right video-surface pattern.
- **Bedrock/Polly:** the Converse API made the model a configuration value; SDK v3 errors were typed and easy to
  handle; Polly neural voices for four languages listed immediately.

## Feedback Question 3: What needs work?

- **Install/diagnostics (Vega SDK):** missing `jq` dependency, bundled Node rejecting `NODE_OPTIONS`, a broken
  `virtualdevice` symlink, emulator library dependencies not listed, silent boot failures (also on low memory), no
  `vega device screenshot` (F-05, F-09).
- **Media:** HTTPS-only sources undocumented and reported as a generic playback error (F-06); a debug build logs
  `Unsupported top level event type topOnKeplerVideoSurfaceViewCreated`.
- **Emulator recording:** 1080p `screenrecord` can hang QEMU (F-07).
- **Docs gaps:** supported JS syntax level / Babel preset for RN 0.72 (F-02), system fonts and blur (F-08), launcher
  icon size (F-10).
- **Bedrock:** a new account's daily token allowance looks like a generic throttle (F-04).
- **Amazon Devices Builder Tools MCP:** its server failed to connect from our agent session, so we relied on the
  docs pages and the device itself.

## Feedback Question 4: How was your onboarding experience (zero to hello world)?

- **Vega SDK + Virtual Device:** about 75 minutes on Ubuntu 24.04 (in a distrobox, because Arch hosts are not
  supported), almost all of it on the four install repairs in F-05. After that, Hello World on the device took
  minutes and day-to-day iteration was fast.
- **React Native for Vega:** easy for a React developer — the samples gave a working video app quickly; the
  surprises were the Babel syntax level (F-02) and HTTPS-only media (F-06).
- **AWS Bedrock/Polly:** credentials and SDK setup in under 30 minutes; listing models and voices worked first
  time; the first real Bedrock call was blocked by the daily allowance (F-04).

## Feedback Question 5: Would you build with these devices and services again?

Yes. The Vega runtime itself was solid — video, focus navigation and SVG overlays worked reliably once the toolchain
was installed, and a TV is the right screen for guided practice in the living room. The time we lost was in the
installer and diagnostics, which are fixable. We would also use Bedrock again for the coach: the Converse API keeps
the model swappable and the cost controls simple.

## Which AI tools have you leveraged while working on this project?

- **Claude Code (Anthropic Claude models)** as a pair-programmer and agent: planning, TypeScript across the monorepo,
  tests, debugging on the Vega Virtual Device through scripted remote keys and screenshots, documentation, the brand
  and the animated lesson videos (parallel sub-agents for brand, animation, audio and the demo film).
- **Claude Code skills:** huashu-design (brand directions) and huashu-art-motion (animation method).
- **Kokoro-82M** (open-source, Apache-2.0, run locally) for the lesson and film narration.
- **MediaPipe Tasks** (on-device ML) for pose and hand landmarks in the product itself.
- **Amazon Bedrock / Polly** integrated in the product (switched off on the hosted demo).

## Describe the level of learning you/your team derived from the project

High. New to us: building and shipping a React Native app on Vega OS (manifest, W3C media player, D-pad focus, the
Virtual Device and its emulator console), designing an open file format (`.istep`) and a deterministic gate engine
that runs unchanged on a phone, a server and a TV, real-time pose and hand tracking in the browser with a measured
privacy guarantee, cost-safe AI integration (mock mode, caching, rate limits, budgets), and producing narrated,
animated lesson content in code. Debugging the toolchain taught us to make every claim verifiable — real device
recordings, measured byte counts, and a friction log written as things broke.

## Did you gain AI value that you can use in your career?

Yes. We learned to use AI agents for real engineering — splitting work across parallel agents with clear briefs,
checking their output against screenshots and tests rather than trusting it — and to design AI features that stay
safe and cheap: deterministic code for safety decisions, the model only for short coaching language, with fallbacks,
caching and hard limits. Both carry directly into professional work.

## Eligibility checkboxes

Tick these only if they are true for you (age of majority, eligible jurisdiction, not an employee/agent of the
sponsors). We cannot answer them for you.
