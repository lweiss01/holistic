# Requirements: Holistic Andon (v1.0 UI Glanceability)

**Defined:** 2026-04-29  
**Core Value:** The live board reflects real agent runtime truth, not stale inferred history.

## v1 Requirements

### Runtime Truth Model

- [ ] **RTM-01**: Fleet live status for each session is derived from runtime truth (`runtime_sessions`, `runtime_processes`, `runtime_events`) only.
- [ ] **RTM-02**: `needs_input` is shown only when runtime state confirms `waiting_for_input`.
- [ ] **RTM-03**: `flowing/running` is shown only when runtime status is active and heartbeat freshness is live.
- [ ] **RTM-04**: Legacy narrative/session events are excluded from live-state classification.

### Session Identity and Objective Integrity

- [ ] **SID-01**: Agent identity shown in Fleet cards comes from runtime/session source attribution without hardcoded model fallback.
- [ ] **SID-02**: Objective shown on live cards reflects current runtime session context, not stale carryover from old sessions.
- [ ] **SID-03**: Stale sessions are excluded from live board when runtime evidence does not support active monitoring.

### Glanceable Intervention UX

- [ ] **UIX-01**: Mission Control cards present intervention status as the primary visual signal (state-first hierarchy).
- [ ] **UIX-02**: Operators can determine intervention need at a glance without reading narrative paragraphs.
- [ ] **UIX-03**: Runtime-disconnected/degraded conditions are shown explicitly and distinctly from active states.

### Regression Safety

- [ ] **RGT-01**: Tests cover sticky `needs_input` regressions from stale unresolved narrative events.
- [ ] **RGT-02**: Tests cover sticky objective regressions where old milestone objectives persist incorrectly.
- [ ] **RGT-03**: Tests verify runtime-feed absence yields degraded/offline state rather than inferred activity.

## Future Requirements

- **UIX-04**: Adaptive fleet sorting by operator behavior and intervention outcomes.
- **RTM-05**: Multi-runtime federation across multiple hosts/workspaces.

## Out of Scope

| Feature | Reason |
|---------|--------|
| New external runtime adapter implementation | Current milestone is trust and clarity hardening of existing runtime truth path |
| Full redesign of all dashboard pages | Focus this milestone on Mission Control intervention scanability and truth model reliability |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RTM-01 | Phase 1 | Planned |
| RTM-02 | Phase 1 | Planned |
| RTM-03 | Phase 1 | Planned |
| RTM-04 | Phase 1 | Planned |
| SID-01 | Phase 2 | Planned |
| SID-02 | Phase 2 | Planned |
| SID-03 | Phase 2 | Planned |
| UIX-01 | Phase 3 | Planned |
| UIX-02 | Phase 3 | Planned |
| UIX-03 | Phase 3 | Planned |
| RGT-01 | Phase 4 | Planned |
| RGT-02 | Phase 4 | Planned |
| RGT-03 | Phase 4 | Planned |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-04-29 after milestone v1.0 scoping*
