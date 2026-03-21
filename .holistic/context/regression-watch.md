# Regression Watch

Use this before changing existing behavior. It is the short list of fixes and outcomes that future agents should preserve.

## Remove first-class phase tracking from Holistic core state, docs, and commands

- Goal: Review project README for accuracy and current direction
- Durable changes:
- Removed all phase-related types, functions, commands, and documentation
- Updated tests - 20/20 passing
- Verified status, resume, and help commands work correctly
- Confirmed HOLISTIC.md and generated docs are clean
- Reviewed entire README.md content
- Confirmed overall direction and messaging is accurate
- Removed set-phase and complete-phase from commands table
- Removed all phase types, functions, commands, and documentation
- All 20 tests passing
- Why this matters:
- Holistic is workflow-neutral and doesn't impose planning methodologies
- Simpler codebase with clearer focus on session continuity
- README now accurately reflects the workflow-neutral approach
- No references to removed phase tracking features remain in user-facing docs
- Holistic is workflow-neutral
- Do not regress:
- Do not reintroduce first-class workflow structures into core state
- Do not reintroduce workflow structures
- Source session: session-2026-03-21T17-09-10-181Z

## Remove first-class phase tracking from Holistic core state, docs, and commands

- Goal: Remove first-class phase tracking from Holistic core state, docs, and commands
- Durable changes:
- Removed PhaseRecord and PhaseTracker types
- Removed phase commands and functions
- All 20 tests passing
- Why this matters:
- Holistic is now workflow-neutral and doesn't hard-code planning methodologies
- Phase tracking commands (set-phase, complete-phase) removed from CLI
- Phase types removed from type system
- Holistic is now workflow-neutral
- Do not regress:
- Do not reintroduce workflow-specific planning structures into core state
- Keep Holistic focused on durable session continuity, not project planning
- Do not reintroduce workflow structures
- Source session: session-2026-03-21T17-02-53-195Z

## Capture work and prepare a clean handoff.

- Goal: Capture work and prepare a clean handoff.
- Durable changes:
- Reviewed the role of phase tracking against the product vision and identified it as workflow-management creep
- Aligned on an optional work-context direction so Holistic can recognize systems like GSD2 or beads without becoming one
- Added workflow-neutral guiding principles to the roadmap guardrails
- Updated generated zero-touch guidance to reinforce optional workflow-context references over first-class planning models
- Recorded checkpoints clarifying that Holistic should stay focused on session continuity instead of project-planning structure
- Added guiding principles that Holistic should recognize workflow systems without becoming one
- Updated generated zero-touch guidance to reinforce lightweight workflow-context references over first-class planning models
- Why this matters:
- Holistic stays focused on session continuity instead of hard-coding one planning methodology into the product.
- Future integrations can attach workflow metadata without making phases, slices, or tickets first-class Holistic concepts.
- The repo now records anti-bloat guidance in both roadmap and generated operating docs.
- The product direction is now explicitly guarded against planning-model bloat and workflow lock-in.
- Do not regress:
- Do not let Holistic drift into owning project-planning structure such as phases or slices.
- Prefer inferred or explicit workflow context references over first-class workflow-management commands.
- Do not let future continuity features hard-code phases, slices, or other methodology-specific planning structures into the core model.
- Source session: session-2026-03-21T04-06-41-194Z

## Plan Phase 2 Team/Org Mode

- Goal: Enable collaborative workflows with contributor tracking and team-level continuity features.
- Durable changes:
- Validated Claude Desktop MCP resume, checkpoint, and handoff flows in the Holistic repo
- Fixed MCP server lifetime, Claude default agent attribution, and latest-next-step precedence
- Validated Phase 1.5 through Claude Desktop MCP and Codex Desktop repo-first dogfooding
- Marked Phase 1.5 complete in Holistic state and roadmap docs
- Activated Phase 2 Team/Org Mode as the next phase
- Why this matters:
- Phase 1.5 is now implementation-complete and dogfooded in the Holistic repo.
- Phase 2 can now begin from a validated low-ceremony workflow baseline.
- The repo now records a validated low-ceremony workflow baseline and is ready to begin Phase 2.
- Do not regress:
- Do not let MCP servers exit immediately after stdio connect.
- Do not let fresh handoff next steps lose priority behind stale older items.
- Source session: session-2026-03-21T03-14-16-945Z

