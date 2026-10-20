# 01 — Product Specification

## 1. Vision

**InStep — the video that waits for you.**

Learning a physical skill from a video fails because the video keeps playing whether you keep up or not, and it never tells you what you did wrong. InStep makes video lessons **body-aware**: the lesson pauses at each key moment ("gate") and continues only when the learner's pose, hand shape, rhythm, hold or repetitions are right. A kind AI coach gives one short, specific tip when someone is stuck.

InStep is a **platform**, not a single app:

- **Learners** use it on the TV they already watch every day (Fire TV, Vega OS), with a phone or laptop as the camera.
- **Creators** (physiotherapists, Deaf signers, CPR instructors, teachers) record a demonstration once on their phone; InStep turns it into a gated lesson automatically.
- **Developers** can add body-aware gates to any video with the open `.istep` format and the open-source `vega-gated-video-player` component.

## 2. The problem (use only numbers from `SOURCES.md`)

- Home exercise programmes work only if people do them, and most don't: in one 2026 survey of 1,006 Americans, 76% did not complete all their assigned at-home physical therapy exercises.
- Falls are the second leading cause of unintentional injury death worldwide (about 684,000 deaths per year); the home-based Otago Exercise Programme reduced falls and fall injuries by 35% in controlled trials.
- At least 90% of deaf children are born to hearing parents, and many of those parents never learn sign language.
- About 73% of out-of-hospital cardiac arrests happen at home; immediate CPR can double or triple survival.
- Video demonstrations help people learn movement better than text — but today's videos play blindly.

## 3. Users and personas

| Persona | Needs | Device |
|---|---|---|
| **Margaret, 78**, lives alone, prescribed balance exercises after a near-fall | Large, simple UI; safety; doesn't want to touch the remote mid-exercise | Fire TV + phone propped on a shelf |
| **Ravi, 58**, stroke survivor doing hand rehab | High repetition count; motivation; visible progress | Fire TV + laptop webcam |
| **Ana and Tom**, hearing parents of a deaf toddler | Practise everyday signs together, finger-level feedback, no audio dependence | Fire TV + phone |
| **Leah, 35**, wants CPR practice between certified courses | Correct rhythm and straight arms | Fire TV + phone at her side |
| **Kids 4–8** with a parent | Fun, active story time | Fire TV + laptop |
| **Dr. Chen, physiotherapist** (creator) | Record once, assign, see adherence and quality | Phone (Creator Studio) + web report |
| **Sam, Deaf signer** (creator) | Publish sign lessons with correct handshape references | Phone (Creator Studio) |
| **Family member far away** | Join a session remotely (Together mode), see progress | Phone |

## 4. The five channels

Each channel is a category of lessons on the TV home screen. All channels use the same gate engine.

### 4.1 Fall Prevention (HERO)
- Otago-style strength and balance exercises, created by a physio in Creator Studio.
- **Chair safety check** before any balance exercise (chair detected near the learner).
- **Sway stop**: lesson pauses and says "Let's sit down and rest" if lateral sway exceeds the lesson's limit.
- Hold timers, pose matching, progression levels (two hands on chair → one hand → no hands).
- Demo lessons: "Heel raises (with chair)", "Single-leg stand (with chair)".

### 4.2 Stroke Hand Rehab
- Hand-tracked exercises: open/close hand, finger spread, wrist turn.
- Counts **quality reps** (full range of motion), slows the video when the learner lags, celebrates milestones.
- Demo lesson: "Open and close your hand — 20 reps".

### 4.3 Sign Language for Families (HERO, emotional peak)
- Static handshapes first: ASL "I love you", fingerspelling letters A, B, C, L, Y (static letters only; J and Z involve motion — exclude).
- **Delta Glow** finger HUD: correct fingers glow green; the single most wrong finger glows amber with an arrow ("curl" or "extend"). No audio needed.
- Together mode so parent and child (or two parents) pass the gate together.
- Demo lesson: "Your first signs: I love you", "Fingerspelling: A B C".

