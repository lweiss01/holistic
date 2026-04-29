# Phase 02: Identity and Objective Integrity — Research

**Researched:** 2026-04-29  
**Requirements:** SID-01, SID-02, SID-03  
**Confidence:** HIGH

## Summary

Phase 02 should harden Fleet identity/objective sourcing so cards reflect current runtime context, not stale legacy carryover. The core runtime path is already present, but there are three concrete gaps:

1. Agent identity still falls back to environment inference (`inferAgentFromEnvironment`) when attribution is missing.
2. Runtime objective can degrade to generic `Runtime {activity}` because prompt/objective context is not guaranteed to persist in `runtime_sessions.metadata`.
3. Legacy sessions without runtime evidence are still merged into Mission Control in the runtime branch, which can re-surface stale objectives after restarts.

No new libraries are needed; this is a source-of-truth and data-contract hardening phase across existing services.

## Standard Stack

Use the existing runtime + Fleet architecture:

- `services/runtime-service` for runtime session creation and metadata persistence.
- `services/andon-api/src/runtime-repository.ts` for `runtime_sessions`/`runtime_events` reads and writes.
- `services/andon-api/src/repository.ts` for Fleet assembly and status/objective/identity shaping.
- `apps/andon-dashboard/src/App.tsx` for Mission Control card rendering.
- `tests/andon.test.ts` and `tests/runtime-service.test.ts` for regression coverage.

Data contracts to keep as canonical:

- Runtime identity/objective: `runtime_sessions.agent_name` + `runtime_sessions.metadata`.
- Legacy/history context: `sessions`/`events` tables.
- Live board eligibility: runtime evidence first, legacy only under explicit fallback rules.

## Architecture Patterns

### Pattern 1: Runtime-First Identity Resolver (SID-01)

Implement a single resolver in Fleet assembly with this precedence:

1. `runtime_sessions.agent_name` when non-empty.
2. `runtime_sessions.metadata.agentName` when present.
3. Legacy `sessions.agent_name` only when no runtime session exists for that card.
4. Final fallback: explicit `"unknown (source missing)"` (not environment inference).

Apply this in both Fleet sessions and recent-event mapping so labels stay consistent.

### Pattern 2: Runtime Objective Session Binding (SID-02)

Bind objective text to active runtime session context:

1. `runtime_sessions.metadata.objective`
2. `runtime_sessions.metadata.prompt`
3. Explicit `"No runtime objective"` placeholder

Required companion change: when runtime tasks are created, persist prompt/objective into runtime metadata so Fleet has deterministic fields.

Also harden legacy ingestion (`ensureSession`) so `session.started` events reset objective from start payload instead of inheriting prior objective text.

### Pattern 3: Stale Session Exclusion Gate for Mission Control (SID-03)

In runtime-enabled Fleet mode:

- Do not treat disconnected legacy rows as first-class live cards by default.
- Include legacy rows only when they pass strict fallback criteria (for example: no overlapping active runtime context and still within recency window).
- Keep stale/disconnected legacy context discoverable through History/detail routes, not the primary live board queue.

This preserves observability without allowing stale objectives to dominate the live board.

### Pattern 4: Shared Fleet Projection Helpers

Identity/objective/fallback logic should be centralized in helper functions and reused for:

- Runtime item projection
- Legacy fallback projection
- Recent events projection

Avoid duplicating resolver logic in multiple mapping branches.

## Don't Hand-Roll

- Do **not** infer identity from process environment flags for live Fleet display.
- Do **not** infer objective from summaries or narrative event text.
- Do **not** add new tables for this phase; extend existing `runtime_sessions.metadata` usage.
- Do **not** keep separate, divergent identity/objective resolver logic for runtime vs legacy rows.

## Common Pitfalls

1. **Environment relabeling drift:** Unknown sessions silently adopt the local shell/runtime identity.
2. **Objective null collapse:** Missing runtime metadata causes generic objective text and makes stale legacy objective appear “better,” masking the active runtime context.
3. **Legacy carryover visibility leak:** Disconnected legacy rows remain prominent in Mission Control and appear current after runtime restarts.
4. **Session restart objective stickiness:** Objective persists through reused session IDs when start events omit objective fields.
5. **Coverage gap:** Existing tests heavily cover status truth but not identity/objective provenance edge cases.

## Code Examples

### 1) Current anti-pattern to replace (environment fallback in display path)

```ts
function normalizeDisplayAgentName(agentName: string): string {
  return agentName && agentName.trim().length > 0 && agentName !== "unknown"
    ? agentName
    : inferAgentFromEnvironment();
}
```

### 2) Prescriptive identity resolver shape

```ts
function resolveFleetAgentName(input: {
  runtimeAgentName?: string | null;
  runtimeMetadata?: Record<string, unknown> | null;
  legacyAgentName?: string | null;
}): string {
  const runtimeDirect = input.runtimeAgentName?.trim();
  if (runtimeDirect) return runtimeDirect;

  const runtimeMeta = typeof input.runtimeMetadata?.agentName === "string"
    ? input.runtimeMetadata.agentName.trim()
    : "";
  if (runtimeMeta) return runtimeMeta;

  const legacy = input.legacyAgentName?.trim();
  if (legacy) return legacy;

  return "unknown (source missing)";
}
```

### 3) Prescriptive objective resolver shape

```ts
function resolveFleetObjective(metadata?: Record<string, unknown>): string {
  const objective = typeof metadata?.objective === "string" ? metadata.objective.trim() : "";
  if (objective) return objective;
  const prompt = typeof metadata?.prompt === "string" ? metadata.prompt.trim() : "";
  if (prompt) return prompt;
  return "No runtime objective";
}
```

## Verification Targets

Add focused regression tests:

1. `tests/andon.test.ts`: runtime card identity remains `"unknown (source missing)"` when attribution is absent.
2. `tests/andon.test.ts`: runtime objective uses metadata prompt/objective and never reuses stale legacy objective after a new runtime session.
3. `tests/andon.test.ts`: disconnected legacy row is excluded (or demoted out of live queue) when active runtime evidence exists.
4. `tests/runtime-service.test.ts`: runtime task creation persists prompt/objective metadata for downstream Fleet use.

Validation commands:

- `npm run test:andon`
- `npm test`

## Implementation Notes for Plan Phase

- Primary touchpoints: `services/andon-api/src/repository.ts`, `services/runtime-service/src/server.ts`, `packages/runtime-local/src/LocalRuntimeAdapter.ts`, `tests/andon.test.ts`, `tests/runtime-service.test.ts`.
- Keep API response compatibility intact for dashboard consumers.
- Treat this phase as data provenance hardening, not a UI redesign.
