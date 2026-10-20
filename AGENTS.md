# AGENTS.md — Instructions for the coding agent

You are building **InStep**, a hackathon project that must be **fully functional, polished, and honest**. Read this file completely before writing code.

## 1. Order of work

1. Read every file in `docs/` in numeric order.
2. Do the **Day-1 spike** in `docs/10-build-plan.md` (Milestone 0) before anything else. It tests the two riskiest assumptions on the Vega Virtual Device. Report results before continuing.
3. Build milestones in the order given. Do not start a later milestone while an earlier one fails its acceptance criteria.
4. After each milestone, run the tests in `docs/11-testing-qa.md` that apply, and write a short entry in `docs/PROGRESS.md` (create it): what works, what doesn't, what changed from the spec and why.

## 2. Priorities (when in doubt)

1. **It works end to end in the demo.** A working, narrow feature beats a broad, broken one.
2. **Safety and honesty.** Never fake a feature, a number or a citation.
3. **Polish of the two hero channels** (Fall Prevention and Sign Language for Families).
4. Everything else.

## 3. Honesty rules (non-negotiable)

- **Never add a UI element for a feature that does not work.** No placeholder buttons, no "coming soon" cards on the main catalog, no fake camera sources (do NOT add a "Ring Indoor Cam" toggle).
- **Only cite statistics and papers listed in `docs/SOURCES.md`.** Do not add any other number, study or arXiv ID to the UI, README, or submission text. In particular, never cite arXiv 2511.22737 for any accuracy or success-rate claim (its numbers come from synthetic simulation).
- **CPR channel** must always show: "Practice aid for rhythm and straight arms only. It does not measure compression depth and is not certification. Take a certified CPR course."
- **Fall prevention and rehab channels** must show: "Use exercises prescribed or approved by your physiotherapist. Stop if you feel pain, dizziness or unsteadiness."
- **Sign language channel** must show: "A practice aid created with Deaf signers. Learn with Deaf teachers and community too."
- The AI coach gives **coaching tips, never diagnoses** (no "your ACL", "you have", "injury", "disease").
- The video must clearly state in the demo that the camera is an external phone/laptop camera.

## 4. Safety rules for code

- **Safety gates are never loosened automatically.** `safety_prerequisite` gates and the sway-stop threshold use fixed values from the `.istep` file. Adaptive tolerance (see `docs/04-gate-engine.md`) applies only to learning gates.
- **Adaptive tolerance is deterministic code**, not decided by the AI model.
- If the camera stream drops for more than 2 seconds during a lesson, the TV pauses and shows "Camera disconnected". Never keep playing a gated lesson with no camera data.

## 5. Privacy rules

- Camera frames are processed **only in the browser** of the companion device. **Never** upload, record to server, or transmit camera video of the learner.
- Only normalized landmark coordinates and gate results leave the device.
- Creator Studio is the only place that records video, and only the instructor's demonstration, with an explicit "Record demonstration" action and a visible recording indicator.
- The Privacy pill on the companion must show **real measured numbers** (bytes/second of skeleton JSON actually sent; video bytes sent must be measured as 0, not hard-coded).

## 6. AWS cost rules

AWS hackathon credits are no longer available (out of codes as of Oct 7), so AWS usage is billed to the developer.

- Implement `MOCK_AI=true` (default in development) that returns templated tips and uses browser speech synthesis instead of Polly. Use real Bedrock/Polly only when `MOCK_AI=false`.
- Cache coach tips by `(lessonId, gateId, errorBucket, language)`.
- Rate limit: max 1 coach call per learner per 8 seconds; max 300 coach calls per server process per day (configurable).
- Read the model ID from `BEDROCK_MODEL_ID` env var. Do not hard-code a specific model name.
- Document in README how to set an AWS Budgets alert.

## 7. Coding standards

- **TypeScript everywhere** (strict mode). Node 20+.
- Shared logic lives in `packages/` and is **pure** (no DOM, no React Native imports) so it runs in the browser, Node and Vega.
- Validate all external data with **zod** (WebSocket messages, `.istep` files, API bodies).
- No secrets in the repo. Use `.env` + `.env.example`.
- Every package has unit tests (vitest). The gate engine needs high coverage (see `docs/11-testing-qa.md`).
- Lint with ESLint + Prettier. Keep files small and named clearly.
- Log with a tiny structured logger (`[module] message {json}`); no noisy logs at 30 fps.

## 8. Vega OS specifics — verify, don't assume

Use the **Amazon Devices Builder Tools** (MCP server + Agent Skills) and the official samples to verify Vega details before relying on them. Do not assume Android or web APIs exist on Vega. Things to verify in Milestone 0:

- WebSocket client availability and how the Vega Virtual Device reaches the host machine's network.
- Which video component to use (follow `vega-video-sample` / `react-native-multi-tv-app-sample`), and which formats it plays (prefer H.264 MP4).
- Whether `react-native-svg` (or an equivalent) is supported for overlays, and its frame rate over video.
- Focus management library used by the starter (keep it).

Record every surprise or workaround in `docs/FRICTION_LOG.md` (create it) using the format in `docs/12-submission-kit.md`. These become the submission's friction logs (up to +10% judging bonus).

## 9. Definition of done (whole project)

- Fresh clone → `README` setup steps → running TV app on Vega Virtual Device + companion + server in under 15 minutes.
- Both hero lessons run end to end with gates, overlays, coach tips and reports.
- CPR and Kids lessons run end to end (shorter).
- Creator Studio records a demo, auto-places gates, publishes, and the lesson appears on the TV.
- Together mode works with two companion devices.
- All tests pass. No console errors in the demo path.
- `LICENSE` (MIT) at repo root. Open-source package `vega-gated-video-player` published as a separate public repo.
- Demo video script rehearsed (see `docs/12-submission-kit.md`).
