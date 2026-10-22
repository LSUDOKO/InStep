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

## Still to do

1. (done 02:35) All seven lessons recorded on the device; GIFs committed in `docs/screenshots/tv/gif/`; README
   embeds them; loop-aware placeholder videos deployed to Render; step-rail TV build installed on the device.
2. (done, Oct 22) tvOS-style redesign of every TV screen, installed on the device and checked (solo, Together
   mode, "Over the video"). The README GIFs still show the old design: re-run `scripts/device/record-all.sh`
   after the real videos are in. Render still serves the pre-redesign posters until the next deploy (a deploy
   wipes profiles; recreate one on the TV).
3. Record real people for the two hero channels (consent in `content/CREDITS.md`), replace the placeholder
   `video.mp4` files, re-run `pnpm dryrun-lessons` and the device recording for those two.
4. Phone fps check, AWS probe when the daily quota resets (`pnpm aws:check --probe`), demo video, Devpost form
   (`docs/SUBMISSION.md`, `docs/12-submission-kit.md`).
