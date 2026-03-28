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

### One command. Every agent. Zero re-explaining. ✨

Holistic gives your AI agents shared memory inside the repo itself. When you switch from Claude to Codex to Gemini, the next agent can see what happened last time, what not to break, and what should happen next.

---

## Get started in 30 seconds ⚡

Open your project repo in PowerShell, Terminal, Command Prompt, or whatever shell you normally use.

Requires Node.js 24+.

Run these two commands:

```bash
npm install -g holistic
holistic bootstrap
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
holistic bootstrap --remote origin
git add .gitattributes HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md HISTORY.md
git add .holistic/config.json .holistic/state.json
git add .holistic/context/
git commit -m "feat: add holistic"
```

By default, Holistic now syncs portable state through a hidden git ref (`refs/holistic/state`) to avoid GitHub branch noise. That sync mirrors Holistic state only - it does not auto-push your working branch.

Advanced overrides:

```bash
holistic bootstrap --state-ref refs/holistic/state
holistic bootstrap --state-branch holistic/state
```

If you want repo scaffolding without changing local desktop integrations or daemon startup on the current machine, use:

```bash
holistic bootstrap --install-daemon false --configure-mcp false
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
- If you only want repo files and hooks, use `holistic bootstrap --install-daemon false --configure-mcp false`.

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
|- HISTORY.md
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

| Command | What it does |
|---|---|
| `holistic init` | Base repo setup and scaffolding |
| `holistic bootstrap` | One-step machine setup for repo files, hooks, and by-default local daemon/MCP integration setup |
| `holistic start --agent <name>` | Opens a session and prints the ASCII banner plus recap |
| `holistic checkpoint --reason "..."` | Saves progress and context |
| `holistic handoff` | Ends a session with a handoff |
| `holistic status` | Shows the current state |
| `holistic diff --from <id> --to <id>` | Compares two sessions |
| `holistic serve` | Runs the thin MCP server and prints a startup banner to `stderr` |
| `holistic watch` | Foreground daemon mode for automatic checkpoints |

### Non-interactive handoff

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

## Quick links

- [Walkthrough](./docs/handoff-walkthrough.md)
- [Changelog](./CHANGELOG.md)
- [Contributing](./CONTRIBUTING.md)
- [License](./LICENSE)

---

<p align="center"><em>Built for people who use more than one AI assistant and are tired of paying the context tax.</em></p>
