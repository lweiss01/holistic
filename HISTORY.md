# History — holistic

_Append-only log of every Holistic session. Newest entries at the bottom._

---
## Session `session-2026-03-19T19-30-32-935Z` | 2026-03-19T21:31:29.920Z | codex

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Finalize Holistic v1 implementation and validate the long-term memory workflow  
**Checkpoints:** 12

**Work done:**
✅ Implemented the Holistic CLI and repo-visible docs scaffold
✅ Added project-history.md and regression-watch.md generation
✅ Added wrapper-based git commit support for handoffs
✅ Added MIT license, contributor guide, and cross-agent walkthrough docs
✅ Updated the README with quick links to contributor and walkthrough docs
✅ Initialized Holistic in this repo with origin and the holistic/state branch
✅ Verified the repo-local resume flow and reran the full test suite

**Recommended next steps:**
- Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- Review whether you want richer history fields like affected files, severity, validation results, or user-facing outcomes.
- Decide whether you want me to add one-time install scripts for Windows/macOS/Linux so the daemon can actually run at login without manual startup.
- Decide whether you want me to add automatic post-handoff sync helpers or a dedicated Holistic state branch for cleaner cross-device propagation.
- Decide whether you want me to install the Windows startup hook on this laptop now that the repo-first sync model is in place.
- Add docs/architecture.md that separates product architecture from runtime-generated Holistic state
- Add a first-5-minutes quickstart for trying Holistic in another repo
- Add tests around holistic init CLI output and config flag propagation

**Files changed:**
- `.holistic/state.json`

---

## Session `session-2026-03-19T23-33-42-124Z` | 2026-03-19T23:35:06.517Z | codex

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Clarify Antigravity startup behavior and close the session cleanly.  
**Checkpoints:** 1

**Work done:**
✅ Reviewed the Holistic repo instructions, durable memory docs, and Antigravity adapter to verify the intended startup contract.
✅ Confirmed the zero-touch limitation: the repo can preserve memory but cannot force arbitrary IDE startup behavior by itself.
✅ Captured the expectation gap in Holistic state and created follow-up issue holistic-cuf.

**Recommended next steps:**
- Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- Decide whether to tighten docs so they stop implying Antigravity auto-resume already works.
- Investigate whether Antigravity exposes a real startup hook or workspace automation Holistic can integrate with.
- Tighten docs so they stop implying Antigravity auto-resume already works if no startup hook exists.

**Files changed:**
- `.beads/beads.db`
- `.beads/beads.db-wal`
- `.beads/daemon.log`
- `.beads/export-state/263571a4cc647266.json`
- `.beads/issues.jsonl`
- `.beads/last-touched`
- `.holistic/state.json`

---

## Session `session-2026-03-20T00-04-53-218Z` | 2026-03-20T00:05:25.833Z | codex

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.  
**Checkpoints:** 1

**Work done:**
✅ Provided a reusable hotkey-safe startup prompt for repo resume across IDEs and agent tools.
✅ Provided a reusable startup prompt the user can bind to a hotkey across IDEs and agent tools.
✅ Updated the Holistic session state so the hotkey guidance is preserved in the handoff docs.

**Recommended next steps:**
- Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- When reopening work in any tool, send the hotkey prompt first so the agent reads the repo instructions and recaps current state before acting.

**Files changed:**
- `.beads/daemon.log`
- `.holistic/state.json`

---

## Session `session-2026-03-20T00-07-50-104Z` | 2026-03-20T00:08:05.321Z | codex

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.  
**Checkpoints:** 1

**Work done:**
✅ Recorded that the startup prompt is portable across tools, while the hholistic trigger is just a local text-expander shortcut.
✅ Updated the Holistic handoff to distinguish the portable startup prompt from the local hholistic trigger.

**Recommended next steps:**
- Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- When reopening work on this laptop, use the local hholistic Beeftext shortcut to send the startup prompt.
- On other devices or tools, send the same startup prompt manually or via whatever local snippet tool is available.

**Files changed:**
- `.holistic/state.json`

---

## Session `session-2026-03-20T01-56-30-503Z` | 2026-03-20T02:39:52.256Z | claude

