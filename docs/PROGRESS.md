# Progress log

Newest first. Each entry: what works, what doesn't, what changed from the spec and why.

## 2026-10-21 — Repo setup + Milestone 1 (packages)

**Works**

- Monorepo (pnpm 11 workspaces), TypeScript strict, ESLint + Prettier, vitest, GitHub Actions CI.
- `@instep/istep-format`: zod schema (source of truth), JSON Schema export, `istep validate` CLI, 7 example
  tracks, 5 crafted invalid files. All examples pass; all invalid files fail with JSON-path errors
  (e.g. `gates[0].learning: safety_prerequisite gates can never be learning gates`).
- `@instep/gate-engine`: all 7 gate types, One-Euro smoothing, mirroring, visibility/`no_person` freeze,
  lesson-wide sway monitor with 2 s resume check, deterministic adaptive tolerance, error buckets, pace-follow,
  reference-timeline interpolation, synthetic fixtures (`makePose`, `makeHand`). All 13 required test groups
  pass; line coverage ≈ 98% (target ≥ 90%). 10,000 frames evaluate well under 2 s.
- `@instep/protocol`: zod schemas for every WebSocket message and REST body, landmark quantisation and
  `toFrame` conversion. Pose-only and hands-only landmark messages are ≤ 1.5 KB.

**Changes from the spec (and why)**

| Change | Why |
| --- | --- |
| Added `rep_count` metric `heel_lift` | docs/08 uses it for heel raises; docs/03's metric list lacked it. |
| Added pose `conditions` (`heel_lift`, `foot_lift`) to `pose_match` / `hold_duration` / steps | Heel raises and single-leg stands are not visible as joint angles from a front camera. |
| Added safety checks `upper_body_visible`, `hands_visible` | The CPR placement check (side view) can't be expressed with `full_body_visible`. |
| Added `handScores` to frames / `landmarks` messages | `hand: "any"` must pick the hand with the higher detection score. |
| Disclaimer required (non-empty) for fall, rehab, sign and CPR channels in the validator | Mirrors AGENTS.md §3 and Creator Studio rules. |
| Rhythm peak prominence 0.05 × torso (spec 0.15) and a faster smoothing filter for rhythm gates | Real compressions on a cushion move the wrists ~0.1 torso lengths; 0.15 would miss them. To be re-tuned in rehearsal. |
| Runner timing uses frame timestamps (sender clock) instead of an injected `now()` | Equally deterministic in tests and immune to relay jitter. |
| Added `joined`, `speak`, `lesson_ended` WS messages and a relay-set `from` field | Needed for guest routing in Together mode and companion speech fallback. |
| `control` action `ok` | Remote/companion OK is required to resume after a sway stop. |

**Not yet done:** Milestone 0 (Vega spike) — waiting for the Vega SDK in an Ubuntu 24.04 distrobox on the
developer machine (Arch Linux is not an officially supported host).
