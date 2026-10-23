# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""Original music beds and sound effects, synthesised in code (no samples, no third-party music).

Writes content/lessons/<id>/audio/bed.ogg (one per lesson, the video's length) and sparkle.ogg (lessons that use it).
Styles: calm (fall prevention, rehab), playful (kids), gentle (sign language), none (CPR: the metronome leads).
The bed fades to silence around every gate time t and every rewindTo, so the TV pausing at a gate or seeking back
for a loop never cuts a note, and loop segments join seamlessly.

    uv run scripts/audio/bed.py [lessonId ...]
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
SR = 48000
LEVEL_DB = {'calm': -37.0, 'playful': -35.0, 'gentle': -38.0}  # bed RMS before ducking; voice sits ~-20 dBFS


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def adsr(n, a, r):
    """Attack / release envelope over n samples (seconds a, r)."""
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    e[:na] = np.linspace(0, 1, na) ** 2
    e[n - nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def tone(freq, n, partials=((1, 1.0), (2, 0.18), (3, 0.06)), detune=0.0):
    t = np.arange(n) / SR
    return sum(a * np.sin(2 * np.pi * freq * k * (1 + detune) * t) for k, a in partials)


def pad(chords, seconds_per_chord, dur, octave_shift=0, bright=0.18):
    """Soft stereo pad: each chord a stack of sines, slightly detuned left/right, long attack and release."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    span = seconds_per_chord + 1.5  # overlap into the next chord
    for i in range(int(np.ceil(dur / seconds_per_chord))):
        start = int(i * seconds_per_chord * SR)
        notes = chords[i % len(chords)]
        seg = int(min(span, dur - i * seconds_per_chord) * SR)
        if seg <= 0:
            break
        env = adsr(seg, 1.4, 1.6)
        for j, m in enumerate(notes):
            f = midi(m + 12 * octave_shift)
            p = ((1, 1.0), (2, bright), (3, bright / 3))
            l = tone(f, seg, p, -0.0012)
            r = tone(f, seg, p, 0.0012)
            w = 1.0 if j == 0 else 0.6
            out[start:start + seg, 0] += w * l * env
            out[start:start + seg, 1] += w * r * env
    t = np.arange(n) / SR
    return out * (0.85 + 0.15 * np.sin(2 * np.pi * t / 7.0))[:, None]  # slow breathing swell


def pluck(freq, dur=0.6):
    """Marimba-ish pluck: fundamental + 4th partial, fast exponential decay."""
    t = np.arange(int(dur * SR)) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 30)
    return x * np.exp(-t * 7) * adsr(len(t), 0.004, 0.05)


def calm(dur):
    # F major colour: Fmaj7, Dm9, Bbmaj7, Csus2 — 4 s each
    return pad([[53, 57, 60, 64], [50, 57, 60, 64], [46, 53, 57, 62], [48, 55, 60, 62]], 4.0, dur)


def gentle(dur):
    # higher, slower and sparser: Cmaj7, Am7, Fmaj9 — 6 s each
    return pad([[60, 64, 67, 71], [57, 64, 67, 72], [53, 64, 67, 69]], 6.0, dur, bright=0.08)


def playful(dur):
    """C major pentatonic plucks on an eighth-note grid (100 BPM) over a soft bass; seeded, so reproducible."""
    n = int(dur * SR)
    out = np.zeros((n, 2))
    rng = np.random.default_rng(7)
    eighth = 60 / 100 / 2
    scale = [72, 74, 76, 79, 81, 84]
    bass = [48, 45, 41, 43]  # C, A, F, G, one per bar
    i, prev = 0, 2
    while i * eighth < dur:
        at = int(i * eighth * SR)
        if i % 8 == 0:
            b = tone(midi(bass[(i // 8) % 4]), int(1.9 * SR), ((1, 1.0), (2, 0.3))) * adsr(int(1.9 * SR), 0.02, 1.2)
            seg = b[: n - at]
            out[at:at + len(seg)] += 0.55 * seg[:, None]
        if rng.random() < (0.85 if i % 2 == 0 else 0.4):
            prev = int(np.clip(prev + rng.integers(-2, 3), 0, len(scale) - 1))
            p = pluck(midi(scale[prev]))[: n - at]
            pan = 0.5 + 0.3 * np.sin(i * 0.7)
            out[at:at + len(p), 0] += 0.5 * p * (1 - pan)
            out[at:at + len(p), 1] += 0.5 * p * pan
        i += 1
    return out


def sparkle():
    """A soft rising sparkle: five high bell partials arpeggiated over 0.25 s, decaying in about a second."""
    n = int(1.1 * SR)
    out = np.zeros((n, 2))
    for k, m in enumerate([84, 88, 91, 96, 100]):
        at = int(k * 0.05 * SR)
        t = np.arange(n - at) / SR
        x = (np.sin(2 * np.pi * midi(m) * t) + 0.3 * np.sin(2 * np.pi * midi(m) * 2.76 * t)) * np.exp(-t * 4.5)
        x *= adsr(len(t), 0.003, 0.2)
        pan = 0.3 + 0.1 * k
        out[at:, 0] += x * (1 - pan)
        out[at:, 1] += x * pan
    return out / np.abs(out).max() * 10 ** (-14 / 20)


def gate_dips(dur, times):
    """1 everywhere, falling to 0 just before each time and rising back after it; fades in and out at the ends."""
    t = np.arange(int(dur * SR)) / SR
    g = np.minimum(1.0, np.minimum(t / 1.5, (dur - t) / 2.0)).clip(0, 1)
    for x in times:
        down = np.clip((x - 0.05 - t) / 0.55, 0, 1)  # 1 → 0 over [x-0.6, x-0.05]
        up = np.clip((t - x - 0.05) / 0.95, 0, 1)  # 0 → 1 over [x+0.05, x+1.0]
        g = np.minimum(g, np.where(t < x, down, up))
    return g


def write_ogg(x, path):
    with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
        sf.write(tmp.name, x.astype(np.float32), SR)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp.name, '-c:a', 'libopus', '-b:a', '48k',
                        '-map_metadata', '-1', str(path)], check=True)


def main(ids):
    for f in sorted((ROOT / 'scripts/audio/narration').glob('*.json')):
        lesson = f.stem
        if ids and lesson not in ids:
            continue
        n = json.loads(f.read_text())
        track = json.loads((ROOT / 'content/lessons' / lesson / 'track.istep').read_text())
        dur = float(track['video']['durationSec'])
        out = ROOT / 'content/lessons' / lesson / 'audio'
        out.mkdir(parents=True, exist_ok=True)
        style = n.get('bed', 'none')
        if style in LEVEL_DB:
            x = {'calm': calm, 'gentle': gentle, 'playful': playful}[style](dur)
            x *= 10 ** (LEVEL_DB[style] / 20) / np.sqrt(np.mean(x ** 2))
            times = [g['t'] for g in track['gates']] + [g['rewindTo'] for g in track['gates'] if 'rewindTo' in g]
            write_ogg(x * gate_dips(dur, times)[:, None], out / 'bed.ogg')
            print(f'[bed] {lesson}: {style}, {dur:g}s, dips at {sorted(times)}')
        else:
            (out / 'bed.ogg').unlink(missing_ok=True)
            print(f'[bed] {lesson}: no bed')
        if any(s['name'] == 'sparkle' for s in n.get('sfx', [])):
            write_ogg(sparkle(), out / 'sparkle.ogg')
        else:
            (out / 'sparkle.ogg').unlink(missing_ok=True)


if __name__ == '__main__':
    main(sys.argv[1:])
