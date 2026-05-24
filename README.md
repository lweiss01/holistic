# Holistic

```text
██╗  ██╗ ██████╗ ██╗     ██╗███████╗████████╗██╗ ██████╗
██║  ██║██╔═══██╗██║     ██║██╔════╝╚══██╔══╝██║██╔════╝
███████║██║   ██║██║     ██║███████╗   ██║   ██║██║
██╔══██║██║   ██║██║     ██║╚════██║   ██║   ██║██║
██║  ██║╚██████╔╝███████╗██║███████║   ██║   ██║╚██████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝

Your agents switch. Your repo remembers.
```

[![npm version](https://img.shields.io/npm/v/holistic.svg)](https://www.npmjs.com/package/holistic) [![Tests](https://img.shields.io/github/actions/workflow/status/lweiss01/holistic/test.yml?branch=main&label=tests)](https://github.com/lweiss01/holistic/actions) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](./package.json)

### One command. Every agent. Zero re-explaining. ✨  
### Checkpoints, not transcripts.

Holistic gives AI coding agents durable continuity inside the repository itself.

Context windows fill up.  
Sessions compact.  
Agents forget.

Holistic is built around a different idea:

> The repository should be the source of truth, not the chat window.

Instead of relying on giant transcripts or fragile prompt history, Holistic stores durable project continuity as structured repo-native artifacts:
- checkpoints
- handoffs
- decisions
- operational state
- active work context
- unresolved threads

The result:
- agents can switch
- sessions can end
- context can compact

…and the project still remembers where it was.

---

# Why Holistic Exists 😵

Modern AI coding workflows are fragile.

An agent works for hours, the context window fills up, compaction happens, and suddenly:
- architectural reasoning disappears
- unresolved work gets forgotten
- bugs reappear
- handoffs become messy
- the next session starts from partial understanding
- humans re-explain the same context repeatedly

This is the context tax. Every compaction, every new session, every agent switch costs you time you already spent.

The fix is not a bigger context window. It is deciding the context window was never the right place to store memory in the first place.

Holistic treats LLM sessions as disposable execution surfaces, not durable memory systems.

The durable memory lives in the repo.

---

# Checkpoints, Not Transcripts 🧭

Holistic does not try to preserve entire conversations forever.

Instead, agents periodically create structured checkpoints at meaningful moments:
- end of a session
- before a context switch
- after important decisions
- before handing work to another agent

Each checkpoint captures:
- current state
- active work
- unresolved threads
- decisions and reasoning
- gotchas
- next recommended actions

A future agent resumes from the checkpoint instead of trying to reconstruct meaning from a compacted transcript.

The checkpoint becomes the durable source of truth.  
The live context window becomes disposable working memory.

---

# What it feels like with Holistic 🌿

Run one setup command:

```bash
holistic bootstrap
```

Then daily use is mostly:

1. Open the repo in Codex, Claude, Gemini, Cursor, or another supported app
2. Start a fresh session
3. Ask the agent to read `AGENTS.md` and `HOLISTIC.md`
4. Let Holistic carry continuity through checkpoints, handoffs, and repo memory

Most days, you do not need to keep a terminal process open or manually re-brief the agent.

---

# How it works 🧠

```text
Agent session starts
        ↓
Reads HOLISTIC.md + repo continuity artifacts
        ↓
Performs work
        ↓
Creates checkpoint + handoff
        ↓
Session ends / compacts
        ↓
Future agent resumes from checkpoint
```

The repo remembers, not the window.

---

# Why trust Holistic? 🔒

Holistic is designed to be safe to install, inspectable, and predictable.

- 🛡️ Security-hardened repository containment and integrity protections
- 🧪 Broad automated test coverage for core flows and Andon paths
- 🧭 Transparent repo-first architecture
- 🔍 Human-readable repo-native state
- 🛠️ Actively maintained with rapid iteration

> See [SECURITY.md](./SECURITY.md) for full technical details.

---

# Get started in 30 seconds ⚡

Open your project repo in PowerShell, Terminal, Command Prompt, or your preferred shell.

Requires Node.js 24+.

```bash
npm install -g holistic
holistic bootstrap --yes
```

After that, open the repo in your agent app and use this startup prompt:

```text
Before doing any other work, read AGENTS.md and HOLISTIC.md, recap the current state briefly, and ask me exactly one question: continue as planned, tweak the plan, or start something new.
```

That is enough to get the core Holistic workflow running.

---

# Quick start 🚀

## Install 📦

Requires Node.js 24+.

```bash
npm install -g holistic
```

Verify the CLI:

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

For local development without packaging:

```bash
npm install
npm link
```

---

## Set up a repo 🛠️

```bash
cd my-project
holistic bootstrap --remote origin --yes

git add .gitattributes HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md
git add .holistic/config.json .holistic/state.json
git add .holistic/context/
git commit -m "feat: add holistic"
```

By default, Holistic syncs portable continuity state through a hidden git ref (`refs/holistic/state`) to avoid GitHub branch noise.

Advanced overrides:

```bash
holistic bootstrap --state-ref refs/holistic/state
holistic bootstrap --state-branch holistic/state
holistic bootstrap --portable
```

Granular bootstrap flags:

```bash
holistic bootstrap --yes-hooks --yes-attr
```

---

# Daily workflow 🔄

One-time setup:

- Run `holistic bootstrap`
- Configure integrations if desired
- Commit the generated continuity files

Normal use:

- Start a session in Claude, Codex, Cursor, Gemini, or another supported app
- Let the agent read repo instructions and continuity state
- Work normally
- Use explicit commands only when needed

Useful manual commands:

```bash
holistic status
holistic checkpoint --reason "..."
holistic handoff
```

If `holistic` is not on PATH:

- Windows: `.\.holistic\system\holistic.cmd <command>`
- macOS/Linux: `./.holistic/system/holistic <command>`

---

# Regression protection 🛡️

When an agent fixes something delicate, lock it in:

```bash
holistic checkpoint \
  --fixed "login redirect loop" \
  --fix-files "src/auth.ts" \
  --fix-risk "changing redirect logic will re-introduce this"
```

Future agents will see the warning before touching risky areas again.

---

# Works with multiple agent apps 🤝

Holistic is model-agnostic.

Claude can hand work to Codex.  
Codex can hand work to Gemini.  
A human can resume from all of them.

The continuity survives because the repo holds the state, not the model session.

| App / Surface | Reads | MCP auto-start | Startup action |
|---|---|---|---|
| Claude Desktop / Cowork | `CLAUDE.md` and repo docs | ✅ Yes | Usually automatic after bootstrap |
| Codex | `AGENTS.md` and repo docs | ❌ No | Run `/holistic` at conversation start |
| Gemini | `GEMINI.md` and repo docs | ❌ No | Run `/holistic` at conversation start |
| Cursor | `.cursorrules` and repo docs | ❌ No | Run `/holistic` manually |
| GitHub Copilot | `.github/copilot-instructions.md` | ❌ No | Run `/holistic` manually |
| Goose | `AGENTS.md` and repo docs | ❌ No | Run `holistic resume --continue` |
| Other VS Code forks | `AGENTS.md` and repo docs | ❌ No | Treat as manual-start |

---

# What lives in your repo 🗂️

```text
my-project/
|- HOLISTIC.md
|- AGENTS.md
|- CLAUDE.md
|- GEMINI.md
|- .cursorrules
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

Portable repo memory is meant to be committed and synced.

Machine-local helpers under `.holistic/system/` remain local and are already gitignored.

---

# Commands ⚙️

| Command | Description |
| :--- | :--- |
| `holistic init` | Base repo setup and scaffolding |
| `holistic bootstrap` | One-step machine setup |
| `holistic doctor` | Health check & diagnostics |
| `holistic repair` | Regenerates local helpers |
| `holistic resume / start` | Loads project recap |
| `holistic start-new` | Starts a fresh session |
| `holistic checkpoint` | Saves progress and context |
| `holistic handoff` | Ends a session with a handoff |
| `holistic status` | Shows current state |
| `holistic diff` | Compares two session IDs |
| `holistic search` | Finds prior session state |
| `holistic serve` | Read-only MCP server |
| `holistic watch` | Automatic checkpoint daemon |

---

# Architecture 🏗️

Holistic is intentionally repo-first, not machine-first.

| Layer | Purpose | Portable? |
|---|---|---|
| Repo memory | Shared continuity and cognitive state | Yes |
| State ref | Cross-device continuity distribution | Yes |
| Local daemon | Passive capture on one machine | No |
| Andon | Operational awareness and supervision | Optional |

This split is what allows Holistic to work across tools, sessions, and devices instead of being tied to a single machine or model.

---

# What Holistic is NOT ❌

Holistic is not:
- a vector database
- a hosted memory SaaS
- transcript replay
- prompt stuffing middleware
- infinite context
- chat archival

Holistic is repo-native continuity infrastructure.

---

# Why this matters 🌎

If you already use more than one AI coding assistant, you already have the continuity problem.

Holistic gives you:
- less repeated explanation
- fewer accidental regressions
- clearer handoffs
- durable architectural memory
- resumable sessions
- interchangeable agents
- continuity across compaction events

---

# Experimental: Andon 🚦

Andon (named for the Toyota production system signal that something needs attention) is Holistic's operational awareness layer for long-running agentic workflows.

Think of it as Mission Control for agent workflows.

Andon surfaces:
- active sessions
- stale work
- action-required states
- pending input
- intervention conditions
- operational repo status

The goal is not just memory, but operational cognition for agentic software development.

Current dashboard routes:

| UI route | API source | Purpose |
| :--- | :--- | :--- |
| `/` | `GET /mission-control` | Live operational board |
| `/history` | `GET /history` | Historical sessions |
| `/session/:id/replay` | `GET /sessions/:id/replay` | Session replay |
| `/health` | `GET /health/andon` | Runtime diagnostics |

Run locally:

```bash
npm run andon:dev
npm --prefix apps/andon-dashboard run dev
```

Andon is experimental and evolving rapidly.

---

# Current Status 🚧

Holistic is under active development.

The architecture is evolving quickly, especially around:
- Andon
- runtime telemetry
- continuity workflows
- operational semantics
- multi-agent coordination

The core philosophy is stable.  
The implementation is still evolving.

---

# Beta Feedback Welcome 🙏

Issues, experiments, critiques, and architectural discussions are all welcome.

This space is evolving rapidly, and Holistic is intentionally exploring new patterns for durable agentic software workflows.

- [Issues](https://github.com/lweiss01/holistic/issues)
- [Security](./SECURITY.md)
- [Contributing](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

---

# License

MIT

---

<p align="center">
  <em>Built for people who use more than one AI assistant and are tired of paying the context tax.</em>
</p>
