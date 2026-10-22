# Friction log

Only real experiences, recorded as they happen. Format from `docs/12-submission-kit.md`.

### F-01: Vega Developer Tools do not support Arch Linux hosts

- Task attempted: install Vega Developer Tools and run the Vega Virtual Device on the development laptop.
- Steps taken: checked the system requirements at
  https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html — supported hosts are macOS 10.15+ and
  Ubuntu 20.04 / 22.04 / 24.04 (x86_64). Developer machine runs Arch Linux (KVM available). A community
  answer states VirtualBox VMs are not supported either.
- Expected: a Linux install path that works on any x86_64 distribution with KVM.
- Actual: no documented route for other distributions; workaround under evaluation (Ubuntu 24.04 distrobox with
  `/dev/kvm` passed through).
- Severity: High
- Workaround: _pending — result will be recorded after the Milestone 0 spike._
- Suggestion: publish a container image (or documented distrobox/toolbox recipe) for the SDK + VVD, or list the
  exact host requirements (glibc, KVM, GPU) so other distributions can be supported.

### F-02: Shared TypeScript packages need extra Babel plugins for the RN 0.72 Vega toolchain

- Task attempted: bundle the Vega TV app with Metro, consuming the monorepo's shared TypeScript packages (gate engine, protocol, zod) from source.
- Steps taken: `npx react-native bundle --entry-file index.js --platform kepler --dev false …` in `apps/tv` (RN 0.72.0, `metro-react-native-babel-preset` 0.76, as in `react-native-multi-tv-app-sample`).
- Expected: modern TypeScript/ES2021 that runs in current browsers and Node also bundles for Vega.
- Actual: `SyntaxError: Export namespace should be first transformed by @babel/plugin-transform-export-namespace-from` for `export * as rest from './rest'`; and `??=` / `||=` (from zod 4 and our code) passed through untransformed.
- Severity: Medium
- Workaround: rewrote the re-export as `import * as rest; export { rest }` and added `@babel/plugin-transform-logical-assignment-operators` + `@babel/plugin-transform-class-static-block` to `babel.config.js`. A CI job now bundles the TV app on every push.
- Suggestion: document the JS syntax level supported by the Vega runtime (Hermes version) and ship a Babel preset for Vega that includes these transforms, or update the RN 0.72 template's preset.

### F-03: MediaPipe Tasks (web) sends usage telemetry with no opt-out

- Task attempted: keep the companion's promise that only body points leave the device.
- Steps taken: ran the camera page under Playwright with network capture; `@mediapipe/tasks-vision` 1.1.1 posted
  `https://odml.pa.googleapis.com/v1/log` (protobuf usage stats, API key in a header) every 60 s. Searched the
  bundle and typings for a disable flag — none.
- Expected: a documented option to disable telemetry, as for most SDKs.
- Actual: always on. (Not an Amazon tool — recorded because it affects any privacy-first Fire TV companion.)
- Severity: Medium
- Workaround: strict `Content-Security-Policy: connect-src 'self'` on the companion pages; the browser blocks the
  request. Verified by an e2e test on every push.
- Suggestion: for Fire TV devices with a camera, an on-device pose API would remove the need for a third-party
  web SDK entirely (see feature requests).

### F-04: Bedrock daily token cap on a new account surfaces as a generic throttle

- Task attempted: run one real coaching tip through Amazon Bedrock (Converse API) with `MOCK_AI=false`.
- Steps taken: `aws bedrock-runtime converse --region us-east-1 --model-id amazon.nova-micro-v1:0 … --inference-config '{"maxTokens":5}'` with valid AdministratorAccess credentials; `amazon.nova-micro-v1:0` and `amazon.nova-lite-v1:0` were listed by `list-foundation-models`.
- Expected: a reply, or a clear "model access not granted" message.
- Actual: `ThrottlingException … Too many tokens per day, please wait before trying again` on the very first call of the day, for both Nova models; the Seoul Claude 3 Haiku model returned "marked by provider as Legacy".
- Severity: Medium
- Workaround: the coach already falls back to the lesson's template tip on any model error, so the product keeps working; `pnpm aws:check` reports which models the account can list and probes with a 5-token call.
- Suggestion: return a distinct error code (and the reset time) for per-account daily allowances, and show the allowance in the Bedrock console next to model access.

