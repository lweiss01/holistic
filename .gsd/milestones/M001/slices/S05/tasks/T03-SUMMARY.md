---
id: T03
parent: S05
milestone: M001
provides: []
requires: []
affects: []
key_files: ["README.md", "AGENTS.md"]
key_decisions: ["Publish slash helper labels for /holistic, /checkpoint, and /handoff in both README and AGENTS so visibility exists in primary user-facing docs.", "Include CLI-equivalent commands alongside slash helpers for environments that lack slash aliases."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran full project tests to confirm docs/help updates did not affect behavior."
completed_at: 2026-03-28T20:30:23.299Z
blocker_discovered: false
---

# T03: Added visible slash command helper text for /holistic, /checkpoint, and /handoff across docs surfaces.

> Added visible slash command helper text for /holistic, /checkpoint, and /handoff across docs surfaces.

## What Happened
---
id: T03
parent: S05
milestone: M001
key_files:
  - README.md
  - AGENTS.md
key_decisions:
  - Publish slash helper labels for /holistic, /checkpoint, and /handoff in both README and AGENTS so visibility exists in primary user-facing docs.
  - Include CLI-equivalent commands alongside slash helpers for environments that lack slash aliases.
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:30:23.300Z
blocker_discovered: false
---

# T03: Added visible slash command helper text for /holistic, /checkpoint, and /handoff across docs surfaces.

**Added visible slash command helper text for /holistic, /checkpoint, and /handoff across docs surfaces.**

## What Happened

Added explicit slash command helper text for /holistic, /checkpoint, and /handoff in agent-visible docs surfaces. README now contains an agent-facing slash helper table with CLI equivalents, and AGENTS includes helper labels plus fallback guidance for non-slash environments.

## Verification

Ran full project tests to confirm docs/help updates did not affect behavior.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 3400ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `README.md`
- `AGENTS.md`


## Deviations
None.

## Known Issues
None.
