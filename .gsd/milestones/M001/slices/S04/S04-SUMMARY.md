---
id: S04
parent: M001
milestone: M001
provides:
  - Failure-visibility diagnostics at startup for daemon health anomalies.
  - Deterministic warning payloads reusable by future notification channels.
requires:
  - slice: S01
    provides: Shared startup greeting/notification channel established for carryover recaps.
affects:
  - S05
key_files:
  - src/core/types.ts
  - src/core/state.ts
  - src/cli.ts
  - tests/run-tests.ts
  - src/__tests__/mcp-notification.test.ts
key_decisions:
  - Centralize diagnostics computation in state layer to keep warning logic deterministic and reusable.
  - Use one startup formatter path (buildStartupGreeting) for both MCP notifications and /holistic output.
  - Keep warning language diagnostic/system-health focused rather than user-blaming.
patterns_established:
  - State-layer evaluator + shared formatter for cross-surface parity.
  - Boundary tests at exact thresholds (3 days, 50 files) plus below-threshold negatives.
observability_surfaces:
  - Startup greeting warning section showing warning code and message.
  - Structured diagnostic warning payloads with observedAt and inputs fields for root-cause troubleshooting.
drill_down_paths:
  - .gsd/milestones/M001/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-28T19:41:20.081Z
blocker_discovered: false
---

# S04: Edge-Case Health Diagnostics

**Implemented and shipped edge-case daemon health diagnostics with shared startup warning surfaces and regression coverage.**

## What Happened

Delivered S04 end-to-end: implemented health diagnostics evaluation for stale checkpoints and unusual high-change/no-checkpoint patterns, wired warnings into both startup surfaces through shared formatting, and locked behavior with boundary/phrasing tests. The startup warning path now remains quiet when diagnostics are clear and surfaces machine-readable code-labeled diagnostics when anomalies are detected.

## Verification

Verified by automated coverage and build checks: full suite includes stale boundary (exact and under), unusual threshold (50 and 49), warning rendering, and diagnostic-language assertions; build compiles cleanly.

## Requirements Advanced

- R010 — Added startup warning rendering path and tests for stale-checkpoint diagnostics surfaced at startup.
- R011 — Added unusual pattern detection (50+ files without checkpoint evidence) and startup surfacing/tests.

## Requirements Validated

- R010 — `npm test` includes `buildStartupGreeting includes system health warnings for stale daemon checkpoints` and diagnostics boundary tests, with `npm run build` passing.
- R011 — `npm test` includes 50-file trigger and 49-file non-trigger tests plus startup warning rendering checks, with `npm run build` passing.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

T02 plan listed docs.ts as a likely touchpoint, but integration was completed through shared startup greeting usage in state/cli without needing docs.ts edits.

## Known Limitations

Warnings are startup-scoped only in this slice; no continuous in-session alert channel by design.

## Follow-ups

S05 should extend helper text/docs parity so warning behavior is discoverable across tools, and requirements R010/R011 should be promoted to validated in REQUIREMENTS.md with this slice's proof.

## Files Created/Modified

- `src/core/types.ts` — Added health diagnostics types for warning codes/payloads.
- `src/core/state.ts` — Implemented diagnostics evaluator and integrated warning rendering into shared startup greeting.
- `src/cli.ts` — Switched /holistic resume output to shared startup greeting rendering path.
- `tests/run-tests.ts` — Added diagnostics evaluator tests, boundary checks, and startup warning behavior coverage.
- `src/__tests__/mcp-notification.test.ts` — Added startup greeting warning/no-warning regression and phrasing tests.
