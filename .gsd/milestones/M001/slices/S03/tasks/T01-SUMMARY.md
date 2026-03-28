---
id: T01
parent: S03
milestone: M001
provides: []
requires: []
affects: []
key_files: ["src/core/types.ts", "src/core/state.ts", "src/core/docs.ts", "tests/run-tests.ts"]
key_decisions: ["Expose `archiveSessionsDir` explicitly in `RuntimePaths` so archived-session storage is a first-class runtime boundary.", "Keep derived docs on a merged stored-session reader (`readAllSessions`) so archive placement changes cannot silently hide history or regression memory."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Task-specific verification passed via `npm test -- --grep "archived sessions|history"`, proving archive placement, merged history rendering, and corrupt-session tolerance across active/archive directories. Slice-level build verification also passed via `npm run build`. Full `npm test` remains partially failing because of pre-existing hook-management expectations outside this task’s archive/history scope."
completed_at: 2026-03-28T03:24:55.535Z
blocker_discovered: false
---

# T01: Added explicit archive session storage and kept derived history/regression docs reading merged stored sessions.

> Added explicit archive session storage and kept derived history/regression docs reading merged stored sessions.

## What Happened
---
id: T01
parent: S03
milestone: M001
key_files:
  - src/core/types.ts
  - src/core/state.ts
  - src/core/docs.ts
  - tests/run-tests.ts
key_decisions:
  - Expose `archiveSessionsDir` explicitly in `RuntimePaths` so archived-session storage is a first-class runtime boundary.
  - Keep derived docs on a merged stored-session reader (`readAllSessions`) so archive placement changes cannot silently hide history or regression memory.
duration: ""
verification_result: mixed
completed_at: 2026-03-28T03:24:55.537Z
blocker_discovered: false
---

# T01: Added explicit archive session storage and kept derived history/regression docs reading merged stored sessions.

**Added explicit archive session storage and kept derived history/regression docs reading merged stored sessions.**

## What Happened

Updated Holistic’s session-storage contract so archived session records now have an explicit runtime home under `.holistic/sessions/archive/` instead of sharing the flat active sessions directory. Added centralized stored-session readers for archive-only and merged-history use, preserved corrupt-session skip behavior across both directories, rewired derived history/regression/root-history docs to consume the merged reader, and extended the regression harness to prove archive placement plus merged history visibility.

## Verification

Task-specific verification passed via `npm test -- --grep "archived sessions|history"`, proving archive placement, merged history rendering, and corrupt-session tolerance across active/archive directories. Slice-level build verification also passed via `npm run build`. Full `npm test` remains partially failing because of pre-existing hook-management expectations outside this task’s archive/history scope.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --grep "archived sessions|history"` | 0 | ✅ pass | 1099ms |
| 2 | `npm test` | 1 | ❌ fail | 1623ms |
| 3 | `npm run build` | 0 | ✅ pass | 2716ms |


## Deviations

None.

## Known Issues

`npm test` still fails in three unrelated hook-management tests: `repo runtime override keeps self-dogfooding files local-only`, `init can install git hooks and generate portable hook scripts`, and `managed hook refresh heals stale hooks and preserves custom hooks`. `npm run build` passes, and the task-specific archive/history verification passes.

## Files Created/Modified

- `src/core/types.ts`
- `src/core/state.ts`
- `src/core/docs.ts`
- `tests/run-tests.ts`


## Deviations
None.

## Known Issues
`npm test` still fails in three unrelated hook-management tests: `repo runtime override keeps self-dogfooding files local-only`, `init can install git hooks and generate portable hook scripts`, and `managed hook refresh heals stale hooks and preserves custom hooks`. `npm run build` passes, and the task-specific archive/history verification passes.
