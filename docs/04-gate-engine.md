# 04 — Gate Engine (`packages/gate-engine`)

Pure TypeScript, no platform imports. Runs on TV (Vega), companion (browser) and Node (tests).

## 1. Public API

```ts
export type Frame = {
  ts: number;                                   // ms, sender clock
  pose?: Landmark[] | null;                     // 33 × {x,y,z,v} normalised 0..1
  hands?: { left?: Landmark[] | null; right?: Landmark[] | null };
  objects?: { label: string; score: number; box: [x: number, y: number, w: number, h: number] }[];
  mirrored: boolean;                            // true if the camera image was mirrored
};

export type GateStatus = 'waiting' | 'progress' | 'passed' | 'blocked_safety' | 'no_person';

export interface GateEval {
  status: GateStatus;
  progress: number;                 // 0..1 (hold %, reps/target, matched frames %, sequence step)
  score: number;                    // 0..1 overall closeness
  jointErrors?: Record<string, number>;   // signed degrees (user − target)
  fingerErrors?: { finger: Finger; delta: number; hint: 'curl' | 'extend' }[];
  worst?: { name: string; hint: string }; // single most important fix (for HUD + coach)
  reps?: number; bpm?: number; holdSec?: number; step?: number;
  message?: string;                 // short HUD text, e.g. "Step into view"
}

export function createGateRunner(gate: Gate, ctx: RunnerContext): GateRunner;
export interface GateRunner { push(frame: Frame): GateEval; reset(): void; readonly state: unknown; }

export function createSafetyMonitor(cfg: SafetyConfig): { push(f: Frame): { stop: boolean; reason?: string } };
export function nextTolerance(base: Tolerance, history: AttemptHistory, learning: boolean): Tolerance;
export function errorBucket(e: GateEval): string;   // stable key for coach cache, e.g. "l_knee:-20..-10"
```

`RunnerContext` = `{ reference?: ReferenceTimeline; affectedHand?: 'left'|'right'; now(): number }`. Inject `now` for deterministic tests.

## 2. Pre-processing (every frame)

1. **Visibility check:** pose required if gate uses pose; average visibility of required landmarks ≥ 0.5, else `no_person` (timers frozen, not reset).
2. **Mirroring:** if `mirrored`, swap left/right landmark indices so "left" always means the learner's left.
3. **Smoothing:** One-Euro filter per landmark coordinate (`minCutoff=1.0, beta=0.02`). Keep filter state per runner.
4. **Normalisation for distances:** divide distances by **torso length** (shoulder-mid to hip-mid). For hands, divide by **palm size** (wrist 0 → middle MCP 9).

## 3. Geometry helpers

- `angle(a, b, c)` → degrees at `b` using 2D (x, y) by default; use 3D when all `z` present and `useZ` flag set (default false — MediaPipe z is noisy).
- Joint triplets (MediaPipe Pose indices):

| Joint | Triplet | | Joint | Triplet |
|---|---|---|---|---|
| `l_shoulder` | 13-11-23 | | `r_shoulder` | 14-12-24 |
| `l_elbow` | 11-13-15 | | `r_elbow` | 12-14-16 |
| `l_hip` | 11-23-25 | | `r_hip` | 12-24-26 |
| `l_knee` | 23-25-27 | | `r_knee` | 24-26-28 |
| `l_ankle` | 25-27-31 | | `r_ankle` | 26-28-32 |
| `torso` | angle of (hip-mid → shoulder-mid) vs vertical (0° = upright) | | `heel_lift` | (heel y − foot-index y) / torso length, per foot |

- **Finger curl** (MediaPipe Hands, 21 landmarks): for each finger, curl = `clamp((180 − meanJointAngle) / 120, 0, 1)` over its two PIP/DIP angles (thumb uses MCP 2-3-4 and CMC 1-2-3 with its own range calibration: `/ 90`). Fingers: thumb (1–4), index (5–8), middle (9–12), ring (13–16), pinky (17–20).
- **Hand openness** = mean distance of fingertips (4, 8, 12, 16, 20) to wrist (0) ÷ palm size, mapped to 0..1 with calibration range [0.9, 2.0].

## 4. Gate algorithms

### 4.1 `pose_match`
- Target angles: from reference frame at `target.atSec` (computed with the same helpers) or explicit `angles`.
- `err_j = userAngle_j − targetAngle_j`; joint OK if `|err_j| ≤ tol.angleDeg`.
- Match frame if all joints OK. **Pass** after `minFrames` consecutive matched frames (default 8).
- `score = 1 − mean(min(|err_j| / (2·tol), 1))`. `worst` = joint with largest `|err|/tol`; hint generated from sign and joint ("bend your left knee less").

### 4.2 `hold_duration`
- Uses `pose_match` per frame. Accumulate time while matched. If not matched for ≤ `graceSec`, **pause** timer; longer → reset to 0. `progress = held / holdSec`. Pass at `held ≥ holdSec`.

### 4.3 `rep_count`
- Compute metric value `m` each frame (smoothed).
- State machine with hysteresis: `LOW` when `m ≤ range.low`, `HIGH` when `m ≥ range.high`. One **quality rep** = LOW → HIGH → LOW (full range). Partial movement (never reaching HIGH) is counted as `partial` (shown, not counted).
- Cadence: rolling average rep duration over last 3 reps → `learnerRepSec`.
- **Pace-follow** (if enabled): TV sets playback rate `1.0` if `learnerRepSec ≤ teacherRepSec·1.25`, `0.75` if ≤ `·1.75`, else `0.5`. Rate changes at most once per 3 s (hysteresis). If the player cannot change rate on Vega (verify), fall back to `loop_segment`.
- Pass at `reps ≥ target`.

