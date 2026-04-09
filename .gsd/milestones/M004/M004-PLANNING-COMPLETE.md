# M004 Planning Complete

## Status

✅ **Research Complete** — `.gsd/milestones/M004/M004-RESEARCH.md`  
✅ **All 6 Slices Planned** — Task-level plans created for S01-S06

## Slice Planning Summary

### S01: Implement Git Commit Execution (HIGH RISK)
**4 tasks | ~2.5 hours**
- T01: Add commitPendingChanges function to git.ts (45m)
- T02: Integrate commitPendingChanges into handoff flow (30m)
- T03: Add error handling and edge cases (45m)
- T04: End-to-end verification (30m)

**Key deliverable:** Handoff creates actual git commits instead of just writing intent

### S02: Fix Sync Script Portability (MEDIUM RISK)  
**3 tasks | ~1.25 hours**
- T01: Update shell script template for dynamic ROOT (20m)
- T02: Update PowerShell script template for dynamic ROOT (20m)
- T03: End-to-end verification of portable sync scripts (30m)

**Key deliverable:** Sync scripts work from any directory/machine

### S03: Add File I/O Error Handling (HIGH RISK)
**5 tasks | ~3.5 hours**
- T01: Add error handling to state.ts file operations (60m)
- T02: Add error handling to session I/O (45m)
- T03: Add error handling to git.ts file operations (45m)
- T04: Add error handling to docs.ts file operations (30m)
- T05: Update CLI to handle I/O errors gracefully (30m)

**Key deliverable:** File I/O failures show errors instead of crashing

### S04: Optimize Daemon State Persistence (MEDIUM RISK)
**4 tasks | ~2 hours**
- T01: Audit persistObservedState call sites (15m)
- T02: Remove persistObservedState from buffering paths (20m)
- T03: Add persistence logging for verification (20m)
- T04: Operational verification of reduced state writes (65m)

**Key deliverable:** state.json written <5 times/hour instead of 120+

### S05: Fix Deduplication & Minor Bugs (LOW RISK)
**3 tasks | ~1.75 hours**
- T01: Fix recentFirstMerge deduplication (30m)
- T02: Fix detached HEAD branch name (30m)
- T03: Throttle session hygiene to once per day (45m)

**Key deliverable:** Three bug fixes with unit tests

### S06: Use Git LS-Files for Snapshot (MEDIUM RISK)
**3 tasks | ~2 hours**
- T01: Implement git ls-files snapshot capture (45m)
- T02: Add fallback logic to captureRepoSnapshot (30m)
- T03: Benchmark and verify performance improvement (45m)

**Key deliverable:** 10x faster snapshot on large repos

## Total Effort Estimate
**23 tasks across 6 slices | ~13 hours total**

## Dependency Order

**Parallel track 1 (no dependencies):**
- S01: Implement Git Commit Execution
- S05: Fix Deduplication & Minor Bugs

**Depends on S01:**
- S02: Fix Sync Script Portability (sync pushes commits)

**Parallel track 2 (no dependencies):**
- S03: Add File I/O Error Handling

**Depends on S03:**
- S04: Optimize Daemon State Persistence (needs error handling for safe persistence)
- S06: Use Git LS-Files for Snapshot (git ops need error handling)

## Recommended Execution Order

1. **S01** (high risk, foundational) — Get auto-commit working first
2. **S03** (high risk, foundational) — Add error handling before optimizations
3. **S05** (low risk, independent) — Quick wins while S03 is fresh
4. **S02** (depends on S01) — Fix sync scripts now that commits work
5. **S06** (depends on S03) — Performance optimization with error handling
6. **S04** (depends on S03) — Daemon optimization last (needs stable foundation)

## Known Issues

- **Database transaction errors** when calling `gsd_plan_slice` for S06
  - Manually created S06-PLAN.md instead
  - Same error encountered during M001 completion (T07 issue)
  - Does not affect plan quality, just tool call success

## Next Steps

1. Start execution with S01 (high-risk, foundational)
2. Use `/gsd auto` for automated execution OR
3. Execute manually task-by-task with human oversight

All research complete, all plans ready. M004 is ready for execution.
