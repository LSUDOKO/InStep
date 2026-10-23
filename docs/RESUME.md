# Resume notes (state as of 2026-10-22, ~02:40 IST)

Deadline: **Oct 23, 12:00 PM PDT = Oct 24, 00:30 IST.**

## What is done and where

- Hosted server: https://instep-wfcr.onrender.com (Render free plan, service `srv-dbcadjui0phs73ataj4g`). No disk,
  so profiles reset on every deploy. Deploys are manual: `render deploys create srv-dbcadjui0phs73ataj4g --wait`
  (or the API call in `docs/PROGRESS.md`). Deployed: `b7d01a5` (loop-aware placeholder videos).
- TV app runs on the Vega Virtual Device (Ubuntu 24.04 distrobox `vega`, SDK 0.24.12112). Build:
  `cd apps/tv && npm run build:debug`; install: `vega run-app build/x86_64-debug/tv_x86_64.vpkg com.instep.tv.main -d VirtualDevice`.
  Always `unset NODE_OPTIONS` and `source ~/vega/env` first (see `docs/FRICTION_LOG.md` F-05).
- Screenshots and GIF sources: `~/instep-capture/` (webm recordings from the emulator, `scratch/` has every
  screenshot and learner log). GIFs go to `docs/screenshots/tv/gif/<lesson>.gif`
  (`scripts/device/webm2gif.sh in.webm out.gif 3 720 8`).
- Device helpers are in `scripts/device/` (they expect `INSTEP_CAPTURE=~/instep-capture` and the distrobox `vega`
  with the emulator console on port 5554; `tvkey.sh` uses the on-device `inputd-cli`, `tvshot.sh` the emulator
  console screenshot, `record-all.sh` records lessons one by one with a fresh app launch each).

## Start the device tomorrow

```bash
distrobox enter vega -- bash -c 'unset NODE_OPTIONS; source ~/vega/env; rm -rf ~/vega/sdk/vega-sdk/main/0.24.12112/vvd/instances/*/; vega virtual-device start --timeout 400'
distrobox enter vega -- bash -c 'unset NODE_OPTIONS; source ~/vega/env; cd ~/Desktop/hackathon_projects/InStep/apps/tv && vega run-app build/x86_64-debug/tv_x86_64.vpkg com.instep.tv.main -d VirtualDevice'
INSTEP_CAPTURE=~/instep-capture scripts/device/record-all.sh "fall-heel-raise|0|0|6|170" "fall-single-leg-stand|0|1|6|120" "asl-fingerspell-abc|1|0|5|130" "asl-i-love-you|1|1|6|60" "rehab-hand-open-close|2|0|5|110" "cpr-rhythm|3|0|6|110" "kids-forest-walk|4|0|6|120"
```

The recorder needs a profile on the hosted server (after a deploy, create one on the TV: Welcome → Create a
profile → type a name → Right ×7 → Down ×2 → Select). `record-all.sh` assumes the profile exists and that the
first Select on the Profiles screen opens Home.

## Still to do (as of Oct 23, 21:40 IST)

Done today: Blue Hour brand + new logo (TV launcher icon too), illustrated + narrated videos for every lesson
(`scripts/motion/`, `scripts/audio/`), iOS-style companion with sounds, architecture diagram
(`docs/architecture/`), demo film v1 (`docs/video/instep-demo.mp4`, 2:41), 3 of 7 README GIFs re-recorded in the new
design (heel raises, single-leg stand, fingerspelling).

1. Upload `docs/video/instep-demo.mp4` to YouTube (public or unlisted) and paste the link in Devpost.
2. Paste the Devpost text from `docs/SUBMISSION.md` (product feedback, friction logs F-01…F-10, feature requests).
3. Optional: re-record the other four GIFs (`scripts/device/record-all.sh`, needs a profile on the hosted server),
   and swap a real phone-camera clip of yourself into the film's "Simulated learner" shots.
4. Owner decision: the ASL track disclaimer says "created with Deaf signers"; the illustrated hands are not yet
   reviewed by Deaf signers.
