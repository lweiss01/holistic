---
phase: 01-runtime-truth-boundary
plan: 02
subsystem: fleet-runtime-boundary
tags: [andon, fleet, runtime, disconnected, regression]
requires:
  - phase: 01-runtime-truth-boundary
    provides: Runtime-first fleet classification baseline
provides:
  - Runtime-backed fleet entries can coexist with legacy-only sessions as explicit disconnected parked cards
  - Legacy-only session visibility no longer depends on legacy live-state inference
  - Regression coverage for mixed runtime + legacy visibility behavior
affects: [fleet, runtime-truth, mission-control]
tech-stack:
  added: []
  patterns: [runtime-authoritative status with disconnected legacy visibility]
key-files:
  created: []
  modified: [services/andon-api/src/repository.ts, tests/andon.test.ts]
key-decisions:
  - "When runtime sessions exist, non-mirrored legacy sessions remain visible as parked runtime-missing cards."
  - "Disconnected legacy visibility uses explicit runtime-missing explanation/evidence and low-urgency recommendation semantics."
patterns-established:
  - "Runtime sessions determine active state; legacy-only rows are informational disconnected entries."
requirements-completed: [RTM-01, RTM-02, RTM-03, RTM-04]
duration: 22m
completed: 2026-04-29
---

# Phase 01 Plan 02: Runtime Truth Boundary Summary

**Fleet runtime-truth behavior now preserves disconnected legacy visibility without restoring legacy live-state inference.**

## Accomplishments

- Updated Fleet runtime path to append legacy sessions that have no runtime mirror as `parked` disconnected entries.
- Added explicit runtime-missing explanation/evidence for these entries.
- Added integration regression coverage validating mixed runtime + legacy visibility behavior.

## Verification

- `npm run test:andon` passes all Phase 01 RTM tests, including mixed runtime + disconnected legacy visibility.
- `npm test` (full suite) passes as of 2026-04-29 execute-phase run.

## Plan execution note — 2026-04-29 (`$gsd-execute-phase 1`)

- Implemented `listLegacySessionsWithoutRuntimeMirror`, `buildDisconnectedLegacyFleetItem`, and `buildRuntimeMissingMirrorRecommendation` in `services/andon-api/src/repository.ts`; merged disconnected legacy rows into the runtime-present `getFleet` path after runtime-only filtering/sort.
- Applied the same cold parked + one-hour stale filter used for runtime rows to disconnected legacy rows so stale legacy-only noise stays off the board.
- Updated `tests/andon.test.ts`: mixed-fleet contract, checkpoint-noise legacy surfaces as parked below runtime attention.

## Self-Check: PASSED

- Runtime-only status inference remains intact for active/needs_input states.
- Legacy-only sessions are visible as disconnected parked entries with runtime-missing evidence.
