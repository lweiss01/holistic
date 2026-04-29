# Project Research Summary

**Project:** Holistic Andon  
**Domain:** Runtime-first agent supervision dashboard  
**Researched:** 2026-04-29  
**Confidence:** HIGH

## Executive Summary

The milestone should focus on restoring operator trust by enforcing a strict runtime truth boundary for live board status. Existing architecture already has the right primitives (`runtime-service`, `runtime_*` tables, Fleet API, Mission Control UI), but live classification has been repeatedly contaminated by legacy narrative/session signals.

The recommended approach is to make runtime session/process/heartbeat data the only authority for live status, while keeping legacy events as narrative context only. This must be paired with clear degraded-mode UX when runtime feed is unavailable.

## Key Findings

### Stack additions

No major stack changes needed. Use existing Node/TypeScript + SQLite + React surfaces and harden logic boundaries plus visual hierarchy.

### Feature table stakes

- Runtime-only live classification for Fleet cards and totals.
- Accurate intervention states (`needs_input`, `blocked`, `review`, `parked`) from current runtime evidence.
- Glance-first UI hierarchy prioritizing intervention signal over explanatory text.
- Explicit disconnected/degraded runtime state.

### Watch Out For

- Sticky objective and sticky status regression from legacy event mixing.
- `user.resumed`/checkpoint events being interpreted as active work.
- Agent attribution fallback accidentally relabeling sessions.

## Implications for Roadmap

Suggested phased order:
1. Truth model boundary and live classifier hardening.
2. Agent/objective source correctness and stale-session exclusion.
3. Degraded runtime UX and glance-first Mission Control redesign.
4. Regression/contract test coverage to lock behavior.

Research flags:
- Phase 1/2 are deterministic engineering (no additional domain research required).
- Phase 3 requires careful UI calibration with operator feedback loops.

---
*Research completed: 2026-04-29*
