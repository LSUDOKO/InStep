#!/usr/bin/env python3
"""
Renders the illustrated lesson videos for The Forest Walk (kids) and the two sign-language lessons.

Method (after the huashu-art-motion skill, MIT): every frame is a pure function of time drawn on a <canvas> by
stage.html; headless Chromium (Playwright) renders frame i at t = i / 25 and pipes the PNG into ffmpeg. Gate times,
labels and the duration come from each lesson's track.istep, colours from docs/brand/palette.json.

  uv run --with playwright python scripts/motion/kids-asl/render.py kids-forest-walk-v1 asl-fingerspell-abc-v1
  uv run --with playwright python scripts/motion/kids-asl/render.py --all
  uv run --with playwright python scripts/motion/kids-asl/render.py asl-i-love-you-v1 --stills 5,7.5 --out /tmp/x

Output: content/lessons/<id>/video.mp4 (1280x720, 25 fps, H.264 main, yuv420p, +faststart). The renderer adds no
sound; if video.mp4 already carries narration from scripts/audio/mux.mjs, that audio track is kept as is.
"""
import argparse
import base64
import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LESSONS = ['kids-forest-walk-v1', 'asl-fingerspell-abc-v1', 'asl-i-love-you-v1']
ASL = {'asl-fingerspell-abc-v1', 'asl-i-love-you-v1'}
FPS = 25
FONT = ROOT / 'apps/companion/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'

ap = argparse.ArgumentParser()
ap.add_argument('lessons', nargs='*')
ap.add_argument('--all', action='store_true')
ap.add_argument('--stills', help='comma-separated seconds: write PNGs to --out instead of a video')
ap.add_argument('--out', help='directory for --stills')
a = ap.parse_args()
ids = LESSONS if a.all else a.lessons
if not ids or any(i not in LESSONS for i in ids):
    ap.error(f'lessons: {" ".join(LESSONS)} (or --all)')

palette = json.loads((ROOT / 'docs/brand/palette.json').read_text())
font = base64.b64encode(FONT.read_bytes()).decode() if FONT.exists() else ''
if not font:
    print(f'[render] Inter not found at {FONT}; run pnpm install. Falling back to a system sans.', file=sys.stderr)


def render(pg, lesson_id):
    d = ROOT / 'content/lessons' / lesson_id
    track = json.loads((d / 'track.istep').read_text())
    dur = float(track['video']['durationSec'])
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.goto((HERE / 'stage.html').as_uri())
    pg.evaluate('async (cfg) => { await window.boot(cfg); }', {'track': track, 'palette': palette, 'font': font})
    grab = "(t) => { window.renderFrame(t); return window.CANVAS.toDataURL('image/png').split(',')[1]; }"
    if a.stills:
        out = Path(a.out or d)
        out.mkdir(parents=True, exist_ok=True)
        for s in a.stills.split(','):
            p = out / f'{lesson_id}-{float(s):05.2f}.png'
            p.write_bytes(base64.b64decode(pg.evaluate(grab, float(s))))
            print('wrote', p)
    else:
        out = d / track['video'].get('src', 'video.mp4')
        tmp = out.with_suffix('.tmp.mp4')
        ff = subprocess.Popen([
            'ffmpeg', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-r', str(FPS), '-i', '-',
            '-vf', 'format=yuv420p', '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', '24',
            '-r', str(FPS), '-an', '-movflags', '+faststart', str(tmp),
        ], stdin=subprocess.PIPE)
        n = int(round(dur * FPS))
        for i in range(n):
            ff.stdin.write(base64.b64decode(pg.evaluate(grab, i / FPS)))
            if i % 250 == 0:
                print(f'[render] {lesson_id} {i}/{n}', file=sys.stderr)
        ff.stdin.close()
        if ff.wait():
            sys.exit('ffmpeg failed')
        # keep narration that scripts/audio/mux.mjs already put in (it copies the video stream and only owns audio)
        has_audio = out.exists() and subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', str(out)],
            capture_output=True, text=True).stdout.strip()
        if has_audio:
            both = out.with_suffix('.av.mp4')
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(tmp), '-i', str(out), '-map', '0:v', '-map', '1:a',
                            '-c', 'copy', '-movflags', '+faststart', str(both)], check=True)
            os.replace(both, tmp)
            print('[render] kept the existing audio track', file=sys.stderr)
        os.replace(tmp, out)
        print('wrote', out, f'{out.stat().st_size / 1e6:.2f} MB')
        if lesson_id in ASL:  # a real (illustrated) video now: posters come from its frames, the lesson is published
            (d / 'video.placeholder').unlink(missing_ok=True)
            (d / 'video.animated').write_text(
                'Animated demonstration from scripts/motion/kids-asl/render.py (illustrated handshapes, not yet '
                'reviewed by Deaf signers). Delete this file when you add a recorded demonstration.\n')
    if errors:
        sys.exit(f'[render] page errors in {lesson_id}: {errors[:3]}')


with sync_playwright() as p:
    browser = p.chromium.launch()
    for lid in ids:
        pg = browser.new_page(viewport={'width': 1280, 'height': 720})
        render(pg, lid)
        pg.close()
    browser.close()