### 4.4 CPR Practice (light)
- Practise on a firm cushion. Rhythm gate (100–120 compressions per minute) and straight-arm check (camera placed at the learner's side).
- Always shows the CPR disclaimer (see `AGENTS.md`).
- Demo lesson: "Hands-only CPR rhythm — 30 compressions".

### 4.5 Kids' Active Storytime (light)
- A short story video that waits for kids to act it out ("Stretch tall like a tree!", "Crouch small like a mouse!").
- Generous tolerances, celebratory animation on every pass.
- Demo lesson: "The Forest Walk".

## 5. Feature list

### 5.1 Learner (TV)
| ID | Feature | Priority |
|---|---|---|
| L1 | Home catalog with 5 channels and lesson cards (D-pad navigation) | Must |
| L2 | Pairing: TV shows QR code + 4-digit room code; phone joins | Must |
| L3 | Gated player: pauses at gates, resumes when passed | Must |
| L4 | Ghost overlay: instructor skeleton (dashed) over learner skeleton (solid, coloured by correctness) | Must |
| L5 | Gate HUD: gate instruction, progress ring (holds), rep counter, rhythm meter, step breadcrumbs | Must |
| L6 | Delta Glow finger HUD for hand-sign gates | Must |
| L7 | Safety: chair check badge, sway stop screen, camera-disconnected pause | Must |
| L8 | Kind AI coach tip after being stuck (caption always + voice) | Must |
| L9 | Pace-follow: playback slows to 0.75× / 0.5× when learner lags (rep and tempo lessons) | Should |
| L10 | Adaptive tolerance for learning gates (deterministic) | Should |
| L11 | Hands-free control: raise-hand gesture to pause/resume; voice commands on companion ("pause", "repeat", "easier") | Should |
| L12 | Session summary screen (reps, holds, time, gates passed, streak) | Must |
| L13 | Settings: server address, language, caption size, voice on/off, high-contrast mode | Must |
| L14 | Accessibility: captions for every spoken line, high-contrast mode, large text | Must |

### 5.2 Companion (phone/laptop web)
| ID | Feature | Priority |
|---|---|---|
| C1 | Join by QR/room code; camera permission flow with clear explanation | Must |
| C2 | Camera node: MediaPipe Pose + Hands + chair detection, all in-browser | Must |
| C3 | Privacy pill with measured bytes/sec (video 0 KB/s) | Must |
| C4 | Camera placement helper ("Step back until your whole body is in the frame", side-view hint for CPR) | Must |
| C5 | Creator Studio: record demo, auto-gates, edit gates on a timeline, publish | Must |
| C6 | Together mode (guest role) | Should |
| C7 | Progress report page for caregiver/physio (skeleton-only data) | Should |
| C8 | Voice commands via browser speech recognition (if available) | Could |

### 5.3 Platform
| ID | Feature | Priority |
|---|---|---|
| P1 | `.istep` open format + validator + JSON schema | Must |
| P2 | Open-source `vega-gated-video-player` package (MIT) | Must |
| P3 | Coach service (Bedrock) with mock mode, cache, rate limits | Must |
| P4 | Voice tips (Polly) with browser-speech fallback | Should |
| P5 | Optional MCP server: `get_progress_report`, `list_lessons` | Could |

## 6. Non-goals (do not build)

- No medical diagnosis, injury detection or clinical claims.
- No compression-depth measurement for CPR.
- No continuous sign-language translation; only fixed static handshapes per lesson.
- No user accounts with passwords; use simple learner profiles (name + avatar) on the server.
- No Ring camera integration, no NBA/sports drills, no AI-generated reference videos.
- No streaming of learner video anywhere.

## 7. Success criteria (for the demo)

1. A judge understands the idea within the first 15 seconds of the video.
2. The video pauses and resumes on real body input, visibly and reliably (≥ 95% of attempts in rehearsal).
3. The chair safety check and sway stop work live.
4. Delta Glow highlights the correct wrong finger in the sign lesson.
5. A creator records a lesson and it plays on the TV within 60 seconds.
6. Gate decisions feel instant: skeleton-to-TV latency under 150 ms on local Wi-Fi.