## Capture work and prepare a clean handoff.

- Goal: Capture work and prepare a clean handoff.
- Durable changes:
- Marked Phase 1 complete and Phase 1.5 active with explicit phase tracking
- Sent visible Holistic resume notifications when MCP clients connect
- Auto-inferred sessions from pending work, handoffs, recent files, or recent commits
- Clustered passive repo activity before checkpointing to reduce polling noise
- Added explicit post-checkout branch-switch continuity checkpoints
- Added idle and work-milestone auto-drafted handoff generation
- Made holistic handoff draft-aware with a non-interactive --draft accept path
- Added conservative auto-sync planning and trigger hooks for checkpoint and handoff flows
- Hardened generated sync scripts to disable git hooks in state-branch worktrees
- Added holistic bootstrap command for one-step machine setup
- Configured Claude Desktop MCP to use the repo-local Holistic CLI entrypoint with HOLISTIC_REPO
- Verified bootstrap idempotence and preservation of existing MCP server entries
- Why this matters:
- Phase 1.5 work is now beginning from an explicit tracked phase state
- Phase 1.5 now covers implicit resume, auto-session inference, and smarter passive checkpoint triggers.
- Phase 1.5 now covers implicit resume, auto-session inference, smarter passive checkpoints, auto-drafted handoffs, and conservative auto-sync triggers.
- Phase 1.5 now includes an end-to-end bootstrap path so new machines can be prepared with much less ceremony.
- Do not regress:
- Keep the MCP integration thin and avoid adding startup ceremony while improving continuity
- Passive checkpoints should ignore Holistic's own portable state files and avoid re-checkpointing on bookkeeping churn.
- Branch switches should produce a single explicit continuity checkpoint instead of repeated daemon noise.
- Auto-drafted handoffs should only refresh when the source session meaningfully changes and should never finalize a session without explicit handoff confirmation.
- Auto-sync must stay hook-safe so syncing portable state cannot recursively create more Holistic activity.
- Bootstrap must remain idempotent and should never clobber unrelated Claude Desktop MCP server entries.
- Repo-local MCP bootstrap must keep pointing at the current Holistic CLI entrypoint so development setups work without a global install.
- Source session: session-2026-03-21T01-01-43-885Z

## Session Two

- Goal: Session two goal
- Durable changes:
- Added beta
- Why this matters:
- No impact notes recorded.
- Do not regress:
- Keep beta behavior
- Source session: session-2026-03-20T22-07-23-761Z

## Session One

- Goal: Session one goal
- Durable changes:
- Added alpha
- Why this matters:
- No impact notes recorded.
- Do not regress:
- Keep alpha behavior
- Source session: session-2026-03-20T22-07-22-579Z

## Test branch fallback fix

- Goal: Test branch fallback fix
- Durable changes:
- Changed getBranchName() fallback from 'master' to 'unknown'
- Changed createSession() branch init from 'master' to empty string
- All tests passing
- Created 22 beads issues from roadmap
- Closed holistic-imq after successful fix
- Fixed branch fallback ambiguity (Task 1a)
- Expanded AgentName union with 5 new agents (Task 1b)
- Added state migration skeleton (Task 1c)
- Consolidated readline usage (Task 1d)
- Prepared package.json and .npmignore for publishing
- Fixed branch fallback ambiguity (holistic-imq)
- Expanded AgentName union to 8 agents (holistic-nbr)
- Added state migration skeleton (holistic-64o)
- Consolidated readline usage (holistic-eh8)
- Built TypeScript compilation system (holistic-yn3)
- Created 22 beads issues for Phases 0-4
- Added Windows-compatible build script
- Added resume reminder to Claude adapter
- Replaced Unix-only clean script with a Node-based clean script
- Replaced shell-based smoke test with a cross-platform Node smoke test
- Verified npm pack contents with a workspace-local npm cache
- Verified global install from holistic-0.1.0.tgz and smoke-tested the installed CLI
- Updated README install instructions to match the validated packaged flow
- Added a product focus guardrail to the roadmap
- Reframed Phase 3 as core workflow tightening
- Reframed Phase 4 as focused integrations with strict scope
- Why this matters:
- Failed git reads now visibly different from actual 'master' branch
- Phase 0 foundation fixes prevent embarrassing bugs when users arrive
- 4/5 critical bugs fixed - only npm publishing remains
- Foundation prevents embarrassing bugs when users arrive
- All 8 agent types now supported with adapters
- Schema changes have safe migration path
- Windows users can now build successfully
- Phase 0 packaging and install validation now succeeds on Windows
- prepublishOnly now runs a real smoke test before publish
- The roadmap now protects Holistic's niche instead of drifting toward an everything tool
- Later-phase planning is now constrained to features that improve durable context continuity
- Do not regress:
- Do not use 'master' as a fallback value anywhere - use 'unknown' for failures
- Node.js --experimental-strip-types doesn't work in node_modules, must build to JS
- Always test npm install -g locally before publishing
- Never skip Phase 0 on future projects - foundation matters
- Keep package scripts cross-platform; do not reintroduce Unix-only rm or shell redirection
- Keep README install instructions aligned with the packaged tarball flow
- Do not add late-phase roadmap work that broadens Holistic beyond durable cross-agent context continuity without a clear continuity payoff
- Source session: session-2026-03-20T02-39-52-257Z

