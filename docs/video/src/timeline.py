#!/usr/bin/env python3
"""One timeline for picture, sound and captions: docs/video/src/timeline.json + docs/video/captions.srt.

Shots are (id, length, legacy start). A shot with a legacy start is drawn by its v1 function, which still uses v1 film
times: film.js passes it t - start + legacy. Voice-over lines sit at (shot, offset); lengths come from
audio/durations.json (vo.py). Reels are the footage a shot plays, in order: (source, in-point, length[, 'full']).
TV lines are the TV's own narration, taken from the device recording (or the lesson video for full-frame inserts) and
mixed by music.py with the film voice paused.

  python3 docs/video/src/timeline.py
"""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
ROOT = HERE.parents[2]
CAP = Path.home() / 'instep-capture'
FILM = CAP / 'film'
LES = ROOT / 'content/lessons'
FPS = 30

BOOT = FILM / 'boot.mp4'  # real Vega Virtual Device boot -> launcher -> InStep, recorded by the lead agent
OPEN = [  # opening cuts on boot.mp4: (film from, film to, recording in-point, speed)
    (0.9, 4.3, 6.6, 1), (4.3, 5.5, 12.8, 1), (5.5, 6.7, 18.8, 1), (6.7, 7.9, 20.0, 1),
    (7.9, 9.7, 99.0, 6), (9.7, 11.6, 120.8, 1), (11.6, 14.0, 124.5, 1),
]

SHOTS = [  # id, length (s), v1 start (shots drawn by their v1 function)
    ('s1', 14.0, None), ('s2', 7.0, 6.4), ('s3', 22.2, 13.4), ('s4', 8.6, 35.6), ('s5', 7.8, 44.2),
    ('s6', 16.8, 52.0), ('heel', 35.0, None), ('safe', 11.0, None), ('asl', 18.6, None), ('kids', 19.9, None),
    ('more', 13.8, None), ('s10', 13.0, 117.5), ('file', 10.8, None), ('arch', 22.5, None), ('hon', 12.4, None),
    ('s12', 11.0, 150.0),
]
VO = {  # line id: (shot, offset)
    's2': ('s2', 0.5), 's3a': ('s3', 0.6), 's3b': ('s3', 7.2), 's3c': ('s3', 14.7), 's4a': ('s4', 0.6), 's4b': ('s4', 5.4),
    's5': ('s5', 3.4), 'cam_a': ('s6', 0.8), 'cam_b': ('s6', 8.1), 'heel_a': ('heel', 0.3), 'heel_b': ('heel', 21.0),
    'safe': ('safe', 0.5), 'asl_a': ('asl', 0.2), 'asl_b': ('asl', 9.5), 'kids_a': ('kids', 0.35), 'kids_b': ('kids', 9.3),
    'more_a': ('more', 0.5), 'more_b': ('more', 8.6), 's10a': ('s10', 0.6), 's10b': ('s10', 5.9), 'file': ('file', 0.6),
    'arch_a': ('arch', 0.6), 's11b': ('arch', 8.2), 's11c': ('arch', 16.7), 'hon': ('hon', 0.8), 's12': ('s12', 1.8),
}
NOCAP = {'s2', 's4b', 's5', 's12'}  # said word for word by the kinetic type on screen: no burned-in caption
REELS = {
    's1': [(BOOT, i, round((b - a) * r, 3)) for a, b, i, r in OPEN],
    'heel': [(FILM / 'heel-raise.webm', 35.6, 11.5), (FILM / 'heel-raise.webm', 47.6, 7.0), (FILM / 'heel-raise.webm', 60.0, 12.0),
             (FILM / 'heel-raise.webm', 120.5, 4.5)],
    'safe': [(FILM / 'heel-raise.webm', 30.4, 5.4), (FILM / 'kids.webm', 105.6, 5.6)],
    'asl': [(FILM / 'launcher.webm', 46.0, 3.0), (FILM / 'asl.webm', 35.7, 6.0), (FILM / 'asl.webm', 55.2, 9.6)],
    'kids': [(FILM / 'kids.webm', 12.6, 3.0), (FILM / 'kids.webm', 86.0, 10.6), (LES / 'kids-forest-walk-v1/video.mp4', 19.3, 6.3, 'full')],
    'more': [(LES / 'rehab-hand-open-close-v1/video.mp4', 2.0, 8.4), (LES / 'cpr-rhythm-v1/video.mp4', 1.0, 8.4),
             (FILM / 'heel-raise.webm', 7.0, 2.9)],
}
OTHER = {  # extra slots used by v1 shots
    'heel': (FILM / 'heel-raise.webm', 55.0, 22.0),        # s6 TV
    'launcher': (FILM / 'launcher.webm', 3.0, 40.0),       # s10 "published to the TV"
}
TV = [  # (shot, offset, source, in, length, caption at (offset, until), text): the TV's own narration
    ('heel', 11.5, FILM / 'heel-raise.webm', 47.6, 7.0, 11.9, 18.3, 'Up, and down.'),
    ('asl', 4.7, FILM / 'asl.webm', 37.4, 4.3, 4.95, 8.8, 'Letter A. A fist, thumb resting at the side.'),
    ('kids', 3.6, FILM / 'kids.webm', 86.6, 5.8, 4.3, 8.9, 'Look at the tall trees. Stretch up tall like a tree!'),
    ('kids', 13.6, LES / 'kids-forest-walk-v1/video.mp4', 19.3, 6.3, 14.2, 17.4, 'Here’s a flamingo. Can you stand on one foot?'),
]
TV_EXTRA_CAPS = [('kids', 18.8, 19.85, 'Amazing balancing!')]


