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

## Session `session-2026-03-21T01-01-43-885Z` | 2026-03-21T03:06:36.952Z | unknown

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Capture work and prepare a clean handoff.  
**Checkpoints:** 6

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
- Patch MCP checkpoints to infer claude as the agent by default

**Files changed:**
- `.claude/settings.local.json`

---

## Session `session-2026-03-21T03-11-40-952Z` | 2026-03-21T03:12:32.525Z | claude

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Implement implicit resume or context recovery when MCP clients connect  
**Checkpoints:** 1

**Recommended next steps:**
- This should be the active next step now
- Implement implicit resume or context recovery when MCP clients connect

---

## Session `session-2026-03-21T03-14-16-945Z` | 2026-03-21T03:38:28.607Z | codex

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Enable collaborative workflows with contributor tracking and team-level continuity features.  
**Checkpoints:** 7

**Work done:**
✅ Validated Claude Desktop MCP resume, checkpoint, and handoff flows in the Holistic repo
✅ Fixed MCP server lifetime, Claude default agent attribution, and latest-next-step precedence
✅ Validated Phase 1.5 through Claude Desktop MCP and Codex Desktop repo-first dogfooding
✅ Marked Phase 1.5 complete in Holistic state and roadmap docs
✅ Activated Phase 2 Team/Org Mode as the next phase

**Recommended next steps:**
- Start Phase 2 Team/Org Mode planning
- Harden live remote sync against origin/holistic/state and validate the end-to-end path
- Review Phase 2 roadmap scope
- Choose the first contributor-tracking slice
- Commit and push the Phase 1.5 workflow disappearance implementation

---

## Session `session-2026-03-21T04-06-41-194Z` | 2026-03-21T04:08:45.340Z | codex

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Capture work and prepare a clean handoff.  
**Checkpoints:** 2

**Work done:**
✅ Reviewed the role of phase tracking against the product vision and identified it as workflow-management creep
✅ Aligned on an optional work-context direction so Holistic can recognize systems like GSD2 or beads without becoming one
✅ Added workflow-neutral guiding principles to the roadmap guardrails
✅ Updated generated zero-touch guidance to reinforce optional workflow-context references over first-class planning models
✅ Recorded checkpoints clarifying that Holistic should stay focused on session continuity instead of project-planning structure
✅ Added guiding principles that Holistic should recognize workflow systems without becoming one
✅ Updated generated zero-touch guidance to reinforce lightweight workflow-context references over first-class planning models

**Recommended next steps:**
- Remove first-class phase tracking from Holistic core state, docs, and commands
- Design optional workContext metadata and detector strategy for external workflow systems such as GSD2 or beads
- Keep current goal, latest status, next steps, and references derived from checkpoints and handoffs wherever possible
- Design optional workContext metadata that can reference external workflow systems without owning them
- Add a guiding principle that Holistic should recognize workflow systems, not become one
- Design an optional workContext model and detector strategy for external workflow systems

---

## Session `session-2026-03-21T17-02-53-195Z` | 2026-03-21T17:03:52.005Z | unknown

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Remove first-class phase tracking from Holistic core state, docs, and commands  
**Checkpoints:** 1

**Work done:**
✅ Removed PhaseRecord and PhaseTracker types
✅ Removed phase commands and functions
✅ All 20 tests passing

**Recommended next steps:**
- Review roadmap docs
- Test the changes thoroughly
- Update any remaining documentation references

**Files changed:**
- `.bg-shell/manifest.json`

---

## Session `session-2026-03-21T17-09-10-181Z` | 2026-03-21T17:12:53.984Z | unknown

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Review project README for accuracy and current direction  
**Checkpoints:** 2

**Work done:**
✅ Removed all phase-related types, functions, commands, and documentation
✅ Updated tests - 20/20 passing
✅ Verified status, resume, and help commands work correctly
✅ Confirmed HOLISTIC.md and generated docs are clean
✅ Reviewed entire README.md content
✅ Confirmed overall direction and messaging is accurate
✅ Removed set-phase and complete-phase from commands table
✅ Removed all phase types, functions, commands, and documentation
✅ All 20 tests passing

**Recommended next steps:**
- Review roadmap docs
- Phase tracking removal work is complete
- Review project README for accuracy and current direction

**Files changed:**
- `.bg-shell/manifest.json`

---

## Session `session-2026-03-21T17-14-11-384Z` | 2026-03-21T18:32:38.773Z | unknown

