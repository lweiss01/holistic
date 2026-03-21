# HOLISTIC

<!-- ═══════════════════════════════════════════════════════════════════════
     AGENT INSTRUCTIONS — READ THIS ENTIRE FILE BEFORE DOING ANYTHING ELSE
     ═══════════════════════════════════════════════════════════════════════

  1. Read this file top-to-bottom.
  2. Read AGENTS.md for the setup steps specific to your agent.
  3. Summarise to the user: what was last worked on, what's planned next.
  4. Ask: "Continue as planned, tweak the plan, or do something different?"
  5. Run `holistic resume --agent <your-agent-name>` to open a session.

  ⚠️  If you are about to edit a file listed under KNOWN FIXES, STOP and
     read that fix entry carefully before proceeding.
  ════════════════════════════════════════════════════════════════════════ -->

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

That is the intended end state for this project. Prefer changes that reduce ceremony, keep continuity durable, and make Holistic fade further into the background of normal work.

## Current Objective

**Capture work and prepare a clean handoff.**

Capture work and prepare a clean handoff.

## Latest Work Status

Converted the Holistic repo itself to a main-only setup so the public repo does not use a separate holistic/state branch.

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Remove the local and remote holistic/state branches from this repo and keep future Holistic-repo work on main only
- Decide separately whether Holistic should change the default sync-on-checkpoint behavior for newly initialized repos

## Active Plan

- Read HOLISTIC.md
- Confirm next step with the user

## Overall Impact So Far

- Ordinary local checkpoints still work, but they no longer auto-push the portable-state branch in this repo
- This keeps dogfooding quieter while preserving handoff-driven sync
- Users can still create their own holistic/state branch in their project repos, but the public Holistic repo stays cleaner and only exposes main
- The state-branch model remains valid for actual project repos; this change is only for dogfooding the Holistic repo itself

## Regression Watch

- Do not turn checkpoint-triggered sync back on in this repo unless we explicitly want frequent holistic/state pushes again
- Treat this as a repo-local quieting change, not yet a product-wide default change
- Do not re-enable holistic/state syncing in the Holistic repo unless we intentionally want the public repo to expose portable-state branch activity again
- Do not confuse this repo-only cleanup with the default behavior Holistic should use for user projects

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/daemon.log

## Pending Work Queue

- Capture work and prepare a clean handoff.: Design and implement a state-sync strategy that avoids GitHub Compare & pull request prompts for normal project repos
- Capture work and prepare a clean handoff.: Regenerate or auto-refresh installed git hooks when tracked hook templates change so local .git/hooks stay aligned with the repo
- Remove first-class phase tracking from Holistic core state, docs, and commands: Review roadmap docs
- Remove first-class phase tracking from Holistic core state, docs, and commands: Review roadmap docs
- Capture work and prepare a clean handoff.: Remove first-class phase tracking from Holistic core state, docs, and commands

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

- Last updated: 2026-03-21T20:25:53.776Z
- Last handoff: Added GitHub banner/PR noise from same-repo state sync to the roadmap and queued it as the next product fix
- Pending sessions remembered: 14
