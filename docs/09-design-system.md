# 09 — Design System

InStep should feel **calm, warm and trustworthy** — closer to a good physiotherapy clinic than a gym app. Large, legible, generous spacing, very clear state changes.

## 1. Brand

- **Name:** InStep · **Tagline:** "The video that waits for you."
- **Logo idea:** a footprint whose toe curve forms a play-button triangle, or a pause bar becoming a step. Simple flat mark, works at 48 px.
- **Voice:** short, kind, second person. "Nice! Hold it… done." Never blaming ("Wrong!"). Always say what to do next.

## 2. Colour tokens (dark theme default — TV and companion)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0E1116` | App background |
| `surface` | `#171B22` | Cards, panels |
| `surface-2` | `#212733` | Raised, focused card bg |
| `text` | `#F2F4F7` | Primary text |
| `text-muted` | `#A7B0BE` | Secondary text |
| `brand` | `#4FD1C5` | Teal: brand, ghost skeleton, links |
| `focus` | `#FFFFFF` | Focus ring (3 px) + scale |
| `ok` | `#3DDC97` | Matched joints/fingers, pass |
| `near` | `#FFB547` | Amber: close / worst finger glow |
| `far` | `#FF6B6B` | Red: far off, safety block |
| `info` | `#7AA7FF` | Neutral info chips |

**High-contrast mode:** pure black bg, white text, OK = `#00FF7F`, near = `#FFD400`, far = `#FF3B30`, thicker strokes (×1.5). Never rely on colour alone: every state also has an icon/shape (✓, !, ✗) and text.

## 3. Typography

- Font: **Inter** (or Atkinson Hyperlegible for high-legibility mode). Bundle the font files; no runtime font CDN.
- TV scale (1080p): Display 72/80 · H1 56/64 · H2 40/48 · Body 32/40 · Caption 28/36 (minimum on TV). Caption size setting multiplies by 1.0 / 1.25 / 1.5.
- Companion scale: H1 28 · Body 17 · Small 14 (min).

## 4. Layout (TV, 10-foot rules)

- Safe area: 5% margins (96 px horizontal, 54 px vertical) at 1920×1080.
- Grid: 12 columns, 24 px gutters. Cards 384×216 (16:9) with title below.
- Focus: focused element scales 1.06, white 3 px ring, `surface-2` bg, subtle shadow; transition 150 ms (disabled with reduce-motion).
- One primary action per screen, focused by default.
- No text over busy video without a scrim (`rgba(0,0,0,0.55)`).

## 5. Skeleton and overlay styles

| Element | Style |
|---|---|
| Ghost (instructor) skeleton | `brand` teal, 6 px dashed (12/8), 70% opacity, joints 10 px hollow circles |
| Learner skeleton | 8 px solid, per-limb colour `ok`/`near`/`far`, joints 12 px filled; unused joints grey `#5B6575` |
| Worst joint | pulsing ring (1 Hz) + label chip ("Left knee: bend less") |
| Delta Glow hand | 2.5× scale hand diagram; finger bones as rounded bars; correct = `ok` glow; worst = `near` pulsing glow + arrow (↓ curl, ↑ extend); others not OK = `near` steady |
| Lock-in (pass) | whole-screen edge glow `ok` 400 ms + ✓ badge + soft chime |
| Safety block | `far` border on learner panel + checklist with ✗/✓ icons |
| Progress ring | 120 px ring, 10 px stroke, `ok` fill, centre shows seconds left |
| Rep counter | big numerals (Display), partial reps in `text-muted` "+2 partial" |
| BPM meter | horizontal band; target zone 100–120 shaded `ok`; needle = current BPM; metronome dot pulses at 110 bpm |

## 6. Motion and sound

- Durations 150–400 ms, ease-out. Reduce-motion setting removes scale/pulse (uses static highlights).
- Sounds: pass chime, gentle "tick" for each rep, metronome click for CPR. All original, short, quiet, mutable. Never use sound as the only feedback.

## 7. Iconography and illustrations

- Line icons (e.g., Lucide, MIT) bundled locally.
- Camera placement illustrations: simple flat drawings (front view at hip height 2–3 m; side view for CPR; hand close-up for sign/rehab).
- Channel colours (accents only): Fall `#4FD1C5`, Rehab `#7AA7FF`, Sign `#C08BFF`, CPR `#FF6B6B`, Kids `#FFB547`.

## 8. Copy guidelines

- Gate labels: imperative, ≤ 6 words ("Rise onto your toes").
- Tips: ≤ 20 words, one action.
- Errors: what happened + what to do ("Camera disconnected. Open the InStep page on your phone again.").
- Avoid medical language; avoid "patient" in UI (use "you").

## 9. Accessibility checklist

- Contrast ≥ 4.5:1 for text (≥ 7:1 in high-contrast mode).
- Every audio cue has visual equivalent; captions on by default.
- All interactions reachable by D-pad; focus order logical.
- Companion: screen-reader labels on all controls; works with large text settings.
- Sign channel works fully with sound off.
