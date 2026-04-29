# M010 - Master execution plan (Mission Control UX)

**Milestone:** [M010-ROADMAP.md](./M010-ROADMAP.md)
**Checkpoint:** Holistic checkpoint recorded after roadmap realignment for runtime-first fleet supervision.

## 1. Objective

Ship a fleet-first Mission Control homepage that sits on top of the runtime substrate from M006-M009.
The landing page must answer: what agents are running, which need me, why they need me, and where work or risk is clustering.

## 2. Realignment note

The old M010 "Builds A-F" work is preserved as groundwork, not deleted.
The previous single-session monitor, timeline, status density, and copy-honesty work still inform this milestone, but the milestone now targets the fleet homepage instead of incremental history-wall polish.
Historical summary files under `slices/` remain evidence of earlier groundwork and should not be read as completion proof for the new slice definitions.

## 3. Non-goals

- Replacing the dedicated session detail and timeline routes
- Rebuilding runtime orchestration inside the dashboard
- Inventing provider-specific adapter UX before the shared runtime contract is proven

## 4. Preconditions

- M006 supplies runtime contracts, persistence, and repository plumbing.
- M007 supplies runtime-service, local adapter behavior, and live runtime events.
- M008 supplies approvals, worktree metadata, and overlap/conflict safety signals.
- M009 supplies activity derivation, attention ranking, failure/stall detection, and explanations.

## 4.1 Parallel execution guardrails (active)

- M010 must not edit runtime ownership surfaces while M006/M007 are active:
  - `packages/runtime-core/**`
  - `packages/runtime-local/**`
  - `services/runtime-service/**`
  - M006/M007 milestone plan and roadmap files
- M010 can edit mission-control consumer and UX surfaces only:
  - M010 milestone files under `.gsd/milestones/M010/**`
  - Mission Control-facing docs in `docs/andon-mvp.md` and `docs/andon-design-tokens.md`
- If runtime data is missing for a homepage requirement, record it as a dependency gap in `slices/DEPENDENCY-GAPS.md` and adapt at the M010 read boundary until upstream lands.

## 5. Execution waves

| Wave | Slices | Rationale |
|------|--------|-----------|
| W1 | S01 | Establish the fleet read model and contract before UI work spreads across the app. |
| W2 | S02, S04 | Build the Fleet Header and Agent Grid once ranked fleet data exists. |
| W3 | S03 | Add the Attention Queue after quick-action semantics and attention reasons are stable. |
| W4 | S05 | Add timeline-style macro views once the homepage core is usable. |
| W5 | S06 | Finish the route migration and detail-page continuity story last. |
| W6 | S07 | Refine card/queue information value and scanning clarity after baseline continuity is stable. |

## 6. Verification loop

For each slice:

1. Update the slice plan checklist as tasks land.
2. Add or extend automated tests for any new API contract or sorting/ranking logic.
3. Run `npm test`.
4. Run `npm run andon:build` when dashboard code changes.
5. Manually verify the homepage and drill-down routes against live or fixture-backed data.

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Fleet UI ships before runtime data is trustworthy | Gate S02-S05 on S01 plus M006-M009 readiness. |
| Mission Control turns into oversized single-agent panels | Keep density requirements explicit in S04. |
| Quick actions imply capabilities the runtime cannot honor | Respect `RuntimeCapabilities` and disable or hide unsupported actions. |
| Homepage API becomes a fan-out bottleneck | Keep `/fleet` aggregated and additive; avoid many client-side round trips. |

## 8. Milestone done when

- [ ] S01-S07 slice plans are completed or explicitly deferred with reasons.
- [ ] `/` is the Mission Control homepage backed by `GET /fleet`.
- [ ] Detail and timeline drill-down routes remain intact and useful.
- [ ] The homepage clearly separates runtime truth from Holistic grounding.

## 9. Slice plans

- [S01 - Fleet read model and `/fleet` contract](./slices/S01/S01-PLAN.md)
- [S02 - Fleet Header](./slices/S02/S02-PLAN.md)
- [S03 - Attention Queue](./slices/S03/S03-PLAN.md)
- [S04 - Agent Grid](./slices/S04/S04-PLAN.md)
- [S05 - Activity Heatmap and Recent Signals Rail](./slices/S05/S05-PLAN.md)
- [S06 - Drill-down continuity and migration honesty](./slices/S06/S06-PLAN.md)
- [S07 - Informative UI refinement](./slices/S07/S07-PLAN.md)

## 10. Next action

Start with M006, not M010.
Once M006-M009 are in place, begin M010 at S01 by defining the aggregated `/fleet` contract and its ranking/read-model inputs.
