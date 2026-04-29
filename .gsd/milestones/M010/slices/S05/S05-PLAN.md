# M010 S05 - Activity Heatmap and Recent Signals Rail

## Parallel lane constraints

- Execute after S01 and after core homepage sections (S02-S04) are consuming `/fleet`.
- Keep aggregation changes on M010 read-model helpers only; do not modify runtime ownership layers.
- Capture missing activity/signal fields in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md).

## Tasks

- [ ] Add an activity heatmap for the last 24 hours, designed to expand to longer windows later.
- [ ] Choose heatmap groupings that help supervision: by repo, by agent, by severity, or by intervention volume.
- [ ] Add a Recent Signals Rail that surfaces fleet-wide live events without forcing a detail-page drill-down.
- [ ] Add tests for any aggregation helpers used to build heatmap cells or recent-event summaries.

## Success Criteria

- The homepage shows both current priority and recent activity patterns at a glance.