def chunks(text, limit=80):
    parts = re.split(r'(?<=[,.:;?])\s+', text)
    out, cur = [], ''
    for p in parts:
        if cur and len(cur) >= 24 and len(cur) + 1 + len(p) > limit:
            out.append(cur); cur = p
        else:
            cur = (cur + ' ' + p).strip()
    if cur:
        out.append(cur)
    return out


def srt_time(t):
    ms = round(t * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def main():
    shots, t = [], 0.0
    for sid, ln, legacy in SHOTS:
        shots.append({'id': sid, 'start': round(t, 3), 'end': round(t + ln, 3), **({'legacy': legacy} if legacy is not None else {})})
        t += ln
    END = round(t, 3)
    at = {s['id']: s['start'] for s in shots}
    vo = json.loads((HERE / 'vo.json').read_text())
    dur = json.loads((VIDEO / 'audio/durations.json').read_text())
    lines, caps = [], []
    for ln in vo['lines']:
        sh, off = VO[ln['id']]
        a, d = at[sh] + off, dur[ln['id']]['dur']
        lines.append({'id': ln['id'], 'shot': sh, 'at': round(a, 3), 'dur': d, 'text': ln['text']})
        cs = chunks(ln['text'])
        total = sum(len(c) for c in cs)
        tt = a
        for c in cs:
            span = d * len(c) / total
            caps.append({'a': round(tt, 3), 'b': round(tt + span + 0.15, 3), 'text': c, 'burn': ln['id'] not in NOCAP})
            tt += span
    tv = []
    for sh, off, src, i, d, ca, cb, text in TV:
        tv.append({'at': round(at[sh] + off, 3), 'src': str(src), 'in': i, 'dur': d})
        caps.append({'a': round(at[sh] + ca, 3), 'b': round(at[sh] + cb, 3), 'text': text, 'tv': True, 'burn': True})
    for sh, ca, cb, text in TV_EXTRA_CAPS:
        caps.append({'a': round(at[sh] + ca, 3), 'b': round(at[sh] + cb, 3), 'text': text, 'tv': True, 'burn': True})
    lines.sort(key=lambda x: x['at']); caps.sort(key=lambda c: c['a'])
    for a, b in zip(lines, lines[1:]):
        assert a['at'] + a['dur'] + 0.2 <= b['at'], f"VO overlap: {a['id']} ends {a['at'] + a['dur']:.2f} > {b['id']} {b['at']}"
    for ln in lines:  # every line sits inside its shot; no TV line under a VO line
        sh = next(s for s in shots if s['id'] == ln['shot'])
        assert sh['start'] <= ln['at'] and ln['at'] + ln['dur'] <= sh['end'] + 0.01, (ln['id'], ln['at'] + ln['dur'], sh['end'])
        for c in caps:
            if c.get('tv'):
                assert not (c['a'] < ln['at'] + ln['dur'] - 0.1 and ln['at'] < c['b']), f"TV caption {c['text']!r} under VO {ln['id']}"
    for a, b in zip(caps, caps[1:]):  # one caption at a time
        assert a['b'] <= b['a'] + 0.35, (a['text'], b['text'])
        a['b'] = min(a['b'], b['a'])
    clips = {}
    for sid, reel in REELS.items():
        for k, r in enumerate(reel):
            src, i, d = r[0], r[1], r[2]
            assert Path(src).exists(), src
            clips[f'{sid}{k}'] = {'src': str(src), 'in': i, 'dur': round(d, 3), 'full': len(r) > 3 and r[3] == 'full'}
    for slot, (src, i, d) in OTHER.items():
        clips[slot] = {'src': str(src), 'in': i, 'dur': d, 'full': False}
    tl = {'fps': FPS, 'duration': END, 'width': 1920, 'height': 1080, 'shots': shots, 'vo': lines, 'tv': tv,
          'captions': caps, 'clips': clips, 'archFrames': round((dict((x[0], x[1]) for x in SHOTS)['arch'] + 0.6) * FPS), 'open': [[a, b, r] for a, b, _, r in OPEN]}
    (HERE / 'timeline.json').write_text(json.dumps(tl, indent=1))
    srt = [c for c in caps]
    (VIDEO / 'captions.srt').write_text(''.join(f"{i + 1}\n{srt_time(c['a'])} --> {srt_time(c['b'])}\n{'TV: ' if c.get('tv') else ''}{c['text']}\n\n"
                                                for i, c in enumerate(srt)))
    speech = sum(l['dur'] for l in lines)
    words = sum(len(l['text'].split()) for l in lines)
    print(f'[timeline] {END:.1f}s, {len(shots)} shots, {len(lines)} lines, {speech:.1f}s speech, {words} words; '
          f'opening: {BOOT.name}')
    for s in shots:
        print(f"  {s['id']:5s} {s['start']:6.1f} - {s['end']:6.1f}")


if __name__ == '__main__':
    main()
