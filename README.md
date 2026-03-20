# Holistic

**One command. Every agent. Zero re-explaining.**

Holistic gives your AI agents a shared memory — so when you switch from Cowork to Antigravity to Codex, the next agent knows exactly what the last one did, what not to break, and what to do next.

---

## The problem (you know this pain)

You are using multiple AI coding agents across multiple apps. Maybe Claude in Cowork for architecture, Codex for implementation, Antigravity for debugging. And every single time you start a new session:

- **You re-explain everything.** The agent has no memory of what was done before.
- **Bugs come back from the dead.** One agent fixes a bug. A different agent, not knowing it was ever broken, re-introduces it.
- **Progress gets lost.** Context windows fill up. Sessions end abruptly. A week later you cannot remember why a particular decision was made.
- **Agents contradict each other.** One agent builds something a certain way. The next one tears it down. Then a third tries to use the first approach again.
- **Nobody knows what "done" means.** Is that feature finished? Was it tested? Did it break something else?

---

## The solution

Holistic drops a set of markdown files into your repo that every agent reads at session start. The agent recaps what happened last time, warns you about what not to break, and asks how you want to proceed — before writing a single line of code.

```
holistic init          ← one-time setup per project
```

That is the only command you ever run yourself. Everything else is automatic.

---

## How it works

```
holistic init
     ↓
You open a session in any app
     ↓
Agent reads HOLISTIC.md automatically
     ↓
"Here's where we left off. Here's what's planned.
 Here's what you must not break. How do you want to proceed?"
     ↓
You answer. Work begins.
     ↓
You make commits → git hook auto-saves progress
     ↓
"I'm done for now"
     ↓
Agent runs holistic handoff, updates all docs, archives the session
     ↓
Next agent (any app, any model) picks up seamlessly
```

No terminal commands. No copy-pasting context. No starting over.

---

## Regression protection

When an agent fixes a bug, record it:

```bash
holistic checkpoint \
  --fixed "user session not persisting after page refresh" \
  --fix-files "src/auth/session.ts" \
  --fix-risk "adding per-route auth middleware will shadow this fix"
```

From that point on, every agent that opens a session sees this in `HOLISTIC.md`:

```
## Known Fixes — Do Not Regress

⚠️  If you are about to edit a file listed here, STOP and read the fix entry first.

- user session not persisting after page refresh
  Sensitive files: src/auth/session.ts
  Risk: adding per-route auth middleware will shadow this fix
```

No more bug-fix loops. No more "wait, we fixed this already."

---

## Works with every agent and model

Holistic is completely model-agnostic. It works through standard markdown files that every agent reads — the underlying AI (Gemini, Claude, GPT, whatever) does not matter at all.

| App | Reads | Auto-starts? |
|---|---|---|
| Cowork (Claude desktop) | `CLAUDE.md` | ✅ automatic |
| Antigravity | `GEMINI.md` + `AGENTS.md` | ✅ automatic |
| Codex | `AGENTS.md` | ✅ automatic |
| Android Studio (Gemini) | `AGENTS.md` | ✅ automatic |
| Any other VS Code fork | `AGENTS.md` | ✅ automatic |
| Web tools (Perplexity, etc.) | — | paste manually |

Switch from Gemini to Claude to GPT mid-project? Holistic does not care. The agent reads the file and follows the instructions, full stop.

---

## Installation

Requires Node.js 24+.

```bash
git clone https://github.com/lweiss01/holistic.git
cd holistic
npm run build
npm pack
npm install -g ./holistic-0.1.0.tgz
```

Or for local development:

```bash
git clone https://github.com/lweiss01/holistic.git
cd holistic
npm link
```

---

## Quick start

```bash
cd my-project
holistic init --remote origin --state-branch holistic/state --install-hooks
git add HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md HISTORY.md .holistic/
git commit -m "feat: add holistic"
```

Done. Open a session in any app and the agent handles everything else.

---

## What lives in your repo

