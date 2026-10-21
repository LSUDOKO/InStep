# Changelog

All notable changes to InStep. Dates are 2026.

## 0.4.0 — Oct 21

- Creator Studio: record or upload a demonstration, automatic step suggestions, timeline editor, live step
  preview, publish to TVs.
- Amazon Bedrock coach tips and step labels, Amazon Polly voice, one daily AI budget (mock mode by default).
- Caregiver report page, raise-hand gesture, voice commands, CPR metronome, generated Kids lesson video.
- Optional MCP server (`list_lessons`, `get_progress_report`).
- Privacy: strict CSP on the companion blocks MediaPipe telemetry and all third-party requests.
- `<GatedPlayer>` for Vega and the `vega-gated-video-player` export; landmark recording + replay.

## 0.3.0 — Oct 21

- Vega TV app: catalog, pairing, camera check, gated player with HUD, skeletons and Delta Glow, summary,
  progress, settings. Type-checks and Metro-bundles in CI (device run pending).
- Platform-independent gated-player controller.

## 0.2.0 — Oct 21

- Companion camera node with in-browser MediaPipe and a measured privacy pill; Playwright e2e.

## 0.1.0 — Oct 21

- `.istep` format, gate engine, protocol, server (relay, REST, SQLite, mock coach).
