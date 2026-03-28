---
id: T01
parent: S06
milestone: M001
provides: []
requires: []
affects: []
key_files: [".holistic-local/context/project-history.md", ".holistic-local/context/regression-watch.md"]
key_decisions: ["Use real CLI flow (resume, checkpoint, handoff --draft) as the dogfooding acceptance path instead of synthetic docs-only validation.", "Treat repeated unmanaged-hook refresh warnings as a UX signal to capture for S07 polish rather than a blocker for S06."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Executed live CLI flow and confirmed successful command exits and expected output surfaces."
completed_at: 2026-03-28T20:36:50.362Z
blocker_discovered: false
---

# T01: Validated core Holistic CLI dogfooding flow in the Holistic repo and captured rough-edge findings.

> Validated core Holistic CLI dogfooding flow in the Holistic repo and captured rough-edge findings.

## What Happened
---
id: T01
parent: S06
milestone: M001
key_files:
  - .holistic-local/context/project-history.md
  - .holistic-local/context/regression-watch.md
key_decisions:
  - Use real CLI flow (resume, checkpoint, handoff --draft) as the dogfooding acceptance path instead of synthetic docs-only validation.
  - Treat repeated unmanaged-hook refresh warnings as a UX signal to capture for S07 polish rather than a blocker for S06.
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:36:50.362Z
blocker_discovered: false
---

# T01: Validated core Holistic CLI dogfooding flow in the Holistic repo and captured rough-edge findings.

**Validated core Holistic CLI dogfooding flow in the Holistic repo and captured rough-edge findings.**

## What Happened

Dogfooded Holistic end-to-end inside the Holistic repo itself using the real CLI path: resume --continue, checkpoint, and handoff --draft. Core flow works and writes expected recap/checkpoint/handoff outputs. Observed two rough edges for follow-up: startup recap can include outdated long-tail next steps in long-lived sessions, and unmanaged-hook refresh warnings are repeated/noisy on each command.

## Verification

Executed live CLI flow and confirmed successful command exits and expected output surfaces.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run holistic -- resume --continue` | 0 | ✅ pass | 3100ms |
| 2 | `npm run holistic -- checkpoint --reason "s06 dogfood t01 checkpoint" --status "Validated resume/startup flow in Holistic repo"` | 0 | ✅ pass | 3300ms |
| 3 | `npm run holistic -- handoff --draft --summary "S06 T01 dogfooding snapshot" --next "Run same flow in paydirt repo"` | 0 | ✅ pass | 5600ms |


## Deviations

None.

## Known Issues

Startup recap still carried stale historical next-step text from older release cycles, and repeated 'existing hook is not Holistic-managed' warnings add noise in normal CLI flow.

## Files Created/Modified

- `.holistic-local/context/project-history.md`
- `.holistic-local/context/regression-watch.md`


## Deviations
None.

## Known Issues
Startup recap still carried stale historical next-step text from older release cycles, and repeated 'existing hook is not Holistic-managed' warnings add noise in normal CLI flow.
