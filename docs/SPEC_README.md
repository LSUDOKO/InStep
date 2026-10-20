# InStep — The video that waits for you

> A Fire TV (Vega OS) platform where how-to videos **pause at key moments and continue only when your body or hands get it right**, with a kind AI coach, a creator studio for instructors, and an open file format (`.istep`) that turns any video into a body-aware lesson.

Built for **Build, Ship, Shape: Amazon Developer Hackathon** — **Fire TV track**, plus **AWS Builder** and **Open Source** mini challenges.

**Submission deadline:** October 23, 2026, 12:00 PM PDT (October 24, 2026, 12:30 AM IST).

---

## How to use this spec pack

This folder is written for a coding agent (and for you). Give the agent this instruction:

> "Read `AGENTS.md` first, then every file in `docs/` in numeric order. Build the project exactly as specified, following the milestone order in `docs/10-build-plan.md`. Do not skip the Day-1 spike. Check off acceptance criteria as you go."

## Files

| File | What it covers |
|---|---|
| `AGENTS.md` | Rules for the coding agent: priorities, honesty rules, coding standards, what not to do |
| `docs/01-product-spec.md` | Vision, problem, users, the 5 channels, all features, non-goals, success criteria |
| `docs/02-architecture.md` | System components, data flow, repo layout, tech stack, network and privacy design |
| `docs/03-istep-format.md` | The `.istep` open file format: JSON schema, fields, examples |
| `docs/04-gate-engine.md` | The 7 gate types: maths, state machines, thresholds, adaptive tolerance, unit tests |
| `docs/05-tv-app.md` | Vega OS TV app: screens, focus navigation, gated player, overlays, settings |
| `docs/06-companion-web.md` | Phone/laptop web app: camera node, Creator Studio, Together mode, reports |
| `docs/07-server-and-aws.md` | Relay server, WebSocket protocol, REST API, Bedrock coach, Polly, storage, cost guards, optional MCP |
| `docs/08-channels-and-content.md` | Content plan for each channel, safety rules, respectful sign-language practice, disclaimers |
| `docs/09-design-system.md` | 10-foot TV UI, colours, typography, focus states, overlay styles, phone UI |
| `docs/10-build-plan.md` | Milestones in order, Day-1 spike, acceptance criteria per milestone |
| `docs/11-testing-qa.md` | Unit, integration, device and demo-rehearsal tests |
| `docs/12-submission-kit.md` | Demo video script, Devpost text, product feedback, friction logs, open-source package, compliance checklist |
| `docs/SOURCES.md` | The only statistics and research the project may cite, with links |

## One-paragraph pitch

Every how-to video has the same flaw: it doesn't wait for you. InStep watches you through a phone or laptop camera, pauses the lesson on your Fire TV at each key moment, and continues only when your pose, hand shape, rhythm or hold is right. It runs fall-prevention exercises with a chair safety check, stroke hand rehab with quality rep counting, sign-language practice for hearing parents of deaf children with finger-level visual feedback, CPR rhythm practice, and kids' active storytime. Instructors record a lesson once on their phone; InStep turns it into a gated lesson automatically. Only skeleton numbers leave the camera device — never video.