**Branch:** `main`  
**Status:** handed_off  
**Goal:** Plan Holistic milestones M001-M003 using GSD workflow  
**Checkpoints:** 11

**Work done:**
✅ Committed 15 changed files with comprehensive commit message
✅ Pushed to GitHub successfully
✅ Refined milestone sequence: M001 Core Workflow Tightening, M002 Team/Org Mode, M003 Focused Integrations
✅ Added 'set and forget' design philosophy to roadmap docs
✅ Added 'silent partner' capture philosophy to roadmap docs
✅ Defined M001 slices: S01 auto startup, S02 proactive capture, S03 archiving, S04 health diagnostics, S05 documentation
✅ Wrote M002 and M003 draft context files for future discussion
✅ Defined slash command set: /holistic, /checkpoint, /handoff
✅ Wrote 14 active requirements with full traceability
✅ Created detailed roadmap with 5 slices, boundary map, verification strategy
✅ Documented research findings from MCP, daemon, sessions, agent patterns
✅ Created PROJECT.md with current state and milestone sequence
✅ Updated STATE.md pointing to next action: S01 planning

**Recommended next steps:**
- Begin S01: Automatic Startup Notifications slice planning
- Begin M001 detailed planning with focused research
- Work is complete

**Files changed:**
- `.beads/daemon.log`
- `.bg-shell/manifest.json`
- `.gitignore`

---

## Session `session-2026-03-21T18-32-48-379Z` | 2026-03-21T19:12:14.816Z | unknown

**Branch:** `main`  
**Status:** active  
**Goal:** Capture work and prepare a clean handoff.  
**Checkpoints:** 14

**Work done:**
✅ Researched MCP SDK notification primitives
✅ Documented findings in S01-RESEARCH.md
✅ Identified hybrid approach: enhanced tool description + manual fallback
✅ Created buildStartupGreeting() in state.ts
✅ Updated mcp-server.ts to use shared formatter
✅ All 20 tests passing
✅ Enhanced holistic_resume tool description with 🎯 emoji and clear call-to-action
✅ Updated tool to return formatted greeting instead of JSON
✅ Added comment explaining sendLoggingMessage is diagnostic only
✅ Updated test to expect formatted text instead of JSON
✅ Added holistic_slash tool to MCP server
✅ Implements auto-infer behavior for manual context loading
✅ Updated SupportedToolName type
✅ Updated test to expect 4 tools instead of 3
✅ Created mcp-notification.test.ts with 8 test cases
✅ Tests cover: empty state, active session fields, choices, adapter docs, paths, handoff, pending work, recommended command
✅ Integrated test module into run-tests.ts
✅ All 28 tests passing (20 original + 8 new)
✅ Added 'Startup Patterns' section to AGENTS.md
✅ Documented MCP vs non-MCP tool differences
✅ Added tool comparison table showing automatic vs manual triggers
✅ Updated claude-cowork.md adapter to mention holistic_resume tool for MCP
✅ All 28 tests still passing
✅ Completed T01-T06: research, implementation, tests, documentation
✅ 28 tests passing (20 original + 8 new)
✅ MCP notification enhanced with prominent tool description
✅ holistic_slash tool added for manual /holistic pattern
✅ AGENTS.md and adapters updated with startup guidance
✅ T07 UAT passed: holistic_resume returns formatted greeting
✅ T08 UAT passed: holistic_slash returns same greeting format
✅ Both tools confirmed working with real Holistic state
✅ S01 all tasks complete and UATs passing
✅ Created S01.5 slice plan for ASCII splash screen
✅ Added S01.5 to M001 roadmap
✅ Updated GSD STATE to point to S01.5/T01
✅ Created splash.ts module with renderSplash() and printSplash()
✅ Added splash to init command with status items
✅ Added splash to bootstrap command with status items
✅ Added splash to README.md header with tagline
✅ Tested in Windows terminal - renders correctly
✅ Committed and pushed 19 files to main branch
✅ S01 Automatic Startup Notifications complete and verified
✅ S01.5 ASCII Splash Screen complete and verified
✅ All 28 tests passing

**Recommended next steps:**
- User verification: T07 (MCP auto-greeting in Claude Desktop)
- User verification: T08 (/holistic command testing)
- Update M001 roadmap to mark S01 complete
- Consider adding ASCII splash screen slice
- Execute S01.5/T01: Create splash screen module
- Consider S02: Proactive Automatic Capture or other M001 slices

**Files changed:**
- `.beads/daemon.log`
- `.bg-shell/manifest.json`
- `.gitignore`
- `README.md`

