---
id: T02
parent: S03
milestone: M001
provides: []
requires: []
affects: []
key_files: ["src/core/state.ts", "src/daemon.ts", "tests/run-tests.ts"]
key_decisions: ["Single shared runSessionHygiene owns the archive policy — session start, resume, and daemon tick all call the same function.", "Crash-safe ordering: write to archive first, then unlink from active.", "Malformed endedAt and missing endedAt skip archival silently — one bad file cannot archive the wrong sessions."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran npm test -- --grep "30 day|daemon tick" — all 13 matched tests pass (6 new + 7 existing daemon tests). Build passes via npm run build. Full npm test shows the same 3 pre-existing hook-management failures from T01, no new regressions."
completed_at: 2026-03-28T03:42:47.622Z
blocker_discovered: false
---

# T02: Implemented 30-day stale-session archiving during session start, resume, and daemon ticks with shared hygiene helper, reference-exemption logic, and boundary-condition tests

> Implemented 30-day stale-session archiving during session start, resume, and daemon ticks with shared hygiene helper, reference-exemption logic, and boundary-condition tests

## What Happened
---
id: T02
parent: S03
milestone: M001
key_files:
  - src/core/state.ts
  - src/daemon.ts
  - tests/run-tests.ts
key_decisions:
  - Single shared runSessionHygiene owns the archive policy — session start, resume, and daemon tick all call the same function.
  - Crash-safe ordering: write to archive first, then unlink from active.
  - Malformed endedAt and missing endedAt skip archival silently — one bad file cannot archive the wrong sessions.
duration: ""
verification_result: mixed
completed_at: 2026-03-28T03:42:47.625Z
blocker_discovered: false
---

# T02: Implemented 30-day stale-session archiving during session start, resume, and daemon ticks with shared hygiene helper, reference-exemption logic, and boundary-condition tests

**Implemented 30-day stale-session archiving during session start, resume, and daemon ticks with shared hygiene helper, reference-exemption logic, and boundary-condition tests**

## What Happened

Added findArchiveCandidates and runSessionHygiene to src/core/state.ts as the single shared hygiene policy. findArchiveCandidates scans active sessions for those ended >30 days ago, excluding any referenced by activeSession, lastHandoff, pendingWork, or relatedSessions on other active sessions. runSessionHygiene moves qualifying sessions to archive with crash-safe write-then-unlink ordering. Wired the hygiene call into three entrypoints: startNewSession, continueFromLatest (both in state.ts), and the runDaemonTick locked section (in daemon.ts), all invoking the same codepath. Added 6 new test cases covering stale-vs-referenced sessions with boundary conditions, malformed/missing endedAt tolerance, daemon-tick and session-start integration, no-candidate passthrough, and multi-candidate batch archiving.

## Verification

Ran npm test -- --grep "30 day|daemon tick" — all 13 matched tests pass (6 new + 7 existing daemon tests). Build passes via npm run build. Full npm test shows the same 3 pre-existing hook-management failures from T01, no new regressions.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --grep "30 day|daemon tick"` | 0 | ✅ pass | 2400ms |
| 2 | `npm run build` | 0 | ✅ pass | 2700ms |
| 3 | `npm test` | 1 | ❌ fail (3 pre-existing) | 2700ms |


## Deviations

None.

## Known Issues

npm test still fails on the same 3 pre-existing hook-management tests from T01: repo runtime override, git hooks installation, and managed hook refresh. These are unrelated to session hygiene.

## Files Created/Modified

- `src/core/state.ts`
- `src/daemon.ts`
- `tests/run-tests.ts`


## Deviations
None.

## Known Issues
npm test still fails on the same 3 pre-existing hook-management tests from T01: repo runtime override, git hooks installation, and managed hook refresh. These are unrelated to session hygiene.
