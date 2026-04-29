# M010 S06 - Drill-down continuity and migration honesty

## Parallel lane constraints

- Execute after S02-S05 homepage migration work is in place.
- Preserve existing drill-down contracts additively; do not move route logic into runtime services.
- Note any dependency blockers in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md) instead of cross-milestone edits.

## Tasks

- [ ] Keep `/session/:id`, `/session/:id/timeline`, and `/history` useful as drill-down routes after `/` becomes Mission Control.
- [ ] Audit copy so runtime activity, status explanations, and Holistic grounding are never conflated.
- [ ] Preserve additive compatibility during the route transition so saved links and existing tests keep working.
- [ ] Add verification that detail routes still surface current task, runtime state, and Holistic grounding clearly after the homepage pivot.

## Success Criteria

- Mission Control becomes the landing experience without breaking or confusing the existing drill-down surfaces.