### 4.4 `rhythm_bpm`
- Signal: y of wrist midpoint, smoothed; detect peaks with min prominence 0.15·torso length and min distance 0.3 s.
- `bpm` = 60 / median interval of last 6 peaks. Compression counts only if `bpm ∈ [min, max]` **and** both elbows ≥ `armsStraight.minElbowDeg` at the bottom of the press.
- Pass at `count` good compressions. HUD shows live BPM, "faster/slower", arm-lock indicator.
- Note: elbow angle needs a side view; if the camera view isn't `side`, show the placement hint.

### 4.5 `hand_sign`
- Choose hand: `any` = whichever hand has higher detection score; `left/right` respect mirroring.
- `c` = 5 curl values; `delta_i = c_i − target_i`; finger OK if `|delta_i| ≤ tol.curl` (default 0.3).
- `fingerErrors` lists not-OK fingers; `hint = delta > 0 ? 'extend' : 'curl'`. `worst` = largest `|delta|`.
- Optional `spread` check: thumb–index distance ÷ palm size `> 0.6` = "open".
- Pass after `minFrames` consecutive matched frames (default 10).

### 4.6 `sequence_order`
- Run a sub-runner per step in order. Step passes → advance; `stepWindowSec` elapsed without passing the current step → stay on the step (don't fail; coach may trigger). `progress = step / steps.length`.

### 4.7 `safety_prerequisite`
- `object_near`: an object with `label` (COCO "chair"; also accept "couch", "bench" if `allowAlternatives`) and score ≥ `minScore` whose box centre is within `maxDistance` (normalised image units) of the hip midpoint **or** whose box overlaps the learner's hand. Must hold for `minFrames` consecutive frames.
- `full_body_visible`: landmarks 0, 11, 12, 23, 24, 27, 28 visible ≥ 0.5 and inside frame margins (0.02..0.98).
- `stable`: std-dev of hip-midpoint x (÷ torso length) over `windowSec` ≤ `maxLateralSway`.
- All checks must pass simultaneously for `minFrames`. Status while failing: `blocked_safety` with a message per failing check ("I can't see a chair next to you").

## 5. Lesson-wide safety monitor (`swayStop`)

Runs on **every** frame during playback and gates, independent of current gate. Computes lateral sway as in `stable`. If sway > `maxLateralSway` for longer than 0.3 s within `windowSec` → `stop: true, reason: 'sway'`. TV pauses immediately and shows the rest screen. Resuming requires the learner to press OK (or gesture) **and** pass a `stable` check for 2 s. Thresholds come only from the `.istep` file.

## 6. Adaptive tolerance (deterministic, learning gates only)

```
if (!gate.learning) return base;
failedAttempts = attempts on this gate in this session that hit coachAfterSec
recentPasses   = passes of this gate type in last 3 sessions for this learner
factor = 1 + 0.10 * min(failedAttempts, 3)        // loosen up to +30% within a session
       - 0.05 * min(recentPasses, 3)              // tighten up to −15% as skill improves
factor = clamp(factor, 0.85, 1.30)
tolerance = base * factor  (applies to angleDeg and curl; never to safety values or bpm range)
```
TV shows a small "Easier mode" chip when factor > 1.

## 7. Defaults (tune in rehearsal, then freeze)

| Param | Default |
|---|---|
| `angleDeg` | 20 |
| `curl` | 0.3 |
| `minFrames` pose / hand | 8 / 10 |
| `graceSec` | 0.4 |
| `coachAfterSec` | 6 |
| `timeoutSec` | 45 |
| Visibility threshold | 0.5 |

## 8. Required unit tests (vitest)

Create synthetic landmark fixtures with a small builder (`fixtures/makePose({ l_knee: 170, torso: 5 })`, `makeHand({ curl: [0,0,1,1,0] })`). Tests must cover:

1. Angle helper: known triangles (90°, 180°, 45°) ± 0.5°.
2. Mirroring swaps left/right correctly.
3. `pose_match`: passes after exactly `minFrames`; resets on a mismatch; `worst` identifies the right joint and sign.
4. `hold_duration`: grace pause vs reset; passes at exact hold time with injected clock.
5. `rep_count`: counts only full-range reps; ignores partial; hysteresis prevents double counting on jitter; pace-follow rate selection.
6. `rhythm_bpm`: synthetic sine at 110 bpm → bpm 110 ± 3; 80 bpm → not counted; bent elbows → not counted.
7. `hand_sign`: "I love you" target passes; middle finger extended → `fingerErrors` = middle, hint `curl`.
8. `sequence_order`: steps in order pass; out-of-order does not advance.
9. `safety_prerequisite`: no chair → blocked; chair far → blocked; chair near + stable → pass; `learning` cannot be true.
10. Sway monitor triggers on oscillation above limit, not below.
11. Adaptive tolerance: clamps; never applies when `learning=false`.
12. `no_person` freezes timers without resetting.
13. Performance: 10,000 frames evaluated in < 2 s in Node.

Coverage target for this package: **≥ 90% lines**.
