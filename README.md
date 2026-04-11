# Holistic

```
██╗  ██╗ ██████╗ ██╗     ██╗███████╗████████╗██╗ ██████╗
██║  ██║██╔═══██╗██║     ██║██╔════╝╚══██╔══╝██║██╔════╝
███████║██║   ██║██║     ██║███████╗   ██║   ██║██║     
██╔══██║██║   ██║██║     ██║╚════██║   ██║   ██║██║     
██║  ██║╚██████╔╝███████╗██║███████║   ██║   ██║╚██████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝

Your repo remembers, so your next agent doesn't have to guess.
Shared memory for AI agents, built into your repo.
```

[![npm version](https://img.shields.io/npm/v/holistic.svg)](https://www.npmjs.com/package/holistic)
[![Tests](https://img.shields.io/github/actions/workflow/status/lweiss01/holistic/test.yml?branch=main&label=tests)](https://github.com/lweiss01/holistic/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](./package.json)

### One command. Every agent. Zero re-explaining. ✨

Holistic gives your AI agents shared memory inside the repo itself. When you switch from Claude to Codex to Gemini, the next agent can see what happened last time, what not to break, and what should happen next.


---


### Why trust this?

- 🔐 No known security vulnerabilities
- 🧪 60+ automated tests covering core flows
- 🛠️ Actively maintained (frequent releases)
- 🔍 Transparent local setup (see `SECURITY.md`)

> Early beta, but built to be safe, inspectable, and predictable.


---


## Get started in 30 seconds ⚡

Open your project repo in PowerShell, Terminal, Command Prompt, or whatever shell you normally use.

Requires Node.js 24+.

Run these two commands:

```bash
npm install -g holistic
holistic bootstrap --yes
```

After that, open the repo in your agent app and use this startup prompt:

```text
Before doing any other work, read AGENTS.md and HOLISTIC.md, recap the current state briefly, and ask me exactly one question: continue as planned, tweak the plan, or start something new.
```

That is enough to get the basic Holistic workflow working.

If you want the fuller install and setup details, jump to [Quick start](#quick-start-).


---


## The problem 😵

If you use more than one AI coding assistant, the workflow usually falls apart:

- 🔁 You re-explain the project every session.
- 🐞 Bugs come back because the next agent does not know what was already fixed.
- 🧠 Progress gets lost when context windows end.
- 💥 Agents undo each other because there is no durable handoff.
- 🌫️ It is hard to tell what is actually done.

Holistic fixes that by making the repo the source of truth.


---


## What it feels like with HOLISTIC 🌿

Run one setup command on a machine:

```bash
holistic bootstrap
```

Then daily use is mostly:

1. Open the repo in Codex, Claude, or another supported app.
2. Start a fresh session.
3. Ask the agent to read `AGENTS.md` and `HOLISTIC.md`.
4. Let Holistic carry continuity through checkpoints, handoffs, and repo memory.

Most days, you do not need to keep a terminal process open or manually re-brief the agent.

`holistic bootstrap` is a machine setup command, not just a repo setup command. By default it can install local startup helpers and configure Claude Desktop MCP on that machine.


---


## How it works 🧭

```text
holistic bootstrap
      ->
You open a repo in your agent app
      ->
The agent reads HOLISTIC.md and AGENTS.md
      ->
"Here's where we left off. Here's what's next. Continue as planned, tweak the plan, or start something new?"
      ->
Work happens
      ->
Holistic checkpoints and handoffs keep repo memory current
      ->
The next agent picks up without a long re-explanation
```


---


## Quick start 🚀

### Install 📦

Requires Node.js 24+.

```bash
npm install -g holistic
```

Then verify the CLI is available:

```bash
holistic --help
```

For contributors or local source installs:

```bash
git clone https://github.com/lweiss01/holistic.git
cd holistic
npm install
npm run build
npm pack
npm install -g ./holistic-*.tgz
```

For local development without a packaged tarball:

```bash
npm install
npm link
```

### Set up a repo 🛠️

```bash
cd my-project
holistic bootstrap --remote origin --yes
git add .gitattributes HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md
git add .holistic/config.json .holistic/state.json
git add .holistic/context/
git commit -m "feat: add holistic"
```

By default, Holistic now syncs portable state through a hidden git ref (`refs/holistic/state`) to avoid GitHub branch noise. That sync mirrors Holistic state only - it does not auto-push your working branch.

Advanced overrides:

```bash
holistic bootstrap --state-ref refs/holistic/state
holistic bootstrap --state-branch holistic/state
holistic bootstrap --portable
```

If you want repo scaffolding without changing local desktop integrations or daemon startup on the current machine, you can use granular flags to be surgical:

```bash
# Only install Git hooks and managed attributes
holistic bootstrap --yes-hooks --yes-attr
```

**What to commit:**
- `.gitattributes` - Holistic-managed line-ending rules for portable files
- `.holistic/config.json` - repo configuration
- `.holistic/state.json` - current session state  
- `.holistic/context/` - generated docs (history, regression watch, adapters)
- `.holistic/sessions/` - session history files

**What NOT to commit:**
- `.holistic/system/` - machine-local helper scripts and wrappers with absolute paths (already in `.gitignore`)

The portable repo memory is meant to be committed and synced. Machine-local helper scripts are generated for each machine and stay local.


---


## Daily workflow 🔄

One-time machine setup:

- Run `holistic bootstrap`.
- By default it scaffolds repo files, installs hooks, sets up daemon startup, and configures supported integrations such as Claude Desktop MCP on the current machine.
- To be surgical about what is applied, use granular flags like `--yes-hooks`, `--yes-daemon`, or `--yes-mcp`.

Normal use:

- Start a session in Codex, Claude, or another supported app.
- Let the agent read the repo instructions and current handoff state.
- Work normally.
- Use explicit CLI commands only when you want to inspect state manually or force a checkpoint or handoff yourself.

Useful manual commands:

```bash
holistic status
holistic checkpoint --reason "..."
holistic handoff
```

If `holistic` is not on `PATH` in a given shell, every bootstrapped repo also has a repo-local fallback:

- Windows: `.\.holistic\system\holistic.cmd <command>`
- macOS/Linux: `./.holistic/system/holistic <command>`


---


## Regression protection 🛡️

When an agent fixes something delicate, lock it in:

```bash
holistic checkpoint \
  --fixed "login redirect loop" \
  --fix-files "src/auth.ts" \
  --fix-risk "changing redirect logic will re-introduce this"
```

Future agents will see that warning in the repo docs before they touch the risky area again.


---


## Works with multiple agent apps 🤝

Holistic is model-agnostic. It works through repo files first, and can expose a thin MCP server where supported.

### Startup parity matrix

Use this table to decide whether startup should be automatic (MCP/tooling hook) or manual (`/holistic` / `holistic_resume`).

| App / Surface | Reads | MCP auto-start | Startup action |
|---|---|---|---|
| Claude Desktop / Cowork | `CLAUDE.md` and repo docs | ✅ Yes | Usually automatic after `holistic bootstrap`; if context is stale, run `holistic_resume` |
| Codex | `AGENTS.md` and repo docs | ❌ No | Run `/holistic` (or repo-local `holistic resume --continue`) at conversation start |
| Antigravity | `GEMINI.md` and repo docs | ❌ No | Run `/holistic` at conversation start |
| Gemini | `GEMINI.md` and repo docs | ❌ No | Run `/holistic` at conversation start |
| Cursor | `.cursorrules` and repo docs | ❌ No | Run `/holistic` at conversation start for deterministic recap |
| GitHub Copilot | `.github/copilot-instructions.md` and repo docs | ❌ No | Run `/holistic` at conversation start |
| Goose | `AGENTS.md` and repo docs | ❌ No | Run repo-local `holistic resume --continue` in the shell session |
| GSD / GSD2 | `AGENTS.md` and repo docs | ❌ No | Run `/holistic` or `holistic_resume` before first implementation step |
| Other VS Code forks | `AGENTS.md` and repo docs | ❌ No | Treat as manual-start and run `/holistic` |
| Web tools | repo docs pasted manually | ❌ No | Manual copy/paste recap from Holistic docs |


---


## What lives in your repo 🗂️

```text
my-project/
|- HOLISTIC.md
|- AGENTS.md
|- CLAUDE.md
|- GEMINI.md
|- .cursorrules
|- .windsurfrules
|- .gitattributes
|- .github/
|  `- copilot-instructions.md
`- .holistic/
   |- config.json
   |- state.json
   |- sessions/
   `- context/
      |- project-history.md
      |- regression-watch.md
      `- adapters/
```

The portable repo memory (config, state, context, sessions) is meant to be committed and synced. Machine-local helper scripts and repo-local CLI fallbacks under `.holistic/system/` are generated for each machine and stay local (already in `.gitignore`).


---


## Commands

| `holistic init` | Base repo setup and scaffolding |
| `holistic bootstrap` | One-step machine setup. Required `--yes` for Core Setup, or granular `--yes-*` flags. |
| `holistic doctor` | Runs health checks on machine setup and sync logs |
| `holistic repair` | Regenerates `.holistic/system/` helpers |
| `holistic resume / start --agent <name>` | Loads project recap and prints state |
| `holistic start-new` | Starts a fresh session |
| `holistic checkpoint --reason "..."` | Saves progress and context |
| `holistic handoff` | Ends a session with a handoff message |
| `holistic status` | Shows current state and recent sync activity |
| `holistic diff --from <id> --to <id>` | Compares two sessions |
| `holistic search --id <session-id>` | Finds and reactivates an archived session |
| `holistic serve` | Runs the thin MCP server |
| `holistic watch` | Foreground daemon mode for automatic checkpoints |

### Slash command helper text (agent-facing)

When your agent UI supports slash shortcuts, use these helper mappings:

| Slash | Helper text | CLI equivalent |
|---|---|---|
| `/holistic` | Load repo recap and confirm: continue, tweak, or start new. | `holistic resume --continue` |
| `/checkpoint` | Save a structured checkpoint at a natural breakpoint. | `holistic checkpoint --reason "..."` |
| `/handoff` | Finalize session handoff with summary, next steps, blockers, and regression risks. | `holistic handoff` |


```bash
holistic handoff \
  --summary "Implemented OAuth flow and token storage" \
  --next "Wire up the refresh token endpoint" \
  --blocker "Need refresh token endpoint from backend team"
```


---


## Architecture

Holistic is intentionally repo-first, not machine-first.

| Layer | Purpose | Portable? |
|---|---|---|
| Repo memory | Shared handoff, history, regression, and session state | Yes |
| State ref | Cross-device distribution of Holistic state via git | Yes |
| Local daemon | Passive capture on one machine | No |

That split is what makes Holistic work across tools and devices instead of only on one laptop.

### MCP server mode

Holistic can run as a thin MCP server for agent-native workflows:

```bash
holistic serve
```

In normal use, Claude Desktop can launch this automatically after `holistic bootstrap` configures the MCP entry. You usually only run it manually for debugging.

When you do run `holistic serve` manually in a terminal, Holistic prints its ASCII startup banner to `stderr` so you get visible confirmation without corrupting the MCP `stdout` transport.

```json
{
  "mcpServers": {
    "holistic": {
      "command": "holistic",
      "args": ["serve"],
      "env": {
        "HOLISTIC_REPO": "/path/to/your/project"
      }
    }
  }
}
```


---


## Why this matters

If you are already using more than one AI coding assistant, you already have the continuity problem.

Holistic gives you:

- Less repeated explanation
- Fewer accidental regressions
- Clearer handoffs across apps and devices
- A durable record of what changed and why
- Agents that can get to work quickly


---


## Beta Feedback Welcome 🙏

Holistic is in early beta. If you hit rough edges, unexpected behavior, or have ideas for improvement, please [open an issue](https://github.com/lweiss01/holistic/issues). Early adopter feedback directly shapes the direction of the project.

For support and troubleshooting, see [SUPPORT.md](./SUPPORT.md).


---


## Security, Privacy, and Trust 🔒

Holistic is designed to be **transparent, audit-safe, and consent-first**. It is a shared memory layer that stays in your repo, not a cloud service that watches your screen.

### Trust Architecture:
- **Granular Consent**: `holistic bootstrap` now uses a "Consent-First" model. It displays a summary of system-modifying actions and requires an explicit `--yes` for the Core Setup (hooks, daemon, MCP, attributes).
- **Surgical Control**: Use granular flags (`--yes-hooks`, `--yes-daemon`, `--yes-mcp`, `--yes-attr`, `--yes-claude`) to apply only the specific integrations you want.
- **Privacy Mode vs. Portable Mode**: Holistic defaults to **Privacy Mode** (local-only state). To enable cross-device sync, use the `--portable` flag or set `"portableState": true` in the repo config.
- **Read-Only Diagnostics**: The `holistic doctor` command and bootstrap pre-flight checks are strictly non-mutating. They audit your environment without making unexpected changes.
- **Traceable Activity**: Background sync operations (PowerShell/Bash) are visible and logged with timestamps to `.holistic/system/sync.log`.
- **Git-Native Snapshotting**: The repo snapshot logic uses native `git ls-files`, ensuring that your `.gitignore` rules are perfectly respected and performance stays $O(\text{repo size})$.
- **Zero Shell Injection**: Internal commit logic has been stripped of shell wrappers to eliminate command injection risks.

### What it does:
- Writes session state into `.holistic/` inside your repo (committed files you control)
- Installs a daemon via standard OS autostart (Windows Startup folder, macOS LaunchAgents, Linux systemd user)
- Can push Holistic state to a hidden git ref on your configured remote (opt-in, your repo only)

### What it does NOT do:
- Does not read or transmit file contents outside your repo
- Does not access credentials or tokens
- Does not phone home to any external service
- Does not use obfuscated scripts or hidden windows

For the full technical disclosure, see [SECURITY.md](./SECURITY.md).


---


## Quick links

- [Walkthrough](./docs/handoff-walkthrough.md)
- [Security & Privacy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Contributing](./CONTRIBUTING.md)
- [License](./LICENSE)



---


<p align="center"><em>Built for people who use more than one AI assistant and are tired of paying the context tax.</em></p>
