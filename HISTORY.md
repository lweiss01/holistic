# HISTORY

## Durable Memory

This repo uses Holistic to preserve cross-agent context. The durable memory lives in `.holistic/context/` and is automatically updated by the Holistic CLI.

## Key Documents

**Before changing existing behavior, review:**

- **[Project History](./.holistic/context/project-history.md)** — What was built, why it mattered, and what the impact was
- **[Regression Watch](./.holistic/context/regression-watch.md)** — Short list of fixes that must not be broken
- **[Zero-Touch Architecture](./.holistic/context/zero-touch.md)** — How Holistic achieves passive continuity

**Current work state:**

- **[Current Plan](./.holistic/context/current-plan.md)** — Active goal and next steps
- **[HOLISTIC.md](./HOLISTIC.md)** — Live status and pending work queue

**Session archive:**

- **[.holistic/sessions/](./.holistic/sessions/)** — Full session records

## Workflow

Agents should read these docs during startup, then use `holistic checkpoint` during work and `holistic handoff` when pausing.

See [AGENTS.md](./AGENTS.md) for the full protocol.
