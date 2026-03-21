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

## Phase Tracking

- Current phase: Phase 1.5 - Workflow Disappearance
- Phase goal: Implement Phase 1.5 workflow disappearance
- Phase started: 2026-03-21T00:59:53.158Z
- Most recently completed phase: Phase 1 - Feature Expansion (2026-03-21T00:59:53.158Z)

## Current Objective

**Capture work and prepare a clean handoff.**

Capture work and prepare a clean handoff.

## Latest Work Status

Implemented one-command machine bootstrap for hooks, daemon startup, and Claude Desktop MCP configuration.

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Implement implicit resume or context recovery when MCP clients connect
- Preserve the thin MCP tool surface while making startup lower-ceremony
- Implement auto-drafted handoffs for idle or likely session-end states
- Plan conservative automatic sync to the portable holistic/state branch
- Evaluate the remaining Phase 1.5 bootstrap work for one-command machine setup
- Revisit sync behavior in real repos once a remote state branch is available for end-to-end validation
- Decide whether Phase 1.5 should be marked complete after a quick real-world bootstrap and auto-sync validation pass
- If Phase 1.5 is complete, update docs and move to the next roadmap phase

## Active Plan

- Read HOLISTIC.md
- Confirm next step with the user

## Overall Impact So Far

- Phase 1.5 work is now beginning from an explicit tracked phase state
- Phase 1.5 now covers implicit resume, auto-session inference, and smarter passive checkpoint triggers.
- Phase 1.5 now covers implicit resume, auto-session inference, smarter passive checkpoints, auto-drafted handoffs, and conservative auto-sync triggers.
- Phase 1.5 now includes an end-to-end bootstrap path so new machines can be prepared with much less ceremony.

## Regression Watch

