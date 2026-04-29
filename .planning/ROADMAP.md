# Roadmap: v1.0 UI Glanceability

**Created:** 2026-04-29  
**Based on:** `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md`

## Phase 1: Runtime Truth Boundary

**Objective:** Remove legacy inference from the live classification path and make runtime truth authoritative for Fleet live states.  
**Requirements:** RTM-01, RTM-02, RTM-03, RTM-04

### Implementation

- [ ] Refactor Fleet live classification to use runtime status + heartbeat freshness only.
- [ ] Remove/guard legacy narrative event influence in live state reducer.
- [ ] Add explicit runtime evidence checks for `needs_input` and active flow states.

### Success Criteria

- Live card status transitions only when runtime state changes.
- No `needs_input` from unresolved historical narrative events.

### Verification

- Unit tests for classification rules and freshness thresholds.
- Integration checks on `/fleet` with seeded runtime tables.

### Risks

- Hidden call sites may still rely on legacy `status-engine` output for live cards.

---

## Phase 2: Identity and Objective Integrity

**Objective:** Ensure agent/objective fields in Fleet are current and runtime-backed, eliminating sticky historical carryover.  
**Requirements:** SID-01, SID-02, SID-03

### Implementation

- [ ] Trace and centralize agent identity source for live cards.
- [ ] Ensure objective/title fields are tied to active runtime session context.
- [ ] Exclude or demote stale sessions with no active runtime evidence.

### Success Criteria

- Agent labels match actual active runtime context.
- Stale milestone objective does not persist across new sessions/restarts.

### Verification

- Regression tests for objective stickiness and stale session suppression.
- Manual restart + refresh validation workflow.

### Risks

- Session/objective data model may need small schema-safe adjustments for stable linkage.

---

## Phase 3: Glance-First Mission Control UX

**Objective:** Make intervention need obvious in under 3 seconds with explicit degraded mode and stronger visual status hierarchy.  
**Requirements:** UIX-01, UIX-02, UIX-03

### Implementation

- [ ] Rework card information architecture to state-first layout.
- [ ] Promote intervention cues (blocked/needs input/degraded) above descriptive text.
- [ ] Add explicit disconnected/degraded runtime visuals and copy.

### Success Criteria

- Operator can identify top intervention targets without opening details.
- Degraded runtime state is never mistaken for active flow.

### Verification

- UI screenshot assertions or deterministic render checks where feasible.
- Focused dogfooding loop with user feedback against known stale-state scenarios.

### Risks

- Overcompacting card data could hide useful context unless details remain easy to expand.

---

## Phase 4: Regression and Contract Hardening

**Objective:** Lock truth-model and glanceability behavior with tests that prevent recurrence of this session's known failures.  
**Requirements:** RGT-01, RGT-02, RGT-03

### Implementation

- [ ] Add regression fixtures for sticky `needs_input` and sticky objective cases.
- [ ] Add negative tests for runtime-feed absence and degraded mode fallback.
- [ ] Wire tests into existing suite and ensure they run in CI/local loops.

### Success Criteria

- Historical regressions are reproducible as tests and stay fixed.
- Runtime-feed absence cannot produce false “flowing” output.

### Verification

- Full test run including Andon fleet tests and runtime-service tests.

### Risks

- Test fixtures may drift from production schema if runtime tables evolve.

---

## Dependency Order

1. Phase 1 (truth boundary)  
2. Phase 2 (identity/objective integrity)  
3. Phase 3 (glance UX)  
4. Phase 4 (regression hardening)

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| RTM-01 | Phase 1 |
| RTM-02 | Phase 1 |
| RTM-03 | Phase 1 |
| RTM-04 | Phase 1 |
| SID-01 | Phase 2 |
| SID-02 | Phase 2 |
| SID-03 | Phase 2 |
| UIX-01 | Phase 3 |
| UIX-02 | Phase 3 |
| UIX-03 | Phase 3 |
| RGT-01 | Phase 4 |
| RGT-02 | Phase 4 |
| RGT-03 | Phase 4 |

Coverage status: 13/13 requirements mapped.

---
*Roadmap status: ready for execution planning*
