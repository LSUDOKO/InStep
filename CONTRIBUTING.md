# Contributing to InStep

Thanks for your interest! InStep is a hackathon project that aims to stay small, honest and well tested.

## Ground rules

Read [`AGENTS.md`](AGENTS.md) first. In short:

- **Honesty:** no placeholder buttons, no fake features, no statistics outside [`docs/SOURCES.md`](docs/SOURCES.md).
- **Safety:** safety gates and sway-stop thresholds come only from the `.istep` file and are never loosened at runtime.
- **Privacy:** learner camera video never leaves the companion device.
- **Cost:** `MOCK_AI=true` stays the default.

## Setup

```bash
pnpm install
pnpm test && pnpm lint && pnpm typecheck
```

## Workflow

1. Open an issue (or pick one) describing the change.
2. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(gate-engine): …`, `fix(server): …`).
4. Add or update tests. Shared logic in `packages/` must stay pure (no DOM / React Native imports).
5. Open a PR using the template; CI must be green.

## Adding a gate type or `.istep` field

Change the zod schema in `packages/istep-format/src/schema.ts`, regenerate the JSON Schema
(`pnpm --filter @instep/istep-format build`), document it in `docs/03-istep-format.md`, and add engine tests.
