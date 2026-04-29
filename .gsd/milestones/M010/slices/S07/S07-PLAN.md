# M010 S07 - Informative UI refinement

## Parallel lane constraints

- Execute after S02-S06 baseline mission-control flow is stable.
- Stay in mission-control UI and read-model consumer surfaces; do not modify runtime ownership layers.
- Record any missing runtime fields in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md) instead of upstream edits.

## Tasks

- [ ] Audit Fleet Header, Attention Queue, and Agent Grid for information gaps that block supervisor decisions in under 10 seconds.
- [ ] Improve card and queue content hierarchy so each item answers: why this matters now, what action is expected, and what changed recently.
- [ ] Add compact explanatory labels for ambiguous metrics (for example, freshness and attention rank) so values are informative without reading docs.
- [ ] Reduce decorative or repetitive copy that does not influence action while preserving visual scanability.
- [ ] Add verification tests for any new formatting or ranking helper logic introduced during refinement.

## Success Criteria

- Mission Control remains visually polished but becomes more operationally informative at a glance.
- Operators can identify priority, reason, and next action from the first screen without opening detail routes.
