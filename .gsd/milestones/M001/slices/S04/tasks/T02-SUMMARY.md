---
id: T02
parent: S04
milestone: M001
provides: []
requires: []
affects: []
key_files: ["src/core/state.ts", "src/cli.ts", "src/__tests__/mcp-notification.test.ts"]
key_decisions: ["Use buildStartupGreeting as the single formatting source so MCP and /holistic stay aligned.", "Preserve baseline startup behavior when no warnings exist; only append diagnostics when present."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran full suite and build to confirm startup greeting behavior remains stable on no-warning paths while warning paths render correctly."
completed_at: 2026-03-28T19:40:40.076Z
blocker_discovered: false
---

# T02: Integrated diagnostics warnings into shared startup greeting used by MCP and /holistic surfaces.

> Integrated diagnostics warnings into shared startup greeting used by MCP and /holistic surfaces.

## What Happened
---
id: T02
parent: S04
milestone: M001
key_files:
  - src/core/state.ts
  - src/cli.ts
  - src/__tests__/mcp-notification.test.ts
key_decisions:
  - Use buildStartupGreeting as the single formatting source so MCP and /holistic stay aligned.
  - Preserve baseline startup behavior when no warnings exist; only append diagnostics when present.
duration: ""
verification_result: passed
completed_at: 2026-03-28T19:40:40.076Z
blocker_discovered: false
---

# T02: Integrated diagnostics warnings into shared startup greeting used by MCP and /holistic surfaces.

**Integrated diagnostics warnings into shared startup greeting used by MCP and /holistic surfaces.**

## What Happened

Integrated daemon-health diagnostics into startup surfaces by extending buildStartupGreeting to include a system-health warning section when evaluateHealthDiagnostics emits warnings. Updated CLI resume handling to consume the same shared greeting path used by MCP notification flow so both surfaces display identical warning content. Added tests confirming warning rendering and warning-only output when carryover context is empty but health diagnostics exist.

## Verification

Ran full suite and build to confirm startup greeting behavior remains stable on no-warning paths while warning paths render correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 4200ms |
| 2 | `npm run build` | 0 | ✅ pass | 7100ms |


## Deviations

One plan-level adjustment: integration was implemented through the shared buildStartupGreeting path (state + CLI usage), so direct changes in docs.ts were not required for parity.

## Known Issues

None.

## Files Created/Modified

- `src/core/state.ts`
- `src/cli.ts`
- `src/__tests__/mcp-notification.test.ts`


## Deviations
One plan-level adjustment: integration was implemented through the shared buildStartupGreeting path (state + CLI usage), so direct changes in docs.ts were not required for parity.

## Known Issues
None.