```
my-project/
├── HOLISTIC.md     ← master handoff doc — every agent reads this at session start
├── AGENTS.md       ← per-agent protocol (Codex, Antigravity, etc.) — auto-read
├── CLAUDE.md       ← auto-read by Claude / Cowork
├── GEMINI.md       ← auto-read by Antigravity (highest-priority rules slot)
├── HISTORY.md      ← append-only log of every session
└── .holistic/
    ├── state.json          ← machine-readable current state
    ├── sessions/           ← full archive of every past session
    └── context/
        ├── project-history.md   ← long-term memory with structured metadata
        ├── regression-watch.md  ← what must never break again
        └── adapters/            ← per-agent startup docs
```

All of these get committed to your repo. They are the shared brain of your project.

---

## Commands

| Command | What it does |
|---|---|
| `holistic init` | One-time setup — scaffolds files, installs git hook |
| `holistic start --agent <name>` | Opens a session, prints the recap *(agents run this automatically)* |
| `holistic resume --agent <name>` | Same as start (alias) |
| `holistic checkpoint --reason "..."` | Saves progress snapshot *(fires automatically on every git commit)* |
| `holistic handoff` | Ends session with an interactive dialog |
| `holistic status` | Current state at a glance |
| `holistic diff --from <id> --to <id>` | Compare two sessions in text or JSON |
| `holistic serve` | Run as a thin MCP server for agent-native workflows |
| `holistic watch` | Foreground daemon mode for automatic checkpoints |

### Checkpoint flags

```bash
holistic checkpoint \
  --reason "implemented auth middleware" \
  --done "JWT validation" \
  --next "wire up refresh tokens"

# Record a fix that must not regress:
holistic checkpoint \
  --fixed "login redirect loop" \
  --fix-files "src/auth.ts" \
  --fix-risk "changing redirect logic will re-introduce this"
```

### Non-interactive handoff

```bash
holistic handoff \
  --summary "Implemented OAuth flow and token storage" \
  --next "Wire up the refresh token endpoint" \
  --blocker "Need refresh token endpoint from backend team"
```

---

## What a session looks like

```
[You open Cowork on your latest project]

Claude: I've read HOLISTIC.md. Here's where things stand:

        Last session (Antigravity · 2 days ago)
        ✅ OAuth login flow
        ✅ JWT validation middleware
        ✅ Token storage
        ⛔ Blocker: refresh token endpoint not yet available from backend
        → Next: wire up refresh token endpoint once available

        🔒 Known fix to protect: login redirect loop
           Don't touch redirect logic in src/auth.ts

        How do you want to proceed?
        1. Continue as planned
        2. Tweak the plan
        3. Do something different

[You work. Commits happen. Checkpoints fire automatically.]

You: I'm done for now.

Claude: [runs holistic handoff, walks you through a quick summary dialog]
        [updates HOLISTIC.md, HISTORY.md, archives session]
        [reminds you to commit the handoff files]
```

---

## Architecture

### Repo-first, not machine-first

A daemon on your laptop cannot help a session that starts on your phone.

So the architecture is intentionally split:

| Layer | Purpose | Portable? |
|---|---|---|
| Repo memory | Shared handoff, history, regression, and session state | Yes |
| State branch | Cross-device distribution of Holistic state via git | Yes |
| Local daemon | Passive capture on one machine | No |

This is what makes Holistic genuinely cross-agent and cross-platform instead of laptop-bound.

### MCP server mode

Holistic can also run as a thin MCP server for agent-native workflows:

```bash
holistic serve
```

#### Claude Desktop example

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

## What makes this a no-brainer

If you are already using more than one AI coding assistant, you already have the problem.

Holistic gives you:

- Less repeated explanation
- Fewer accidental regressions
- Clearer handoffs between apps and devices
- A durable record of what changed and why

Less thrash. More forward motion.

---

## Quick links

- [Walkthrough](./docs/handoff-walkthrough.md)
- [Contributing](./CONTRIBUTING.md)
- [License](./LICENSE)

---

## License

MIT — see [LICENSE](LICENSE).