**Branch:** `main`  
**Status:** superseded  
**Goal:** Enhance history/regression docs with structured metadata and create implementation plans for daemon, sync, integrations, and visualization features  
**Checkpoints:** 3

**Work done:**
✅ Added Severity, OutcomeStatus, AreaTag types
✅ Added ValidationItem, ImpactNote, RegressionRisk structured types
✅ Extended SessionRecord with optional structured metadata fields
✅ Updated checkpoint and handoff inputs to support structured metadata
✅ Enhanced docs.ts with structured rendering functions
✅ Updated project history and regression watch rendering
✅ Implemented structured metadata types (Severity, OutcomeStatus, AreaTag)
✅ Created ValidationItem, ImpactNote, RegressionRisk structured types
✅ Extended SessionRecord with backward-compatible optional metadata fields
✅ Enhanced doc rendering to show structured metadata when available
✅ Created comprehensive structured-metadata.md guide with examples
✅ Created detailed roadmap for daemon passive capture (02)
✅ Created detailed roadmap for cross-device sync (03)
✅ Created detailed roadmap for agent integrations (04)
✅ Created detailed roadmap for visualization & search (05)
✅ Created roadmap README with implementation order and dependencies
✅ Created Phase 0: Code Hardening roadmap (CRITICAL - do first)
✅ Created Phase 1: Feature Expansion roadmap (MCP, diff, status, hooks)
✅ Identified 5 critical foundation bugs to fix before any marketing
✅ Restructured roadmap with clear phase dependencies
✅ Marked original roadmaps 02-05 as reference material

**Files changed:**
- `.beads/beads.db-wal`
- `.beads/daemon.log`
- `.bg-shell/manifest.json`
- `.holistic/state.json`
- `src/core/git.ts`
- `src/core/state.ts`

---

## Session `session-2026-03-20T02-39-52-257Z` | 2026-03-20T22:07:22.578Z | codex

**Branch:** `main`  
**Status:** superseded  
**Goal:** Test branch fallback fix  
**Checkpoints:** 5

**Work done:**
✅ Changed getBranchName() fallback from 'master' to 'unknown'
✅ Changed createSession() branch init from 'master' to empty string
✅ All tests passing
✅ Created 22 beads issues from roadmap
✅ Closed holistic-imq after successful fix
✅ Fixed branch fallback ambiguity (Task 1a)
✅ Expanded AgentName union with 5 new agents (Task 1b)
✅ Added state migration skeleton (Task 1c)
✅ Consolidated readline usage (Task 1d)
✅ Prepared package.json and .npmignore for publishing
✅ Fixed branch fallback ambiguity (holistic-imq)
✅ Expanded AgentName union to 8 agents (holistic-nbr)
✅ Added state migration skeleton (holistic-64o)
✅ Consolidated readline usage (holistic-eh8)
✅ Built TypeScript compilation system (holistic-yn3)
✅ Created 22 beads issues for Phases 0-4
✅ Added Windows-compatible build script
✅ Added resume reminder to Claude adapter
✅ Replaced Unix-only clean script with a Node-based clean script
✅ Replaced shell-based smoke test with a cross-platform Node smoke test
✅ Verified npm pack contents with a workspace-local npm cache
✅ Verified global install from holistic-0.1.0.tgz and smoke-tested the installed CLI
✅ Updated README install instructions to match the validated packaged flow
✅ Added a product focus guardrail to the roadmap
✅ Reframed Phase 3 as core workflow tightening
✅ Reframed Phase 4 as focused integrations with strict scope

**Recommended next steps:**
- Expand AgentName union to include Gemini, Copilot, Cursor, Goose, GSD
- Add build step for npm publishing (TypeScript → JavaScript)
- Complete Phase 0 Task 1e
- Start Phase 1 with MCP server mode (holistic serve)
- Review docs/roadmap/01-feature-expansion.md for task details
- Decide whether to publish 0.1.0 or move into Phase 1
- Use the focus guardrail when planning post-Phase-2 work
- Keep future roadmap additions tied to checkpoint, resume, handoff, review, or regression-awareness improvements

**Files changed:**
- `.holistic/config.json`
- `.holistic/state.json`
- `.holistic/state.json.lock`
- `.holistic/system/README.md`
- `.holistic/system/restore-state.ps1`
- `.holistic/system/restore-state.sh`
- `.holistic/system/run-daemon.ps1`
- `.holistic/system/run-daemon.sh`
- `.holistic/system/sync-state.ps1`
- `.holistic/system/sync-state.sh`

