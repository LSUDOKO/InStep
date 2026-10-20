# 08 — Channels and Content

All demo content must be **original, recorded by you or consenting people**, with written permission noted in `content/CREDITS.md`. No third-party footage, no AI-generated people as references, no copyrighted music (use silence or your own simple chime/beat files).

## 1. Recording guidelines (all lessons)

- 1080p, 30 fps, landscape, steady tripod/shelf, plain background, good front lighting, full body (or hands) in frame.
- Instructor wears clothes contrasting with the background.
- Speak or caption each step. Add burned-in captions OR a `.vtt` caption file.
- Each movement: demonstrate, then **pause still for ~1 s** at the key position (this helps auto-gates).
- Keep each lesson 30–90 s for the demo.
- Export H.264 MP4, AAC audio.

## 2. Fall Prevention (hero)

**Creator:** ideally a physiotherapist; if not available, you, and label lessons "Demonstration lesson — use exercises approved by your physiotherapist."

| Lesson | Gates |
|---|---|
| **Heel raises (with chair)** | `safety_prerequisite` (chair near + full body + stable) → `pose_match` "stand tall, hand on chair" → `rep_count` heel raises ×5 (metric `vertical_position` of heels or `heel_lift`) → `hold_duration` final rise 2 s |
| **Single-leg stand (with chair)** | `safety_prerequisite` → `hold_duration` "lift one foot slightly, hold 5 s" (knee angle target) → swap legs `hold_duration` 5 s |

- Lesson-wide `swayStop` enabled with a conservative limit; rehearse to make sure normal standing doesn't trigger it, deliberate swaying does.
- Progression labels: Level 1 two hands on chair, Level 2 one hand, Level 3 fingertip. (Level shown in UI; physio chooses.)
- Disclaimer on detail screen and summary.

## 3. Stroke Hand Rehab

| Lesson | Gates |
|---|---|
| **Open and close your hand** | `rep_count` hand_openness ×20, `affected` hand, pace-follow on |
| **Wrist turns** (optional) | `rep_count` wrist_rotation ×10 |

- Celebrate milestones (5, 10, 20) with a large counter animation. Summary shows quality reps vs partial.
- Disclaimer as for fall prevention.

## 4. Sign Language for Families (hero)

**Respect and accuracy rules:**
- Reference videos are recorded by a **Deaf or fluent signer** with consent and credit. If you can't find one before the deadline, record yourself carefully, label "Practice demo — reviewed by: (name or 'not yet reviewed')", and say so honestly in the submission.
- Use **ASL** consistently (or another sign language, but label it clearly).
- Static handshapes only for v1. Movement-based signs are a stated future step.
- Never claim the app "teaches sign language" alone; it's a **practice aid**. Disclaimer (from `AGENTS.md`) shown on detail screen.

| Lesson | Gates |
|---|---|
| **Your first sign: I love you** | `hand_sign` ILY (thumb, index, pinky extended; middle, ring curled) |
| **Fingerspelling: A B C L Y** | `hand_sign` per letter, then `sequence_order` "spell CAB" |

- Delta Glow must be the main feedback; audio optional.
- Together mode demo: parent + child (or two adults) sign together; gate passes when both lock in.
- Calibrate curl targets from the signer's own reference (`target.source: "reference"`); hand-written values in `03-istep-format.md` are only examples.

## 5. CPR Practice (light)

| Lesson | Gates |
|---|---|
| **Hands-only CPR rhythm** | `safety_prerequisite`-style placement check (side view, hands visible) → `rhythm_bpm` 30 compressions at 100–120 bpm with straight arms |

- Practise on a firm cushion on the floor; never on a person.
- Disclaimer always visible on screen during the lesson (small banner).
- Metronome beat: generate a simple click track (no copyrighted music).

## 6. Kids' Active Storytime (light)

| Lesson | Gates |
|---|---|
| **The Forest Walk** | `pose_match` "Stretch tall like a tree" (arms up) → `pose_match` "Crouch small like a mouse" → `hold_duration` "Stand on one foot like a flamingo" 2 s (generous tolerance) → `pose_match` "Wave goodbye" |

- Use simple illustrated slides or your own puppet/drawing video with narration. Bright colours, celebratory star burst on pass.
- Tolerances generous (`angleDeg` 30).

## 7. Content checklist

- [ ] All videos original with consent forms noted in `CREDITS.md`
- [ ] Each lesson has `lesson.json`, `track.istep` (valid), `reference.json`, `video.mp4`, `poster.jpg` (1280×720)
- [ ] Disclaimers present for fall, rehab, sign, CPR
- [ ] Captions for every spoken instruction
- [ ] Each gate rehearsed 10× with ≥ 9 passes when done correctly and ≤ 1 pass when done wrong
