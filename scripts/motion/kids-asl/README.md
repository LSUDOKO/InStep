# Illustrated lessons: The Forest Walk and the two sign-language lessons

Re-render (needs `uv`, `ffmpeg`, `pnpm install` for the Inter font; Playwright's Chromium on first run:
`uv run --with playwright playwright install chromium`):

```sh
uv run --with playwright python scripts/motion/kids-asl/render.py --all            # all three videos
uv run --with playwright python scripts/motion/kids-asl/render.py asl-i-love-you-v1 --stills 4.5,7.5 --out /tmp/x
node scripts/make-posters.mjs <lessonId>                                           # poster from the new frames
```

`stage.html` draws each frame on a canvas as a pure function of `t` (`kit.js` shapes, `hand.js` 3D hand, `asl.js`,
`kids.js`); `render.py` steps it in headless Chromium and pipes PNGs to ffmpeg (1280x720, 25 fps, H.264 main, no added
sound; an audio track already muxed by `scripts/audio/mux.mjs` is kept). Gate times come from each `track.istep`, colours
from `docs/brand/palette.json`. Method after the huashu-art-motion skill (MIT, github.com/alchaincyf/huashu-art-motion);
no code or art from it is copied.