---

## Session `session-2026-03-20T22-07-22-579Z` | 2026-03-20T22:07:23.760Z | unknown

**Branch:** `main`  
**Status:** superseded  
**Goal:** Session one goal  
**Checkpoints:** 1

**Work done:**
✅ Added alpha

**Recommended next steps:**
- Start second session

**Files changed:**
- `.holistic/state.json`
- `.holistic/state.json.lock`

---

## Session `session-2026-03-20T22-07-23-761Z` | 2026-03-20T22:07:24.945Z | unknown

**Branch:** `main`  
**Status:** superseded  
**Goal:** Session two goal  
**Checkpoints:** 1

**Work done:**
✅ Added beta

**Recommended next steps:**
- Start third session

**Files changed:**
- `.holistic/state.json`
- `.holistic/state.json.lock`

---

## Session `session-2026-03-20T22-07-24-946Z` | 2026-03-20T22:19:30.577Z | unknown

**Branch:** `main`  
**Status:** superseded  
**Goal:** Session three goal  
**Checkpoints:** 0

**Files changed:**
- `.holistic/config.json`
- `.holistic/state.json`
- `.holistic/state.json.lock`
- `.holistic/system/README.md`
- `.holistic/system/restore-state.ps1`
- `.holistic/system/restore-state.sh`
- `.holistic/system/run-daemon.ps1`
- `.holistic/system/run-daemon.sh`
- `.holistic/system/sync-state.ps1`
- `.holistic/system/sync-state.sh`

---

## Session `session-2026-03-21T01-01-43-885Z` | 2026-03-21T01:22:23.316Z | codex

**Branch:** `main`  
**Status:** active  
**Goal:** Capture work and prepare a clean handoff.  
**Checkpoints:** 4

**Work done:**
✅ Marked Phase 1 complete and Phase 1.5 active with explicit phase tracking
✅ Sent visible Holistic resume notifications when MCP clients connect
✅ Auto-inferred sessions from pending work, handoffs, recent files, or recent commits
✅ Clustered passive repo activity before checkpointing to reduce polling noise
✅ Added explicit post-checkout branch-switch continuity checkpoints
✅ Added idle and work-milestone auto-drafted handoff generation
✅ Made holistic handoff draft-aware with a non-interactive --draft accept path
✅ Added conservative auto-sync planning and trigger hooks for checkpoint and handoff flows
✅ Hardened generated sync scripts to disable git hooks in state-branch worktrees
✅ Added holistic bootstrap command for one-step machine setup
✅ Configured Claude Desktop MCP to use the repo-local Holistic CLI entrypoint with HOLISTIC_REPO
✅ Verified bootstrap idempotence and preservation of existing MCP server entries

**Recommended next steps:**
- Implement implicit resume or context recovery when MCP clients connect
- Preserve the thin MCP tool surface while making startup lower-ceremony
- Implement auto-drafted handoffs for idle or likely session-end states
- Plan conservative automatic sync to the portable holistic/state branch
- Evaluate the remaining Phase 1.5 bootstrap work for one-command machine setup
- Revisit sync behavior in real repos once a remote state branch is available for end-to-end validation
- Decide whether Phase 1.5 should be marked complete after a quick real-world bootstrap and auto-sync validation pass
- If Phase 1.5 is complete, update docs and move to the next roadmap phase

