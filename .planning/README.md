# Product planning index (Holistic + Andon)

This directory holds **cross-cutting planning** that is not tied to GSD runtime state (`.gsd/activity`, locks, journals).

## Canonical sources

| Concern | Where it lives |
|--------|----------------|
| **Execution** (waves, slices, tasks, checklists) | [`.gsd/`](../.gsd/) — especially [`.gsd/PROJECT.md`](../.gsd/PROJECT.md) and [`.gsd/milestones/`](../.gsd/milestones/) |
| **Capability contract** | [`.gsd/REQUIREMENTS.md`](../.gsd/REQUIREMENTS.md) |
| **Andon design ↔ code map** | [`docs/andon-design-tokens.md`](../docs/andon-design-tokens.md), [`docs/andon-mvp.md`](../docs/andon-mvp.md) |
| **Holistic product narrative (public)** | [`HOLISTIC.md`](../HOLISTIC.md), [`README.md`](../README.md) |

## Local-only runtime

- **`.holistic-local/`**, `HOLISTIC.local.md`, `AGENTS.local.md` — personal dogfooding; do not commit.
- **`.holistic/system/`** (when present) — machine-local helpers; listed in `.gitignore`; not a planning document store.

## Reconciliation log

- [RECONCILIATION-2026-04-18.md](./RECONCILIATION-2026-04-18.md) — gaps between built state and agreed architecture (session 2026-04-18), mapped to milestones/slices/tasks.
- [CANON-LAYERS.md](./CANON-LAYERS.md) — short stable statement of Holistic vs OpenHarness vs Andon layers (aligned with design spec §4 / §8).
