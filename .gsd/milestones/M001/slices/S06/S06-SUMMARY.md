---
id: S06
parent: M001
milestone: M001
provides:
  - Real-world confidence that core set-and-forget flow works outside synthetic tests.
  - Prioritized rough-edge findings grounded in real usage.
requires:
  - slice: S02
    provides: Automatic checkpoint/handoff behaviors validated in synthetic tests before field validation.
  - slice: S03
    provides: Session lifecycle hygiene behavior validated before cross-repo use.
affects:
  - S07
key_files:
  - .gsd/milestones/M001/slices/S06/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S06/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S06/tasks/T03-SUMMARY.md
key_decisions:
  - Use live CLI flows in real repos (not synthetic mocks) as dogfooding proof criteria.
  - Treat version-skew behavior as a rollout/polish concern to fix in S07, not as a blocker to S06 validation completion.
patterns_established:
  - Dogfooding protocol: resume → checkpoint → handoff in each target repo with captured command evidence.
  - Cross-repo synthesis step before closing validation slice.
observability_surfaces:
  - Task-level dogfooding evidence summaries for each repo pass.
  - Cross-repo synthesis summary capturing known rough edges and impact.
drill_down_paths:
  - .gsd/milestones/M001/slices/S06/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S06/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S06/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:40:06.321Z
blocker_discovered: false
---

# S06: Real-World Dogfooding

**Validated Holistic in two real repos and produced a concrete rough-edge backlog for S07 polish.**

## What Happened

Executed real-world dogfooding across two repositories (Holistic and Paydirt) using resume/checkpoint/handoff workflows. Both repos validated core continuity behavior for resume and checkpoint. Paydirt exposed practical version-skew and handoff UX differences (0.4.0), while Holistic exposed recap and warning-noise rough edges in long-lived sessions. The slice retires the 'unknown real-world viability' risk and hands concrete polish targets to S07.

## Verification

Validated with command evidence in both repos and a final full test run (`npm test`) on product repo to ensure baseline remains green.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Validated in two repos (Holistic + Paydirt) rather than three; this still meets S06's 2-3 repo objective range.

## Known Limitations

Only two repos were exercised in this pass; a third repo could further increase confidence but was not required to satisfy the stated 2-3 range.

## Follow-ups

S07 should address three concrete rough edges found here: noisy unmanaged-hook warnings, stale long-tail recap drift in old sessions, and rollout guidance/guardrails for mixed-version repos (e.g., 0.4.0 behavior differences).

## Files Created/Modified

- `.gsd/milestones/M001/slices/S06/tasks/T01-SUMMARY.md` — Captured first dogfooding pass findings in Holistic repo using live CLI flow.
- `.gsd/milestones/M001/slices/S06/tasks/T02-SUMMARY.md` — Captured second dogfooding pass findings in Paydirt repo and version-skew behavior.
- `.gsd/milestones/M001/slices/S06/tasks/T03-SUMMARY.md` — Captured cross-repo synthesis and follow-up rough-edge backlog.
