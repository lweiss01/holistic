## Current Position

Phase: Andon recovery Step B
Plan: `docs/andon-recovery-plan.md`
Status: Canonical recovery plan established; implementation remains paused until Step C
Last activity: 2026-04-30 - Option D selected: rebuild runtime harness + dashboard around a clean contract while salvaging useful runtime scaffolding.

## Project Reference

See: `.planning/PROJECT.md` and `docs/andon-recovery-plan.md`.

**Core value:** The live board reflects real agent runtime truth, not stale inferred history.
**Current focus:** Runtime harness contract and server-side operational projection before any dashboard rebuild.

## Accumulated Context

- `docs/andon-recovery-plan.md` is the canonical Andon recovery contract.
- `.planning/ROADMAP.md` and `.planning/phases/01-runtime-truth-boundary/` are superseded for execution and retained as historical context.
- Dashboard trust dropped because stale status/objective repeatedly appeared after restarts.
- Runtime-first path exists but still needs strict boundaries, operational categories, and stronger degraded-mode handling.
- Operator feedback requires intervention-first UI where state is obvious without reading detail text.
