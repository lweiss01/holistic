# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Structured metadata and roadmap planning**

Enhance history/regression docs with structured metadata and create implementation plans for daemon, sync, integrations, and visualization features

## Latest Work Status

All 5 recommended next steps documented with detailed implementation plans

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Run `holistic start-new --goal "Describe the task"` to begin capturing work.

## Active Plan

- Review current history/regression format
- Design enhanced metadata schema
- Update TypeScript types
- Implement doc generation
- Create roadmap plans for items 2-5

## Overall Impact So Far

- History and regression docs can now show severity, affected areas, outcome status, and validation checklists
- Backward compatible - existing sessions continue working with plain text
- History and regression docs now support rich metadata (severity, areas, outcomes, validation checklists)
- Roadmaps provide 2-3 session implementation plans for each major feature
- Clear path forward: daemon+sync (foundation), integrations (adoption), visualization (scale)
- Backward compatible - existing sessions work unchanged, new sessions can use structured metadata

## Regression Watch

- Do not remove legacy impactNotes and regressionRisks string arrays - needed for backward compatibility
- Do not remove legacy impactNotes/regressionRisks string arrays - backward compatibility
- Rendering logic must check for structured metadata first, gracefully fall back to plain text

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .bg-shell/manifest.json
- .holistic/state.json
- docs/roadmap/02-daemon-passive-capture.md
- docs/roadmap/03-cross-device-sync.md
- docs/roadmap/04-agent-integrations.md
- docs/roadmap/05-visualization-search.md
- docs/roadmap/README.md
- docs/structured-metadata.md

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

- Last updated: 2026-03-20T01:58:46.397Z
- Last handoff: No explicit handoff captured yet.
- Pending sessions remembered: 1
