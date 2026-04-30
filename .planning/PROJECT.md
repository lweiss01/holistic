# Holistic Andon

## What This Is

Holistic Andon is an operator supervision layer for coding agents with trustworthy runtime state. It should let a human understand agent health, intervention need, and momentum at a glance without reading narrative details. The primary audience is AI-assisted developers running multiple long-lived agent sessions.

## Core Value

The live board reflects real agent runtime truth, not stale inferred history.

## Current Milestone: Andon Recovery

**Canonical plan:** [`docs/andon-recovery-plan.md`](../docs/andon-recovery-plan.md)

**Goal:** Rebuild the runtime harness and dashboard around a clean server-side operational contract, while salvaging useful runtime package scaffolding.

**Target features:**

- Runtime harness contract that distinguishes heartbeat from meaningful activity.
- Server-side operational categories: `live`, `needs_action`, `degraded_active`, `review`, `historical`, `unknown`.
- Mission Control as a no-scroll instrument panel after telemetry truth tests pass.

## Requirements

### Validated / Useful Groundwork

- [x] Runtime-first fleet read path is available when runtime tables have data.
- [x] Agent attribution no longer defaults to codex when signal is missing.

### Active

- [ ] Step C: Define the runtime harness contract Andon needs.
- [ ] Step D: Implement server-side operational projection.
- [ ] Step E: Fix replay/event integrity.
- [ ] Step F: Clean up API contracts before UI rebuild.

### Out of Scope

- New runtime adapters beyond the existing local/runtime scaffolding.
- Dashboard polish before telemetry truth is proven.
- Client-side status reclassification in React.

## Context

- Current pain: repeated stale labels and stale objective carryover made the board feel non-real-time.
- Runtime tables exist (`runtime_sessions`, `runtime_events`, `runtime_processes`) but classification still has legacy interference.
- Operator feedback requires intervention-first UI where state is obvious without reading detail text.

## Constraints

- **Architecture**: Runtime harness is source-of-truth for live status - no legacy narrative inference for live state.
- **UX**: Primary board must be glanceable and intervention-first.
- **Compatibility**: Keep existing API and test suite passing while tightening truth model.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `docs/andon-recovery-plan.md` as canonical recovery plan | Prevent drift across `.planning`, `.gsd`, and older roadmap docs | Active |
| Select Option D | Current dashboard and runtime harness are not trustworthy enough for cosmetic salvage | Rebuild around clean contract, salvage useful scaffolding |
| Defer dashboard rebuild until telemetry tests pass | Prevent UI polish from hiding broken truth | Step G cannot start before Steps C-F |

---
*Last updated: 2026-04-30 after Step B recovery planning*
