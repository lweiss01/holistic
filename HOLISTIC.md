# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Capture work and prepare a clean handoff.**

Plan Holistic milestones M001-M003 using GSD workflow

## Latest Work Status

Completed full milestone planning: requirements, research, roadmap, project definition

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Begin S01: Automatic Startup Notifications slice planning
- Begin M001 detailed planning with focused research
- Work is complete

## Active Plan

- Read HOLISTIC.md
- Confirm next step with the user

## Overall Impact So Far

- Phase tracking removal is now available on GitHub
- Breaking change documented in commit message
- Holistic roadmap now has clear execution path with philosophy-driven design
- M001 prioritizes making automatic capture work so users never think about Holistic
- M001 has clear execution path from requirements through verification
- Boundary map ensures slices connect cleanly
- Research captured pitfalls and existing code patterns for implementation

## Regression Watch

- Keep 'silent partner' and 'set and forget' philosophies central to all feature decisions
- Reject features that add user ceremony or require manual commands for normal workflows
- Follow 'silent partner' philosophy - automatic capture, not user nagging
- Follow 'set and forget' - minimize CLI usage, agent-conversation-first

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .bg-shell/manifest.json
- .gsd/STATE.md
- .gsd/milestones/M001/slices/S01/S01-PLAN.md
- .holistic/state.json

## Pending Work Queue

- Remove first-class phase tracking from Holistic core state, docs, and commands: Review roadmap docs
- Remove first-class phase tracking from Holistic core state, docs, and commands: Review roadmap docs
- Capture work and prepare a clean handoff.: Remove first-class phase tracking from Holistic core state, docs, and commands
- Plan Phase 2 Team/Org Mode: Start Phase 2 Team/Org Mode planning
- Capture work and prepare a clean handoff.: This should be the active next step now

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

- Last updated: 2026-03-21T18:22:23.830Z
- Last handoff: Phase tracking removal complete - codebase is now workflow-neutral
- Pending sessions remembered: 12
