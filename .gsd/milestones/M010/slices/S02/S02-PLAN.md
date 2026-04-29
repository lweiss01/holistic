# M010 S02 - Fleet Header

Realigned from the earlier history-wall plan.

## Parallel lane constraints

- Execute after S01 contract/read-model is stable.
- Consume `/fleet` additively; do not edit runtime ownership code from this slice.
- Log missing upstream fields in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md) before requesting cross-milestone changes.

## Tasks

- [ ] Replace the current single-session-first hero on `/` with a Fleet Header fed by `/fleet`.
- [ ] Surface top-line totals such as total sessions, active agents, needs human, blocked, at risk, awaiting review, and completed today.
- [ ] Keep the visual treatment compact and scanable rather than promotional or oversized.
- [ ] Add tests or snapshot-friendly pure helpers where totals or labels are derived in shared code.

## Success Criteria

- The first thing a user sees on `/` is fleet state, not one agent spotlight.
