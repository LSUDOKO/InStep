# 12 — Submission Kit

Submit on Devpost before **Oct 23, 2026, 12:00 PM PDT (Oct 24, 12:30 AM IST)**. Entering: **Fire TV track** + **AWS Builder** + **Open Source** mini challenges.

## 1. Demo video (under 3:00, public on YouTube/Vimeo, English)

Judges may stop at 3:00 — the best material comes first. Screen layout: Vega Virtual Device large, a small inset of the real person, the phone in frame when relevant. Say clearly that the camera is an external phone/laptop camera.

| Time | Visual | Narration (draft) |
|---|---|---|
| 0:00–0:12 | A normal how-to video plays while a person falls behind | "Every how-to video has the same flaw: it doesn't wait for you." |
| 0:12–0:20 | InStep logo on Fire TV | "InStep turns any video into a lesson that waits for you — on the Fire TV you already have." |
| 0:20–0:40 | Physio records heel raises on a phone in Creator Studio → auto-gates appear → Publish → appears on TV | "A physiotherapist records once. InStep finds the key moments and makes them gates." |
| 0:40–1:25 | Older adult on VVD: pairs phone by QR → chair check blocks ("I can't see a chair") → moves chair → passes → video pauses at "rise onto your toes", waits, resumes on pass; hold ring fills; deliberate sway → "Let's sit down and rest" | "Falls kill about 684,000 people a year. Proven home exercises cut falls by 35% — but most people don't do them, or do them wrong. InStep checks safety first and waits for you." |
| 1:25–2:05 | Sign language: parent forms ILY; middle finger wrong → Delta Glow amber + arrow → fixes → lock-in glow; Together mode: child/second person signs too | "Most deaf children are born to hearing parents. InStep shows exactly which finger to fix — no sound needed — and lets families practise together." |
| 2:05–2:25 | Montage: CPR rhythm meter on a cushion (disclaimer visible); kids forest story; rehab rep counter | "The same engine powers CPR rhythm practice, stroke hand rehab and active storytime for kids." |
| 2:25–2:45 | Privacy pill "Video sent 0 KB/s"; coach tip appears; architecture slide | "Only body points leave the camera — never video. A kind coach on Amazon Bedrock gives one tip when you're stuck." |
| 2:45–3:00 | `.istep` file next to a `.vtt` file; GitHub repo | "And `.istep` is open: like captions for movement. Any Vega app can add it with our open-source player." |

Record at 1080p; clean audio; captions burned in or uploaded. No copyrighted music.

## 2. Devpost text

**Tagline:** The video that waits for you.

**Inspiration:** How-to videos play at the same speed whether you keep up or not. For people doing prescribed home exercises, learning sign language for their child, or practising CPR, that means doing it wrong — or giving up.

**What it does:** (pitch paragraph from README + bullet list of channels and platform features)

**How we built it:** Vega OS React Native app on the Vega Virtual Device; companion web app with MediaPipe running entirely in the browser; Node relay; pure-TypeScript gate engine shared across TV, browser and server; `.istep` open format; Amazon Bedrock (Converse API) for coach tips and auto-gate labels; Amazon Polly for voice; open-source player package.

**Challenges / Accomplishments / What we learned / What's next:** fill from `PROGRESS.md` and `FRICTION_LOG.md`. What's next: movement-based signs reviewed by Deaf educators, clinician pilot, Fire TV camera support, more languages.

**Honesty notes to include:** camera is external; CPR doesn't measure depth; lessons are demonstrations (name who reviewed them); statistics come from `SOURCES.md`.

## 3. Product feedback (required — one entry per tool)

Template for each: *What I used it for · What worked well · What needs work · Onboarding (zero to hello world) · Would I build with it again, and why.* Be specific and name the tool. Cover at least:

- Vega Developer Tools + Vega Virtual Device
- Vega CLI
- `react-native-multi-tv-app-sample` / `vega-video-sample`
- Amazon Devices Builder Tools (MCP + Agent Skills)
- Vega video player / W3C media APIs
- Focus/navigation library from the sample
- Amazon Bedrock (Converse API) — describe exactly how InStep uses it
- Amazon Polly — how it's used
- (Optional) Kiro, if you used it while coding — describe how
- (Optional) MCP SDK

## 4. Friction logs (up to +10% bonus)

Keep `docs/FRICTION_LOG.md` during the build. Submit 4–6 entries. Each entry:

```
### F-01: <short title>
- Task attempted:
- Steps taken: (exact commands/config)
- Expected:
- Actual:
- Severity: Critical (blocker) | High | Medium | Low
- Workaround:
- Suggestion: (concrete, actionable for the Amazon team)
```
Only log real experiences. Likely candidates (verify, don't invent): VVD reaching host network for WebSockets; overlay rendering performance over video; playback-rate support; audio while video paused; packaging monorepo packages for Vega builds.

## 5. Feature requests (optional)

2–3 requests, each with why it matters and urgency (critical / important / nice-to-have). Example: "Camera/pose API on Fire TV devices with a camera" (important), "Documented way for VVD to reach host network" (important).

## 6. Open Source mini challenge fields

- **Contribution URL:** `https://github.com/<you>/vega-gated-video-player`
- **Your repo URL:** main InStep repo
- **GitHub username**
- **Description (what / how / why):** "A React Native component and open JSON format (`.istep`) that make any video body-aware: the player pauses at timed gates and resumes when live pose or hand landmarks satisfy the gate. Pure-TypeScript gate engine (7 gate types), JSON Schema, validator CLI, examples. It matters because any Vega app — fitness, rehab, education, accessibility — can add interactive, camera-aware lessons in a few lines."

## 7. AWS Builder mini challenge fields

Describe: Bedrock Converse API for coaching tips (prompt, filters, cache, rate limits) and Creator Studio auto-gate labels; Polly for multilingual voice tips; (optional) S3 for media. Include an architecture diagram and code links.

## 8. Compliance checklist (final)

- [ ] Repo **public** with `LICENSE` (MIT) visible at root (avoids collaborator-invite expiry)
- [ ] README: setup in < 15 minutes, `.env.example`, mock mode, budget alert
- [ ] Demo video < 3:00, public, English, shows app running on **Vega Virtual Device** (or Fire TV)
- [ ] No third-party trademarks/copyrighted music or footage; consent for all people shown
- [ ] Product feedback for every tool/SDK used, including AWS services
- [ ] Track + both mini challenges selected; mini challenge fields filled
- [ ] Friction logs and feature requests added
- [ ] All teammates added to the submission and accepted invites
- [ ] Every statistic in video/text appears in `SOURCES.md`
- [ ] Submitted with ≥ 2 hours to spare
