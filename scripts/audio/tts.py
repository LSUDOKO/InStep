# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx==0.4.9", "soundfile", "numpy"]
# ///
"""Renders each narration line with Kokoro-82M (Apache-2.0), locally, into content/lessons/<id>/audio/v-<hash>.ogg.

Free and offline after the first model download (~326 MB, kept in ~/.cache/instep-tts, never in the repo).
Clips already rendered for the same voice + speed + text are skipped, so re-running is cheap. Clips no longer used
by the lesson's narration are deleted.

    uv run scripts/audio/tts.py [lessonId ...]
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
NARRATION = ROOT / 'scripts/audio/narration'
CACHE = Path(os.environ.get('INSTEP_TTS_DIR', Path.home() / '.cache/instep-tts'))
RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
MODEL = {  # file -> sha256 (verified on download)
    'kokoro-v1.0.onnx': '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5',
    'voices-v1.0.bin': 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
}


def clip_name(voice: str, speed: float, text: str) -> str:
    """Same hash as scripts/audio/mux.mjs (clipName)."""
    return 'v-' + hashlib.sha1(f'{voice}|{speed:g}|{text}'.encode()).hexdigest()[:12] + '.ogg'


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def ensure_model() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, digest in MODEL.items():
        p = CACHE / name
        if not p.exists():
            print(f'[tts] downloading {name} to {CACHE}')
            urllib.request.urlretrieve(RELEASE + name, p.with_suffix('.part'))
            p.with_suffix('.part').rename(p)
        if sha256(p) != digest:
            sys.exit(f'[tts] checksum mismatch for {p}; delete it and re-run')


def trim(x: np.ndarray, sr: int) -> np.ndarray:
    """Cut the model's leading/trailing silence so a clip's length is its speech, plus 30 ms of air each side."""
    loud = np.flatnonzero(np.abs(x) > 0.01)
    if loud.size == 0:
        return x
    pad = int(0.03 * sr)
    return x[max(0, loud[0] - pad): loud[-1] + pad]


def main(ids: list[str]) -> None:
    ensure_model()
    from kokoro_onnx import Kokoro

    tts = Kokoro(str(CACHE / 'kokoro-v1.0.onnx'), str(CACHE / 'voices-v1.0.bin'))
    files = sorted(NARRATION.glob('*.json'))
    for f in files:
        lesson = f.stem
        if ids and lesson not in ids:
            continue
        n = json.loads(f.read_text())
        out = ROOT / 'content/lessons' / lesson / 'audio'
        out.mkdir(parents=True, exist_ok=True)
        keep = set()
        for line in n['lines']:
            voice, speed = line.get('voice', n['voice']), line.get('speed', n['speed'])
            name = clip_name(voice, speed, line['text'])
            keep.add(name)
            if (out / name).exists():
                continue
            samples, sr = tts.create(line['text'], voice=voice, speed=speed, lang='en-us')
            x = trim(np.asarray(samples, dtype=np.float32), sr)
            with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
                sf.write(tmp.name, x, sr)
                subprocess.run(
                    ['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp.name, '-ac', '1', '-c:a', 'libopus',
                     '-b:a', '48k', '-map_metadata', '-1', str(out / name)],
                    check=True,
                )
            print(f'[tts] {lesson} {len(x) / sr:5.2f}s  {line["text"]}')
        for old in out.glob('v-*.ogg'):
            if old.name not in keep:
                old.unlink()
    print('[tts] done')


if __name__ == '__main__':
    main(sys.argv[1:])
