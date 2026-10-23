# Lesson audio: narration, music bed, sound effects

Every lesson video gets a warm spoken coach, a quiet original music bed and a few soft effects. It's all made
locally at no cost: no cloud TTS, no AWS, no stock music.

```
scripts/audio/narration/<lessonId>.json   what is said, and when (seconds into the video)
scripts/audio/tts.py                      narration lines -> content/lessons/<id>/audio/v-<hash>.ogg (Kokoro, local)
scripts/audio/bed.py                      music bed + sparkle -> content/lessons/<id>/audio/bed.ogg, sparkle.ogg
scripts/audio/mux.mjs                     stems + video.mp4 -> video.mp4 with sound (Node + ffmpeg only)
```

## Re-mux after a video is re-rendered

The stems are committed, so you only need Node and ffmpeg:

```sh
node scripts/audio/mux.mjs                 # every lesson
node scripts/audio/mux.mjs kids-forest-walk-v1
node scripts/audio/mux.mjs --check         # print the timing-contract table only
```

`mux.mjs` keeps only the video stream (`-c:v copy`, so the picture and its duration never change) and drops any
existing audio. It then mixes:

- the narration clips at their times;
- the bed, ducked under the voice;
- the effects.

The mix is loudness-normalised to about -16 LUFS, held under -1.5 dBTP, and encoded as AAC 128k stereo 48 kHz with
`+faststart`. The result goes to a temp file next to `video.mp4`, which replaces `video.mp4` only if `video.mp4` did
not change during the mux. Re-running gives the same result, so run it again whenever a video is re-rendered.

## Change what is said

1. Edit `narration/<lessonId>.json`. Each line has `at` (start, in seconds) and `text`. A line can override the
   lesson's `voice` or `speed`.
2. Run `uv run scripts/audio/tts.py <lessonId>`. It renders only new or changed lines and removes clips that are no
   longer used.
3. Run `node scripts/audio/mux.mjs <lessonId>`. It refuses to mux if the timing contract below is broken.

The first `tts.py` run downloads the model into `~/.cache/instep-tts` (about 326 MB, checked against its sha256).
Set `INSTEP_TTS_DIR` to put it elsewhere. Model files never go in the repo. Rendering every line from scratch takes about 3
minutes on a laptop CPU.

To change the music, edit `bed.py` and run `uv run scripts/audio/bed.py [lessonId]`.

## Timing contract (the TV pauses at every gate `t`)

- **Before the gate:** a line ends at least **0.3 s before the next gate's `t`**. It never straddles a `t`. If it
  did, the TV would freeze it mid-word while waiting for the learner.
- **Rewind points:** no line straddles a `rewindTo`. Otherwise its tail would replay on every loop.
- **Loop segments:** a loop segment (`rewindTo` to `t`) plays twice with sound, once as a demonstration and once as
  the first loop of the gate, and then muted. Lines inside it repeat cleanly:
  - heel raises: "Up," and "and down." on each 2 s rep;
  - hand: "Close," and "and open.".
- **Instructions and praise:** instructions come just before their gate. Praise starts just after `t`, so it is heard
  only once the learner has actually passed.
- **Music bed:** the bed fades to silence around every `t` and `rewindTo`. Pausing or seeking never cuts a note, and
  loop seams are silent.
- **Kids' sparkles:** each sparkle lands at `t + 0.4`, the moment the video's star burst starts after a pass.

`mux.mjs --check` prints every line's end time against the next gate and exits non-zero on a violation.

## Content rules

- **Coaching only.** Lines are coaching cues, never diagnoses, and contain no statistics.
- **Fall prevention and rehab:** the safety line "Stop if you feel pain, dizziness or unsteadiness." is spoken once.
  The full disclaimer stays on screen.
- **CPR:** no counting, so the companion's metronome leads, and no music. The closing line repeats that this is
  rhythm practice and points to a certified course.
- **Sign language:** the spoken cues only add to what is on the card. Every lesson works fully with the sound off.
- **Volume:** the bed sits about 10–14 LU under the voice.

## Model and licences

| Part                   | What                                                                                                                       | Licence                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Voice model            | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0 by hexgrad. Voices `af_heart` (coach), `af_bella` (kids)      | Apache-2.0                 |
| Runtime                | [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) 0.4.9, with the model files from its `model-files-v1.0` release | MIT                        |
| Phonemes (render only) | espeak-ng via phonemizer-fork and espeakng-loader. Used on the developer's machine, not in the repo or the apps            | GPL-3.0                    |
| Music bed, sparkle     | Original, synthesised by `bed.py` (sine pads and plucks, no samples)                                                       | CC-BY-4.0 (as the lessons) |

The narration is a synthetic voice, not a person. See `content/CREDITS.md`.
