# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Test branch fallback fix**

Test branch fallback fix

## Latest Work Status

Phase 0 almost complete - discovered TypeScript stripping limitation in node_modules

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Expand AgentName union to include Gemini, Copilot, Cursor, Goose, GSD
- Add build step for npm publishing (TypeScript → JavaScript)
- Complete Phase 0 Task 1e

## Active Plan

- Read HOLISTIC.md
- Confirm the next concrete step

## Overall Impact So Far

- Failed git reads now visibly different from actual 'master' branch
- Phase 0 foundation fixes prevent embarrassing bugs when users arrive
- 4/5 critical bugs fixed - only npm publishing remains

## Regression Watch

- Do not use 'master' as a fallback value anywhere - use 'unknown' for failures
- Node.js --experimental-strip-types doesn't work in node_modules, must build to JS

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/beads.db-wal
- .beads/daemon.log
- .bg-shell/manifest.json
- .holistic/context/README.md
- .holistic/context/adapters/antigravity.md
- .holistic/context/adapters/claude-cowork.md
- .holistic/context/adapters/codex.md
- .holistic/context/current-plan.md
- .holistic/context/project-history.md
- .holistic/context/regression-watch.md
- .holistic/context/session-protocol.md
- .holistic/context/zero-touch.md
- .holistic/state.json
- .npmignore
- AGENTS.md
- HOLISTIC.md
- holistic-0.1.0.tgz
- package.json
- src/cli.ts
- src/core/state.ts

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

- Last updated: 2026-03-20T02:56:12.967Z
- Last handoff: No explicit handoff captured yet.
- Pending sessions remembered: 2
