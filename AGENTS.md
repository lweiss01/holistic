# AGENTS

## Public Repo Policy

This repository is the public Holistic product repo.
Do not treat committed files here as a personal session archive.
Do not commit self-dogfooding runtime state, generated handoff files, or local history back into `main`.

## Start Here

1. Read [HOLISTIC.md](./HOLISTIC.md).
2. Read [README.md](./README.md) for current product direction.
3. If local self-dogfooding files exist, prefer those local-only runtime files over creating or updating tracked public runtime files.
4. Recap the current state for the user and ask whether to continue, tweak the plan, or start something new.

## `/holistic` Startup Pattern (non-MCP tools)

When a tool does not auto-start via MCP, agents should explicitly run Holistic startup before implementation work.

### Expected startup flow

1. Run `/holistic` (or repo-local CLI `holistic resume --continue`).
2. Read the recap and summarize current objective + latest status in 1-3 lines.
3. Ask the user: **continue as planned, tweak the plan, or start something new**.
4. Wait for user choice before coding.

### Behavior contract

- Do not skip startup recap when a prior session or handoff exists.
- Keep startup output concise and actionable.
- If no carryover exists, state that clearly and offer to start a new session.
- Treat startup warnings as system-health diagnostics (not user blame).

## Self-Dogfooding On This Repo

The Holistic repo is a special case.

- Normal user repos may use tracked runtime files and an optional `holistic/state` branch.
- This repo should not expose a contributor's personal runtime state in the public codebase.
- Local runtime state for dogfooding belongs in ignored files such as `.holistic-local/`, `HOLISTIC.local.md`, and `AGENTS.local.md`.

## Guardrail

Before committing from this repo, check that you are not staging:

- `.holistic-local/`
- `HOLISTIC.local.md`
- `AGENTS.local.md`
- local session archives
- generated personal history or handoff files

If the change is repo-local dogfooding state, keep it local.
