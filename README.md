# 🧠 Holistic

### **One command. Every agent. Zero re-explaining.**

Holistic gives your AI agents a shared memory — so when you switch from Cowork to Antigravity to Codex, the next agent knows exactly what the last one did, what not to break, and what to do next. You don't lift a finger.

---

## 😤 Sound familiar?

You're juggling multiple AI coding agents across multiple apps. Maybe Claude in Cowork for architecture, Codex for implementation, Antigravity for debugging. And every single time you start a new session:

- 🔁 **You re-explain everything.** The agent has no memory of what was done before. You spend the first 10 minutes of every session getting it up to speed.
- 🐛 **Bugs come back from the dead.** One agent fixes a bug. A different agent — not knowing it was ever broken — re-introduces it. You lose an hour figuring out what happened.
- 📉 **Progress gets lost.** Context windows fill up. Sessions end abruptly. A week later you can't remember why a particular decision was made.
- 🔀 **Agents contradict each other.** One builds something a certain way. The next tears it down. The third tries the first approach again. You're going in circles.
- 🤷 **Nobody knows what "done" means.** Is that feature finished? Was it tested? Did it break something else?

If you've felt any of that, Holistic is for you.

---

## ✨ The fix

Holistic drops a set of markdown files into your repo that every agent reads automatically at session start. The agent recaps what happened last time, warns you about what not to break, and asks how you want to proceed — **before writing a single line of code.**

```
holistic init          ← the only command you ever run yourself
```

Everything else is automatic.

---

## 🔄 How it works

```
holistic init
      ↓
🧑  You open a session in any app
      ↓
🤖  Agent reads HOLISTIC.md automatically
      ↓
🤖  "Here's where we left off. Here's what's planned.
     Here's what you must not break. How do you want to proceed?"
      ↓
🧑  You answer. Work begins.
      ↓
💾  You make commits → git hook auto-saves progress
      ↓
🧑  "I'm done for now."
      ↓
🤖  Agent runs holistic handoff, updates all docs, archives the session
      ↓
🔁  Next agent — any app, any model — picks up seamlessly
```

No terminal commands. No copy-pasting context. No starting over.

---

## 🔒 Regression protection that actually works

This one's a game-changer. When an agent fixes a bug, lock it in:

```bash
holistic checkpoint \
  --fixed "user session not persisting after page refresh" \
  --fix-files "src/auth/session.ts" \
  --fix-risk "adding per-route auth middleware will shadow this fix"
```

From that point on, **every agent that opens a session** sees this at the top of `HOLISTIC.md`:

```
## Known Fixes — Do Not Regress

⚠️  If you are about to edit a file listed here, STOP and read the fix entry first.

- user session not persisting after page refresh
  Sensitive files: src/auth/session.ts
  Risk: adding per-route auth middleware will shadow this fix
```

No more bug-fix loops. No more "wait, we already fixed this."

---

## 🤖 Works with every agent and every model

Holistic is completely model-agnostic. It works through standard markdown files — the underlying AI (Gemini, Claude, GPT, whatever) doesn't matter at all.

| App | Reads | Auto-starts? |
|---|---|---|
| 🖥️ Cowork (Claude desktop) | `CLAUDE.md` | ✅ automatic |
| 🪐 Antigravity | `GEMINI.md` + `AGENTS.md` | ✅ automatic |
| 💻 Codex | `AGENTS.md` | ✅ automatic |
| 🤖 Android Studio (Gemini) | `AGENTS.md` | ✅ automatic |
| 🧩 Any other VS Code fork | `AGENTS.md` | ✅ automatic |
| 🌐 Web tools (Perplexity, etc.) | — | paste manually |

Switch from Gemini to Claude to GPT mid-project? Holistic doesn't care. The agent reads the file and follows the protocol, full stop.

---

## 💬 What a session actually looks like

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
        [updates HOLISTIC.md, HISTORY.md, archives the session]
        [reminds you to commit the handoff files]
```

---

## 🚀 Installation

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

## ⚡ Quick start

```bash
cd my-project
holistic init --remote origin --state-branch holistic/state --install-hooks
git add HOLISTIC.md AGENTS.md CLAUDE.md GEMINI.md HISTORY.md .holistic/
git commit -m "feat: add holistic"
```

Done. Open a session in any app — the agent handles everything else.

---

## 📁 What lives in your repo

```
my-project/
├── HOLISTIC.md     ← 🧠 master handoff doc — every agent reads this at session start
├── AGENTS.md       ← 📋 per-agent protocol (Codex, Antigravity, etc.) — auto-read
├── CLAUDE.md       ← 🤖 auto-read by Claude / Cowork
├── GEMINI.md       ← 🪐 auto-read by Antigravity (highest-priority rules slot)
├── HISTORY.md      ← 📜 append-only log of every session
└── .holistic/
    ├── state.json          ← machine-readable current state
    ├── sessions/           ← full archive of every past session
    └── context/
        ├── project-history.md   ← long-term memory with structured metadata
        ├── regression-watch.md  ← what must never break again
        └── adapters/            ← per-agent startup docs
```

All of these live in your repo. They are the shared brain of your project — committed, synced, and available from any device.

---

## 🛠️ Commands

| Command | What it does |
|---|---|
| `holistic init` | One-time setup — scaffolds all files, installs git hook |
| `holistic start --agent <name>` | Opens a session, prints the recap *(agents run this automatically)* |
| `holistic checkpoint --reason "..."` | Saves a progress snapshot *(fires automatically on every git commit)* |
| `holistic handoff` | Ends the session with an interactive summary dialog |
| `holistic status` | Current state at a glance |
| `holistic diff --from <id> --to <id>` | Compare two sessions in text or JSON |
| `holistic serve` | Run as a thin MCP server for agent-native workflows |
| `holistic watch` | Foreground daemon mode for automatic checkpoints |

### Record a fix that must not regress

```bash
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

## 🏗️ Architecture: repo-first, not machine-first

> 📱 A daemon on your laptop can't help a session that starts on your phone.

So the architecture is intentionally split:

| Layer | Purpose | Portable? |
|---|---|---|
| 📂 Repo memory | Shared handoff, history, regression, and session state | ✅ Yes |
| 🌿 State branch | Cross-device distribution of Holistic state via git | ✅ Yes |
| ⚙️ Local daemon | Passive capture on one machine | ❌ No |

This is what makes Holistic genuinely cross-agent and cross-platform — not just laptop-bound.

### MCP server mode

Holistic can also run as a thin MCP server for agent-native workflows:

```bash
holistic serve
```

```json
{
  "mcpServers": {
    "holistic": {
      "command": "holistic",
      "args": ["serve"],
      "env": { "HOLISTIC_REPO": "/path/to/your/project" }
    }
  }
}
```

---

## 💡 Why this is a no-brainer

If you're already using more than one AI coding assistant, **you already have the problem.**

Holistic gives you:

- ✅ Less repeated explanation
- ✅ Fewer accidental regressions
- ✅ Clearer handoffs across apps and devices
- ✅ A durable record of what changed and why
- ✅ An agent that's ready to work in 30 seconds, not 10 minutes

Less thrash. More forward motion. 🚀

---

## 🔗 Quick links

- [Walkthrough](./docs/handoff-walkthrough.md)
- [Contributing](./CONTRIBUTING.md)
- [License](./LICENSE)

---

<p align="center"><em>Built for people who use more than one AI assistant and are tired of paying the context tax.</em></p>
