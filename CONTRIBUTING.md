# Contributing to Holistic

Holistic is trying to solve a very specific pain: project work gets fragmented across agents, apps, devices, and half-finished sessions. Contributions are most helpful when they make handoffs clearer, memory more durable, or regressions harder to repeat.

## What we care about

- preserving project context across agent switches
- reducing repeated regressions
- making setup simple enough that people will actually use it
- keeping the repo-first model portable across tools and devices
- making long-term project history useful, not noisy

## Local development

Requirements:

- Node.js 24+
- Git

Install and verify:

```bash
npm install
node --version
npm test
```

## Project structure

| Path | Purpose |
| --- | --- |
| `src/cli.ts` | public CLI entrypoint |
| `src/daemon.ts` | passive background capture |
| `src/core/state.ts` | canonical state model and session lifecycle |
| `src/core/docs.ts` | generated repo-visible memory docs |
| `src/core/setup.ts` | repo init and system helper generation |
| `tests/run-tests.ts` | end-to-end regression harness |
| `.holistic-local/` | ignored local Holistic runtime for this public product repo |

## Dogfooding Holistic in this repo

This public product repo is a special case.

Holistic dogfooding here must stay local-only and untracked. The repo-level override redirects runtime state into `.holistic-local/`, `HOLISTIC.local.md`, and `AGENTS.local.md` instead of tracked public runtime files.

Recommended local setup for working on Holistic itself:

```bash
node --experimental-strip-types src/cli.ts bootstrap --install-daemon false --configure-mcp false --install-hooks false
```

Common local flows:

```bash
node --experimental-strip-types src/cli.ts resume --agent codex
node --experimental-strip-types src/cli.ts checkpoint --reason "milestone"
node --experimental-strip-types src/cli.ts handoff
```

Do not initialize tracked `.holistic/` runtime state in this repo, and do not use a visible `holistic/state` branch here for self-dogfooding.

For normal user repos, tracked `.holistic/` runtime plus the hidden portable state ref (`refs/holistic/state`) is the standard path. This product repo itself should stay public, clean, and main-only.

## Contribution guidelines

### 1. Prefer repo-first solutions

If a feature only works on one machine or in one app, it is probably not enough on its own. Holistic should degrade gracefully to repo-visible memory.

### 2. Preserve long-term memory

New features should help answer:

- what changed
- why it changed
- what impact it had
- what should not regress later

### 3. Avoid transcript bloat

Holistic should preserve durable, useful state. It should not turn into a raw log dump of every prompt and response.

### 4. Protect user trust

- redact secrets
- do not commit sensitive local state by accident
- make automated behavior legible and reviewable

### 5. Test behavior, not just helpers

When possible, add tests around the user-visible workflow:

- resume
- checkpoint
- handoff
- carryover to a new session
- regression preservation
- cross-device sync behavior

## Pull request checklist

Before opening a PR:

- run `npm test`
- run `npm run build`
- verify the README and docs still match the behavior
- think through whether your change improves or harms cross-agent portability
- call out any new risks around regression memory, secrecy, or sync

## Good areas for contributions

- stronger regression tracking
- better cross-device sync ergonomics
- richer handoff review flows
- app-specific integrations that still honor the repo-first contract
- clearer history summarization
- safer passive capture

## Design principle

Holistic should help the next agent act like they were there the whole time.
