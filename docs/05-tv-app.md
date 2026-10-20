# 05 — TV App (`apps/tv`, Vega OS)

## 1. Starting point

- Scaffold from **`react-native-multi-tv-app-sample`** (most complete: drawer nav, content grid, hero, video player). If its player is limited on Vega, port the player setup from **`vega-video-sample`** (W3C media player, focus management).
- Use the **Amazon Devices Builder Tools** MCP/Agent Skills in your coding assistant to scaffold, profile and debug.
- Keep the starter's focus/navigation library and patterns. Do not introduce a second focus system.
- Target: Vega Virtual Device at 1920×1080. Design to the 10-foot UI rules in `09-design-system.md`.

## 2. Screens and navigation

```
Splash → (first run) Welcome + Server check → Profile picker → Home
Home ─┬─ Channel row × 5 ─► Lesson detail ─► Pair camera ─► Camera check ─► Lesson player ─► Session summary
      ├─ Continue (last lesson)                                   │
      ├─ My progress                                              └─► Sway rest screen / Camera lost screen
      └─ Settings (drawer)
```

### 2.1 Splash / Server check
- Logo + tagline "The video that waits for you". Pings `GET /api/health`. Fail → retry screen showing server URL, button "Open Settings".

### 2.2 Profile picker
- Large avatar tiles (max 6) + "Add profile" (name via on-screen keyboard, avatar choice, affected hand for rehab: left/right/none). Stored on server (`/api/profiles`).

### 2.3 Home
- Hero banner (rotating): one hero per hero channel with short tagline.
- 5 rows, one per channel, with lesson cards (poster, title, duration, gate count, difficulty dots, "New" badge for Creator Studio uploads).
- "Continue" row if a session is unfinished. "My progress" tile.
- Live update: when the server broadcasts `catalog_updated`, refresh rows (Creator Studio publish shows up without restart).

### 2.4 Lesson detail
- Poster, title, creator credit, what you'll need ("A sturdy chair", "A firm cushion"), camera placement illustration, disclaimer text (required), gates list preview, buttons: **Start**, **Practice with family (Together)**.

### 2.5 Pair camera
- Big QR code + 4-digit room code + short URL. Text: "Open this on your phone or laptop. Your camera stays on your device — only body points are shared."
- Shows connected devices as they join (Host ✓, Guest ✓). Auto-advance when host connected.

### 2.6 Camera check
- Live learner skeleton on dark background, checklist from `.istep` `camera.hint` + `full_body_visible` / hand visible. "Looks good!" → countdown 3-2-1 → player.

### 2.7 Lesson player (core)
Layout (1920×1080):
```
┌───────────────────────────────────────────────┬──────────────────────┐
│                                               │  Learner panel       │
│        Lesson video (16:9, ~1280×720)         │  (skeleton on dark   │
│        + ghost skeleton overlay (optional)    │   bg, 560×720)       │
│                                               │  + Delta Glow hand   │
├───────────────────────────────────────────────┴──────────────────────┤
│  Gate HUD: [icon] "Rise onto your toes"   ◯ progress   reps 7/20      │
│  Coach caption (when present)                        ● Camera  ● Privacy│
└────────────────────────────────────────────────────────────────────────┘
```
- **Two overlay modes** (Settings): *Side-by-side* (default, above) and *Overlay* (learner skeleton drawn over video). Side-by-side is the fallback if overlay over video is slow on Vega.
- **Ghost skeleton**: instructor reference (dashed, cyan) drawn in the learner panel aligned to the learner's hip-midpoint and torso scale, so the learner sees where to move.
- **Learner skeleton**: solid; each limb coloured by its joint error (green OK, amber close, red far). Joints not used by the gate are neutral grey.
- **Delta Glow** (hand_sign gates): enlarged hand diagram; correct fingers green, worst finger pulsing amber with an arrow (↓ curl / ↑ extend); a full-screen edge glow when the sign locks in. Must work with sound off.
- **HUD widgets per gate type:** progress ring (hold), rep counter + partial count + pace chip ("Slowed to 0.75×"), BPM meter with target band + metronome pulse + arm-lock icon, step breadcrumbs (sequence), safety checklist (prerequisite).
- **Pass feedback:** green flash + short chime + checkmark; then resume. Kids channel: confetti/star burst.
- **Coach tip:** after `coachAfterSec` stuck, caption box slides up with the tip (always visible text) and plays audio if voice is on.
- **Remote controls:** Play/Pause = pause/resume (never bypasses a gate); Left = repeat step (`rewindTo`); Right = skip step (only after `timeoutSec`, and never for safety gates); Back = exit with confirm; Menu = easier/harder options.
- **Hands-free:** companion sends `control` messages (raise-hand-for-1.5s gesture = pause/resume; voice commands). TV treats them like remote keys.

