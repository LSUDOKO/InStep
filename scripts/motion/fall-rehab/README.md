# Fall-prevention and hand-rehab animated demonstrations

Flat, outline-free canvas animations for `fall-heel-raise-v1`, `fall-single-leg-stand-v1` and
`rehab-hand-open-close-v1`. Each move lands on the gate times in that lesson's `track.istep`, looped segments
(`rewindTo` .. `t`) start and end on the same frame, and every frame says "Animated demonstration". Colours come from
`docs/brand/palette.json`.

Re-render (from the repo root; needs uv, ffmpeg and `pnpm install` for the Inter font):

```sh
uv run --with playwright python scripts/motion/fall-rehab/render.py            # all three -> content/lessons/<id>/video.mp4
uv run --with playwright python scripts/motion/fall-rehab/render.py fall-heel-raise-v1 --stills 3,15,36 --out /tmp/frames
node scripts/make-posters.mjs fall-heel-raise-v1                                # poster = a real frame of the new video
node scripts/audio/mux.mjs fall-heel-raise-v1                                  # a render has no sound: put the narration back
```

`kit.js` timing/colour/shape helpers · `room.js` living room and chair · `figure.js` the teacher (kinematics ported
from the earlier pycairo generator; `scripts/make-animated-lesson.py` now forwards here) · `hand.js` table close-up and hand · `lessons.js` timelines · `render.py`
headless Chromium + ffmpeg. Method after the huashu-art-motion skill (MIT, https://github.com/alchaincyf/huashu-art-motion):
style frame first, then animate, then contact sheets and loop-seam checks. No code or art is copied from it.
