# PROJECT

## What This Is

Holistic is a cross-agent session continuity tool. It makes the repo itself the source of truth for session history, handoffs, and regression memory so you can switch between AI assistants (Claude, Codex, Gemini, etc.) without re-explaining the project every time.

## Core Value

**One command. Every agent. Zero re-explaining.**

Even if everything else got stripped away, agents must be able to pick up where the last one left off without the user manually re-briefing them every session.

## Current State

- **Phase 0, 1, 1.5 complete** — foundation solid, MCP server working, daemon passive capture implemented, workflow disappearance features shipped
- **Phase tracking removed** — workflow-neutral refactor complete (March 21, 2026)
- **~3900 LOC TypeScript** — core state engine, CLI, MCP server, daemon, git hooks, cross-device sync
- **20 tests passing** — comprehensive coverage
- **Working in production** — dogfooding in this repo

**What works:**
- `holistic bootstrap` — one-command machine setup
- `holistic checkpoint` / `holistic handoff` — manual capture
- `holistic status` / `holistic diff` / `holistic resume` — inspection commands
- MCP server mode (`holistic serve`) — thin tool surface for agent-native workflows
- Daemon passive capture — background file watching with smart checkpoint clustering
- Cross-device sync via state branch
- Git hooks for auto-checkpoint on commit

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
- Repo-first continuity — portable memory in committed files, not just local state
- State locking — prevents concurrent access corruption
- Structured metadata — backward-compatible enhancement of session records
- Agent adapters — per-tool instructions in `.holistic/context/adapters/`
- Passive capture — daemon watches repo, checkpoints at quiet points
- Auto-drafted handoffs — system generates draft on idle/disconnect

**Design philosophy:**
- **"Set and forget"** — minimal CLI usage, most things automatic or agent-conversation-driven
- **"Silent partner"** — Holistic works in background, remembering everything so you don't have to
- **Agent-conversation-first** — surface state/actions through agent context, not separate dashboards
- **Workflow-neutral** — doesn't impose planning methodologies, recognizes external systems

**Key modules:**
- `src/core/state.ts` — session management, checkpoint, handoff, state persistence
- `src/core/docs.ts` — generates HOLISTIC.md, history, regression watch
- `src/core/git.ts` — repo snapshot, changed files, branch detection
- `src/cli.ts` — command-line interface
- `src/mcp-server.ts` — MCP protocol server, thin tool surface
- `src/daemon.ts` — passive background capture with smart triggers

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M000: Foundation (Phase 0, 1, 1.5) — Complete
- [ ] M001: Core Workflow Tightening — Active (automatic startup, proactive capture, memory hygiene, health diagnostics, documentation)
- [ ] M002: Team/Org Mode — Planned (contributor identity, team sessions, regression ownership, PR export)
- [ ] M003: Focused Integrations — Planned (MCP patterns, thin editor setups, compatibility tests)
