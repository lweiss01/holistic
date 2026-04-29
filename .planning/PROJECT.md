# Holistic Andon

## What This Is

Holistic Andon is an operator dashboard for supervising coding agents with trustworthy runtime state. It should let a human understand agent health, intervention need, and momentum at a glance without reading narrative details. The primary audience is AI-assisted developers running multiple long-lived agent sessions.

## Core Value

The live board reflects real agent runtime truth, not stale inferred history.

## Current Milestone: v1.0 UI Glanceability

**Goal:** Make Mission Control instantly scannable and intervention-oriented by using runtime-backed status signals and glance-first visual hierarchy.

**Target features:**
- Runtime-only live state classification for flowing/needs input/blocked/parked.
- Glance-first status cards and attention queue emphasizing intervention priority.
- Honest degraded state when runtime telemetry is missing or stale.

## Requirements

### Validated

- [x] Runtime-first fleet read path is available when runtime tables have data.
- [x] Agent attribution no longer defaults to codex when signal is missing.

### Active

- [ ] Status classification is sourced exclusively from runtime session/process/event truth.
- [ ] Mission Control visuals communicate intervention need at a glance.
- [ ] Stale objective/status stickiness regression is eliminated and tested.

### Out of Scope

- New runtime adapters beyond the existing local/runtime plumbing — focus is reliability and clarity of current signals.
- Full visual redesign of non-fleet pages (history/detail polish can follow once live board is reliable).

## Context

- Current pain: repeated stale labels and stale objective carryover made the board feel non-real-time.
- Runtime tables exist (`runtime_sessions`, `runtime_events`, `runtime_processes`) but classification still had legacy interference.
- Operator feedback: state should be obvious without reading paragraphs; if runtime is absent, board must say so explicitly.

## Constraints

- **Architecture**: Runtime harness is source-of-truth for live status — no legacy narrative inference for live state.
- **UX**: Primary board must be glanceable and intervention-first.
- **Compatibility**: Keep existing API and test suite passing while tightening truth model.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat runtime telemetry as live authority | Prevent stale history from masquerading as current work | — Pending |
| Prioritize state-first card hierarchy over dense metrics | Operator must decide in seconds, not read for context | — Pending |

---
*Last updated: 2026-04-29 after starting milestone v1.0 UI Glanceability*
