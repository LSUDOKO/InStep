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
