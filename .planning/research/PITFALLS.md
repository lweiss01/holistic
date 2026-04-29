# Pitfalls Research

**Domain:** Runtime supervision dashboards  
**Researched:** 2026-04-29  
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Sticky Narrative Status

**What goes wrong:** Old `needs_input` / `flowing` signals persist after actual runtime state changed.  
**Why it happens:** Narrative events are reused as live-state evidence.  
**How to avoid:** Live classifier reads runtime status + heartbeat only; narrative excluded.  
**Warning signs:** Same “why now” text remains after restart/new activity.  
**Phase to address:** Phase 1 (truth boundary).

### Pitfall 2: Objective Stickiness

**What goes wrong:** One old objective (e.g., M007 text) remains pinned for long periods.  
**Why it happens:** Objective from stale active session or historical rows dominates render path.  
**How to avoid:** Objective source tied to active runtime session context; stale sessions excluded from live board.  
**Warning signs:** Same objective survives restarts and new commits.  
**Phase to address:** Phase 2 (identity + objective source).

### Pitfall 3: False Real-Time Confidence

**What goes wrong:** Board appears “live” while runtime feed is absent.  
**Why it happens:** Silent fallback to inferred history.  
**How to avoid:** Explicit degraded/disconnected runtime mode in Fleet UI.  
**Warning signs:** Runtime sessions empty but cards still claim active flow.  
**Phase to address:** Phase 3 (degraded-mode UX).

## "Looks Done But Isn't" Checklist

- [ ] Runtime feed present in DB for active sessions.
- [ ] `needs_input` requires runtime `waiting_for_input`.
- [ ] `running/flowing` requires fresh runtime heartbeat.
- [ ] Objective comes from current runtime session context, not stale historical narrative.
- [ ] Degraded mode is visible when runtime feed is unavailable.

---
*Pitfalls research for: Andon runtime-truth fidelity*
