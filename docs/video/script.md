# InStep — demo film script (v1)

Target length **2:45** (hard limit 3:00). 1920×1080, 30 fps. English voice-over, captions burned in.
Look: the reference launch film (`~/Downloads/install.mp4`) — centred kinetic type, soft glow backgrounds, UI cards
that slide and settle, logo lockup end card — in the **Blue Hour** brand (`docs/brand/palette.json`: night-indigo
canvas, sky brand, sun accent; Inter / SF-style type). Motion: ease-out springs, 0.4–0.8 s, no bounce gimmicks;
one idea per shot; cross-blurs and push transitions between scenes.

**Honesty rules for the film** (AGENTS.md):

- Every TV shot is a real screen recording of the app on the **Vega Virtual Device**; label it once, small:
  "Recorded on the Vega Virtual Device".
- Learner shots driven by the synthetic learner are labelled "Simulated learner" when they appear.
- Say clearly: "The camera is your phone or laptop — an external camera." CPR: "practice for rhythm only, not
  certification". Numbers only from `docs/SOURCES.md` (S1, S3, S5, S6) and shown with their source on screen.
- No Amazon logo artwork is recreated or faked; the TV is shown through real emulator footage (its own launcher)
  and the words "Fire TV · Vega OS". The remote is a generic illustrated remote.

## Voice-over and shots

| # | Time | Picture | Voice-over (Kokoro `af_heart`) |
|---|------|---------|------|
| 1 | 0:00–0:06 | Black → a living-room TV (illustrated, Blue Hour) wakes; a generic remote presses Select; the real Vega launcher fades in with the **InStep** tile focused. Caption: "Fire TV · Vega OS". | — (music only, soft rise) |
| 2 | 0:06–0:14 | Kinetic type, centred: "Videos play." → "Whether you keep up" → "or not." The word "not" stays, everything else blurs away. | "Every how-to video plays at the same speed — whether you keep up, or not." |
| 3 | 0:14–0:32 | Three real web pages (WHO falls fact sheet; Wexner/Medical Economics PT survey; AHA CPR facts) slide in as glass cards; a sun-yellow highlighter sweeps the key line on each: **684,000 deaths from falls a year** (S1) · **76% don't finish their home exercises** (S3) · **73% of cardiac arrests happen at home** (S6). Source URL under each card. | "Falls kill six hundred and eighty-four thousand people a year. Three in four patients don't finish their home exercises. And most cardiac arrests happen at home — where nobody is checking your form." |
| 4 | 0:32–0:38 | Fourth card: the deaf-children source (S5) highlighting **90% born to hearing parents**. | "Nine in ten deaf children are born to hearing parents, learning to sign from videos that can't see them." |
| 5 | 0:38–0:46 | Logo lockup: the InStep mark draws on (footprint → pause bar → play triangle), wordmark types in, tagline: "The video that waits for you." | "InStep is the video that waits for you." |
| 6 | 0:46–1:00 | Split: phone (iOS frame, real companion screenshot `companion-live.png`) on a stand + TV. A dotted line of body points flows phone → TV. Privacy pill zooms: "Video sent 0.0 KB/s". Caption: "The camera is your phone or laptop." | "Prop up your phone. It becomes the camera — an external camera, not the TV. Pose tracking runs in the phone's browser, and only body points travel to the TV. Never video." |
| 7 | 1:00–1:28 | Real TV recording, heel raises: lesson plays → **pauses** at the gate (ring + "Stand tall, hand on chair") → skeleton turns green → video continues; rep counter "3 of 5"; coach tip as a subtitle. Label "Simulated learner". | "At each key moment the lesson pauses, and continues only when your pose is right. It counts your reps, holds your balance — and if you're stuck, a coach gives one short, kind tip." |
| 8 | 1:28–1:36 | Real TV: chair safety check frame; then "Camera disconnected" frame. | "Safety comes first: no balance work until a chair is beside you, and if the camera drops, the lesson stops." |
| 9 | 1:36–2:00 | Channel montage, 4 s each, each a real TV recording with its channel colour wash: Sign Language (letter L, finger glow) · Hand Rehab (open/close reps) · CPR (metronome, BPM meter; caption "Practice for rhythm only — not certification") · Kids' Forest Walk (flamingo + star burst) · Together mode (two learner chips). | "The same engine teaches sign language hand shapes, stroke-hand rehab, CPR rhythm — practice only, not certification — and a story that kids act out. Two people can even practise together." |
| 10 | 2:00–2:10 | Creator Studio phone screens (real screenshots) stacking: record → suggested steps → publish → appears on TV. | "A physiotherapist or teacher records a lesson once on a phone. InStep finds the still moments, suggests the steps, and publishes it to every TV." |
| 11 | 2:10–2:32 | Animated architecture: Phone (MediaPipe in the browser) → WebSocket relay (Node, Fastify, on Render) → Fire TV (React Native for Vega; gate engine; W3C media player). Side nodes: `.istep` open format, Creator Studio, coach (Amazon Bedrock + Polly, mock mode), open-source `vega-gated-video-player`. Packets animate along edges; labels type in. | "Under the hood: an open lesson format called dot-i-step, one pure TypeScript gate engine shared by the phone, the server and the TV, and an open-source Vega player any app can use." |
| 12 | 2:32–2:45 | End card (cream→indigo glow like the reference): logo, tagline, pills: "Fire TV · Vega OS" · "0 bytes of video uploaded" · "Open source · MIT" · "Built for the Amazon Developer Hackathon". URL `github.com/LSUDOKO/InStep`. | "InStep. The video that waits for you." |

Word count ≈ 300 → ~2:30 of speech at ~125 wpm, leaving breathing room.

## Music and sound

Original, code-synthesised (no samples, no copyrighted music): a warm pad + soft pluck motif at ~96 BPM, building at
shot 5 (logo) and shot 9 (montage), resolving on the end card. Ducks 8 dB under speech. Subtle UI ticks when cards
land and a soft chime when a gate passes in shot 7. Loudness −16 LUFS, true peak ≤ −1.5 dBTP.

## Assets

- Real TV recordings (new design, Blue Hour, narrated lesson videos): `~/instep-capture/film/*.webm` (device capture
  agent).
- Phone screens: `docs/screenshots/companion-*.png`, `creator-*.png`.
- Web pages: Playwright screenshots of the S1/S3/S5/S6 URLs at 1440 px, saved in `docs/video/assets/web/`.
- Architecture diagram: `docs/architecture/` (also used in the README).
- Output: `docs/video/instep-demo.mp4` (≤ 3:00) + `docs/video/captions.srt`.