### F-05: Vega SDK install on Ubuntu 24.04 (distrobox on Arch) needed four manual repairs

- Task attempted: install Vega Developer Tools 0.24.12112 and start the Virtual Device, following the official "Install the Vega Developer Tools" page, inside an Ubuntu 24.04 distrobox (Docker backend, `/dev/kvm` passed through) on an Arch host.
- Steps taken / what broke:
  1. `get_vvm.sh` aborts with `jq is required` — `jq` is not in the page's Ubuntu dependency list.
  2. The deadsnakes PPA returned `503 Service Unavailable` for ~10 minutes, so `libpython3.8-dev` could not be installed; the installer did not need it to proceed.
  3. Every `vega` command printed `node: --no-experimental-strip-types is not allowed in NODE_OPTIONS`. The SDK bundles an older Node whose CLI rejects a flag the developer's shell exports for Node 22. Fix: `unset NODE_OPTIONS` before running `vega`.
  4. `vega virtual-device start` returned silently and `run-app` said "Cannot find an instance of Vega Virtual Device". `vvd/bin/virtualdevice` was a symlink to `../../../../../../../../..` (i.e. `/`). Fix: relink it to `packages/KeplerCLIKVDI/KeplerCLIKVDI-2.0.4800.0/AL2_x86_64/DEV.STD.PTHREAD/build/bin/virtualdevice`.
  5. `vega virtual-device start` reported "Waiting for virtual device to boot" then nothing. The instance's `virtual_device.err` said `vega-virtual-device: error while loading shared libraries: libpulse.so.0`. The emulator (an Android-emulator derivative) needs PulseAudio, X11/XCB and Mesa libraries that a minimal Ubuntu 24.04 lacks. Fix: `apt install libpulse0 libgl1 libegl1 libgbm1 libx11-xcb1 libxkbcommon-x11-0 libxcb-cursor0 libnss3 libasound2t64 libfontconfig1 libxcomposite1 libxi6 libxtst6 libxrandr2 libxcursor1 libxdamage1`. The CLI never surfaced the error; it only timed out.
  6. No supported way to screenshot the device. With the default host-GPU mode, QEMU's QMP `screendump` returns a black frame; the on-device `screenshooter` / `gwsi-tool-screenshooter` run as `app_user` fail with `creating a buffer file … Permission denied` (and the first bare call takes `com.amazon.dev.shell.service` down with it). Workaround: start the device with `vega virtual-device start --no-gl-accel`, then dump the framebuffer over the QMP socket (`/tmp/qmp-socket-5554.sock`, `screendump`). Slower rendering, but scriptable screenshots.
  7. (Self-inflicted, but worth noting) running `vega` once as root rewrote `~/vega/sdk/components.json` as `root:root 600`; afterwards every command reported "SDK version main@0.24.12112 is not installed". The CLI could tell the user the file is unreadable rather than "not installed".
- Expected: a single installer run and `vega virtual-device start` opening the device window.
- Actual: as above; total ~75 minutes of debugging before the first Hello World.
- Severity: High (blocks every first-time Ubuntu developer who exports NODE_OPTIONS or whose VVD symlink is mis-generated).
- Suggestion: add `jq` to the documented dependencies; have the CLI strip or ignore unsupported `NODE_OPTIONS` for its bundled Node; verify the `vvd/bin/virtualdevice` link after install and print the path it resolves to; print the emulator's stderr (or at least `ldd` misses) when boot never starts; add `vega device screenshot`; list the emulator's apt dependencies on the Ubuntu install page; distinguish "not installed" from "config unreadable".

### F-06: The Vega media player refuses `http://` video sources — only HTTPS plays

