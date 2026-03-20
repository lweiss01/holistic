# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

That is the intended end state for this project. Prefer changes that reduce ceremony, keep continuity durable, and make Holistic fade further into the background of normal work.

## Current Objective

**Start using Holistic in this repo**

Phase 1 rollout and real repo usage

## Latest Work Status

Committed: docs: set the low-touch continuity north star

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Plan Phase 1.5 around implicit resume, auto-session inference, smarter passive checkpoints, auto-drafted handoffs, automatic sync, and machine bootstrap

## Active Plan

- Check current Holistic state
- Use checkpoints during real work
- Create a clean handoff when pausing

## Overall Impact So Far

- The roadmap now prioritizes low-touch continuity over surface-area growth
- Future work should make resume, checkpoint, handoff, and sync fade further into the background

## Regression Watch

- Do not add workflow steps that increase startup ceremony unless they clearly improve durable continuity
- Avoid roadmap drift into broad platform features that do not help Holistic quietly preserve continuity

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/daemon.log
- .holistic/state.json
- .holistic/state.json.lock

## Pending Work Queue

- Session Three: Review HOLISTIC.md and decide the next concrete step.
- Session Two: Start third session
- Session One: Start second session
- Test branch fallback fix: Expand AgentName union to include Gemini, Copilot, Cursor, Goose, GSD
- Structured metadata and roadmap planning: Review HOLISTIC.md and decide the next concrete step.

## Long-Term Memory

- Project history: [.holistic/context/project-history.md](.holistic/context/project-history.md)
- Regression watch: [.holistic/context/regression-watch.md](.holistic/context/regression-watch.md)
- Zero-touch architecture: [.holistic/context/zero-touch.md](.holistic/context/zero-touch.md)
- Portable sync model: handoffs are intended to be committed and synced so any device with repo access can continue.

## Supporting Documents

- State file: [.holistic/state.json](.holistic/state.json)
- Current plan: [.holistic/context/current-plan.md](.holistic/context/current-plan.md)
- Session protocol: [.holistic/context/session-protocol.md](.holistic/context/session-protocol.md)
- Session archive: [.holistic/sessions](.holistic/sessions)
- Adapter docs:
- codex: [.holistic/context/adapters/codex.md](.holistic/context/adapters/codex.md)
- claude: [.holistic/context/adapters/claude-cowork.md](.holistic/context/adapters/claude-cowork.md)
- antigravity: [.holistic/context/adapters/antigravity.md](.holistic/context/adapters/antigravity.md)
- gemini: [.holistic/context/adapters/gemini.md](.holistic/context/adapters/gemini.md)
- copilot: [.holistic/context/adapters/copilot.md](.holistic/context/adapters/copilot.md)
- cursor: [.holistic/context/adapters/cursor.md](.holistic/context/adapters/cursor.md)
- goose: [.holistic/context/adapters/goose.md](.holistic/context/adapters/goose.md)
- gsd: [.holistic/context/adapters/gsd.md](.holistic/context/adapters/gsd.md)

## Historical Memory

- Last updated: 2026-03-20T22:27:53.624Z
- Last handoff: No explicit handoff captured yet.
- Pending sessions remembered: 6
