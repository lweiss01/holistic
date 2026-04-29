# Architecture Research

**Domain:** Runtime-first agent supervision  
**Researched:** 2026-04-29  
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
Runtime Adapters / Harness
    ↓
runtime-service (session/process/event normalization)
    ↓
runtime_* tables (runtime_sessions, runtime_events, runtime_processes)
    ↓
andon-api /fleet (live classification + priority)
    ↓
andon-dashboard (state-first UI, intervention queue, drilldown)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| runtime-service | Runtime lifecycle + heartbeats + normalized events | Adapter registry + persistence + stream fanout |
| andon-api | Fleet aggregation and action surfaces | Runtime-first query path, fallback paths only for history |
| andon-dashboard | Operator-facing supervision UI | Glance-first cards, intervention queue, details on demand |

## Recommended Project Structure

```
services/runtime-service/       # runtime truth ingestion and lifecycle
services/andon-api/             # fleet aggregation and read APIs
apps/andon-dashboard/           # mission control UI
packages/andon-core/            # status/recommendation/supervision engines
packages/runtime-core/          # runtime contract types
```

## Architectural Patterns

### Pattern 1: Runtime Source-of-Truth Boundary

**What:** Live status derives only from runtime tables.  
**When to use:** All live board views and totals.  
**Trade-offs:** Requires runtime feed health checks and degraded UX path.

### Pattern 2: Narrative as Secondary Context

**What:** Legacy/session narrative events support “why” and timeline, not live status.  
**When to use:** Detail and audit views.  
**Trade-offs:** Must avoid leaking narrative events into liveness logic.

### Pattern 3: Degraded Mode Explicitness

**What:** If runtime feed unavailable, show disconnected/degraded state.  
**When to use:** Runtime session absence or stale heartbeat windows.  
**Trade-offs:** Surfaces platform gaps honestly (good for trust).

## Anti-Patterns

- Mixing runtime and legacy evidence in one live-state reducer.
- Deriving “flowing” from `user.resumed`/checkpoint events.
- Defaulting unknown agent identity to a single model name.

---
*Architecture research for: Andon runtime-truth milestone*
