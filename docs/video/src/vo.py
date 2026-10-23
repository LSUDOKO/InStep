# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx==0.4.9", "soundfile", "numpy"]
# ///
"""Film voice-over: docs/video/src/vo.json -> docs/video/audio/vo-<id>.wav (Kokoro-82M, local, af_heart) + durations.json.

Model files come from scripts/audio/tts.py's cache (~/.cache/instep-tts). Lines whose text is unchanged are skipped.
  uv run docs/video/src/vo.py
"""
import json, os, sys
from pathlib import Path
import numpy as np, soundfile as sf

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'scripts/audio'))
from tts import CACHE, ensure_model, trim  # noqa: E402

SRC = Path(__file__).with_name('vo.json')
OUT = ROOT / 'docs/video/audio'

def main():
    ensure_model()
    from kokoro_onnx import Kokoro
    tts = Kokoro(str(CACHE / 'kokoro-v1.0.onnx'), str(CACHE / 'voices-v1.0.bin'))
    cfg = json.loads(SRC.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    meta_p = OUT / 'durations.json'
    meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
    for ln in cfg['lines']:
        say = ln.get('say', ln['text']); speed = ln.get('speed', cfg['speed'])
        key = f"{cfg['voice']}|{speed}|{say}"
        p = OUT / f"vo-{ln['id']}.wav"
        if p.exists() and meta.get(ln['id'], {}).get('key') == key:
            continue
        s, sr = tts.create(say, voice=ln.get('voice', cfg['voice']), speed=speed, lang='en-us')
        x = trim(np.asarray(s, dtype=np.float32), sr)
        sf.write(p, x, sr)
        meta[ln['id']] = {'key': key, 'dur': round(len(x) / sr, 3), 'sr': sr}
        print(f"[vo] {ln['id']:5s} {len(x)/sr:5.2f}s {ln['text']}")
    meta_p.write_text(json.dumps(meta, indent=1))
    print('[vo] total', round(sum(m['dur'] for m in meta.values()), 2), 's')

if __name__ == '__main__':
    main()