## Structured metadata and roadmap planning

- Goal: Enhance history/regression docs with structured metadata and create implementation plans for daemon, sync, integrations, and visualization features
- Durable changes:
- Added Severity, OutcomeStatus, AreaTag types
- Added ValidationItem, ImpactNote, RegressionRisk structured types
- Extended SessionRecord with optional structured metadata fields
- Updated checkpoint and handoff inputs to support structured metadata
- Enhanced docs.ts with structured rendering functions
- Updated project history and regression watch rendering
- Implemented structured metadata types (Severity, OutcomeStatus, AreaTag)
- Created ValidationItem, ImpactNote, RegressionRisk structured types
- Extended SessionRecord with backward-compatible optional metadata fields
- Enhanced doc rendering to show structured metadata when available
- Created comprehensive structured-metadata.md guide with examples
- Created detailed roadmap for daemon passive capture (02)
- Created detailed roadmap for cross-device sync (03)
- Created detailed roadmap for agent integrations (04)
- Created detailed roadmap for visualization & search (05)
- Created roadmap README with implementation order and dependencies
- Created Phase 0: Code Hardening roadmap (CRITICAL - do first)
- Created Phase 1: Feature Expansion roadmap (MCP, diff, status, hooks)
- Identified 5 critical foundation bugs to fix before any marketing
- Restructured roadmap with clear phase dependencies
- Marked original roadmaps 02-05 as reference material
- Why this matters:
- History and regression docs can now show severity, affected areas, outcome status, and validation checklists
- Backward compatible - existing sessions continue working with plain text
- History and regression docs now support rich metadata (severity, areas, outcomes, validation checklists)
- Roadmaps provide 2-3 session implementation plans for each major feature
- Clear path forward: daemon+sync (foundation), integrations (adoption), visualization (scale)
- Backward compatible - existing sessions work unchanged, new sessions can use structured metadata
- Phase 0 prevents embarrassing bugs when new users arrive
- MCP server (Phase 1) enables invisible capture in agents - most powerful adoption unlock
- Clear path: fix foundation → build features → enable teams → grow audience → IDE extensions
- Do not regress:
- Do not remove legacy impactNotes and regressionRisks string arrays - needed for backward compatibility
- Do not remove legacy impactNotes/regressionRisks string arrays - backward compatibility
- Rendering logic must check for structured metadata first, gracefully fall back to plain text
- Do NOT skip Phase 0 - building on shaky foundation wastes time
- Do NOT publish features before fixing branch fallback ambiguity
- Do NOT add new agent names without expanding AgentName union first
- Source session: session-2026-03-20T01-56-30-503Z

## Finalize Holistic v1 implementation

- Goal: Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- Durable changes:
- Recorded that the startup prompt is portable across tools, while the hholistic trigger is just a local text-expander shortcut.
- Updated the Holistic handoff to distinguish the portable startup prompt from the local hholistic trigger.
- Why this matters:
- The handoff now distinguishes between portable prompt content and a machine-specific hotkey trigger, which should reduce confusion in future sessions.
- Future sessions now have a clearer explanation that the prompt content is portable but the hotkey trigger is machine-specific.
- Do not regress:
- Do not imply that hholistic or any specific hotkey name is portable across devices or IDEs.
- Source session: session-2026-03-20T00-07-50-104Z

## Finalize Holistic v1 implementation

