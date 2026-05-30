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

**Your agents switch. Your repo remembers.**

Most agent-memory tools are laptop-bound. They assume you sit at one terminal and switch between CLIs. Real work is messier than that: a desktop assistant here, an IDE agent there, a mobile follow-up later, a second machine tomorrow.

Holistic gives your repo a durable memory layer that survives all of it: agent switches, app switches, device switches, context compaction, and half-finished sessions. The state lives on a dedicated branch that syncs across machines, not in a local folder one laptop owns.

If you build with more than one AI coding assistant, you already have the problem Holistic solves.

## What makes it different

There are several good cross-agent handoff tools now. Here is where Holistic is not the same:

- **Cross-device, not just cross-agent.** Other tools keep state in a local folder on one machine. Holistic syncs through the repo itself on a dedicated state branch, so a session you start on your phone picks up what your laptop agent did this morning.
- **Regression memory, not just handoff.** Most tools move context forward. Holistic also guards against backsliding. A regression watchlist records what must not break again, so the fourth agent does not undo what the second agent fixed.
- **Human-reviewed checkpoints.** A checkpoint is written for an agent with zero context, then shown to you for review before it is saved. You edit the memory, the repo stores it, every agent reads it.

## Install

Holistic is published on npm.

```bash
npm install -g holistic
```

Then initialize it once in any repo:

```bash
cd /path/to/your/project
holistic init --remote origin --state-branch holistic/state
```

To work from source instead:

```bash
git clone https://github.com/lweiss01/holistic.git
cd holistic
npm link
```

Requires Node.js 24+.

## The problem

If these sound familiar, Holistic is for you:

- "I already explained this to another agent earlier today."
- "Why did it change that? We already fixed this."
- "It solved the bug, but broke the previous fix."
- "I switched from laptop to phone and lost the thread."
- "I know we decided this once, but I cannot prove it to the next agent."

That repeated re-briefing and regression loop is one of the biggest hidden costs of AI-assisted development. Holistic makes the repo remember what the agents forget.

## How it works

Holistic anchors memory in files the repo already tracks:

- `HOLISTIC.md` is the first file an agent should read.
- `.holistic/state.json` holds machine-readable state.
- `.holistic/sessions/` is an append-only session history.

The architecture is split on purpose, because a daemon on your laptop cannot help a session that starts on your phone:

| Layer | Purpose | Portable |
| --- | --- | --- |
| Repo memory | Shared handoff, history, regression, and session state | Yes |
| State branch | Cross-device distribution of Holistic state | Yes |
| Local daemon | Passive capture on one machine | No |

### During a session

Holistic captures the current objective, latest status, attempted paths, assumptions, blockers, impact, and next steps. On a machine with the optional daemon installed, it can watch the repo and create passive checkpoints in the background.

### Ending a session

When you end a session, the agent produces a handoff summary, shows it to you for review, lets you edit anything missing, finalizes the handoff, preserves unfinished work, and syncs portable state for the next device or agent.

### Starting the next session

The next agent reads `HOLISTIC.md`, reviews project history and regression memory, recaps where things stand, and asks whether to continue, adjust the plan, or start something new.

## Commands

| Command | Purpose |
| --- | --- |
| `holistic init` | Initialize Holistic for a repo |
| `holistic resume` | Produce a recap and recovery flow |
| `holistic checkpoint` | Save durable mid-session state |
| `holistic handoff` | Finalize the session handoff |
| `holistic start-new` | Start a fresh tracked session while preserving unfinished work |
| `holistic watch` | Foreground watch mode for automatic checkpoints |

## Example workflow

```
Session 1 in Cowork
  work happens, handoff is finalized, portable state is synced

Session 2 in Antigravity
  repo is opened, recap is read,
  unfinished work and regression risks are visible,
  work continues without re-briefing

Session 3 on mobile with Codex
  repo is available, last handoff and history are still there,
  the agent continues with shared context
```

## Roadmap

Holistic is source-first and evolving. What is on deck:

- **Supersession semantics.** Today a checkpoint that turns out to be wrong can only be overwritten or left to mislead. Supersession will let a checkpoint be marked deprecated without deleting it, with a pointer to the entry that replaces it and a short reason. This keeps the history honest instead of letting the memory layer fill with confident but stale claims. (Raised by readers of the dev.to series, and the next concrete build.)
- **Published releases and changelog.** Tagged GitHub releases that track the npm versions, so the repo and the package tell the same story.
- **Richer regression detection.** Move the regression watchlist from a manual list toward checkpoints that can flag the specific files or behaviors a prior fix depended on.
- **Cross-agent messaging (under consideration).** A way for one agent to leave a targeted note for a specific next agent, not just a broadcast state update. Being evaluated against the goal of keeping the format simple.
- **Adapter coverage.** Clearer, tested setup for each agent environment (Claude Code, Codex, Gemini/Antigravity, Cursor) rather than a single generic path.

## Background

The thinking behind Holistic is written up in an ongoing dev.to series on AI coding agent memory: why checkpoints beat transcripts, why continuity is a coordination problem rather than a memory problem, and where the idea breaks down once agents no longer share a trust boundary.

## Contributing

Contributions and issues are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
