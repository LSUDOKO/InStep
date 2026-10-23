# Demo film generator

Rebuild `docs/video/instep-demo.mp4` (and `captions.srt`) from code, locally, at no cost:

```sh
uv run docs/video/src/vo.py                                   # voice-over (Kokoro-82M af_heart) -> audio/vo-*.wav
python3 docs/video/src/timeline.py                            # timings, footage slots -> timeline.json, captions.srt
uv run docs/video/src/music.py                                # original score + effects + VO mix -> audio/mix.wav (-16 LUFS)
uv run --with playwright python docs/video/src/render.py      # frames (film.html/film.js) -> instep-demo.mp4
uv run --with playwright python docs/video/src/web_shots.py   # only to refresh the source-page screenshots
```

`render.py heel kids` re-renders only those shots; `--stills 14.5,47 --out DIR` writes single frames. TV footage comes
from the Vega Virtual Device recordings in `~/instep-capture/film/` (Blue Hour design: `boot.mp4`, `launcher.webm`,
`heel-raise.webm`, `asl.webm`, `kids.webm`) and the lesson videos in `content/lessons/*/video.mp4`; shots, reels, VO
and TV-narration lines are set in `timeline.py`. The architecture section renders `docs/architecture/system-diagram.html`.
Footage frames and segments are cached in `docs/video/.cache/` (git-ignored). The script and honesty rules are in
`../script.md`.
