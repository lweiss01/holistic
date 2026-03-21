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

Fixed Windows first-run state-branch sync so holistic/state can be created cleanly

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
- .tmp-tests/holistic-bootstrap-home-SSbhP8/AppData/Roaming/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-SSbhP8/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-cs92jp.cmd
- .tmp-tests/holistic-bootstrap-home-viZjLD/Library/Application Support/Claude/claude_desktop_config.json
- .tmp-tests/holistic-bootstrap-home-viZjLD/Library/LaunchAgents/com.holistic.holistic-test-tm1wuk.plist
- .tmp-tests/holistic-home-kAvTYR/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-nx3urm.cmd
- .tmp-tests/holistic-test-00GmJI/.holistic/context/README.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/project-history.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-00GmJI/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-00GmJI/.holistic/sessions/session-2026-03-21T19-56-12-619Z.json
- .tmp-tests/holistic-test-00GmJI/.holistic/state.json
- .tmp-tests/holistic-test-00GmJI/AGENTS.md
- .tmp-tests/holistic-test-00GmJI/CLAUDE.md
- .tmp-tests/holistic-test-00GmJI/GEMINI.md
- .tmp-tests/holistic-test-00GmJI/HISTORY.md
- .tmp-tests/holistic-test-00GmJI/HOLISTIC.md
- .tmp-tests/holistic-test-00GmJI/README.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/README.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/project-history.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-6Bixw8/.holistic/state.json
- .tmp-tests/holistic-test-6Bixw8/AGENTS.md
- .tmp-tests/holistic-test-6Bixw8/CLAUDE.md
- .tmp-tests/holistic-test-6Bixw8/GEMINI.md
- .tmp-tests/holistic-test-6Bixw8/HISTORY.md
- .tmp-tests/holistic-test-6Bixw8/HOLISTIC.md
- .tmp-tests/holistic-test-6Bixw8/README.md
- .tmp-tests/holistic-test-6Bixw8/src/feature.ts
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/README.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/project-history.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-DOgz4B/.holistic/sessions/session-2026-03-21T19-56-12-463Z.json
- .tmp-tests/holistic-test-DOgz4B/.holistic/sessions/session-2026-03-21T19-56-12-490Z.json
- .tmp-tests/holistic-test-DOgz4B/.holistic/state.json
- .tmp-tests/holistic-test-DOgz4B/AGENTS.md
- .tmp-tests/holistic-test-DOgz4B/CLAUDE.md
- .tmp-tests/holistic-test-DOgz4B/GEMINI.md
- .tmp-tests/holistic-test-DOgz4B/HISTORY.md
- .tmp-tests/holistic-test-DOgz4B/HOLISTIC.md
- .tmp-tests/holistic-test-DOgz4B/README.md
- .tmp-tests/holistic-test-DOgz4B/alpha.txt
- .tmp-tests/holistic-test-DOgz4B/beta.txt
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/README.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/project-history.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-DWBUoH/.holistic/sessions/session-2026-03-21T19-56-12-434Z.json
- .tmp-tests/holistic-test-DWBUoH/.holistic/state.json
- .tmp-tests/holistic-test-DWBUoH/AGENTS.md
- .tmp-tests/holistic-test-DWBUoH/CLAUDE.md
- .tmp-tests/holistic-test-DWBUoH/GEMINI.md
- .tmp-tests/holistic-test-DWBUoH/HISTORY.md
- .tmp-tests/holistic-test-DWBUoH/HOLISTIC.md
- .tmp-tests/holistic-test-DWBUoH/README.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/README.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/project-history.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-L4CWOc/.holistic/state.json
- .tmp-tests/holistic-test-L4CWOc/AGENTS.md
- .tmp-tests/holistic-test-L4CWOc/CLAUDE.md
- .tmp-tests/holistic-test-L4CWOc/GEMINI.md
- .tmp-tests/holistic-test-L4CWOc/HISTORY.md
- .tmp-tests/holistic-test-L4CWOc/HOLISTIC.md
- .tmp-tests/holistic-test-L4CWOc/README.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/config.json
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/README.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/project-history.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/state.json
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/README.md
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-Tm1wUK/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-Tm1wUK/AGENTS.md
- .tmp-tests/holistic-test-Tm1wUK/CLAUDE.md
- .tmp-tests/holistic-test-Tm1wUK/GEMINI.md
- .tmp-tests/holistic-test-Tm1wUK/HISTORY.md
- .tmp-tests/holistic-test-Tm1wUK/HOLISTIC.md
- .tmp-tests/holistic-test-Tm1wUK/README.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/README.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/project-history.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-UUtH97/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-UUtH97/.holistic/state.json
- .tmp-tests/holistic-test-UUtH97/AGENTS.md
- .tmp-tests/holistic-test-UUtH97/CLAUDE.md
- .tmp-tests/holistic-test-UUtH97/GEMINI.md
- .tmp-tests/holistic-test-UUtH97/HISTORY.md
- .tmp-tests/holistic-test-UUtH97/HOLISTIC.md
- .tmp-tests/holistic-test-UUtH97/README.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/README.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/project-history.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-Usdx1y/.holistic/state.json
- .tmp-tests/holistic-test-Usdx1y/AGENTS.md
- .tmp-tests/holistic-test-Usdx1y/CLAUDE.md
- .tmp-tests/holistic-test-Usdx1y/GEMINI.md
- .tmp-tests/holistic-test-Usdx1y/HISTORY.md
- .tmp-tests/holistic-test-Usdx1y/HOLISTIC.md
- .tmp-tests/holistic-test-Usdx1y/README.md
- .tmp-tests/holistic-test-Usdx1y/notes.txt
- .tmp-tests/holistic-test-aMWOgz/.holistic/config.json
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/README.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/project-history.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/state.json
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/README.md
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-aMWOgz/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-aMWOgz/AGENTS.md
- .tmp-tests/holistic-test-aMWOgz/CLAUDE.md
- .tmp-tests/holistic-test-aMWOgz/GEMINI.md
- .tmp-tests/holistic-test-aMWOgz/HISTORY.md
- .tmp-tests/holistic-test-aMWOgz/HOLISTIC.md
- .tmp-tests/holistic-test-aMWOgz/README.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/config.json
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/README.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/project-history.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/state.json
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/README.md
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-cs92Jp/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-cs92Jp/AGENTS.md
- .tmp-tests/holistic-test-cs92Jp/CLAUDE.md
- .tmp-tests/holistic-test-cs92Jp/GEMINI.md
- .tmp-tests/holistic-test-cs92Jp/HISTORY.md
- .tmp-tests/holistic-test-cs92Jp/HOLISTIC.md
- .tmp-tests/holistic-test-cs92Jp/README.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/README.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/project-history.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-lCju2H/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-lCju2H/.holistic/sessions/session-2026-03-21T19-56-12-772Z.json
- .tmp-tests/holistic-test-lCju2H/.holistic/state.json
- .tmp-tests/holistic-test-lCju2H/AGENTS.md
- .tmp-tests/holistic-test-lCju2H/CLAUDE.md
- .tmp-tests/holistic-test-lCju2H/GEMINI.md
- .tmp-tests/holistic-test-lCju2H/HISTORY.md
- .tmp-tests/holistic-test-lCju2H/HOLISTIC.md
- .tmp-tests/holistic-test-lCju2H/README.md
- .tmp-tests/holistic-test-nX3urM/.holistic/config.json
- .tmp-tests/holistic-test-nX3urM/.holistic/context/README.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/project-history.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-nX3urM/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-nX3urM/.holistic/state.json
- .tmp-tests/holistic-test-nX3urM/.holistic/system/README.md
- .tmp-tests/holistic-test-nX3urM/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-nX3urM/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-nX3urM/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-nX3urM/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-nX3urM/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-nX3urM/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-nX3urM/AGENTS.md
- .tmp-tests/holistic-test-nX3urM/CLAUDE.md
- .tmp-tests/holistic-test-nX3urM/GEMINI.md
- .tmp-tests/holistic-test-nX3urM/HISTORY.md
- .tmp-tests/holistic-test-nX3urM/HOLISTIC.md
- .tmp-tests/holistic-test-nX3urM/README.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/config.json
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/README.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/project-history.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/state.json
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/README.md
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/restore-state.ps1
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/restore-state.sh
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/run-daemon.ps1
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/run-daemon.sh
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/sync-state.ps1
- .tmp-tests/holistic-test-o4q5oY/.holistic/system/sync-state.sh
- .tmp-tests/holistic-test-o4q5oY/AGENTS.md
- .tmp-tests/holistic-test-o4q5oY/CLAUDE.md
- .tmp-tests/holistic-test-o4q5oY/GEMINI.md
- .tmp-tests/holistic-test-o4q5oY/HISTORY.md
- .tmp-tests/holistic-test-o4q5oY/HOLISTIC.md
- .tmp-tests/holistic-test-o4q5oY/README.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/README.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/project-history.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-rjQTe8/.holistic/sessions/session-2026-03-21T19-56-12-527Z.json
- .tmp-tests/holistic-test-rjQTe8/.holistic/state.json
- .tmp-tests/holistic-test-rjQTe8/AGENTS.md
- .tmp-tests/holistic-test-rjQTe8/CLAUDE.md
- .tmp-tests/holistic-test-rjQTe8/GEMINI.md
- .tmp-tests/holistic-test-rjQTe8/HISTORY.md
- .tmp-tests/holistic-test-rjQTe8/HOLISTIC.md
- .tmp-tests/holistic-test-rjQTe8/README.md
- .tmp-tests/holistic-test-tAgbxB/README.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/README.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/project-history.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-xg3ShL/.holistic/state.json
- .tmp-tests/holistic-test-xg3ShL/AGENTS.md
- .tmp-tests/holistic-test-xg3ShL/CLAUDE.md
- .tmp-tests/holistic-test-xg3ShL/GEMINI.md
- .tmp-tests/holistic-test-xg3ShL/HISTORY.md
- .tmp-tests/holistic-test-xg3ShL/HOLISTIC.md
- .tmp-tests/holistic-test-xg3ShL/README.md
- .tmp-tests/holistic-test-xg3ShL/notes.txt
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/README.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/project-history.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-yNV0Hb/.holistic/sessions/session-2026-03-21T19-56-12-593Z.json
- .tmp-tests/holistic-test-yNV0Hb/.holistic/state.json
- .tmp-tests/holistic-test-yNV0Hb/AGENTS.md
- .tmp-tests/holistic-test-yNV0Hb/CLAUDE.md
- .tmp-tests/holistic-test-yNV0Hb/GEMINI.md
- .tmp-tests/holistic-test-yNV0Hb/HISTORY.md
- .tmp-tests/holistic-test-yNV0Hb/HOLISTIC.md
- .tmp-tests/holistic-test-yNV0Hb/README.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/README.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/project-history.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-yd12pi/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-yd12pi/.holistic/state.json
- .tmp-tests/holistic-test-yd12pi/AGENTS.md
- .tmp-tests/holistic-test-yd12pi/CLAUDE.md
- .tmp-tests/holistic-test-yd12pi/GEMINI.md
- .tmp-tests/holistic-test-yd12pi/HISTORY.md
- .tmp-tests/holistic-test-yd12pi/HOLISTIC.md
- .tmp-tests/holistic-test-yd12pi/README.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/README.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/adapters/antigravity.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/adapters/claude-cowork.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/adapters/codex.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/current-plan.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/project-history.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/regression-watch.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/session-protocol.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/context/zero-touch.md
- .tmp-tests/holistic-test-z3JuEP/.holistic/state.json
- .tmp-tests/holistic-test-z3JuEP/AGENTS.md
- .tmp-tests/holistic-test-z3JuEP/CLAUDE.md
- .tmp-tests/holistic-test-z3JuEP/GEMINI.md
- .tmp-tests/holistic-test-z3JuEP/HISTORY.md
- .tmp-tests/holistic-test-z3JuEP/HOLISTIC.md
- .tmp-tests/holistic-test-z3JuEP/README.md
- .tmp-tests/holistic-test-z3JuEP/src/mcp.ts
- dist/__tests__/mcp-notification.test.d.ts
- dist/__tests__/mcp-notification.test.d.ts.map
- dist/__tests__/mcp-notification.test.js
- dist/__tests__/mcp-notification.test.js.map
- dist/cli.d.ts
- dist/cli.d.ts.map
- dist/cli.js
- dist/cli.js.map
- dist/core/docs.d.ts
- dist/core/docs.d.ts.map
- dist/core/docs.js
- dist/core/docs.js.map
- dist/core/git-hooks.d.ts
- dist/core/git-hooks.d.ts.map
- dist/core/git-hooks.js
- dist/core/git-hooks.js.map
- dist/core/git.d.ts
- dist/core/git.d.ts.map
- dist/core/git.js
- dist/core/git.js.map
- dist/core/lock.d.ts
- dist/core/lock.d.ts.map
- dist/core/lock.js
- dist/core/lock.js.map
- dist/core/redact.d.ts
- dist/core/redact.d.ts.map
- dist/core/redact.js
- dist/core/redact.js.map
- dist/core/setup.d.ts
- dist/core/setup.d.ts.map
- dist/core/setup.js
- dist/core/setup.js.map
- dist/core/splash.d.ts
- dist/core/splash.d.ts.map
- dist/core/splash.js
- dist/core/splash.js.map
- dist/core/state.d.ts
- dist/core/state.d.ts.map
- dist/core/state.js
- dist/core/state.js.map
- dist/core/sync.d.ts
- dist/core/sync.d.ts.map
- dist/core/sync.js
- dist/core/sync.js.map
- dist/core/types.d.ts
- dist/core/types.d.ts.map
- dist/core/types.js
- dist/core/types.js.map
- dist/daemon.d.ts
- dist/daemon.d.ts.map
- dist/daemon.js
- dist/daemon.js.map
- dist/mcp-server.d.ts
- dist/mcp-server.d.ts.map
- dist/mcp-server.js
- dist/mcp-server.js.map
- src/__tests__/mcp-notification.test.ts
- src/cli.ts
- src/core/docs.ts
- src/core/git.ts
- src/core/setup.ts
- src/core/state.ts
- src/daemon.ts
- src/mcp-server.ts
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

- Last updated: 2026-03-21T19:46:19.681Z
- Last handoff: S01 & S01.5 complete: automatic startup notifications + ASCII branding shipped to production
- Pending sessions remembered: 12