- Goal: Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- Durable changes:
- Provided a reusable hotkey-safe startup prompt for repo resume across IDEs and agent tools.
- Provided a reusable startup prompt the user can bind to a hotkey across IDEs and agent tools.
- Updated the Holistic session state so the hotkey guidance is preserved in the handoff docs.
- Why this matters:
- The next session can start with a consistent agent-agnostic startup prompt instead of relying on tool-specific behavior or memory.
- Do not regress:
- Do not assume repo initialization alone will make every IDE agent read the Holistic docs automatically on open.
- Source session: session-2026-03-20T00-04-53-218Z

## Finalize Holistic v1 implementation

- Goal: Clarify Antigravity startup behavior and close the session cleanly.
- Durable changes:
- Reviewed the Holistic repo instructions, durable memory docs, and Antigravity adapter to verify the intended startup contract.
- Confirmed the zero-touch limitation: the repo can preserve memory but cannot force arbitrary IDE startup behavior by itself.
- Captured the expectation gap in Holistic state and created follow-up issue holistic-cuf.
- Why this matters:
- Clarified the current gap between the intended Antigravity resume experience and what one-time repo init can actually guarantee.
- Future agents now have an explicit record that one-time repo init alone does not deliver the expected Antigravity startup prompt experience.
- Do not regress:
- Do not imply that repo initialization alone can force Antigravity IDE to ask the user what to do on startup.
- Source session: session-2026-03-19T23-33-42-124Z

## Finalize Holistic v1 implementation

- Goal: Finalize Holistic v1 implementation and validate the long-term memory workflow
- Durable changes:
- Implemented the Holistic CLI and repo-visible docs scaffold
- Added project-history.md and regression-watch.md generation
- Added wrapper-based git commit support for handoffs
- Added MIT license, contributor guide, and cross-agent walkthrough docs
- Updated the README with quick links to contributor and walkthrough docs
- Initialized Holistic in this repo with origin and the holistic/state branch
- Verified the repo-local resume flow and reran the full test suite
- Why this matters:
- Completed sessions now feed a durable project history document for future agents.
- Important fixes can now leave behind explicit rationale and overall impact notes.
- Long-term memory is visible immediately, not only after completed handoffs.
- Future agents can review both current state and durable historical context before changing existing behavior.
- Fixed behaviors can carry explicit rationale forward instead of depending on chat memory.
- Background capture is preserving repo activity without requiring a manual session-start command.
- Holistic now has a machine-layer path toward seamless passive capture across tools.
- Repo-visible memory remains the portable source of truth even when a tool only partially cooperates.
- Cross-device continuity no longer depends on a daemon being present everywhere.
- Handoff docs, project history, and regression memory are the portable layer agents can read on any device.
- Holistic now has generated sync/restore scripts for cross-device propagation.
- A dedicated holistic/state branch can distribute portable memory without tying it to one working branch.
- The repo now has a cleaner public onboarding path for collaborators and evaluators
- Holistic is now dogfooding itself locally in this repo
- The next session can start from a concrete roadmap instead of reconstructing follow-up work
- Do not regress:
- Before changing existing behavior, agents should review regression-watch.md so earlier fixes do not get broken accidentally.
- Behavior that was fixed in one session should be preserved unless the user explicitly wants it changed.
- Agents should still formalize important fixes with handoff metadata so archive entries stay precise over time.
- Agents should review regression-watch.md before modifying areas that were previously stabilized.
- Handoffs should include impact and regression notes whenever a fix changes behavior that could be re-broken later.
- Background capture reduces the chance that work is forgotten when agents switch tools or contexts.
- A repo alone still cannot force arbitrary apps to participate; true zero-touch requires either daemon installation or app integrations.
- Agents should treat zero-touch.md as the source of truth for what is and is not automatic.
- If sessions need to continue on another device, the handoff commit still needs to be synced to the remote repo.
- The daemon should be treated as optional; agents must not assume it exists everywhere.
- Cross-device continuity still depends on syncing the repo or state branch after handoff.
- Devices that do not have the daemon installed should still rely on repo-visible memory and synced handoff commits.
- Do not accidentally commit this repo's live local Holistic runtime state into the product repo
- Keep the public docs aligned with actual CLI and init behavior
- Preserve the repo-first, cross-device design instead of drifting toward a laptop-only workflow
- Source session: session-2026-03-19T19-30-32-935Z

