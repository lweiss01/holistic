# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Resume from last handoff**

Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.

## Latest Work Status

Clarified that one-time Holistic init does not guarantee Antigravity IDE will ask what to do on repo open; current behavior still depends on app cooperation or a real startup integration.

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.

## Active Plan

- No active plan has been captured yet.

## Overall Impact So Far

- No durable impact notes recorded yet.

## Regression Watch

- Review the regression watch document before changing related behavior.

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No confirmed Antigravity startup integration point has been identified yet.

## Changed Files In Current Session

- No repo changes detected for the active session.

## Pending Work Queue

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

## Historical Memory

- Last updated: 2026-03-19T23:33:58.383Z
- Last handoff: Clarified that one-time Holistic init does not guarantee Antigravity IDE will ask what to do on repo open; current behavior still depends on app cooperation or a real startup integration.
- Pending sessions remembered: 1
