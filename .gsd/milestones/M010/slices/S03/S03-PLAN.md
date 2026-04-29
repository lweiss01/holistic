# M010 S03 - Attention Queue

## Parallel lane constraints

- Execute after S01 plus initial S02/S04 data wiring.
- Respect runtime capability outputs from upstream; do not add capability semantics inside runtime layers here.
- Track any missing queue fields in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md).

## Tasks

- [ ] Add an Attention Queue near the top of the homepage for agents waiting on a human.
- [ ] Show agent name, repo, issue, time waiting, and recommended action for each queue item.
- [ ] Wire quick actions such as inspect, pause, resume, answer, approve, or reassign only when the runtime capability model says they are real.
- [ ] Add ranking and filtering tests so blocked and approval-pending sessions rise above routine running work.

## Success Criteria

- The operator can tell what needs intervention first without opening detail pages.
