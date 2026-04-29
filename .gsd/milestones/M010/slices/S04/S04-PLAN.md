# M010 S04 - Agent Grid

## Parallel lane constraints

- Execute after S01 read-model contract is available.
- Keep this slice UI-consumer focused; do not patch runtime-core/service code.
- Record upstream-card-field gaps in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md).

## Tasks

- [ ] Build a dense multi-agent grid that can show several runtime sessions simultaneously.
- [ ] Each card should include agent name, runtime, repo, current phase or activity, runtime/heartbeat freshness, current task, status severity, and recommended next action.
- [ ] Sort the grid by attention rank so the most urgent session naturally lands at the top-left.
- [ ] Preserve responsive density across desktop and smaller viewports without turning cards into oversized panels.

## Success Criteria

- The homepage reads as a fleet board, not a stack of detail pages.
