#!/usr/bin/env python3
"""One timeline for picture, sound and captions: docs/video/src/timeline.json + docs/video/captions.srt.

Shot boundaries and voice-over start times are set here; line lengths come from audio/durations.json (vo.py).
Footage slots map a name to (source file, in-point, length); a newer device capture wins over the older one.

  python3 docs/video/src/timeline.py
"""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
HOME = Path.home() / 'instep-capture'
FPS = 30
END = 161.0

SHOTS = [  # id, start (s)
    ('s1', 0.0), ('s2', 6.4), ('s3', 13.4), ('s4', 35.6), ('s5', 44.2), ('s6', 52.0), ('s7', 68.0),
    ('s8', 88.0), ('s9', 98.6), ('s10', 117.5), ('s11', 130.5), ('s12', 150.0),
]
VO_AT = {
    's2': 6.9, 's3a': 14.0, 's3b': 20.6, 's3c': 28.1, 's4a': 36.2, 's4b': 41.0, 's5': 47.6,
    's6a': 52.8, 's6b': 59.0, 's7a': 69.0, 's7b': 77.0, 's8': 88.6, 's9a': 99.4, 's9b': 110.4,
    's10a': 118.1, 's10b': 123.4, 's11a': 131.4, 's11b': 136.4, 's11c': 142.7, 's12': 151.8,
}
# slot: list of candidates (first existing wins): (file, in, dur)
CLIPS = {
    'launcher': [(HOME / 'film/launcher.webm', 3.0, 40.0)],
    'heel':     [(HOME / 'film/heel-raise.webm', 55.0, 22.0), (HOME / 'fall-heel-raise.webm', 104.0, 22.0)],
    'chair':    [(HOME / 'film/heel-raise.webm', 30.0, 6.0)],
    'lost':     [(HOME / 'fall-heel-raise.webm', 44.0, 5.0)],
    'asl':      [(HOME / 'film/asl.webm', 88.0, 8.0), (HOME / 'asl-fingerspell-abc.webm', 61.0, 8.0)],
    'rehab':    [(HOME / 'rehab-hand-open-close.webm', 33.0, 8.0)],
    'cpr':      [(HOME / 'cpr-rhythm.webm', 37.0, 8.0)],
    'kids':     [(HOME / 'kids-forest-walk.webm', 53.0, 8.0)],
    'together': [],
    'fall':     [(HOME / 'film/heel-raise.webm', 64.0, 8.0), (HOME / 'fall-heel-raise.webm', 108.0, 8.0)],
}


def clips():
    out = {}
    for slot, cands in CLIPS.items():
        for f, at, dur in cands:
            if f.exists():
                out[slot] = {'src': str(f), 'in': at, 'dur': dur, 'new': '/film/' in str(f)}
                break
    return out


def chunks(text, limit=80):
    """Split a line into caption chunks at punctuation, each <= limit chars where possible."""
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
    vo = json.loads((HERE / 'vo.json').read_text())
    dur = json.loads((VIDEO / 'audio/durations.json').read_text())
    lines, caps = [], []
    for ln in vo['lines']:
        at, d = VO_AT[ln['id']], dur[ln['id']]['dur']
        lines.append({'id': ln['id'], 'at': at, 'dur': d, 'text': ln['text']})
        cs = chunks(ln['text'])
        total = sum(len(c) for c in cs)
        t = at
        for c in cs:
            span = d * len(c) / total
            caps.append({'a': round(t, 3), 'b': round(t + span + 0.15, 3), 'text': c})
            t += span
    lines.sort(key=lambda x: x['at'])
    for a, b in zip(lines, lines[1:]):
        assert a['at'] + a['dur'] + 0.2 <= b['at'], f"VO overlap: {a['id']} ends {a['at'] + a['dur']:.2f} > {b['id']} {b['at']}"
    assert lines[-1]['at'] + lines[-1]['dur'] < END - 3
    for a, b in zip(caps, caps[1:]):  # no two captions on screen at once
        a['b'] = min(a['b'], b['a'])
    shots = [{'id': s, 'start': t, 'end': (SHOTS[i + 1][1] if i + 1 < len(SHOTS) else END)} for i, (s, t) in enumerate(SHOTS)]
    for ln in lines:  # every line sits inside its shot
        sh = next(s for s in shots if s['id'] == re.sub(r'[abc]$', '', ln['id']))
        assert sh['start'] <= ln['at'] and ln['at'] + ln['dur'] <= sh['end'] + 0.01, ln['id']
    tl = {'fps': FPS, 'duration': END, 'width': 1920, 'height': 1080, 'shots': shots, 'vo': lines, 'captions': caps,
          'clips': clips()}
    (HERE / 'timeline.json').write_text(json.dumps(tl, indent=1))
    (VIDEO / 'captions.srt').write_text(''.join(f"{i + 1}\n{srt_time(c['a'])} --> {srt_time(c['b'])}\n{c['text']}\n\n"
                                                for i, c in enumerate(caps)))
    speech = sum(l['dur'] for l in lines)
    words = sum(len(l['text'].split()) for l in lines)
    print(f'[timeline] {END:.1f}s, {len(shots)} shots, {len(lines)} lines, {speech:.1f}s speech, {words} words, '
          f'{60 * words / END:.0f} wpm overall; clips: {", ".join(f"{k}{"*" if v["new"] else ""}" for k, v in tl["clips"].items())}')


if __name__ == '__main__':
    main()
