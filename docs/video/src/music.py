# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""Original score + sound effects + voice-over mix for the film, all synthesised here (no samples, no third-party music).

Warm pad and a soft pluck motif at 96 BPM in D; sections follow the shots in timeline.json: quiet under the problem,
lifts at the logo and again for the channels, settles for the honest close, resolves on the end card. Music ducks 8 dB
under every voice-over line and 12 dB under the TV's own narration (taken from the device recording / lesson video,
loudness-matched to the voice-over). UI ticks on card landings.
Writes docs/video/audio/music.wav (score + effects, before ducking) and mix.wav (final, -16 LUFS, <= -1.5 dBTP).

  uv run docs/video/src/music.py
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
AUD = HERE.parent / 'audio'
TL = json.loads((HERE / 'timeline.json').read_text())
SR = 48000
DUR = TL['duration']
N = int(DUR * SR)
BEAT = 60 / 96
BAR = 4 * BEAT
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, r, shape=2.0):
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na: e[:na] = np.linspace(0, 1, na) ** shape
    if nr: e[n - nr:] *= np.linspace(1, 0, nr) ** shape
    return e


def add(buf, at, x, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= len(buf): return
    x = x[: len(buf) - i]
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], 1) * 1.414
    buf[i:i + len(x)] += x * gain


def pad_chord(notes, dur, bright):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for j, m in enumerate(notes):
        f = midi(m)
        for ch, det in ((0, -0.0025), (1, 0.0025)):
            ph = rng.uniform(0, 6.28)
            s = np.sin(2 * np.pi * f * (1 + det) * t + ph) + bright * np.sin(4 * np.pi * f * (1 + det) * t) + bright * 0.3 * np.sin(6 * np.pi * f * t)
            # slow shimmer
            s *= 1 + 0.08 * np.sin(2 * np.pi * (0.13 + 0.05 * j) * t + ph)
            out[:, ch] += s / len(notes)
    return out * env(n, min(1.6, dur / 2.5), min(1.8, dur / 2.5))[:, None]


def pluck(f, dur=1.4, bright=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    e = np.exp(-t * 4.2) * env(n, 0.004, 0.08, 1)
    return (np.sin(2 * np.pi * f * t) + bright * np.exp(-t * 6) * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 9)) * e


def kick(dur=0.45):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def tick(dur=0.05):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    noise = np.convolve(noise, np.ones(6) / 6, 'same')
    return (0.6 * np.sin(2 * np.pi * 2600 * t) + 0.5 * noise) * np.exp(-t * 120)


def chime(f=midi(86), dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 5) + 0.25 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 3.2) * env(n, 0.003, 0.2, 1)


def swell(dur, f0=200, f1=1200):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    k = 40
    noise = np.convolve(noise, np.ones(k) / k, 'same')
    return noise * (t / dur) ** 2.2 * env(n, 0.01, 0.05)


