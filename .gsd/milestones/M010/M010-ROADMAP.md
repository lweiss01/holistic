# M010: Mission Control UX

This milestone is realigned from the earlier "Builds A-F" dashboard plan.
The previous single-session monitor, timeline, and attention-density work remain useful groundwork, but M010 now owns the fleet-first Mission Control homepage built on top of the runtime substrate delivered in M006-M009.

**Architecture reminder:** Layer 1-2 runtime truth comes from the Holistic runtime contract and adapters, Layer 3 grounding comes from Holistic context, and Andon owns fleet supervision plus operator-facing UX.

**Master plan:** [M010-PLAN.md](./M010-PLAN.md)

## Vision

When a user opens Andon, they should understand the entire active agent fleet in a few seconds: what is running, where it is running, what needs intervention, and what deserves attention first.

## Slice Overview

| ID | Slice | Focus | Risk | Depends | Done |
|----|-------|-------|------|---------|------|
| S01 | Fleet read model and `/fleet` contract | Aggregate homepage data in one response | medium | M006-M009 | [ ] |
| S02 | Fleet Header | Top-line totals and state summary | low | S01 | [ ] |
| S03 | Attention Queue | Intervention-first queue and quick actions | medium | S01, M008, M009 | [ ] |
| S04 | Agent Grid | Dense multi-agent card layout sorted by attention | medium | S01, M009 | [ ] |
| S05 | Activity Heatmap and Recent Signals Rail | Time-based activity scan plus live feed | medium | S01, M007, M009 | [ ] |
| S06 | Drill-down continuity and migration honesty | Keep detail routes useful while `/` becomes Mission Control | low | S02-S05 | [ ] |
| S07 | Informative UI refinement | Increase information clarity and decision confidence without sacrificing density | medium | S02-S06 | [ ] |

## Exit Criteria

- `GET /fleet` returns ranked fleet data in a single contract.
- `/` becomes the Mission Control homepage with Fleet Header, Attention Queue, Agent Grid, Activity Heatmap, and Recent Signals Rail.
- `/session/:id`, `/session/:id/timeline`, and `/history` remain valid drill-down surfaces.
- The UI keeps runtime truth and Holistic grounding visually distinct.
- Mission Control cards and queues prioritize actionable context over decorative presentation.

## Parallel Isolation Rules (while M006/M007 run)

- M010 does not modify runtime ownership layers (`packages/runtime-core/**`, `packages/runtime-local/**`, `services/runtime-service/**`).
- Runtime field gaps are captured in `./slices/DEPENDENCY-GAPS.md` instead of patched upstream from this lane.
- M010 work stays on mission-control read/UX surfaces and M010-local planning docs.

## References

- [docs/andon-design-tokens.md](../../../docs/andon-design-tokens.md)
- [docs/andon-mvp.md](../../../docs/andon-mvp.md)
- [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md)
