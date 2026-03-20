# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Test branch fallback fix**

Test branch fallback fix

## Latest Work Status

Fixed silent branch detection failure, moving to Task 1b (expand AgentName)

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Expand AgentName union to include Gemini, Copilot, Cursor, Goose, GSD

## Active Plan

- Read HOLISTIC.md
- Confirm the next concrete step

## Overall Impact So Far

- Failed git reads now visibly different from actual 'master' branch

## Regression Watch

- Do not use 'master' as a fallback value anywhere - use 'unknown' for failures

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/beads.db-wal
- .beads/daemon.log
- .bg-shell/manifest.json
- .holistic/state.json

## Pending Work Queue

- Structured metadata and roadmap planning: Review HOLISTIC.md and decide the next concrete step.
- Finalize Holistic v1 implementation: Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.

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

- Last updated: 2026-03-20T02:53:37.913Z
- Last handoff: No explicit handoff captured yet.
- Pending sessions remembered: 2