**Files changed:**
- `.tmp-tests/holistic-bootstrap-home-4tAFKm/AppData/Roaming/Claude/claude_desktop_config.json`
- `.tmp-tests/holistic-bootstrap-home-4tAFKm/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-kgihpk.cmd`
- `.tmp-tests/holistic-bootstrap-home-c6CEWB/Library/Application Support/Claude/claude_desktop_config.json`
- `.tmp-tests/holistic-bootstrap-home-c6CEWB/Library/LaunchAgents/com.holistic.holistic-test-cxewm0.plist`
- `.tmp-tests/holistic-home-75eHBB/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/holistic-holistic-test-rs9w7b.cmd`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/README.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-01V1Q2/.holistic/state.json`
- `.tmp-tests/holistic-test-01V1Q2/AGENTS.md`
- `.tmp-tests/holistic-test-01V1Q2/CLAUDE.md`
- `.tmp-tests/holistic-test-01V1Q2/GEMINI.md`
- `.tmp-tests/holistic-test-01V1Q2/HISTORY.md`
- `.tmp-tests/holistic-test-01V1Q2/HOLISTIC.md`
- `.tmp-tests/holistic-test-01V1Q2/README.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/README.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-6dHIbS/.holistic/state.json`
- `.tmp-tests/holistic-test-6dHIbS/AGENTS.md`
- `.tmp-tests/holistic-test-6dHIbS/CLAUDE.md`
- `.tmp-tests/holistic-test-6dHIbS/GEMINI.md`
- `.tmp-tests/holistic-test-6dHIbS/HISTORY.md`
- `.tmp-tests/holistic-test-6dHIbS/HOLISTIC.md`
- `.tmp-tests/holistic-test-6dHIbS/README.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/README.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-A5W67x/.holistic/sessions/session-2026-03-21T01-22-12-424Z.json`
- `.tmp-tests/holistic-test-A5W67x/.holistic/state.json`
- `.tmp-tests/holistic-test-A5W67x/AGENTS.md`
- `.tmp-tests/holistic-test-A5W67x/CLAUDE.md`
- `.tmp-tests/holistic-test-A5W67x/GEMINI.md`
- `.tmp-tests/holistic-test-A5W67x/HISTORY.md`
- `.tmp-tests/holistic-test-A5W67x/HOLISTIC.md`
- `.tmp-tests/holistic-test-A5W67x/README.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/README.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-B4GrCh/.holistic/state.json`
- `.tmp-tests/holistic-test-B4GrCh/AGENTS.md`
- `.tmp-tests/holistic-test-B4GrCh/CLAUDE.md`
- `.tmp-tests/holistic-test-B4GrCh/GEMINI.md`
- `.tmp-tests/holistic-test-B4GrCh/HISTORY.md`
- `.tmp-tests/holistic-test-B4GrCh/HOLISTIC.md`
- `.tmp-tests/holistic-test-B4GrCh/README.md`
- `.tmp-tests/holistic-test-B4GrCh/src/feature.ts`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/README.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-CDWaQH/.holistic/state.json`
- `.tmp-tests/holistic-test-CDWaQH/AGENTS.md`
- `.tmp-tests/holistic-test-CDWaQH/CLAUDE.md`
- `.tmp-tests/holistic-test-CDWaQH/GEMINI.md`
- `.tmp-tests/holistic-test-CDWaQH/HISTORY.md`
- `.tmp-tests/holistic-test-CDWaQH/HOLISTIC.md`
- `.tmp-tests/holistic-test-CDWaQH/README.md`
- `.tmp-tests/holistic-test-CDWaQH/notes.txt`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/config.json`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/README.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/state.json`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/README.md`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/restore-state.ps1`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/restore-state.sh`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/run-daemon.ps1`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/run-daemon.sh`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/sync-state.ps1`
- `.tmp-tests/holistic-test-CN9hAg/.holistic/system/sync-state.sh`
- `.tmp-tests/holistic-test-CN9hAg/AGENTS.md`
- `.tmp-tests/holistic-test-CN9hAg/CLAUDE.md`
- `.tmp-tests/holistic-test-CN9hAg/GEMINI.md`
- `.tmp-tests/holistic-test-CN9hAg/HISTORY.md`
- `.tmp-tests/holistic-test-CN9hAg/HOLISTIC.md`
- `.tmp-tests/holistic-test-CN9hAg/README.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/config.json`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/README.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/state.json`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/README.md`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/restore-state.ps1`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/restore-state.sh`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/run-daemon.ps1`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/run-daemon.sh`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/sync-state.ps1`
- `.tmp-tests/holistic-test-CXewm0/.holistic/system/sync-state.sh`
- `.tmp-tests/holistic-test-CXewm0/AGENTS.md`
- `.tmp-tests/holistic-test-CXewm0/CLAUDE.md`
- `.tmp-tests/holistic-test-CXewm0/GEMINI.md`
- `.tmp-tests/holistic-test-CXewm0/HISTORY.md`
- `.tmp-tests/holistic-test-CXewm0/HOLISTIC.md`
- `.tmp-tests/holistic-test-CXewm0/README.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/config.json`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/README.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/state.json`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/README.md`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/restore-state.ps1`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/restore-state.sh`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/run-daemon.ps1`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/run-daemon.sh`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/sync-state.ps1`
- `.tmp-tests/holistic-test-ERv3ij/.holistic/system/sync-state.sh`
- `.tmp-tests/holistic-test-ERv3ij/AGENTS.md`
- `.tmp-tests/holistic-test-ERv3ij/CLAUDE.md`
- `.tmp-tests/holistic-test-ERv3ij/GEMINI.md`
- `.tmp-tests/holistic-test-ERv3ij/HISTORY.md`
- `.tmp-tests/holistic-test-ERv3ij/HOLISTIC.md`
- `.tmp-tests/holistic-test-ERv3ij/README.md`
- `.tmp-tests/holistic-test-J8aiHl/README.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/config.json`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/README.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/state.json`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/README.md`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/restore-state.ps1`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/restore-state.sh`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/run-daemon.ps1`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/run-daemon.sh`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/sync-state.ps1`
- `.tmp-tests/holistic-test-KgIHpk/.holistic/system/sync-state.sh`
- `.tmp-tests/holistic-test-KgIHpk/AGENTS.md`
- `.tmp-tests/holistic-test-KgIHpk/CLAUDE.md`
- `.tmp-tests/holistic-test-KgIHpk/GEMINI.md`
- `.tmp-tests/holistic-test-KgIHpk/HISTORY.md`
- `.tmp-tests/holistic-test-KgIHpk/HOLISTIC.md`
- `.tmp-tests/holistic-test-KgIHpk/README.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/README.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-N1aBLN/.holistic/state.json`
- `.tmp-tests/holistic-test-N1aBLN/AGENTS.md`
- `.tmp-tests/holistic-test-N1aBLN/CLAUDE.md`
- `.tmp-tests/holistic-test-N1aBLN/GEMINI.md`
- `.tmp-tests/holistic-test-N1aBLN/HISTORY.md`
- `.tmp-tests/holistic-test-N1aBLN/HOLISTIC.md`
- `.tmp-tests/holistic-test-N1aBLN/README.md`
- `.tmp-tests/holistic-test-N1aBLN/notes.txt`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/README.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-VZmimr/.holistic/state.json`
- `.tmp-tests/holistic-test-VZmimr/AGENTS.md`
- `.tmp-tests/holistic-test-VZmimr/CLAUDE.md`
- `.tmp-tests/holistic-test-VZmimr/GEMINI.md`
- `.tmp-tests/holistic-test-VZmimr/HISTORY.md`
- `.tmp-tests/holistic-test-VZmimr/HOLISTIC.md`
- `.tmp-tests/holistic-test-VZmimr/README.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/README.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-XX84CF/.holistic/state.json`
- `.tmp-tests/holistic-test-XX84CF/AGENTS.md`
- `.tmp-tests/holistic-test-XX84CF/CLAUDE.md`
- `.tmp-tests/holistic-test-XX84CF/GEMINI.md`
- `.tmp-tests/holistic-test-XX84CF/HISTORY.md`
- `.tmp-tests/holistic-test-XX84CF/HOLISTIC.md`
- `.tmp-tests/holistic-test-XX84CF/README.md`
- `.tmp-tests/holistic-test-XX84CF/src/mcp.ts`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/README.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/sessions/session-2026-03-21T01-22-12-175Z.json`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/sessions/session-2026-03-21T01-22-12-195Z.json`
- `.tmp-tests/holistic-test-YGsLOI/.holistic/state.json`
- `.tmp-tests/holistic-test-YGsLOI/AGENTS.md`
- `.tmp-tests/holistic-test-YGsLOI/CLAUDE.md`
- `.tmp-tests/holistic-test-YGsLOI/GEMINI.md`
- `.tmp-tests/holistic-test-YGsLOI/HISTORY.md`
- `.tmp-tests/holistic-test-YGsLOI/HOLISTIC.md`
- `.tmp-tests/holistic-test-YGsLOI/README.md`
- `.tmp-tests/holistic-test-YGsLOI/alpha.txt`
- `.tmp-tests/holistic-test-YGsLOI/beta.txt`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/README.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/sessions/session-2026-03-21T01-22-12-229Z.json`
- `.tmp-tests/holistic-test-ZiiJAg/.holistic/state.json`
- `.tmp-tests/holistic-test-ZiiJAg/AGENTS.md`
- `.tmp-tests/holistic-test-ZiiJAg/CLAUDE.md`
- `.tmp-tests/holistic-test-ZiiJAg/GEMINI.md`
- `.tmp-tests/holistic-test-ZiiJAg/HISTORY.md`
- `.tmp-tests/holistic-test-ZiiJAg/HOLISTIC.md`
- `.tmp-tests/holistic-test-ZiiJAg/README.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/README.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-hK3J4I/.holistic/state.json`
- `.tmp-tests/holistic-test-hK3J4I/AGENTS.md`
- `.tmp-tests/holistic-test-hK3J4I/CLAUDE.md`
- `.tmp-tests/holistic-test-hK3J4I/GEMINI.md`
- `.tmp-tests/holistic-test-hK3J4I/HISTORY.md`
- `.tmp-tests/holistic-test-hK3J4I/HOLISTIC.md`
- `.tmp-tests/holistic-test-hK3J4I/README.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/README.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/sessions/session-2026-03-21T01-22-12-152Z.json`
- `.tmp-tests/holistic-test-ikL0mM/.holistic/state.json`
- `.tmp-tests/holistic-test-ikL0mM/AGENTS.md`
- `.tmp-tests/holistic-test-ikL0mM/CLAUDE.md`
- `.tmp-tests/holistic-test-ikL0mM/GEMINI.md`
- `.tmp-tests/holistic-test-ikL0mM/HISTORY.md`
- `.tmp-tests/holistic-test-ikL0mM/HOLISTIC.md`
- `.tmp-tests/holistic-test-ikL0mM/README.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/README.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/sessions/session-2026-03-21T01-22-12-283Z.json`
- `.tmp-tests/holistic-test-ppLPvX/.holistic/state.json`
- `.tmp-tests/holistic-test-ppLPvX/AGENTS.md`
- `.tmp-tests/holistic-test-ppLPvX/CLAUDE.md`
- `.tmp-tests/holistic-test-ppLPvX/GEMINI.md`
- `.tmp-tests/holistic-test-ppLPvX/HISTORY.md`
- `.tmp-tests/holistic-test-ppLPvX/HOLISTIC.md`
- `.tmp-tests/holistic-test-ppLPvX/README.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/config.json`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/README.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/state.json`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/README.md`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/restore-state.ps1`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/restore-state.sh`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/run-daemon.ps1`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/run-daemon.sh`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/sync-state.ps1`
- `.tmp-tests/holistic-test-rS9w7B/.holistic/system/sync-state.sh`
- `.tmp-tests/holistic-test-rS9w7B/AGENTS.md`
- `.tmp-tests/holistic-test-rS9w7B/CLAUDE.md`
- `.tmp-tests/holistic-test-rS9w7B/GEMINI.md`
- `.tmp-tests/holistic-test-rS9w7B/HISTORY.md`
- `.tmp-tests/holistic-test-rS9w7B/HOLISTIC.md`
- `.tmp-tests/holistic-test-rS9w7B/README.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/README.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/adapters/antigravity.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/adapters/claude-cowork.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/adapters/codex.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/current-plan.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/project-history.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/regression-watch.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/session-protocol.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/context/zero-touch.md`
- `.tmp-tests/holistic-test-s0Vqm3/.holistic/state.json`
- `.tmp-tests/holistic-test-s0Vqm3/AGENTS.md`
- `.tmp-tests/holistic-test-s0Vqm3/CLAUDE.md`
- `.tmp-tests/holistic-test-s0Vqm3/GEMINI.md`
- `.tmp-tests/holistic-test-s0Vqm3/HISTORY.md`
- `.tmp-tests/holistic-test-s0Vqm3/HOLISTIC.md`
- `.tmp-tests/holistic-test-s0Vqm3/README.md`
- `src/cli.ts`
- `src/core/setup.ts`
- `tests/run-tests.ts`

