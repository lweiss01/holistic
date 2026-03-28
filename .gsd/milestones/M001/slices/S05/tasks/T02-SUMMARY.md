---
id: T02
parent: S05
milestone: M001
provides: []
requires: []
affects: []
key_files: ["AGENTS.md"]
key_decisions: ["Document /holistic startup behavior in AGENTS.md as an explicit required flow for non-MCP tools.", "Make the user choice prompt (continue/tweak/start-new) a first-class behavior contract before implementation work."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Executed full test suite after AGENTS.md update to verify no runtime or docs-generation regressions."
completed_at: 2026-03-28T20:30:11.630Z
blocker_discovered: false
---

# T02: Documented explicit /holistic startup behavior contract in AGENTS.md for non-MCP tools.

> Documented explicit /holistic startup behavior contract in AGENTS.md for non-MCP tools.

## What Happened
---
id: T02
parent: S05
milestone: M001
key_files:
  - AGENTS.md
key_decisions:
  - Document /holistic startup behavior in AGENTS.md as an explicit required flow for non-MCP tools.
  - Make the user choice prompt (continue/tweak/start-new) a first-class behavior contract before implementation work.
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:30:11.630Z
blocker_discovered: false
---

# T02: Documented explicit /holistic startup behavior contract in AGENTS.md for non-MCP tools.

**Documented explicit /holistic startup behavior contract in AGENTS.md for non-MCP tools.**

## What Happened

Expanded AGENTS.md with a dedicated non-MCP startup pattern for /holistic. Added an expected flow and behavior contract covering recap, concise restatement, explicit continue/tweak/start-new prompt, and pause-for-user-choice before coding.

## Verification

Executed full test suite after AGENTS.md update to verify no runtime or docs-generation regressions.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 3200ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `AGENTS.md`


## Deviations
None.

## Known Issues
None.
