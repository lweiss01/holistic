# PROJECT

## Origin Story

**The problem that spawned Holistic:**

Development on NewsThread (an Android news aggregation app) was stalling due to context loss between AI agent sessions. Switching agents meant re-explaining the architecture. Coming back after a break meant starting over. Regressions kept coming back because new agents didn't know what had already been fixed.

**The realization:** This isn't just a NewsThread problem - it's an AI-assisted development problem. Every developer using Claude/Codex/Cursor/etc hits the same wall.

**The decision:** Pause NewsThread to build the tool that makes AI-assisted development actually sustainable across sessions, agents, and time.

**The validation:** If Holistic works well enough to unblock NewsThread, it's worth sharing with other developers.

## What This Is

Holistic is a cross-agent session continuity tool. It makes the repo itself the source of truth for session history, handoffs, and regression memory so you can switch between AI assistants (Claude, Codex, Gemini, etc.) without re-explaining the project every time.

## Core Value

**One command. Every agent. Zero re-explaining.**

Even if everything else got stripped away, agents must be able to pick up where the last one left off without the user manually re-briefing them every session.

## Current State

- **Phase 0, 1, 1.5 complete; M001/S02 complete** - foundation solid, MCP server working, daemon passive capture implemented, proactive automatic capture shipped, workflow disappearance features shipped
- **Phase tracking removed** - workflow-neutral refactor complete (March 21, 2026)
- **State sync validated on Windows** - `main` and `holistic/state` now sync successfully in dogfooding
- **~3900 LOC TypeScript** - core state engine, CLI, MCP server, daemon, git hooks, cross-device sync
- **Automated tests** - run `npm test` for the current count (core, security, redaction, MCP, Andon); the suite grows as modules land
- **Working in production** - dogfooding in this repo
- **Andon MVP scaffold in-repo** - SQLite-backed API, rules engine, collector, React dashboard, mock or **file-backed** Holistic bridge (`HOLISTIC_REPO`), SSE `session_update` snapshots, Holistic CLI telemetry hooks

**What works:**
- `holistic bootstrap` - one-command machine setup
- `holistic checkpoint` / `holistic handoff` - manual capture with structured completion metadata and safety-valve parity across CLI/MCP
- `holistic status` / `holistic diff` / `holistic resume` - inspection commands
- MCP server mode (`holistic serve`) - thin tool surface for agent-native workflows
- Daemon passive capture - background file watching with smart checkpoint clustering plus proactive 2-hour and 5-meaningful-file checkpoints
- Auto-drafted handoffs - idle and explicit completion-signal drafting with duplicate suppression
- Cross-device sync via state branch
- Git hooks for auto-checkpoint on commit

**Known product gaps:**
- Same-repo `holistic/state` sync creates GitHub "Compare & pull request" prompts, which is acceptable for dogfooding but not for the default real-project UX
- Installed `.git/hooks` can drift from tracked hook templates until hooks are regenerated or refreshed

**What's deployed:**
- Published to GitHub: https://github.com/lweiss01/holistic
- npm-ready but not yet published to registry
- Used daily in this repo

## Architecture / Key Patterns

**Tech stack:**
- TypeScript (Node.js 24+)
- MCP SDK for agent integration
- JSON state files (`.holistic/state.json`, `.holistic/sessions/*.json`)
- Git for cross-device sync
- stdio transport for MCP server

**Key patterns:**
- Repo-first continuity - portable memory in committed files, not just local state
- State locking - prevents concurrent access corruption
- Structured metadata - backward-compatible enhancement of session records
- Agent adapters - per-tool instructions in `.holistic/context/adapters/`
- Passive capture - daemon watches repo, checkpoints at quiet points
- Auto-drafted handoffs - system generates draft on idle/disconnect

**Design philosophy:**
- **"Set and forget"** - minimal CLI usage, most things automatic or agent-conversation-driven
- **"Silent partner"** - Holistic works in background, remembering everything so you don't have to
- **Agent-conversation-first** - surface state/actions through agent context, not separate dashboards
- **Workflow-neutral** - doesn't impose planning methodologies, recognizes external systems

**Key modules:**
- `src/core/state.ts` - session management, checkpoint, handoff, state persistence
- `src/core/docs.ts` - generates HOLISTIC.md, history, regression watch
- `src/core/git.ts` - repo snapshot, changed files, branch detection
- `src/cli.ts` - command-line interface
- `src/mcp-server.ts` - MCP protocol server, thin tool surface
- `src/daemon.ts` - passive background capture with smart triggers

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M000: Foundation (Phase 0, 1, 1.5) - Complete
- [ ] M001: Core Workflow Tightening - Active (automatic startup, proactive capture, memory hygiene, health diagnostics, documentation)
- [ ] M002: Team/Org Mode - Planned (contributor identity, team sessions, regression ownership, PR export)
- [ ] M003: Focused Integrations - Planned (MCP patterns, thin editor setups, compatibility tests)
- [ ] M004: Reliability Bug Hunt - Planned/partial (commit execution, sync portability, daemon reliability, repo snapshot performance)
- [ ] M005: Andon MVP - In progress (single-session baseline, local runbook, rules engine, file-backed grounding, SSE refresh, dashboard proof)
- [x] M006: Runtime Core and Persistence - Complete (runtime-core contract, runtime storage schema, runtime repository plumbing, additive compatibility audit, and reconciliation docs complete; runtime-service wiring continues in M007)
- [ ] M007: Runtime Service and Local Adapter - Planned (runtime-service API, local runner, NDJSON events, lifecycle tracking, heartbeats, stale-session detection)
- [ ] M008: Guardrails, Approvals, and Worktree Isolation - Planned (approval tiers, graceful stop escalation, per-session worktrees, dirty-worktree preservation, overlap detection)
- [ ] M009: Fleet Intelligence - Planned (activity derivation, attention ranking, failure/stall detection, approval visibility, overlap and Holistic-vs-runtime drift reasoning)
- [ ] M010: Mission Control UX - Planned (fleet homepage, `/fleet` endpoint, Fleet Header, Attention Queue, Agent Grid, Activity Heatmap, Recent Signals Rail, drill-down continuity)


