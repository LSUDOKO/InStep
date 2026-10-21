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
