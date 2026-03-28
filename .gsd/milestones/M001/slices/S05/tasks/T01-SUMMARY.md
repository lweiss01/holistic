---
id: T01
parent: S05
milestone: M001
provides: []
requires: []
affects: []
key_files: ["README.md"]
key_decisions: ["Model startup behavior as explicit MCP auto-start yes/no instead of a generic 'automatic' label.", "Attach a concrete startup action to each supported tool row to reduce operator ambiguity."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran the project test suite after documentation changes to ensure no regressions in generated/help surfaces and baseline behavior."
completed_at: 2026-03-28T20:30:05.078Z
blocker_discovered: false
---

# T01: Added a startup parity matrix in README distinguishing MCP auto-start from manual /holistic startup.

> Added a startup parity matrix in README distinguishing MCP auto-start from manual /holistic startup.

## What Happened
---
id: T01
parent: S05
milestone: M001
key_files:
  - README.md
key_decisions:
  - Model startup behavior as explicit MCP auto-start yes/no instead of a generic 'automatic' label.
  - Attach a concrete startup action to each supported tool row to reduce operator ambiguity.
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:30:05.085Z
blocker_discovered: false
---

# T01: Added a startup parity matrix in README distinguishing MCP auto-start from manual /holistic startup.

**Added a startup parity matrix in README distinguishing MCP auto-start from manual /holistic startup.**

## What Happened

Reworked the README tool-support section into an explicit startup parity matrix that separates MCP auto-start capability from manual-start paths. The matrix now provides a concrete startup action per tool/surface, reducing ambiguity about where /holistic or holistic_resume is required.

## Verification

Ran the project test suite after documentation changes to ensure no regressions in generated/help surfaces and baseline behavior.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 6000ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `README.md`


## Deviations
None.

## Known Issues
None.
