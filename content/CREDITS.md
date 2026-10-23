# Content credits and consent

Every person who appears in a demo lesson must give written permission before the video is committed.

| Lesson                        | Performer / creator                                                                                                                            | Reviewed by                      | Consent on file                                                    | License        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ | -------------- |
| The Forest Walk (kids)        | Animated story: an illustrated child and forest animals, no real person, drawn in code by `scripts/motion/kids-asl/`                           | —                                | n/a (no people)                                                    | CC-BY-4.0      |
| Heel raises (with chair)      | Animated demonstration: illustrated character, no real person, drawn in code by `scripts/motion/fall-rehab/`                                   | —                                | n/a (no people)                                                    | CC-BY-4.0      |
| Single-leg stand (with chair) | Animated demonstration: illustrated character, no real person, `scripts/motion/fall-rehab/`                                                    | —                                | n/a (no people)                                                    | CC-BY-4.0      |
| Open and close your hand      | Animated demonstration: an illustrated hand, no real person, `scripts/motion/fall-rehab/`                                                      | —                                | n/a (no people)                                                    | CC-BY-4.0      |
| Hands-only CPR rhythm         | Stock footage by Juma Mülhem on Pexels (https://www.pexels.com/video/13755055/), trimmed to 15 s, stock audio removed (InStep narration added) | —                                | n/a — Pexels License stock; no personal consent obtained by InStep | Pexels License |
| Fingerspelling: A B C L Y     | Illustrated handshapes: one drawn hand, no real person, `scripts/motion/kids-asl/`                                                             | not yet reviewed by Deaf signers | n/a (no people)                                                    | CC-BY-4.0      |
| Your first sign: I love you   | Illustrated handshape: one drawn hand, no real person, `scripts/motion/kids-asl/`                                                              | not yet reviewed by Deaf signers | n/a (no people)                                                    | CC-BY-4.0      |

Animated demonstrations say so on every frame. The two sign-language lessons show illustrated handshapes drawn from
standard ASL handshape descriptions (type: Inter, SIL OFL); every frame says "Illustrated handshape · not yet reviewed by Deaf signers".
No Deaf signer has reviewed them yet. A recording by Deaf signers should replace them, and its row will name the reviewers.

The only third-party footage is the Pexels stock clip above. No AI-generated people or copyrighted music is used.

## Audio

| Sound                                    | Source                                                                                                                                                                                                                        | License                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Lesson narration (all seven lessons)     | Synthetic voice made locally with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0 by hexgrad, voices `af_heart` and `af_bella` (kids), run with [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) 0.4.9 | Apache-2.0 (model), MIT (runtime) |
| Music beds and the kids' sparkle         | Original, synthesised in code by `scripts/audio/bed.py`, no samples                                                                                                                                                           | CC-BY-4.0                         |
| Companion chime, rep tick, CPR metronome | Original, synthesised in the browser with Web Audio (`apps/companion/src/lib/sounds.ts`, `metronome.ts`), no audio files                                                                                                      | MIT                               |

The narration is a text-to-speech voice, not a recording of a person, and is labelled as such here. Kokoro's model card
says it was trained only on permissive or non-copyrighted audio, including CC BY data it credits: Koniwa `tnc`
(CC BY 3.0) and SIWIS (CC BY 4.0). Phonemes come from espeak-ng (GPL-3.0) through phonemizer-fork and
espeakng-loader. These run only on the developer's machine when rendering, and none of their code is in this repo or
the apps. Model files: `kokoro-v1.0.onnx` sha256 `7d5df8ec…3636a6c5` and `voices-v1.0.bin` sha256
`bca610b8…1fbf7d`; `scripts/audio/tts.py` holds the full sums. No cloud text-to-speech and no third-party music is
used. How to regenerate: `scripts/audio/README.md`.
