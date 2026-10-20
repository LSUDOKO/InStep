# 03 — The `.istep` Open Format (v1.0)

`.istep` ("InStep track") is a JSON sidecar file that attaches **body-aware gates** to any video, the way WebVTT attaches captions. A player that understands `.istep` pauses the video at each gate and resumes when the gate's condition is met by live landmark data.

- File extension: `.istep` · MIME type: `application/vnd.instep+json` · Encoding: UTF-8 JSON.
- Implemented in `packages/istep-format` as a **zod** schema (source of truth), exported to JSON Schema (`schema/istep-1.0.schema.json`) for other languages.
- Validator CLI: `npx istep validate path/to/track.istep` (prints errors with JSON paths).

## 1. Top-level structure

```jsonc
{
  "istep": "1.0",
  "id": "fall-heel-raise-v1",
  "title": "Heel raises (with chair)",
  "channel": "fall_prevention",          // fall_prevention | stroke_rehab | sign_language | cpr | kids
  "language": "en-US",
  "video": { "src": "video.mp4", "durationSec": 48.0 },
  "tracking": ["pose"],                   // any of: "pose", "hands", "objects"
  "camera": { "view": "front", "hint": "Place the camera at hip height, 2–3 m away." },
  "disclaimer": "Use exercises prescribed or approved by your physiotherapist. Stop if you feel pain, dizziness or unsteadiness.",
  "reference": { "src": "reference.json" }, // instructor landmark timeline (optional but recommended)
  "safety": {                               // lesson-wide monitors, active the whole lesson
    "swayStop": { "enabled": true, "maxLateralSway": 0.06, "windowSec": 1.5 }
  },
  "defaults": { "tolerance": { "angleDeg": 20 }, "coachAfterSec": 6, "timeoutSec": 45 },
  "gates": [ /* Gate objects, sorted by t */ ],
  "credits": { "creator": "Dr. A. Chen, PT", "license": "CC-BY-4.0" }
}
```

## 2. Common gate fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Unique within file |
| `t` | number (sec) | yes | Video time where playback pauses |
| `type` | enum | yes | One of the 7 gate types below |
| `label` | string | yes | Short instruction shown on TV ("Rise onto your toes") |
| `learning` | boolean | no (default `true`) | If `false`, tolerance never adapts. **Forced `false` for `safety_prerequisite`.** |
| `tolerance` | object | no | Overrides defaults (`angleDeg`, `curl`, `bpm` …) |
| `coachAfterSec` | number | no | Seconds stuck before coach tip |
| `timeoutSec` | number | no | After this, offer "Skip step" / "Easier" (never auto-skip safety gates) |
| `fallbackTip` | string | yes | Tip used when AI is unavailable |
| `rewindTo` | number (sec) | no | On "Repeat step", seek here (usually the movement start) |
| `then` | enum | no | `resume` (default) or `loop_segment` (`[rewindTo, t]` loops while waiting) |

## 3. Gate types

### 3.1 `pose_match`
```json
{ "id": "g2", "t": 12.4, "type": "pose_match", "label": "Rise onto your toes",
  "target": { "source": "reference", "atSec": 12.4 },
  "joints": ["l_knee", "r_knee", "l_ankle", "r_ankle", "torso"],
  "tolerance": { "angleDeg": 18 }, "minFrames": 8,
  "fallbackTip": "Push up through the balls of your feet and keep your knees soft." }
```
`target.source` is `"reference"` (take angles from the reference timeline at `atSec`) or `"angles"` with an explicit map: `{ "source": "angles", "angles": { "l_knee": 175, "torso": 90 } }`.

### 3.2 `hold_duration`
Same as `pose_match` plus `"holdSec": 3` and `"graceSec": 0.4` (brief wobble shorter than grace pauses the timer instead of resetting it).

### 3.3 `rep_count`
```json
{ "id": "g1", "t": 6.0, "type": "rep_count", "label": "Open and close your hand",
  "metric": { "kind": "hand_openness", "hand": "affected" },
  "range": { "low": 0.25, "high": 0.75 }, "reps": 20,
  "paceFollow": { "enabled": true, "teacherRepSec": 2.0 },
  "fallbackTip": "Open your fingers as wide as you comfortably can, then make a soft fist." }
```
`metric.kind`: `joint_angle` (with `joint`), `hand_openness`, `wrist_rotation`, `vertical_position` (with `landmark`). `hand`: `left` | `right` | `affected` (from learner profile) | `any`.

