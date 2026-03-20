# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Test branch fallback fix**

Test branch fallback fix

## Latest Work Status

Phase 0 (Code Hardening) complete - 5/5 tasks done, npm package ready

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Expand AgentName union to include Gemini, Copilot, Cursor, Goose, GSD
- Add build step for npm publishing (TypeScript → JavaScript)
- Complete Phase 0 Task 1e
- Start Phase 1 with MCP server mode (holistic serve)
- Review docs/roadmap/01-feature-expansion.md for task details

## Active Plan

- Read HOLISTIC.md
- Confirm the next concrete step

## Overall Impact So Far

- Failed git reads now visibly different from actual 'master' branch
- Phase 0 foundation fixes prevent embarrassing bugs when users arrive
- 4/5 critical bugs fixed - only npm publishing remains
- Foundation prevents embarrassing bugs when users arrive
- All 8 agent types now supported with adapters
- Schema changes have safe migration path
- Windows users can now build successfully

## Regression Watch

- Do not use 'master' as a fallback value anywhere - use 'unknown' for failures
- Node.js --experimental-strip-types doesn't work in node_modules, must build to JS
- Always test npm install -g locally before publishing
- Never skip Phase 0 on future projects - foundation matters

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/daemon.log
- .bg-shell/manifest.json
- .holistic/context/adapters/claude-cowork.md
- .holistic/state.json
- dist/cli.d.ts
- dist/cli.d.ts.map
- dist/cli.js
- dist/cli.js.map
- dist/core/docs.d.ts
- dist/core/docs.d.ts.map
- dist/core/docs.js
- dist/core/docs.js.map
- dist/core/git.d.ts
- dist/core/git.d.ts.map
- dist/core/git.js
- dist/core/git.js.map
- dist/core/redact.d.ts
- dist/core/redact.d.ts.map
- dist/core/redact.js
- dist/core/redact.js.map
- dist/core/setup.d.ts
- dist/core/setup.d.ts.map
- dist/core/setup.js
- dist/core/setup.js.map
- dist/core/state.d.ts
- dist/core/state.d.ts.map
- dist/core/state.js
- dist/core/state.js.map
- dist/core/types.d.ts
- dist/core/types.d.ts.map
- dist/core/types.js
- dist/core/types.js.map
- dist/daemon.d.ts
- dist/daemon.d.ts.map
- dist/daemon.js
- dist/daemon.js.map
- holistic-0.1.0.tgz
- package.json
- scripts/build.mjs
- src/cli.ts
- src/core/docs.ts
- src/core/git.ts
- src/core/setup.ts
- src/core/state.ts
- src/daemon.ts

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

- Last updated: 2026-03-20T03:17:51.386Z
- Last handoff: No explicit handoff captured yet.
- Pending sessions remembered: 2
