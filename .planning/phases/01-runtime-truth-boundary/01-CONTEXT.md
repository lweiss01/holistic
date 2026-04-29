# Phase 01: Runtime Truth Boundary - Context

**Gathered:** 2026-04-29  
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a strict runtime-truth classification boundary for live Fleet state so Mission Control no longer infers live status from legacy narrative events.

</domain>

<decisions>
## Implementation Decisions

### Runtime Truth Classification
- Live Fleet status uses runtime truth as the source of truth.
- `needs_input` is strict: only when runtime status is `waiting_for_input`.
- `flowing` requires runtime running state plus fresh heartbeat.
- If no runtime session exists, show explicit disconnected/offline state (do not infer active state).

### Degraded / Offline Semantics
- Show degraded state in both places: fleet-level banner and per-card disconnected badges.
- Disconnected items are low-priority informational in attention ranking.
- Use friendly guidance copy for degraded/disconnected states.
- No grace period for missing runtime session: disconnected is immediate when runtime session is absent.

### Agent Identity Policy
- If attribution is missing, display `unknown (source missing)`.
- Show a source/provenance tag for identity.
- Normalize displayed names for readability (title-case display normalization).
- Regression contracts must include:
  - no hardcoded default model names
  - unknown rendering when attribution is missing

### Objective Source Policy
- Live objective is runtime-first with legacy session fallback if runtime objective is absent.
- If objective is still missing, show explicit placeholder `No runtime objective`.
- Sticky guard: objective reuse only within the same runtime session ID.
- Regression contracts must include:
  - stale objective removal after restart/refresh without runtime evidence
  - objective swap when runtime session ID changes

### Claude's Discretion
- Exact visual treatment details (iconography, spacing, emphasis weight) for disconnected badges and banner components.
- Final copy wording variants as long as they remain friendly and operationally clear.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/andon-api/src/repository.ts`: current fleet classification, runtime status mapping, waiting-signal gate, and agent normalization path.
- `apps/andon-dashboard/src/App.tsx`: existing card/grid rendering, freshness labels, and attention-rank sort controls.
- `packages/andon-core/src/status-engine.ts`: existing status derivation logic and non-operational event filtering.
- `packages/andon-core/src/supervision-signals.ts`: meaningful-event filtering used in supervision output.

### Established Patterns
- Runtime truth currently enters Fleet through `runtime_sessions` and `runtime_events` mapping helpers.
- Dashboard already exposes status/freshness/attention constructs suitable for state-first refinement.
- Core status/supervision utilities already separate operational vs housekeeping events.

### Integration Points
- Primary backend integration: `getFleet` classification path in `repository.ts`.
- Primary UI integration: Fleet card status, freshness, and recommendation copy in `App.tsx`.
- Regression integration: existing `tests/andon.test.ts` contracts and runtime-seeded test flows.

</code_context>

<specifics>
## Specific Ideas

- Keep live-state semantics strict and explicit; avoid any hidden inference path that can reintroduce stale board behavior.
- Prefer trustworthy low-priority disconnected indicators over optimistic but wrong active-state inference.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-runtime-truth-boundary*
*Context gathered: 2026-04-29*