### 2.8 Safety screens
- **Sway stop:** full-screen calm overlay, "Let's sit down and rest." Resume only with OK/gesture **and** 2 s stable check.
- **Camera lost:** auto-pause, room code shown, resumes automatically when frames return (with 3-2-1).
- **Safety gate blocked:** checklist with ✗/✓ per check and a picture of the expected setup.

### 2.9 Session summary
- Time, gates passed, reps, best hold, BPM average, "Easier mode used" flag, streak, encouraging line. Button "Share with my physio/family" (creates report link, shown as QR). Posts `POST /api/sessions`.

### 2.10 My progress
- Last 14 days: sessions per day bars, total reps, holds. Simple, large.

### 2.11 Settings
- Server URL, language (en-US default; plus es-ES, hi-IN, fr-FR for coach/voice), caption size (M/L/XL), voice on/off, overlay mode, high-contrast mode, reduce motion, about/licenses.

## 3. Player implementation (`packages/gated-player`)

`<GatedPlayer>` wraps the platform video component and owns gate timing.

```tsx
<GatedPlayer
  source={{ uri }}
  track={istep}                         // validated IstepTrack
  reference={referenceTimeline}
  frames$={frameStream}                 // subscribe(cb) → unsubscribe
  onGateEvent={(e) => ...}              // gate_start | gate_progress | gate_passed | gate_stuck | safety_stop
  onEnd={(summary) => ...}
  renderOverlay={(state) => <Hud ... />}
  options={{ overlayMode, paceFollow: true, coach: coachClient }}
/>
```

Rules:
- Poll current time (or use time-update events) every ≤ 100 ms; when `currentTime ≥ gate.t − 0.05`, call `pause()` and `seek(gate.t)` to land exactly.
- While paused on a gate, feed every frame into the gate runner; render latest eval only (use a ref + `requestAnimationFrame`-style throttle to ~20–30 fps; never queue).
- `loop_segment`: while waiting, seek to `rewindTo` and play to `t` repeatedly (muted after first loop).
- On pass: emit `gate_passed`, short delay 400 ms for feedback, `play()`.
- Safety monitor runs during playback too; on stop → pause + safety screen.
- No frames for 2 s → camera-lost pause.
- All timers use injected clock for testing.
- The component must be usable outside InStep (no InStep server dependency). This is the open-source package.

## 4. State management

- Lightweight store (Zustand or React context + reducer). Slices: `connection`, `profile`, `catalog`, `lesson`, `player`, `settings`.
- WebSocket client with auto-reconnect (exponential backoff 0.5 s → 5 s), heartbeat ping every 10 s.

## 5. Acceptance criteria (TV)

- Fully operable with the remote (no touch, no mouse). Visible focus on every focusable element.
- Heel-raise lesson: pauses at each gate, resumes only when the learner passes; chair gate blocks without a chair.
- Sign lesson: Delta Glow identifies the wrong finger; works with sound muted.
- Camera lost and sway stop behave as specified.
- Creator Studio publish appears in Home within 5 s without restart.
- No layout overflow at 1080p; text ≥ 28 px.
