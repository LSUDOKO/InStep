# 06 — Companion Web App (`apps/companion`)

A mobile-first web app (Vite + React + TypeScript), served by the InStep server at `/c/`. Three roles: **Camera node** (learner), **Creator Studio** (instructor), **Reports** (caregiver/physio).

## 1. Routes

| Route | Purpose |
|---|---|
| `/c/?room=1234` | Join a room as camera host (default) |
| `/c/?room=1234&role=guest&name=Tom` | Together mode guest |
| `/c/creator` | Creator Studio (lesson list, new lesson) |
| `/c/creator/:lessonId` | Gate editor |
| `/c/report/:token` | Read-only progress report |

## 2. Camera node

### 2.1 Join flow
1. Enter/scan room code → show what will happen: "Your camera stays on this device. We send only body points (numbers) to your TV." Button **Start camera**.
2. Request camera (`getUserMedia`, 1280×720, user-facing on phones; allow switching front/back).
3. Load MediaPipe models (show progress). Models served from the server's `/models/` (no third-party CDN at runtime; download during build).
4. Send `join` message; show "Connected to TV ✓".

### 2.2 Inference loop
- `@mediapipe/tasks-vision`: `PoseLandmarker` (lite, VIDEO mode), `HandLandmarker` (numHands 2), `ObjectDetector` (EfficientDet-Lite0) — **only the trackers the current lesson requests** (TV sends `lesson_tracking` message). Object detector runs at most 3 fps (chair rarely moves).
- Loop with `requestVideoFrameCallback` (fallback `requestAnimationFrame`); skip a frame if the previous inference is still running.
- Build `landmarks` message (see `07-server-and-aws.md`), quantise to 3 decimals, send ≤ 30/s.
- Local preview: small mirrored camera view with skeleton drawn on top (local only), so the learner can check framing. Option "Hide my camera preview" (privacy / less distraction).

### 2.3 Privacy pill (must be real)
- Wrap the WebSocket `send` in a counter. Show `Video sent: 0 KB/s · Body points: X.X KB/s` updated each second.
- "Video sent" is computed from an explicit counter for any media upload function on this page; there is none on the camera page, so it measures 0. Do not hard-code text.
- Tap the pill → sheet explaining what's sent, with a live JSON sample of one message.

### 2.4 Placement helper
- Uses `camera.view` and checks from the lesson: "Step back until your feet are visible", "Turn the camera to your side for CPR", "Show your hand to the camera".
- Shows a framing silhouette.

### 2.5 Gestures and voice (hands-free)
- **Raise-hand gesture**: wrist above nose for 1.5 s → `control: toggle_pause` (debounce 3 s). Only active when the current gate type does not itself require raising hands (TV sends `gestures_enabled` flag).
- **Voice** (if `SpeechRecognition` available): commands "pause", "play", "repeat", "easier", "next" → `control` messages. Push-to-talk button by default; continuous listening opt-in.
- Haptic feedback (`navigator.vibrate`) on gate pass where supported.

### 2.6 Together mode (guest)
- Same camera node, role `guest`. TV runs a second gate runner for the guest. A gate passes when **both** host and guest pass within a 5 s window. Each person's status shows on the TV with their name.
- Guest can be in another city (over the internet via the public URL), since only landmarks are exchanged.

## 3. Creator Studio

### 3.1 Lesson list
- Cards for creator's lessons (draft/published), **New lesson** button.

### 3.2 New lesson wizard
1. **Details:** title, channel, language, what's needed, camera view (front/side), disclaimer (pre-filled per channel, editable but cannot be emptied for CPR/fall/rehab/sign).
2. **Record:** large **Record demonstration** button; visible red recording indicator and timer; max 60 s. Records video (`MediaRecorder`, MP4/H.264 if supported else WebM) **and** landmarks at 15 fps simultaneously. Or **Upload video** (then landmarks are extracted by running MediaPipe over the uploaded file in the browser).
3. **Upload:** video + reference timeline to `POST /api/lessons/:id/assets`. Server transcodes WebM → H.264 MP4 with ffmpeg if needed (Vega-friendly).
4. **Auto-gates:** propose gates (see 3.3), shown on the timeline.
5. **Edit:** timeline with thumbnails and the reference skeleton; drag gate markers; per gate choose type, label, tolerance, hold seconds / reps / bpm, fallback tip; **Preview gate** lets the creator test it live with their own camera (engine runs in-browser).
6. **Publish:** validates `.istep`; server stores and broadcasts `catalog_updated`.

### 3.3 Auto-gate algorithm (deterministic first, AI second)
1. Compute per-frame joint-angle velocity (deg/s) over joints relevant to the channel (pose joints, or finger curls for sign).
2. Find **still segments**: mean velocity < 20 deg/s for ≥ 0.6 s. The middle of each still segment is a candidate gate time.
3. Merge candidates closer than 2 s; keep at most 8.
4. Default type by channel: fall → `hold_duration` (2–3 s) for stills, `safety_prerequisite` inserted at t≈2 s before the first balance pose (when channel = fall_prevention, always insert); rehab → `rep_count` covering the repeating segment (detect periodicity by autocorrelation of the main metric); sign → `hand_sign` with curl target from the still frame; CPR → `rhythm_bpm`; kids → `pose_match`.
5. **AI step (optional, Bedrock):** send the candidate list as compact JSON (times, joint angle summaries, channel) — **no video, no images** — and ask for short friendly `label` and `fallbackTip` text per gate. Response must be strict JSON validated with zod; on failure keep template labels. Mock mode returns template labels.

## 4. Reports page
- Opened from a share link (`/c/report/:token`). Shows learner name, date range, sessions, adherence (sessions done vs plan), reps over time, holds, gates that needed coaching most, sway stops count. Skeleton-derived numbers only; banner "No video is ever recorded or stored."
- Print-friendly layout.

## 5. UI quality bar
- Mobile-first, large touch targets (≥ 48 px), works in portrait and landscape, dark theme by default matching TV brand (see `09-design-system.md`).
- Every state has a designed screen: loading models, camera denied (with instructions), not secure context (explain HTTPS), disconnected, room not found.

## 6. Acceptance criteria
- Joins a room by QR in < 10 s; first landmarks reach TV within 3 s of camera start.
- Privacy pill shows measured values and video = 0.
- Creator records a 15 s demo, gets ≥ 2 sensible auto-gates, edits one, publishes; lesson plays on TV.
- Together mode: TV waits for both people.
- Works in Chrome (Android, desktop) and Safari (iOS 17+) — document any Safari limitations.
