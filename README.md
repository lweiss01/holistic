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

Holistic gives your repo a durable memory layer that survives all of it: agent switches, app switches, device switches, context compaction, and half-finished sessions. The state syncs through the repo itself on a hidden git ref, not in a local folder one laptop owns.

If you build with more than one AI coding assistant, you already have the problem Holistic solves.

## What makes it different

There are several good cross-agent handoff tools now. Here is where Holistic is not the same:

- **Cross-device, not just cross-agent.** Other tools keep state in a local folder on one machine. Holistic syncs through the repo itself on a hidden ref (`refs/holistic/state`), so a session you start on your phone picks up what your laptop agent did this morning, without adding branch noise to your PR list.
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
holistic init
```

That defaults to the `origin` remote and the hidden state ref
`refs/holistic/state`. Pass `--state-branch holistic/state` only if you want the
legacy visible branch instead.

Cross-device sync is **opt-in**. Until you set `portableState: true` in
`.holistic/config.json` (or pass `--portable` at init), Holistic keeps everything
local and the generated sync scripts exit early, so nothing leaves the machine.
`holistic doctor` tells you which mode you are in.

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
- `.holistic/sessions/` is an append-only session history. Sessions that have been finished and unreferenced for 30 days move to `.holistic/sessions/archive/`, which stays readable but keeps the active set small.
- `.holistic/context/` holds the derived docs agents read at startup: the current plan, project history, and the regression watchlist.

The architecture is split on purpose, because a daemon on your laptop cannot help a session that starts on your phone:

| Layer | Purpose | Portable |
| --- | --- | --- |
| Repo memory | Shared handoff, history, regression, and session state | Yes |
| State ref | Cross-device distribution of Holistic state | Yes |
| Local daemon | Passive capture on one machine, optional | No |
| Andon (optional) | Live monitoring of running agents, source-only | No |

### During a session

Holistic captures the current objective, latest status, attempted paths, assumptions, blockers, impact, and next steps. On a machine with the optional daemon installed, it can watch the repo and create passive checkpoints in the background.

### Ending a session

When you end a session, the agent produces a handoff summary, shows it to you for review, lets you edit anything missing, finalizes the handoff, preserves unfinished work, and syncs portable state for the next device or agent.

### Starting the next session

The next agent reads `HOLISTIC.md`, reviews project history and regression memory, recaps where things stand, and asks whether to continue, adjust the plan, or start something new.

## Which agents does it work with

**Continuity works with any agent.** The memory layer is files in your repo, so
any assistant that can read a repo can pick up where the last one left off, with
no integration required.

What differs per agent is how much the optional Andon board can see *live*.
Each agent is registered as data (an adapter doc), never as a branch in the
daemon, and every adapter declares a capability tier:

| Agent | Live monitoring tier |
| --- | --- |
| Claude Code | `realtime_hooks` |
| Gemini CLI | `realtime_hooks` |
| Codex | `session_lifecycle_only` |
| Cursor | `substrate_fallback` |
| GitHub Copilot | `substrate_fallback` |
| Antigravity | `substrate_fallback` |
| Goose | `substrate_fallback` |

The tiers are explained under [Andon](#how-much-andon-can-see-depends-on-the-agent).
Adding an agent means adding an adapter doc, not editing the daemon.

## MCP

Holistic ships an MCP server, so MCP-capable agents get continuity as tools
rather than as shell commands:

```bash
holistic serve
```

`holistic bootstrap` writes the Claude Desktop MCP entry for you. The tool
surface is deliberately thin: `holistic_resume`, `holistic_checkpoint`,
`holistic_handoff`, and `holistic_slash`. On connect, the server sends a short
notification when carryover exists, so the agent knows to resume before it
starts guessing.

## Commands

Setup:

| Command | Purpose |
| --- | --- |
| `holistic init` | Initialize Holistic for a repo |
| `holistic bootstrap` | Install machine helpers: git hooks, daemon, MCP config |
| `holistic repair` | Regenerate machine-local helpers after a path move or Node reinstall |
| `holistic uninstall` | Remove machine helpers, autostart, and the MCP entry. Keeps session memory unless you pass `--purge` |

Read-only and diagnostic:

| Command | Purpose |
| --- | --- |
| `holistic status` | View current repository health and sync status |
| `holistic doctor` | Run deep diagnostics and verify system health (`--json` for machine output) |
| `holistic resume` | Produce a recap and recovery flow (`holistic start` is an alias) |
| `holistic diff` | Compare session state between two points in time |
| `holistic search` | Find and retrieve session state by ID |
| `holistic version` | Print the installed version |

Stateful:

| Command | Purpose |
| --- | --- |
| `holistic checkpoint` | Save durable mid-session state (reason required) |
| `holistic handoff` | Finalize the session handoff |
| `holistic start-new` | Start a fresh tracked session while preserving unfinished work |
| `holistic watch` | Foreground watch mode for automatic checkpoints |
| `holistic serve` | Run the MCP server over stdio for MCP-capable agents |

The split is the trust model, not just tidiness: read-only commands never write.
They will surface a health warning about an outdated hook, but they will not
silently fix it.

`bootstrap` writes outside the repo (a startup entry, git hooks, and Claude
Desktop MCP config), so it shows you what it intends to change and does nothing
until you pass `--yes`.

## Andon: optional local monitoring

The repo also contains **Andon**, an optional add-on that shows what your agents
are doing right now: a Mission Control board, per-session timelines, and replay.

Andon is **not part of the published npm package**. It lives in this repository
and runs from source, so `npm install -g holistic` does not install it and the
daemon skips it when it is absent.

```bash
npm run andon:dev     # API, dashboard, and runtime writer together
```

It runs three services bound to `127.0.0.1`: the API on 4318, a runtime service
on 4320, and the dashboard on 5173. Because they are reachable from any page
your browser loads, they enforce an origin allowlist and a loopback auth token
created on first start. Read [SECURITY.md](SECURITY.md#network-surface) before
running it, and set `HOLISTIC_ANDON=0` if you want the daemon to leave it alone.

### How much Andon can see depends on the agent

Agents differ in what they expose, so each one is registered as data (an adapter
doc), never as a branch in the daemon. Every adapter declares a capability tier,
and the board degrades honestly rather than inventing a status:

| Tier | What it means |
| --- | --- |
| `realtime_hooks` | The agent has working turn hooks, so running and waiting flip live |
| `session_lifecycle_only` | Session start and end signals only, no turn boundaries |
| `substrate_fallback` | No lifecycle hooks; status is inferred from completion signals |

Adding a new agent means adding an adapter doc, not editing the daemon.

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

### Team mode: parallel agents, not just sequential ones

Everything above is about **serial** continuity: one developer handing off from
one agent to the next. The next step is **parallel** execution, using the git
worktrees Holistic already understands:

```bash
holistic spawn --agent claude    # isolated worktree, fresh branch, tracked session
holistic spawn --agent gemini    # a second worktree, working at the same time
# ... both agents work in parallel ...
holistic gather                  # review the diffs, merge what worked, clean up
```

Worktrees are the right primitive because the isolation is real: separate
directories, separate branches, no agents writing over each other. `gather` is
the interesting half. It has to reconcile two things at once, the **code** from
N branches and the **memory** from N sets of checkpoints, and it keeps the human
review step exactly where it belongs, at the merge.

Scope for the first version is deliberately one developer running several
agents. Several *developers* on one repo is a different problem, because a
checkpoint stops being a note to yourself and becomes an attestation from
someone else's agent, which Holistic cannot verify today. That is gated behind
the trust work below rather than shipped alongside.

### Also planned

- **Decisions and supersession.** Today a checkpoint that turns out to be wrong can only be overwritten or left to mislead. An append-only decision log with explicit supersession will let an entry be marked deprecated without deleting it, carrying a pointer to what replaced it and a short reason. This keeps the history honest instead of letting the memory layer fill with confident but stale claims. Specced; next concrete build.
- **Bounded derived docs.** Project history and the regression watchlist are rendered from session files and grow without limit, which eventually defeats the purpose of a doc agents are told to read first. Both are moving to a hot window with full detail plus a cold index.
- **Richer regression detection.** Move the regression watchlist from a manual list toward checkpoints that can flag the specific files or behaviors a prior fix depended on.
- **Cross-operator trust.** Everything today assumes every writing agent sits inside one person's trust boundary. Supporting teams honestly means a verifiable log, not just a shared branch. The direction is recorded rather than hand-waved.
- **Cross-agent messaging (under consideration).** A way for one agent to leave a targeted note for a specific next agent, not just a broadcast state update. Being evaluated against the goal of keeping the format simple.

Recently shipped: per-agent adapter coverage with declared capability tiers,
agent-agnostic live monitoring through Andon Mission Control, a loopback auth
token and loopback-only event delivery for the Andon services, and tagged
releases that track the npm versions.

## Background

Holistic came out of a fairly specific frustration: agent memory tools kept
treating continuity as a storage problem, when in practice it is a coordination
problem. The hard part is not writing state down. It is deciding what deserves
to be remembered, keeping it honest as it ages, and getting it in front of the
next agent before that agent starts guessing.

I have written about that at length in an ongoing series on AI coding agent
memory: why checkpoints beat transcripts, why regression memory matters more
than handoff summaries, and where the whole idea breaks down once agents stop
sharing a trust boundary.

If you want the deeper treatment of the theory behind this tool, rather than
just the tool itself, I collected it into a field guide:
**[Read the field guide](https://a.co/d/02EDuWEa)**.

## Contributing

Contributions and issues are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
