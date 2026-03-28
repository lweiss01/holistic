---
id: S03
parent: M001
milestone: M001
provides:
  - Automatic archival of stale unreferenced sessions during session start/resume and daemon ticks.
  - Automatic reactivation when archived sessions are explicitly reused by diff/handoff/search.
  - Stable merged history/docs rendering across active and archived session stores.
requires:
  []
affects:
  - S06
key_files:
  - src/core/types.ts
  - src/core/state.ts
  - src/core/docs.ts
  - src/daemon.ts
  - src/cli.ts
  - tests/run-tests.ts
  - .gsd/milestones/M001/slices/S03/S03-PLAN.md
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T03-SUMMARY.md
key_decisions:
  - Made archive storage explicit via `archiveSessionsDir` in RuntimePaths.
  - Centralized archive policy in shared `runSessionHygiene` rather than duplicating logic across entrypoints.
  - Applied crash-safe archive move ordering: write archive record before unlinking active file.
  - Restricted reactivation triggers to explicit exact-id use (diff, handoff relatedSessions session-id tokens, search --id).
  - Preserved malformed/corrupt session tolerance rather than failing full scans.
patterns_established:
  - Single shared state-layer helpers own lifecycle policy (`runSessionHygiene`, `reactivateArchivedSession`).
  - Derived docs consume merged readers so storage layout changes do not hide history.
  - Exact-id gated mutation rules avoid accidental archive churn from free-form text.
observability_surfaces:
  - Archive lifecycle is externally visible via deterministic filesystem placement under `.holistic/sessions/archive/`.
  - Task verification evidence captured in task summaries and verify artifacts for regression traceability.
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-28T18:52:15.575Z
blocker_discovered: false
---

# S03: Automatic Memory Hygiene

**Completed automatic session-memory hygiene with 30-day stale-session archival and explicit-use reactivation across state, daemon, and CLI paths.**

## What Happened

S03 implemented the end-to-end archive lifecycle for Holistic sessions. T01 established `.holistic/sessions/archive/` as an explicit runtime boundary and moved docs/history readers to merged active+archive reads with corrupt-record tolerance intact. T02 introduced a shared `runSessionHygiene` policy that archives only sessions older than 30 days and unreferenced by active continuity metadata, then wired that same policy path into session start/resume and daemon ticks with crash-safe write-then-unlink semantics. T03 added explicit-use reactivation via a shared `reactivateArchivedSession` helper used by diff, handoff related-session references (exact session-id filtering), and exact-id search, plus timestamp-sort hardening for sparse archived records.

## Verification

Task-scoped verification passed for each deliverable class: archive/docs behavior (`npm test -- --grep "archived sessions|history"`), hygiene execution (`npm test -- --grep "30 day|daemon tick"`), and reactivation behavior (`npm test -- --grep "diff|handoff|search|reactivat"`). `npm run build` passed during each task cycle. Full `npm test` still reports the same three pre-existing hook-management failures already tracked before this slice; no new regressions attributable to S03 were introduced.

## Requirements Advanced

- R008 — Implemented 30-day + unreferenced archival policy and wired it into start/resume/daemon tick flows.
- R009 — Implemented explicit-use reactivation from archive for diff, handoff relatedSessions, and search --id.

## Requirements Validated

- R008 — Verified with archive/history and hygiene tests: `npm test -- --grep "archived sessions|history"` and `npm test -- --grep "30 day|daemon tick"` plus build pass.
- R009 — Verified with reactivation tests: `npm test -- --grep "diff|handoff|search|reactivat"` plus build pass.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

T03 included a defensive hardening change to timestamp sorting for sessions missing endedAt/updatedAt so archive reads cannot crash on sparse records.

## Known Limitations

Repository-level full test suite still has three pre-existing hook-management failures outside S03 scope.

## Follow-ups

Carry existing hook-management failures into a dedicated follow-up slice/task so milestone-wide green verification can be achieved.

## Files Created/Modified

- `src/core/types.ts` — Added explicit archive session runtime path in `RuntimePaths`.
- `src/core/state.ts` — Added merged readers, archive candidate logic, hygiene runner, and archive reactivation helper.
- `src/core/docs.ts` — Switched derived history/regression readers to merged active+archive session retrieval.
- `src/daemon.ts` — Invoked shared hygiene path in daemon tick before normal checkpoint flow.
- `src/cli.ts` — Wired explicit reactivation on diff/handoff and added exact-id search path integration.
- `tests/run-tests.ts` — Added coverage for archive placement, hygiene policy, and explicit reactivation behavior.