def score():
    mus = np.zeros((N, 2))
    # chord plan per section: (start, end, chords, level, brightness, pulse, plucks)
    D = [50, 57, 62, 66, 69]          # Dadd9-ish voicing
    Bm = [47, 54, 59, 62, 66]
    G = [43, 55, 59, 62, 69]
    A = [45, 52, 57, 61, 64]
    Em = [40, 52, 59, 62, 67]
    LOOK = {  # shot id -> (chords, level, brightness, pulse, plucks, lift)
        's1': ([D], 0.55, 0.12, False, False, False),
        's2': ([Bm, G, D, A], 0.62, 0.14, False, True, False), 's3': None, 's4': None,
        's5': ([D, G], 0.85, 0.22, False, True, False),
        's6': ([D, Bm, G, A], 0.75, 0.18, True, True, False), 'heel': None, 'safe': None,
        'asl': ([G, D, A, Bm], 0.9, 0.24, True, True, True), 'kids': None, 'more': None,
        's10': ([D, Em, G, A], 0.78, 0.18, True, True, False), 'file': None, 'arch': None,
        'hon': ([Bm, G, D, A], 0.6, 0.14, False, True, False),
        's12': ([D], 0.95, 0.22, False, False, False),
    }
    sections = []  # consecutive shots with the same look share one section so the chords keep moving
    for sh in TL['shots']:
        look = LOOK[sh['id']]
        if look is None:
            s0, _, *rest = sections[-1]; sections[-1] = (s0, sh['end'], *rest)
        else:
            sections.append((sh['start'], sh['end'], *look))
    sections[-1] = (sections[-1][0], DUR, *sections[-1][2:])
    motif = [74, 76, 78, 81, 78, 76, 74, 69]  # D pentatonic, one per 8th, sparse
    for s0, s1, chords, lvl, br, pulse, pl, lift in sections:
        t = s0
        k = 0
        while t < s1 - 0.05:
            d = min(BAR * 2, s1 - t)
            ch = chords[k % len(chords)]
            add(mus, t, pad_chord(ch, d + 1.2, br), 0.22 * lvl)
            add(mus, t, pad_chord([ch[0] - 12], d + 1.2, 0.05), 0.20 * lvl)  # bass
            if pulse:
                for b in range(int(d / BEAT + 1e-6)):
                    if b % 4 in (0, 2):
                        add(mus, t + b * BEAT, kick(), 0.18 * lvl)
            if pl:
                for b in range(int(d / (BEAT / 2) + 1e-6)):
                    if (b + k) % 3 == 0 or (lift and b % 2 == 0):
                        m = motif[(b + 2 * k) % len(motif)] + (12 if lift and b % 4 == 0 else 0)
                        add(mus, t + b * BEAT / 2, pluck(midi(m)), 0.07 * lvl, pan=0.35 * np.sin(b))
            t += d; k += 1
    # lifts: swell into the logo and into the montage, bloom on the end card
    st = {sh['id']: sh['start'] for sh in TL['shots']}
    add(mus, st['s5'] - 1.4, swell(1.4), 0.10)
    add(mus, st['asl'] - 1.2, swell(1.2), 0.08)
    for at, notes in ((st['s5'] + 0.75, [62, 69, 74, 78, 81]), (st['s12'] + 0.3, [50, 62, 69, 74, 78, 81, 86])):
        for j, m in enumerate(notes):
            add(mus, at + j * 0.06, pluck(midi(m), 3.0, 0.3), 0.06, pan=-0.5 + j / len(notes))
    # final fade
    fade = np.ones(N); nf = int(3.5 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 2
    mus *= fade[:, None]
    # intro: rise from silence
    ni = int(1.2 * SR); mus[:ni] *= (np.linspace(0, 1, ni) ** 2)[:, None]
    return mus


def v1_to_film(t):
    """v1 film time -> this film's time, for moments inside shots that are still drawn by their v1 function."""
    for sh in TL['shots']:
        if 'legacy' in sh and sh['legacy'] <= t < sh['legacy'] + sh['end'] - sh['start']:
            return sh['start'] + t - sh['legacy']
    return None


def sfx():
    fx = np.zeros((N, 2))
    st = {sh['id']: sh['start'] for sh in TL['shots']}
    v1 = [13.95, 20.95, 28.45, 36.25, 52.9, 53.3, 62.4, 117.95, 118.2, 118.4, 127.1, 151.75, 151.9, 152.05, 152.2]
    ticks = [x for x in map(v1_to_film, v1) if x is not None]
    ticks += [st['more'] + 0.5 + i * 0.04 for i in range(7)]               # lesson cards fan out
    ticks += [st['file'] + 2.1 + i * 0.32 for i in range(12)]              # file prints, line by line
    for t in ticks:
        add(fx, t, tick(), 0.10, pan=float(rng.uniform(-0.3, 0.3)))
    for t in (0.7, 6.4, 9.55, 11.45):  # remote clicks
        add(fx, t, tick(0.04), 0.16)
    add(fx, st['s5'] + 0.8, chime(midi(81)), 0.05)
    return fx


def tv_line(src, at, dur):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(at), '-t', str(dur), '-i', src, '-vn', '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x * env(len(x), 0.12, 0.25, 1)


def main():
    mus, fx = score(), sfx()
    vo = np.zeros((N, 2))
    duck = np.zeros(N)
    for ln in TL['vo']:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(AUD / f"vo-{ln['id']}.wav"), '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'],
                             capture_output=True, check=True).stdout  # Kokoro writes 24 kHz
        x = np.frombuffer(raw, np.float32).astype(np.float64)
        add(vo, ln['at'], x, 1.0)
        a, b = int((ln['at'] - 0.25) * SR), int((ln['at'] + ln['dur'] + 0.3) * SR)
        duck[max(0, a):b] = 1
    # smooth duck envelope (0.25 s ramps)
    k = int(0.25 * SR)
    cs = np.concatenate([[0], np.cumsum(duck)])
    duck = np.convolve(duck, [1], 'same') if k < 2 else (cs[np.clip(np.arange(N) + k // 2, 0, N)] - cs[np.clip(np.arange(N) - k // 2, 0, N)]) / k
    # the TV's own narration: loudness-matched to the voice-over, music ducked further
    vo_rms = np.sqrt(np.mean(vo[np.abs(vo[:, 0]) > 1e-3, 0] ** 2))
    duck2 = np.zeros(N)
    for ln in TL['tv']:
        x = tv_line(ln['src'], ln['in'], ln['dur'])
        act = x[np.abs(x) > 0.02 * np.abs(x).max()]
        x *= 0.8 * vo_rms / np.sqrt(np.mean(act ** 2))
        add(vo, ln['at'], x, 1.0)
        a, b = int((ln['at'] - 0.2) * SR), int((ln['at'] + ln['dur'] + 0.2) * SR)
        duck2[max(0, a):b] = 1
    cs2 = np.concatenate([[0], np.cumsum(duck2)])
    duck2 = (cs2[np.clip(np.arange(N) + k // 2, 0, N)] - cs2[np.clip(np.arange(N) - k // 2, 0, N)]) / k
    gain = 10 ** ((-8 * duck - 12 * duck2) / 20)
    music = mus * gain[:, None] + fx
    sf.write(AUD / 'music.wav', mus + fx, SR, subtype='FLOAT')
    mix = vo * 0.9 + music * 0.55
    sf.write(AUD / 'mix-raw.wav', mix, SR, subtype='FLOAT')
    # two-pass loudnorm to -16 LUFS, -1.5 dBTP
    m = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(AUD / 'mix-raw.wav'), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(AUD / 'mix-raw.wav'), '-af', af, '-c:a', 'pcm_s24le', str(AUD / 'mix.wav')], check=True)
    (AUD / 'mix-raw.wav').unlink()
    print('[music] mix.wav written; first pass', {k: j[k] for k in ('input_i', 'input_tp')})


if __name__ == '__main__':
    main()
