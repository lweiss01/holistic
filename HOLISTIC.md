# HOLISTIC

## Public Repo Note

This file is intentionally static in the public Holistic repo.

It is not a live session handoff, personal work log, or dogfooding history file.
The public repository must not ship a contributor's private or incidental Holistic runtime state.

## Product North Star

Open repo, start working, Holistic quietly keeps continuity alive.

## Self-Dogfooding Rule

When Holistic is dogfooded on the Holistic repo itself, runtime files must stay local-only and untracked.

For this repo, live runtime state is redirected to ignored local paths such as:

- `.holistic-local/`
- `HOLISTIC.local.md`
- `AGENTS.local.md`

Do not commit local session state, local history, local handoff docs, or local generated runtime files from self-dogfooding back into `main`.

## Contributor Workflow

1. Read [`README.md`](./README.md) for product context.
2. Read [`AGENTS.md`](./AGENTS.md) for contributor instructions in this repo.
3. If local self-dogfooding files exist, use them for your personal runtime state, but keep them untracked.

## Boundary

Holistic user repos may use a separate `holistic/state` branch.
The Holistic product repo itself is a special case and should stay clean, public, and `main`-only.
