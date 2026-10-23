#!/usr/bin/env python3
"""Render the InStep demo film: footage frames -> per-shot H.264 segments (parallel Chromium) -> concat -> mux.

  python3 docs/video/src/timeline.py                                   # timings + captions.srt
  uv run --with playwright python docs/video/src/render.py             # all shots, then mux with audio/mix.wav
  uv run --with playwright python docs/video/src/render.py s7 s9       # re-render only these shots, then mux
  uv run --with playwright python docs/video/src/render.py --stills 14.5,47.2 --out /tmp/x   # single frames

Footage frames and segments live in docs/video/.cache/ (git-ignored). Needs ffmpeg and Playwright's Chromium.
"""
import argparse, base64, functools, hashlib, http.server, json, os, socketserver, subprocess, sys, threading
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
VIDEO = HERE.parent
CACHE = VIDEO / '.cache'
TL = json.loads((HERE / 'timeline.json').read_text())
FPS = TL['fps']


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def extract_clips():
    for slot, c in TL['clips'].items():
        d = CACHE / 'clips' / slot
        key = f"{c['src']}|{c['in']}|{c['dur']}|{os.path.getmtime(c['src'])}"
        if (d / 'key').exists() and (d / 'key').read_text() == key:
            continue
        d.mkdir(parents=True, exist_ok=True)
        for f in d.glob('*.jpg'):
            f.unlink()
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(c['in']), '-t', str(c['dur']), '-i', c['src'],
                        '-vf', f'fps={FPS},scale=1280:720:flags=lanczos', '-q:v', '3', str(d / '%05d.jpg')], check=True)
        (d / 'key').write_text(key)
        print(f'[clips] {slot}: {len(list(d.glob("*.jpg")))} frames from {Path(c["src"]).name} @{c["in"]}s')


def arch_frames(port):
    """docs/architecture/architecture.html via its window.seek(t), one frame per film frame of shot s11."""
    from playwright.sync_api import sync_playwright
    src = ROOT / 'docs/architecture/architecture.html'
    d = CACHE / 'arch'
    sh = next(s for s in TL['shots'] if s['id'] == 's11')
    n = round((sh['end'] - sh['start'] + 0.6) * FPS)
    key = f'{os.path.getmtime(src)}|{n}'
    if (d / 'key').exists() and (d / 'key').read_text() == key:
        return
    d.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1920, 'height': 1080})
        pg.goto(f'http://127.0.0.1:{port}/docs/architecture/architecture.html?t=0')
        pg.wait_for_function('typeof window.seek === "function"')
        pg.evaluate('document.fonts.ready')
        for i in range(n):
            pg.evaluate('t => window.seek(t)', i / FPS)
            pg.screenshot(path=str(d / f'{i + 1:05d}.jpg'), type='jpeg', quality=92)
        b.close()
    (d / 'key').write_text(key)
    print(f'[arch] {n} frames')


def render_range(args):
    """Render frames [f0, f1) to out (mp4) in its own process; returns an error string or None."""
    try:
        return _render_range(*args)
    except Exception as e:  # e.g. a crashed tab: reported and retried by main()
        return f'{type(e).__name__}: {e}'


def _render_range(port, f0, f1, out):
    from playwright.sync_api import sync_playwright
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1920, 'height': 1080})
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/docs/video/src/film.html')
        pg.wait_for_function('window.__ready === true || !!window.__bootFailed', timeout=60000)
        if pg.evaluate('window.__bootFailed || null'):
            return f'boot failed: {pg.evaluate("window.__bootFailed")}'
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                               '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                               '-g', str(FPS * 2), '-r', str(FPS), str(out)], stdin=subprocess.PIPE)
        for f in range(f0, f1):
            ff.stdin.write(base64.b64decode(pg.evaluate('t => window.seek(t)', f / FPS)))
        ff.stdin.close()
        rc = ff.wait()
        b.close()
    if rc:
        return f'ffmpeg failed for {out}'
    return '; '.join(errors[:3]) if errors else None


