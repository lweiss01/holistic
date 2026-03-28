# ai-context.md — Holistic Project Overview

## Project Summary

**Holistic** is a CLI tool and MCP server that gives AI coding agents shared, persistent memory inside the repo itself. The core problem it solves: when you switch between AI assistants (Claude, Codex, Gemini, Copilot, Cursor, Goose, GSD), each new session starts cold. Holistic fixes that by making the repo the single source of truth for session state, handoffs, and regression warnings.

> "Your repo remembers, so your next agent doesn't have to guess."

Current version: **0.4.2** (released 2026-03-26)

---

## Project Goals

1. **Zero re-explaining** — agents read `AGENTS.md` and `HOLISTIC.md` on startup and immediately know where things stand.
2. **Cross-agent continuity** — session state, handoffs, and regression watch files work across Claude, Codex, Gemini, Copilot, Cursor, Goose, and GSD/GSD2.
3. **Regression protection** — fixed bugs and risky areas are locked into `.holistic/context/regression-watch.md` so future agents see the warning before touching them.
4. **Repo-first portability** — all portable state is committed to the repo (or synced via a hidden git ref `refs/holistic/state`). Machine-local helpers stay untracked.
5. **Low ceremony** — one setup command (`holistic bootstrap`), then daily use is just opening the repo in an agent app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (ESM, `.ts` source with `--experimental-strip-types`) |
| Runtime | Node.js 24+ |
| Build | Custom `scripts/build.mjs` (no bundler framework) |
| MCP integration | `@modelcontextprotocol/sdk` ^1.27.1 |
| Tests | Custom test runner (`tests/run-tests.ts`) |
| Package | npm (published as `holistic`) |

---

## Source Layout

```
src/
  cli.ts              — Entry point for all CLI commands
  daemon.ts           — Background passive-capture daemon
  mcp-server.ts       — Thin MCP server (holistic serve)
  core/
    types.ts          — All TypeScript interfaces (SessionRecord, HolisticState, etc.)
    state.ts          — State read/write for .holistic/state.json
    git.ts            — Git integration (snapshots, hooks, state ref sync)
    git-hooks.ts      — Hook installation (pre-push, SessionStart, UserPromptSubmit)
    sync.ts           — Cross-device sync via git ref
    docs.ts           — Generates HOLISTIC.md, AGENTS.md, adapter docs, context files
    setup.ts          — Bootstrap logic (repo scaffolding, MCP config, daemon setup)
    cli-fallback.ts   — Repo-local CLI wrapper generation (Windows + macOS/Linux)
    lock.ts           — File-based lock for concurrent access
    redact.ts         — Redacts sensitive values before writing state
    splash.ts         — ASCII banner output
```

---

## Key CLI Commands

| Command | Purpose |
|---|---|
| `holistic bootstrap` | One-step machine + repo setup (hooks, daemon, MCP config) |
| `holistic init` | Repo scaffolding only |
| `holistic start --agent <name>` | Open session, print recap |
| `holistic checkpoint --reason "..."` | Save progress snapshot |
| `holistic handoff` | End session with a handoff for the next agent |
| `holistic status` | Show current state |
| `holistic diff --from <id> --to <id>` | Compare two sessions |
| `holistic serve` | Run MCP server (stdio transport) |
| `holistic watch` | Foreground daemon mode |

---

## Supported Agents

Claude Desktop/Code, Codex, Gemini, Antigravity, GitHub Copilot, Cursor, Windsurf, Goose, GSD, GSD2.

---

## Repo Policies (important for contributors)

- This is the **public** Holistic product repo. Do not commit personal dogfooding runtime state.
- Local self-dogfooding state goes in untracked paths: `.holistic-local/`, `HOLISTIC.local.md`, `AGENTS.local.md`.
- Machine-local scripts live in `.holistic/system/` (already in `.gitignore`).
- Portable state (`.holistic/config.json`, `.holistic/state.json`, `.holistic/context/`, `.holistic/sessions/`) is meant to be committed.
