#!/usr/bin/env python3
"""Render the fall-prevention and hand-rehab animated demonstrations (scene.html) to each lesson's video.mp4.

Headless Chromium draws every frame with window.renderFrame(lesson, t) on a 1280x720 canvas; PNG frames are piped
to ffmpeg (H.264 main, yuv420p, 25 fps, a keyframe every second so the TV's rewind seeks land on one, +faststart,
no audio track). Method after the huashu-art-motion skill (MIT): one style frame first, then animate, then check.

  uv run --with playwright python scripts/motion/fall-rehab/render.py                       # all three lessons
  uv run --with playwright python scripts/motion/fall-rehab/render.py fall-heel-raise-v1
  uv run --with playwright python scripts/motion/fall-rehab/render.py fall-heel-raise-v1 --stills 3,15,34 --out /tmp/f
"""
import argparse, base64, functools, http.server, json, socketserver, subprocess, sys, threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
LESSONS = ['fall-heel-raise-v1', 'fall-single-leg-stand-v1', 'rehab-hand-open-close-v1']
FPS = 25

ap = argparse.ArgumentParser()
ap.add_argument('lessons', nargs='*', default=LESSONS)
ap.add_argument('--stills', help='comma-separated seconds: write PNGs to --out instead of a video')
ap.add_argument('--out', help='directory for --stills')
ap.add_argument('--crf', type=int, default=24)
a = ap.parse_args()


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
errors = []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('console', lambda m: m.type == 'error' and (print('[page]', m.text), errors.append(m.text)))
    pg.on('pageerror', lambda e: (print('[pageerror]', e), errors.append(str(e))))
    pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/scripts/motion/fall-rehab/scene.html')
    pg.wait_for_function('window.__ready === true || !!window.__bootFailed', timeout=60000)
    if pg.evaluate('window.__bootFailed || null'):
        sys.exit('scene failed to load: ' + pg.evaluate('window.__bootFailed'))
    grab = "([l, t]) => { window.renderFrame(l, t); return window.__canvas.toDataURL('image/png').split(',')[1]; }"

    for lesson in a.lessons:
        d = ROOT / 'content/lessons' / lesson
        track = json.loads((d / 'track.istep').read_text())
        dur = float(track['video']['durationSec'])
        if a.stills:
            out = Path(a.out or '.') / lesson
            out.mkdir(parents=True, exist_ok=True)
            for s in a.stills.split(','):
                (out / f't{float(s):06.2f}.png').write_bytes(base64.b64decode(pg.evaluate(grab, [lesson, float(s)])))
            print('stills ->', out)
            continue
        video = d / track['video'].get('src', 'video.mp4')
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'png', '-i', '-',
                               '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', str(a.crf), '-pix_fmt', 'yuv420p',
                               '-g', str(FPS), '-keyint_min', str(FPS), '-sc_threshold', '0', '-movflags', '+faststart', '-an', str(video)],
                              stdin=subprocess.PIPE)
        n = round(dur * FPS)
        for i in range(n):
            ff.stdin.write(base64.b64decode(pg.evaluate(grab, [lesson, i / FPS])))
            if i % 250 == 0:
                print(f'{lesson} {i}/{n}', flush=True)
        ff.stdin.close()
        if ff.wait():
            sys.exit('ffmpeg failed')
        (d / 'video.animated').write_text('Animated demonstration from scripts/motion/fall-rehab/ (render.py; no recorded people). '
                                          'Delete this file when you add a recorded demonstration.\n')
        print('wrote', video, f'({video.stat().st_size // 1024} KB)')
    b.close()
srv.shutdown()
if errors:
    sys.exit(f'{len(errors)} page error(s), see above')