### 3.4 `rhythm_bpm`
```json
{ "id": "g1", "t": 9.0, "type": "rhythm_bpm", "label": "Push hard and fast — follow the beat",
  "signal": { "landmark": "wrists_mid", "axis": "y" },
  "bpm": { "min": 100, "max": 120 }, "count": 30,
  "armsStraight": { "minElbowDeg": 160 },
  "metronomeBpm": 110,
  "fallbackTip": "Lock your elbows and let your shoulders do the work." }
```

### 3.5 `hand_sign`
```json
{ "id": "g1", "t": 7.5, "type": "hand_sign", "label": "Sign: I love you",
  "hand": "any",
  "target": { "curl": [0.0, 0.0, 1.0, 1.0, 0.0], "spread": { "thumb_index": "open" } },
  "tolerance": { "curl": 0.3 }, "minFrames": 10,
  "fallbackTip": "Fold your middle and ring fingers down; keep thumb, index and little finger up." }
```
`curl` order is **[thumb, index, middle, ring, pinky]**, 0 = fully extended, 1 = fully curled. Optional `target.source: "reference"` reads the curl vector from the reference timeline.

### 3.6 `sequence_order`
```json
{ "id": "g3", "t": 20.0, "type": "sequence_order", "label": "Spell: C-A-B",
  "steps": [ { "type": "hand_sign", "target": { "curl": [0.4,0.5,0.5,0.5,0.5] }, "label": "C" },
             { "type": "hand_sign", "target": { "curl": [0.0,1,1,1,1] }, "label": "A" },
             { "type": "hand_sign", "target": { "curl": [0.7,0,0,0,0] }, "label": "B" } ],
  "stepWindowSec": 6,
  "fallbackTip": "Take it one letter at a time — hold each shape for a moment." }
```
Steps reuse the schema of `pose_match` / `hand_sign` without `id`/`t`.

### 3.7 `safety_prerequisite`
```json
{ "id": "g0", "t": 3.0, "type": "safety_prerequisite", "label": "Stand next to a sturdy chair",
  "checks": [ { "kind": "object_near", "object": "chair", "near": "hips", "maxDistance": 0.35, "minScore": 0.5 },
              { "kind": "full_body_visible" },
              { "kind": "stable", "maxLateralSway": 0.04, "windowSec": 1.0 } ],
  "minFrames": 15,
  "fallbackTip": "Place a sturdy chair beside you and rest one hand on its back." }
```
`learning` is always `false`. Values are never changed at runtime.

## 4. Reference timeline (`reference.json`)

Produced by Creator Studio from the instructor's demonstration.
```jsonc
{ "fps": 15, "tracking": ["pose","hands"],
  "frames": [ { "t": 0.0,
                "pose": [[x,y,z,vis], ... 33],        // normalised, 3 decimals
                "hands": { "left": [[x,y,z], ... 21] | null, "right": ... } } ] }
```
The TV uses it to draw the ghost skeleton (interpolated at video time) and to compute `pose_match` targets.

## 5. Landmark naming

Joint names map to MediaPipe indices in `packages/gate-engine/src/landmarks.ts`. Angle joints are defined as triplets, e.g. `l_knee = (l_hip 23, l_knee 25, l_ankle 27)`, `l_elbow = (11, 13, 15)`, `torso = angle of shoulder-mid→hip-mid vs vertical`. Full table is in `04-gate-engine.md`.

## 6. Versioning and validation rules

- `istep` must equal `"1.0"`; unknown top-level fields are allowed (ignored) for forward compatibility; unknown gate `type` is a validation error.
- `gates` must be sorted by `t`, unique `id`, `0 ≤ t ≤ video.durationSec`.
- `safety_prerequisite.learning` must be absent or `false`.
- Channel `cpr` must include a `disclaimer` containing "does not measure compression depth".

## 7. Example files to ship

Ship these in `packages/istep-format/examples/` and in `content/lessons/`:
- `fall-heel-raise.istep`, `fall-single-leg-stand.istep`
- `rehab-hand-open-close.istep`
- `asl-i-love-you.istep`, `asl-fingerspell-abc.istep`
- `cpr-rhythm.istep`
- `kids-forest-walk.istep`