- Keep the MCP integration thin and avoid adding startup ceremony while improving continuity
- Passive checkpoints should ignore Holistic's own portable state files and avoid re-checkpointing on bookkeeping churn.
- Branch switches should produce a single explicit continuity checkpoint instead of repeated daemon noise.
- Auto-drafted handoffs should only refresh when the source session meaningfully changes and should never finalize a session without explicit handoff confirmation.
- Auto-sync must stay hook-safe so syncing portable state cannot recursively create more Holistic activity.
- Bootstrap must remain idempotent and should never clobber unrelated Claude Desktop MCP server entries.
- Repo-local MCP bootstrap must keep pointing at the current Holistic CLI entrypoint so development setups work without a global install.

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .tmp-tests/holistic-bootstrap-home-4tAFKm/AppData/Roaming/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-4tAFKm/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-kgihpk.cmd
- .tmp-tests/holistic-bootstrap-home-c6CEWB/Library/Application Support/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-c6CEWB/Library/LaunchAgents/com.holistic.holistic-test-cxewm0.plist
- .tmp-tests/holistic-home-75eHBB/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-rs9w7b.cmd
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/README.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/project-history.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-01V1Q2/.holistic/state.json
- .tmp-tests/holistic-test-01V1Q2/AGENTS.md
- .tmp-tests/holistic-test-01V1Q2/CLAUDE.md
- .tmp-tests/holistic-test-01V1Q2/GEMINI.md
- .tmp-tests/holistic-test-01V1Q2/HISTORY.md
- .tmp-tests/holistic-test-01V1Q2/HOLISTIC.md
- .tmp-tests/holistic-test-01V1Q2/README.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/README.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/project-history.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-6dHIbS/.holistic/state.json
- .tmp-tests/holistic-test-6dHIbS/AGENTS.md
- .tmp-tests/holistic-test-6dHIbS/CLAUDE.md
- .tmp-tests/holistic-test-6dHIbS/GEMINI.md
- .tmp-tests/holistic-test-6dHIbS/HISTORY.md
- .tmp-tests/holistic-test-6dHIbS/HOLISTIC.md
- .tmp-tests/holistic-test-6dHIbS/README.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/README.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/project-history.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-A5W67x/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-A5W67x/.holistic/sessions/session-2026-03-21T01-22-12-424Z.json
- .tmp-tests/holistic-test-A5W67x/.holistic/state.json
- .tmp-tests/holistic-test-A5W67x/AGENTS.md
- .tmp-tests/holistic-test-A5W67x/CLAUDE.md
- .tmp-tests/holistic-test-A5W67x/GEMINI.md
- .tmp-tests/holistic-test-A5W67x/HISTORY.md
- .tmp-tests/holistic-test-A5W67x/HOLISTIC.md
- .tmp-tests/holistic-test-A5W67x/README.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/README.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/project-history.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-B4GrCh/.holistic/state.json
- .tmp-tests/holistic-test-B4GrCh/AGENTS.md
- .tmp-tests/holistic-test-B4GrCh/CLAUDE.md
- .tmp-tests/holistic-test-B4GrCh/GEMINI.md
- .tmp-tests/holistic-test-B4GrCh/HISTORY.md
- .tmp-tests/holistic-test-B4GrCh/HOLISTIC.md
- .tmp-tests/holistic-test-B4GrCh/README.md
- .tmp-tests/holistic-test-B4GrCh/src/feature.ts
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/README.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/project-history.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-CDWaQH/.holistic/state.json
- .tmp-tests/holistic-test-CDWaQH/AGENTS.md
- .tmp-tests/holistic-test-CDWaQH/CLAUDE.md
- .tmp-tests/holistic-test-CDWaQH/GEMINI.md
- .tmp-tests/holistic-test-CDWaQH/HISTORY.md
- .tmp-tests/holistic-test-CDWaQH/HOLISTIC.md
- .tmp-tests/holistic-test-CDWaQH/README.md
- .tmp-tests/holistic-test-CDWaQH/notes.txt
- .tmp-tests/holistic-test-CN9hAg/.holistic/config.json
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/README.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/project-history.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/state.json
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/README.md
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-CN9hAg/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-CN9hAg/AGENTS.md
- .tmp-tests/holistic-test-CN9hAg/CLAUDE.md
- .tmp-tests/holistic-test-CN9hAg/GEMINI.md
- .tmp-tests/holistic-test-CN9hAg/HISTORY.md
- .tmp-tests/holistic-test-CN9hAg/HOLISTIC.md
- .tmp-tests/holistic-test-CN9hAg/README.md
- .tmp-tests/holistic-test-CXewm0/.holistic/config.json
- .tmp-tests/holistic-test-CXewm0/.holistic/context/README.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/project-history.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-CXewm0/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-CXewm0/.holistic/state.json
- .tmp-tests/holistic-test-CXewm0/.holistic/system/README.md
- .tmp-tests/holistic-test-CXewm0/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-CXewm0/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-CXewm0/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-CXewm0/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-CXewm0/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-CXewm0/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-CXewm0/AGENTS.md
- .tmp-tests/holistic-test-CXewm0/CLAUDE.md
- .tmp-tests/holistic-test-CXewm0/GEMINI.md
- .tmp-tests/holistic-test-CXewm0/HISTORY.md
- .tmp-tests/holistic-test-CXewm0/HOLISTIC.md
- .tmp-tests/holistic-test-CXewm0/README.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/config.json
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/README.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/state.json
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/README.md
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-ERv3ij/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-ERv3ij/AGENTS.md
- .tmp-tests/holistic-test-ERv3ij/CLAUDE.md
- .tmp-tests/holistic-test-ERv3ij/GEMINI.md
- .tmp-tests/holistic-test-ERv3ij/HISTORY.md
- .tmp-tests/holistic-test-ERv3ij/HOLISTIC.md
- .tmp-tests/holistic-test-ERv3ij/README.md
- .tmp-tests/holistic-test-J8aiHl/README.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/config.json
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/README.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/project-history.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/state.json
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/README.md
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-KgIHpk/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-KgIHpk/AGENTS.md
- .tmp-tests/holistic-test-KgIHpk/CLAUDE.md
- .tmp-tests/holistic-test-KgIHpk/GEMINI.md
- .tmp-tests/holistic-test-KgIHpk/HISTORY.md
- .tmp-tests/holistic-test-KgIHpk/HOLISTIC.md
- .tmp-tests/holistic-test-KgIHpk/README.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/README.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/project-history.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-N1aBLN/.holistic/state.json
- .tmp-tests/holistic-test-N1aBLN/AGENTS.md
- .tmp-tests/holistic-test-N1aBLN/CLAUDE.md
- .tmp-tests/holistic-test-N1aBLN/GEMINI.md
- .tmp-tests/holistic-test-N1aBLN/HISTORY.md
- .tmp-tests/holistic-test-N1aBLN/HOLISTIC.md
- .tmp-tests/holistic-test-N1aBLN/README.md
- .tmp-tests/holistic-test-N1aBLN/notes.txt
- .tmp-tests/holistic-test-VZmimr/.holistic/context/README.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/project-history.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-VZmimr/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-VZmimr/.holistic/state.json
- .tmp-tests/holistic-test-VZmimr/AGENTS.md
- .tmp-tests/holistic-test-VZmimr/CLAUDE.md
- .tmp-tests/holistic-test-VZmimr/GEMINI.md
- .tmp-tests/holistic-test-VZmimr/HISTORY.md
- .tmp-tests/holistic-test-VZmimr/HOLISTIC.md
- .tmp-tests/holistic-test-VZmimr/README.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/README.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/project-history.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-XX84CF/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-XX84CF/.holistic/state.json
- .tmp-tests/holistic-test-XX84CF/AGENTS.md
- .tmp-tests/holistic-test-XX84CF/CLAUDE.md
- .tmp-tests/holistic-test-XX84CF/GEMINI.md
- .tmp-tests/holistic-test-XX84CF/HISTORY.md
- .tmp-tests/holistic-test-XX84CF/HOLISTIC.md
- .tmp-tests/holistic-test-XX84CF/README.md
- .tmp-tests/holistic-test-XX84CF/src/mcp.ts
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/README.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/project-history.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-YGsLOI/.holistic/sessions/session-2026-03-21T01-22-12-175Z.json
- .tmp-tests/holistic-test-YGsLOI/.holistic/sessions/session-2026-03-21T01-22-12-195Z.json
- .tmp-tests/holistic-test-YGsLOI/.holistic/state.json
- .tmp-tests/holistic-test-YGsLOI/AGENTS.md
- .tmp-tests/holistic-test-YGsLOI/CLAUDE.md
- .tmp-tests/holistic-test-YGsLOI/GEMINI.md
- .tmp-tests/holistic-test-YGsLOI/HISTORY.md
- .tmp-tests/holistic-test-YGsLOI/HOLISTIC.md
- .tmp-tests/holistic-test-YGsLOI/README.md
- .tmp-tests/holistic-test-YGsLOI/alpha.txt
- .tmp-tests/holistic-test-YGsLOI/beta.txt
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/README.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ZiiJAg/.holistic/sessions/session-2026-03-21T01-22-12-229Z.json
- .tmp-tests/holistic-test-ZiiJAg/.holistic/state.json
- .tmp-tests/holistic-test-ZiiJAg/AGENTS.md
- .tmp-tests/holistic-test-ZiiJAg/CLAUDE.md
- .tmp-tests/holistic-test-ZiiJAg/GEMINI.md
- .tmp-tests/holistic-test-ZiiJAg/HISTORY.md
- .tmp-tests/holistic-test-ZiiJAg/HOLISTIC.md
- .tmp-tests/holistic-test-ZiiJAg/README.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/README.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/project-history.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-hK3J4I/.holistic/state.json
- .tmp-tests/holistic-test-hK3J4I/AGENTS.md
- .tmp-tests/holistic-test-hK3J4I/CLAUDE.md
- .tmp-tests/holistic-test-hK3J4I/GEMINI.md
- .tmp-tests/holistic-test-hK3J4I/HISTORY.md
- .tmp-tests/holistic-test-hK3J4I/HOLISTIC.md
- .tmp-tests/holistic-test-hK3J4I/README.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/README.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ikL0mM/.holistic/sessions/session-2026-03-21T01-22-12-152Z.json
- .tmp-tests/holistic-test-ikL0mM/.holistic/state.json
- .tmp-tests/holistic-test-ikL0mM/AGENTS.md
- .tmp-tests/holistic-test-ikL0mM/CLAUDE.md
- .tmp-tests/holistic-test-ikL0mM/GEMINI.md
- .tmp-tests/holistic-test-ikL0mM/HISTORY.md
- .tmp-tests/holistic-test-ikL0mM/HOLISTIC.md
- .tmp-tests/holistic-test-ikL0mM/README.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/README.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ppLPvX/.holistic/sessions/session-2026-03-21T01-22-12-283Z.json
- .tmp-tests/holistic-test-ppLPvX/.holistic/state.json
- .tmp-tests/holistic-test-ppLPvX/AGENTS.md
- .tmp-tests/holistic-test-ppLPvX/CLAUDE.md
- .tmp-tests/holistic-test-ppLPvX/GEMINI.md
- .tmp-tests/holistic-test-ppLPvX/HISTORY.md
- .tmp-tests/holistic-test-ppLPvX/HOLISTIC.md
- .tmp-tests/holistic-test-ppLPvX/README.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/config.json
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/README.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/project-history.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/state.json
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/README.md
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-rS9w7B/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-rS9w7B/AGENTS.md
- .tmp-tests/holistic-test-rS9w7B/CLAUDE.md
- .tmp-tests/holistic-test-rS9w7B/GEMINI.md
- .tmp-tests/holistic-test-rS9w7B/HISTORY.md
- .tmp-tests/holistic-test-rS9w7B/HOLISTIC.md
- .tmp-tests/holistic-test-rS9w7B/README.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/README.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/project-history.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-s0Vqm3/.holistic/state.json
- .tmp-tests/holistic-test-s0Vqm3/AGENTS.md
- .tmp-tests/holistic-test-s0Vqm3/CLAUDE.md
- .tmp-tests/holistic-test-s0Vqm3/GEMINI.md
- .tmp-tests/holistic-test-s0Vqm3/HISTORY.md
- .tmp-tests/holistic-test-s0Vqm3/HOLISTIC.md
- .tmp-tests/holistic-test-s0Vqm3/README.md
- src/cli.ts
- src/core/setup.ts
- tests/run-tests.ts

## Pending Work Queue

- Start using Holistic in this repo: Plan Phase 1.5 around implicit resume, auto-session inference, smarter passive checkpoints, auto-drafted handoffs, automatic sync, and machine bootstrap
- Session Three: Review HOLISTIC.md and decide the next concrete step.
- Session Two: Start third session
- Session One: Start second session
- Test branch fallback fix: Expand AgentName union to include Gemini, Copilot, Cursor, Goose, GSD

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

- Last updated: 2026-03-21T01:19:41.026Z
- Last handoff: Merged holistic2 UX improvements into holistic: root-level CLAUDE.md/GEMINI.md/HISTORY.md, --fixed regression flags, holistic start alias, AGENTS.md auto-start comment, README overhaul. Deleted holistic2.
- Pending sessions remembered: 7