- Task attempted: play a lesson video (H.264 High 4.0, yuv420p, AAC, faststart MP4, served with byte ranges) in the TV app on the Vega Virtual Device from the local dev server at `http://10.0.2.2:8788/media/...`.
- Steps taken: `<Video>` (W3C media element) with the http URL; the same URL fetched fine from the device shell (`wget -S --spider` → 200, `accept-ranges: bytes`, `video/mp4`).
- Expected: playback, or an error naming the codec/container problem.
- Actual: the app's generic error ("The video couldn't be played"); device log: `MEDIA_PLAYER:MediaPlayerUtils.cpp(113) isUriSchemeSecure Got an insecure protocol/scheme http, return error` → `openMedia Invalid URI` → `set_src_uri: MPB Call failed with code: 50004` → HTMLMediaElement `error` (code 4). No codec was ever consulted.
- Severity: High for local development (every first `http://` dev server fails with a misleading media error); Low in production (apps serve media over HTTPS anyway).
- Workaround: serve media over HTTPS from a publicly trusted certificate. InStep's TV app now defaults to the hosted server `https://instep-wfcr.onrender.com` (overridable at build time with `INSTEP_SERVER_URL`), while REST and WebSocket still work over plain http for local debugging.
- Suggestion: document the HTTPS-only rule on the Video/W3C media pages; surface a distinct `MEDIA_ERR_SRC_NOT_SUPPORTED` reason ("insecure scheme") to JavaScript; allow `http://10.0.2.2` (the Virtual Device's host alias) in debug builds.

### F-07: The Virtual Device hangs under its own 1080p screen recording

- Task attempted: record each lesson on the Virtual Device with the emulator console (`screenrecord start` at the display's native 1920×1080, 6 Mbps) while the app played video and drew SVG overlays.
- Steps taken: first lesson recorded fine (105 s). During the second, the emulator stopped answering: `detected a hanging thread 'QEMU2 main loop'. No response for 15909 ms` … `'QEMU2 CPU0 thread'. No response for 28503 ms`, preceded by repeated `Error while writing audio frame: [Success]`. The console port closed; `vega virtual-device status` reported `running:false`.
- Expected: either a recording or a refusal, not a dead device.
- Actual: the device had to be stopped, its instance directory cleared and started again (≈1.5 minutes), then the app reinstalled.
- Severity: Medium (reproducible; blocks automated capture).
- Workaround: record at `--size 1280x720 --fps 12 --bit-rate 3M`, relaunch the app before each recording, and have the capture script restart the device when its console stops answering.
- Suggestion: cap the recorder below the host's capability or warn; expose the hang in `vega virtual-device status` (it reported "running" for a while after the hang).

### F-08: No documented font list or backdrop blur for TV UI

- Task attempted: build a tvOS-style UI (frosted platters, a specific typeface) in the React Native for Vega app.
- Steps taken: searched the Vega docs and samples for the system font families and for a blur/vibrancy view.
- Expected: a list of bundled font families and a supported blur component (or a statement that there is none).
- Actual: neither is documented. The family name `Amazon Ember` works when set by name; no blur component was found, so translucent fills stand in for frosted glass.
- Severity: Low (cosmetic), but costs trial-and-error builds on the Virtual Device.
- Workaround: `fontFamily: 'Amazon Ember'`; `rgba(255,255,255,0.08–0.22)` surfaces with a 1 px hairline; gradients with `react-native-svg`.
- Suggestion: a "Typography and materials" page listing system fonts and whether blur is supported.

### F-09: The Virtual Device silently fails to boot when the host is short of memory

- Task attempted: start the Virtual Device (`vega virtual-device start`) on a laptop with a browser and editor open.
- Expected: boot, or an error about memory.
- Actual: the boot wait never finished, or the running device froze mid-session; nothing in the CLI output pointed at memory. Freeing memory (about 4 GB available) fixed it every time.
- Severity: Medium (looks like a broken install).
- Workaround: close memory-heavy apps before starting; check `free -g` first.
- Suggestion: check available memory in `vega virtual-device start` and print a warning with the required amount.

