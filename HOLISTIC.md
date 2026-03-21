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

Updated pre-push Holistic sync hint to recommend the generated helper scripts

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
- Holistic now points users at the supported cross-platform sync path instead of a misleading raw branch push

## Regression Watch

- Do not print decorative output to stdout in MCP server mode
- Keep resume/start banner changes out of MCP tool responses
- Keep README startup command descriptions aligned with actual CLI output
- Do not assume the remote holistic/state branch already exists when generating Windows sync helpers
- Do not reintroduce raw git push origin holistic/state as the primary user hint for syncing Holistic state

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/daemon.log
- .tmp-tests/holistic-bootstrap-home-bSUrpA/Library/Application Support/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-bSUrpA/Library/LaunchAgents/com.holistic.holistic-test-rzmkpt.plist
- .tmp-tests/holistic-bootstrap-home-mv04uU/AppData/Roaming/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-mv04uU/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-wt6dbc.cmd
- .tmp-tests/holistic-home-ygmfxI/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-ljilpj.cmd
- .tmp-tests/holistic-test-DxzA18/.holistic/context/README.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/project-history.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-DxzA18/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-DxzA18/.holistic/sessions/session-2026-03-21T20-01-42-829Z.json
- .tmp-tests/holistic-test-DxzA18/.holistic/state.json
- .tmp-tests/holistic-test-DxzA18/AGENTS.md
- .tmp-tests/holistic-test-DxzA18/CLAUDE.md
- .tmp-tests/holistic-test-DxzA18/GEMINI.md
- .tmp-tests/holistic-test-DxzA18/HISTORY.md
- .tmp-tests/holistic-test-DxzA18/HOLISTIC.md
- .tmp-tests/holistic-test-DxzA18/README.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/README.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/project-history.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-F5AZqA/.holistic/sessions/session-2026-03-21T20-01-43-025Z.json
- .tmp-tests/holistic-test-F5AZqA/.holistic/state.json
- .tmp-tests/holistic-test-F5AZqA/AGENTS.md
- .tmp-tests/holistic-test-F5AZqA/CLAUDE.md
- .tmp-tests/holistic-test-F5AZqA/GEMINI.md
- .tmp-tests/holistic-test-F5AZqA/HISTORY.md
- .tmp-tests/holistic-test-F5AZqA/HOLISTIC.md
- .tmp-tests/holistic-test-F5AZqA/README.md
- .tmp-tests/holistic-test-G4H9Qp/README.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/config.json
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/README.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/project-history.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/state.json
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/README.md
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-Ljilpj/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-Ljilpj/AGENTS.md
- .tmp-tests/holistic-test-Ljilpj/CLAUDE.md
- .tmp-tests/holistic-test-Ljilpj/GEMINI.md
- .tmp-tests/holistic-test-Ljilpj/HISTORY.md
- .tmp-tests/holistic-test-Ljilpj/HOLISTIC.md
- .tmp-tests/holistic-test-Ljilpj/README.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/README.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/project-history.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-RYbovT/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-RYbovT/.holistic/state.json
- .tmp-tests/holistic-test-RYbovT/AGENTS.md
- .tmp-tests/holistic-test-RYbovT/CLAUDE.md
- .tmp-tests/holistic-test-RYbovT/GEMINI.md
- .tmp-tests/holistic-test-RYbovT/HISTORY.md
- .tmp-tests/holistic-test-RYbovT/HOLISTIC.md
- .tmp-tests/holistic-test-RYbovT/README.md
- .tmp-tests/holistic-test-RYbovT/notes.txt
- .tmp-tests/holistic-test-XXpPve/.holistic/context/README.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/project-history.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-XXpPve/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-XXpPve/.holistic/state.json
- .tmp-tests/holistic-test-XXpPve/AGENTS.md
- .tmp-tests/holistic-test-XXpPve/CLAUDE.md
- .tmp-tests/holistic-test-XXpPve/GEMINI.md
- .tmp-tests/holistic-test-XXpPve/HISTORY.md
- .tmp-tests/holistic-test-XXpPve/HOLISTIC.md
- .tmp-tests/holistic-test-XXpPve/README.md
- .tmp-tests/holistic-test-XXpPve/notes.txt
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/config.json
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/README.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/project-history.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/state.json
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/README.md
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-Z3Gfe2/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-Z3Gfe2/AGENTS.md
- .tmp-tests/holistic-test-Z3Gfe2/CLAUDE.md
- .tmp-tests/holistic-test-Z3Gfe2/GEMINI.md
- .tmp-tests/holistic-test-Z3Gfe2/HISTORY.md
- .tmp-tests/holistic-test-Z3Gfe2/HOLISTIC.md
- .tmp-tests/holistic-test-Z3Gfe2/README.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/README.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/project-history.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-e03Wd7/.holistic/state.json
- .tmp-tests/holistic-test-e03Wd7/AGENTS.md
- .tmp-tests/holistic-test-e03Wd7/CLAUDE.md
- .tmp-tests/holistic-test-e03Wd7/GEMINI.md
- .tmp-tests/holistic-test-e03Wd7/HISTORY.md
- .tmp-tests/holistic-test-e03Wd7/HOLISTIC.md
- .tmp-tests/holistic-test-e03Wd7/README.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/README.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/project-history.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-fgCUuO/.holistic/sessions/session-2026-03-21T20-01-42-856Z.json
- .tmp-tests/holistic-test-fgCUuO/.holistic/sessions/session-2026-03-21T20-01-42-879Z.json
- .tmp-tests/holistic-test-fgCUuO/.holistic/state.json
- .tmp-tests/holistic-test-fgCUuO/AGENTS.md
- .tmp-tests/holistic-test-fgCUuO/CLAUDE.md
- .tmp-tests/holistic-test-fgCUuO/GEMINI.md
- .tmp-tests/holistic-test-fgCUuO/HISTORY.md
- .tmp-tests/holistic-test-fgCUuO/HOLISTIC.md
- .tmp-tests/holistic-test-fgCUuO/README.md
- .tmp-tests/holistic-test-fgCUuO/alpha.txt
- .tmp-tests/holistic-test-fgCUuO/beta.txt
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/README.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/project-history.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-fkqMtf/.holistic/state.json
- .tmp-tests/holistic-test-fkqMtf/AGENTS.md
- .tmp-tests/holistic-test-fkqMtf/CLAUDE.md
- .tmp-tests/holistic-test-fkqMtf/GEMINI.md
- .tmp-tests/holistic-test-fkqMtf/HISTORY.md
- .tmp-tests/holistic-test-fkqMtf/HOLISTIC.md
- .tmp-tests/holistic-test-fkqMtf/README.md
- .tmp-tests/holistic-test-fkqMtf/src/feature.ts
- .tmp-tests/holistic-test-jT8rot/.holistic/context/README.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/project-history.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-jT8rot/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-jT8rot/.holistic/state.json
- .tmp-tests/holistic-test-jT8rot/AGENTS.md
- .tmp-tests/holistic-test-jT8rot/CLAUDE.md
- .tmp-tests/holistic-test-jT8rot/GEMINI.md
- .tmp-tests/holistic-test-jT8rot/HISTORY.md
- .tmp-tests/holistic-test-jT8rot/HOLISTIC.md
- .tmp-tests/holistic-test-jT8rot/README.md
- .tmp-tests/holistic-test-jT8rot/src/mcp.ts
- .tmp-tests/holistic-test-japDg9/.holistic/context/README.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/project-history.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-japDg9/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-japDg9/.holistic/state.json
- .tmp-tests/holistic-test-japDg9/AGENTS.md
- .tmp-tests/holistic-test-japDg9/CLAUDE.md
- .tmp-tests/holistic-test-japDg9/GEMINI.md
- .tmp-tests/holistic-test-japDg9/HISTORY.md
- .tmp-tests/holistic-test-japDg9/HOLISTIC.md
- .tmp-tests/holistic-test-japDg9/README.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/README.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/project-history.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-oQu9AS/.holistic/sessions/session-2026-03-21T20-01-42-995Z.json
- .tmp-tests/holistic-test-oQu9AS/.holistic/state.json
- .tmp-tests/holistic-test-oQu9AS/AGENTS.md
- .tmp-tests/holistic-test-oQu9AS/CLAUDE.md
- .tmp-tests/holistic-test-oQu9AS/GEMINI.md
- .tmp-tests/holistic-test-oQu9AS/HISTORY.md
- .tmp-tests/holistic-test-oQu9AS/HOLISTIC.md
- .tmp-tests/holistic-test-oQu9AS/README.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/config.json
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/README.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/project-history.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/state.json
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/README.md
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-rzmKpt/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-rzmKpt/AGENTS.md
- .tmp-tests/holistic-test-rzmKpt/CLAUDE.md
- .tmp-tests/holistic-test-rzmKpt/GEMINI.md
- .tmp-tests/holistic-test-rzmKpt/HISTORY.md
- .tmp-tests/holistic-test-rzmKpt/HOLISTIC.md
- .tmp-tests/holistic-test-rzmKpt/README.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/README.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/project-history.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-ueVb5G/.holistic/state.json
- .tmp-tests/holistic-test-ueVb5G/AGENTS.md
- .tmp-tests/holistic-test-ueVb5G/CLAUDE.md
- .tmp-tests/holistic-test-ueVb5G/GEMINI.md
- .tmp-tests/holistic-test-ueVb5G/HISTORY.md
- .tmp-tests/holistic-test-ueVb5G/HOLISTIC.md
- .tmp-tests/holistic-test-ueVb5G/README.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/config.json
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/README.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/project-history.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/state.json
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/README.md
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-vWZbcX/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-vWZbcX/AGENTS.md
- .tmp-tests/holistic-test-vWZbcX/CLAUDE.md
- .tmp-tests/holistic-test-vWZbcX/GEMINI.md
- .tmp-tests/holistic-test-vWZbcX/HISTORY.md
- .tmp-tests/holistic-test-vWZbcX/HOLISTIC.md
- .tmp-tests/holistic-test-vWZbcX/README.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/README.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/project-history.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-w66uOY/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-w66uOY/.holistic/sessions/session-2026-03-21T20-01-42-913Z.json
- .tmp-tests/holistic-test-w66uOY/.holistic/state.json
- .tmp-tests/holistic-test-w66uOY/AGENTS.md
- .tmp-tests/holistic-test-w66uOY/CLAUDE.md
- .tmp-tests/holistic-test-w66uOY/GEMINI.md
- .tmp-tests/holistic-test-w66uOY/HISTORY.md
- .tmp-tests/holistic-test-w66uOY/HOLISTIC.md
- .tmp-tests/holistic-test-w66uOY/README.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/README.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/project-history.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-wnbMOV/.holistic/sessions/session-2026-03-21T20-01-43-176Z.json
- .tmp-tests/holistic-test-wnbMOV/.holistic/state.json
- .tmp-tests/holistic-test-wnbMOV/AGENTS.md
- .tmp-tests/holistic-test-wnbMOV/CLAUDE.md
- .tmp-tests/holistic-test-wnbMOV/GEMINI.md
- .tmp-tests/holistic-test-wnbMOV/HISTORY.md
- .tmp-tests/holistic-test-wnbMOV/HOLISTIC.md
- .tmp-tests/holistic-test-wnbMOV/README.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/config.json
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/README.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/project-history.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/state.json
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/README.md
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-wt6dBc/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-wt6dBc/AGENTS.md
- .tmp-tests/holistic-test-wt6dBc/CLAUDE.md
- .tmp-tests/holistic-test-wt6dBc/GEMINI.md
- .tmp-tests/holistic-test-wt6dBc/HISTORY.md
- .tmp-tests/holistic-test-wt6dBc/HOLISTIC.md
- .tmp-tests/holistic-test-wt6dBc/README.md
- src/core/git-hooks.ts
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

- Last updated: 2026-03-21T20:00:01.700Z
- Last handoff: S01 & S01.5 complete: automatic startup notifications + ASCII branding shipped to production
- Pending sessions remembered: 12