def segments():
    out = []
    for s in TL['shots']:
        f0, f1 = round(s['start'] * FPS), round(s['end'] * FPS)
        out.append((s['id'], f0, f1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('shots', nargs='*')
    ap.add_argument('--stills')
    ap.add_argument('--out', default=str(CACHE / 'stills'))
    ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--no-mux', action='store_true')
    a = ap.parse_args()
    srv = serve()
    port = srv.server_address[1]
    extract_clips()
    arch_frames(port)
    if a.stills:
        from playwright.sync_api import sync_playwright
        od = Path(a.out); od.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={'width': 1920, 'height': 1080})
            pg.on('pageerror', lambda e: print('[pageerror]', e))
            pg.on('console', lambda m: m.type == 'error' and print('[page]', m.text))
            pg.goto(f'http://127.0.0.1:{port}/docs/video/src/film.html')
            pg.wait_for_function('window.__ready === true || !!window.__bootFailed', timeout=60000)
            if pg.evaluate('window.__bootFailed || null'):
                sys.exit(pg.evaluate('window.__bootFailed'))
            for s in a.stills.split(','):
                (od / f't{float(s):07.2f}.jpg').write_bytes(base64.b64decode(pg.evaluate('t => window.seek(t)', float(s))))
            b.close()
        print('[stills] ->', od)
        return
    seg_dir = CACHE / 'seg'
    seg_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    for sid, f0, f1 in segments():
        if a.shots and sid not in a.shots and (seg_dir / f'{sid}.mp4').exists():
            continue
        # split long shots into chunks so all cores work
        step = 150
        parts = [(f, min(f + step, f1)) for f in range(f0, f1, step)]
        for k, (p0, p1) in enumerate(parts):
            jobs.append((sid, k, len(parts), (port, p0, p1, str(seg_dir / f'{sid}.{k:02d}.mp4'))))
    print(f'[render] {len(jobs)} chunks on {a.jobs} workers')
    with ProcessPoolExecutor(a.jobs) as ex:
        res = list(ex.map(render_range, [j[3] for j in jobs]))
    for k, (j, r) in enumerate(zip(jobs, res)):  # retry crashed chunks one at a time
        if r and not r.startswith('boot') and not Path(j[3][3]).with_suffix('.ok').exists():
            print('[render] retry', j[0], j[1], ':', r[:120])
            res[k] = render_range(j[3])
    bad = [(j[0], r) for j, r in zip(jobs, res) if r]
    for sid, r in bad:
        print('[render] problem in', sid, ':', r)
    done = sorted({j[0] for j in jobs})
    for sid in done:  # join chunks of each re-rendered shot
        parts = sorted(seg_dir.glob(f'{sid}.[0-9][0-9].mp4'))
        lst = seg_dir / f'{sid}.txt'
        lst.write_text(''.join(f"file '{p.name}'\n" for p in parts))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(seg_dir / f'{sid}.mp4')], check=True)
        for p in parts:
            p.unlink()
    lst = seg_dir / 'all.txt'
    lst.write_text(''.join(f"file '{sid}.mp4'\n" for sid, _, _ in segments()))
    pic = CACHE / 'picture.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(pic)], check=True)
    print('[render] picture ->', pic)
    if not a.no_mux:
        mux(pic)
    if bad:
        sys.exit(1)


def mux(pic):
    mix = VIDEO / 'audio/mix.wav'
    out = VIDEO / 'instep-demo.mp4'
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(pic)]
    if mix.exists():
        cmd += ['-i', str(mix), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest']
    cmd += ['-c:v', 'copy', '-movflags', '+faststart', str(out)]
    subprocess.run(cmd, check=True)
    print('[mux] ->', out, f'{out.stat().st_size / 1e6:.1f} MB', '(with audio)' if mix.exists() else '(no audio yet)')


if __name__ == '__main__':
    main()
