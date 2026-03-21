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

Committed: fix(sync): quiet PowerShell state-branch fetch output

## What Was Tried

- No tried items captured yet.

## What To Try Next

- Run `holistic start-new --goal "Describe the task"` to begin capturing work.

## Active Plan

- Read HOLISTIC.md
- Confirm next step with the user

## Overall Impact So Far

- CLI startup flow now shows Holistic branding more consistently in PowerShell
- CLI startup docs now match observed PowerShell behavior
- Fresh Holistic repos on Windows can create and push the dedicated holistic/state branch on first sync

## Regression Watch

- Do not print decorative output to stdout in MCP server mode
- Keep resume/start banner changes out of MCP tool responses
- Keep README startup command descriptions aligned with actual CLI output
- Do not assume the remote holistic/state branch already exists when generating Windows sync helpers

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/daemon.log
- .tmp-tests/holistic-bootstrap-home-CmyYdu/AppData/Roaming/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-CmyYdu/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-oxwp25.cmd
- .tmp-tests/holistic-bootstrap-home-N6vBGb/Library/Application Support/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-N6vBGb/Library/LaunchAgents/com.holistic.holistic-test-oeclh5.plist
- .tmp-tests/holistic-home-KnIElk/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-rfgx9b.cmd
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/README.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/project-history.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-1I39WZ/.holistic/sessions/session-2026-03-21T19-59-43-829Z.json
- .tmp-tests/holistic-test-1I39WZ/.holistic/sessions/session-2026-03-21T19-59-43-850Z.json
- .tmp-tests/holistic-test-1I39WZ/.holistic/state.json
- .tmp-tests/holistic-test-1I39WZ/AGENTS.md
- .tmp-tests/holistic-test-1I39WZ/CLAUDE.md
- .tmp-tests/holistic-test-1I39WZ/GEMINI.md
- .tmp-tests/holistic-test-1I39WZ/HISTORY.md
- .tmp-tests/holistic-test-1I39WZ/HOLISTIC.md
- .tmp-tests/holistic-test-1I39WZ/README.md
- .tmp-tests/holistic-test-1I39WZ/alpha.txt
- .tmp-tests/holistic-test-1I39WZ/beta.txt
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/README.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/project-history.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-8zAzUE/.holistic/sessions/session-2026-03-21T19-59-43-963Z.json
- .tmp-tests/holistic-test-8zAzUE/.holistic/state.json
- .tmp-tests/holistic-test-8zAzUE/AGENTS.md
- .tmp-tests/holistic-test-8zAzUE/CLAUDE.md
- .tmp-tests/holistic-test-8zAzUE/GEMINI.md
- .tmp-tests/holistic-test-8zAzUE/HISTORY.md
- .tmp-tests/holistic-test-8zAzUE/HOLISTIC.md
- .tmp-tests/holistic-test-8zAzUE/README.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/README.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/project-history.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-EHjoh3/.holistic/state.json
- .tmp-tests/holistic-test-EHjoh3/AGENTS.md
- .tmp-tests/holistic-test-EHjoh3/CLAUDE.md
- .tmp-tests/holistic-test-EHjoh3/GEMINI.md
- .tmp-tests/holistic-test-EHjoh3/HISTORY.md
- .tmp-tests/holistic-test-EHjoh3/HOLISTIC.md
- .tmp-tests/holistic-test-EHjoh3/README.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/README.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ET369B/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ET369B/.holistic/sessions/session-2026-03-21T19-59-43-939Z.json
- .tmp-tests/holistic-test-ET369B/.holistic/state.json
- .tmp-tests/holistic-test-ET369B/AGENTS.md
- .tmp-tests/holistic-test-ET369B/CLAUDE.md
- .tmp-tests/holistic-test-ET369B/GEMINI.md
- .tmp-tests/holistic-test-ET369B/HISTORY.md
- .tmp-tests/holistic-test-ET369B/HOLISTIC.md
- .tmp-tests/holistic-test-ET369B/README.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/README.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/project-history.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-HKyeBT/.holistic/state.json
- .tmp-tests/holistic-test-HKyeBT/AGENTS.md
- .tmp-tests/holistic-test-HKyeBT/CLAUDE.md
- .tmp-tests/holistic-test-HKyeBT/GEMINI.md
- .tmp-tests/holistic-test-HKyeBT/HISTORY.md
- .tmp-tests/holistic-test-HKyeBT/HOLISTIC.md
- .tmp-tests/holistic-test-HKyeBT/README.md
- .tmp-tests/holistic-test-HKyeBT/src/mcp.ts
- .tmp-tests/holistic-test-OECLh5/.holistic/config.json
- .tmp-tests/holistic-test-OECLh5/.holistic/context/README.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/project-history.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-OECLh5/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-OECLh5/.holistic/state.json
- .tmp-tests/holistic-test-OECLh5/.holistic/system/README.md
- .tmp-tests/holistic-test-OECLh5/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-OECLh5/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-OECLh5/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-OECLh5/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-OECLh5/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-OECLh5/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-OECLh5/AGENTS.md
- .tmp-tests/holistic-test-OECLh5/CLAUDE.md
- .tmp-tests/holistic-test-OECLh5/GEMINI.md
- .tmp-tests/holistic-test-OECLh5/HISTORY.md
- .tmp-tests/holistic-test-OECLh5/HOLISTIC.md
- .tmp-tests/holistic-test-OECLh5/README.md
- .tmp-tests/holistic-test-OxWp25/.holistic/config.json
- .tmp-tests/holistic-test-OxWp25/.holistic/context/README.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/project-history.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-OxWp25/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-OxWp25/.holistic/state.json
- .tmp-tests/holistic-test-OxWp25/.holistic/system/README.md
- .tmp-tests/holistic-test-OxWp25/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-OxWp25/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-OxWp25/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-OxWp25/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-OxWp25/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-OxWp25/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-OxWp25/AGENTS.md
- .tmp-tests/holistic-test-OxWp25/CLAUDE.md
- .tmp-tests/holistic-test-OxWp25/GEMINI.md
- .tmp-tests/holistic-test-OxWp25/HISTORY.md
- .tmp-tests/holistic-test-OxWp25/HOLISTIC.md
- .tmp-tests/holistic-test-OxWp25/README.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/config.json
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/README.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/project-history.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/state.json
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/README.md
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-Rfgx9b/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-Rfgx9b/AGENTS.md
- .tmp-tests/holistic-test-Rfgx9b/CLAUDE.md
- .tmp-tests/holistic-test-Rfgx9b/GEMINI.md
- .tmp-tests/holistic-test-Rfgx9b/HISTORY.md
- .tmp-tests/holistic-test-Rfgx9b/HOLISTIC.md
- .tmp-tests/holistic-test-Rfgx9b/README.md
- .tmp-tests/holistic-test-T6ttev/.holistic/config.json
- .tmp-tests/holistic-test-T6ttev/.holistic/context/README.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/project-history.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-T6ttev/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-T6ttev/.holistic/state.json
- .tmp-tests/holistic-test-T6ttev/.holistic/system/README.md
- .tmp-tests/holistic-test-T6ttev/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-T6ttev/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-T6ttev/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-T6ttev/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-T6ttev/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-T6ttev/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-T6ttev/AGENTS.md
- .tmp-tests/holistic-test-T6ttev/CLAUDE.md
- .tmp-tests/holistic-test-T6ttev/GEMINI.md
- .tmp-tests/holistic-test-T6ttev/HISTORY.md
- .tmp-tests/holistic-test-T6ttev/HOLISTIC.md
- .tmp-tests/holistic-test-T6ttev/README.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/README.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/project-history.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-bwhxzf/.holistic/sessions/session-2026-03-21T19-59-43-802Z.json
- .tmp-tests/holistic-test-bwhxzf/.holistic/state.json
- .tmp-tests/holistic-test-bwhxzf/AGENTS.md
- .tmp-tests/holistic-test-bwhxzf/CLAUDE.md
- .tmp-tests/holistic-test-bwhxzf/GEMINI.md
- .tmp-tests/holistic-test-bwhxzf/HISTORY.md
- .tmp-tests/holistic-test-bwhxzf/HOLISTIC.md
- .tmp-tests/holistic-test-bwhxzf/README.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/README.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/project-history.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-d9Kyiq/.holistic/state.json
- .tmp-tests/holistic-test-d9Kyiq/AGENTS.md
- .tmp-tests/holistic-test-d9Kyiq/CLAUDE.md
- .tmp-tests/holistic-test-d9Kyiq/GEMINI.md
- .tmp-tests/holistic-test-d9Kyiq/HISTORY.md
- .tmp-tests/holistic-test-d9Kyiq/HOLISTIC.md
- .tmp-tests/holistic-test-d9Kyiq/README.md
- .tmp-tests/holistic-test-d9Kyiq/src/feature.ts
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/README.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/project-history.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-f8jOjY/.holistic/state.json
- .tmp-tests/holistic-test-f8jOjY/AGENTS.md
- .tmp-tests/holistic-test-f8jOjY/CLAUDE.md
- .tmp-tests/holistic-test-f8jOjY/GEMINI.md
- .tmp-tests/holistic-test-f8jOjY/HISTORY.md
- .tmp-tests/holistic-test-f8jOjY/HOLISTIC.md
- .tmp-tests/holistic-test-f8jOjY/README.md
- .tmp-tests/holistic-test-f8jOjY/notes.txt
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/README.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/project-history.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-fSGwiB/.holistic/state.json
- .tmp-tests/holistic-test-fSGwiB/AGENTS.md
- .tmp-tests/holistic-test-fSGwiB/CLAUDE.md
- .tmp-tests/holistic-test-fSGwiB/GEMINI.md
- .tmp-tests/holistic-test-fSGwiB/HISTORY.md
- .tmp-tests/holistic-test-fSGwiB/HOLISTIC.md
- .tmp-tests/holistic-test-fSGwiB/README.md
- .tmp-tests/holistic-test-fSGwiB/notes.txt
- .tmp-tests/holistic-test-nHriCM/.holistic/context/README.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/project-history.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-nHriCM/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-nHriCM/.holistic/sessions/session-2026-03-21T19-59-43-884Z.json
- .tmp-tests/holistic-test-nHriCM/.holistic/state.json
- .tmp-tests/holistic-test-nHriCM/AGENTS.md
- .tmp-tests/holistic-test-nHriCM/CLAUDE.md
- .tmp-tests/holistic-test-nHriCM/GEMINI.md
- .tmp-tests/holistic-test-nHriCM/HISTORY.md
- .tmp-tests/holistic-test-nHriCM/HOLISTIC.md
- .tmp-tests/holistic-test-nHriCM/README.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/README.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/project-history.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-oPGRCO/.holistic/state.json
- .tmp-tests/holistic-test-oPGRCO/AGENTS.md
- .tmp-tests/holistic-test-oPGRCO/CLAUDE.md
- .tmp-tests/holistic-test-oPGRCO/GEMINI.md
- .tmp-tests/holistic-test-oPGRCO/HISTORY.md
- .tmp-tests/holistic-test-oPGRCO/HOLISTIC.md
- .tmp-tests/holistic-test-oPGRCO/README.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/README.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/project-history.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-sJIwlh/.holistic/sessions/session-2026-03-21T19-59-44-124Z.json
- .tmp-tests/holistic-test-sJIwlh/.holistic/state.json
- .tmp-tests/holistic-test-sJIwlh/AGENTS.md
- .tmp-tests/holistic-test-sJIwlh/CLAUDE.md
- .tmp-tests/holistic-test-sJIwlh/GEMINI.md
- .tmp-tests/holistic-test-sJIwlh/HISTORY.md
- .tmp-tests/holistic-test-sJIwlh/HOLISTIC.md
- .tmp-tests/holistic-test-sJIwlh/README.md
- .tmp-tests/holistic-test-tWw2Eq/README.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/config.json
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/README.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/project-history.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/state.json
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/README.md
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-xkKQSs/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-xkKQSs/AGENTS.md
- .tmp-tests/holistic-test-xkKQSs/CLAUDE.md
- .tmp-tests/holistic-test-xkKQSs/GEMINI.md
- .tmp-tests/holistic-test-xkKQSs/HISTORY.md
- .tmp-tests/holistic-test-xkKQSs/HOLISTIC.md
- .tmp-tests/holistic-test-xkKQSs/README.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/README.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ygfDSd/.holistic/state.json
- .tmp-tests/holistic-test-ygfDSd/AGENTS.md
- .tmp-tests/holistic-test-ygfDSd/CLAUDE.md
- .tmp-tests/holistic-test-ygfDSd/GEMINI.md
- .tmp-tests/holistic-test-ygfDSd/HISTORY.md
- .tmp-tests/holistic-test-ygfDSd/HOLISTIC.md
- .tmp-tests/holistic-test-ygfDSd/README.md
- src/core/setup.ts
- tests/run-tests.ts

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

- Last updated: 2026-03-21T19:56:45.589Z
- Last handoff: S01 & S01.5 complete: automatic startup notifications + ASCII branding shipped to production
- Pending sessions remembered: 12
