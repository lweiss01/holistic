# M015: Collector SourceAdapter Interface and Native Claude Code Adapter

## Vision

Define the `SourceAdapter` interface that isolates raw event sources from detectors. Build the deep tier: the native Claude Code adapter that turns PostToolUse payloads into `AgentEvent` objects. Wire the scope-expansion and retry/thrash detectors end-to-end against the adapter output. Detectors are written once against `AgentEvent` and never learn which adapter fed them — this property is proven here so the OTel adapter (M016) can slot in without touching detector code.

## Owner

Andon

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | `SourceAdapter` interface & `AgentEvent` assembly point | low | M014 | [ ] | `SourceAdapter` interface (`toAgentEvent(raw): AgentEvent \| null`) in `services/andon-collector/`; `AgentEvent` assembly sets `phase` from bridge context, `source` to `"collector"`, `timestamp` to receipt time, `id` to `tool_use_id` |
| S02 | Native Claude Code adapter | high | S01 | [ ] | `PostToolUse` payload → `AgentEvent`; `tool_name`→`EventType` mapping; normalized path via M014 utility; `permission_mode` captured in `payload`; Bash `command` path derived best-effort; `phase` not set by adapter |
| S03 | Scope-expansion detector end-to-end | high | S02 | [ ] | A tool touching a path outside `expectedScope` produces `agent.scope_expansion_detected`; `status-engine.ts` flips session to `at_risk` with that evidence; no raw payload fields referenced in detector code |
| S04 | Retry/thrash detector end-to-end | medium | S02 | [ ] | Repeated near-identical tool calls or edit/revert cycles produce `agent.retry_pattern_detected`; computed from event stream using `tool_use_id` for dedup and `structuredPatch` for edit-revert detection |

## Exit Criteria

- Native adapter produces `AgentEvent` with non-null `sessionId` for every PostToolUse payload (all 8 tool categories confirmed in payload audit).
- A tool touching a path outside `expectedScope` produces `agent.scope_expansion_detected`; `status-engine.ts` flips to `at_risk` with that evidence, end to end.
- Repeated identical tool calls produce `agent.retry_pattern_detected`.
- Detectors reference only `AgentEvent` fields; a grep in `services/andon-collector/` for `tool_input`, `tool_response` outside the adapter file returns nothing.
- `phase` on every `AgentEvent` is sourced from the Holistic bridge context, never from the adapter.
- `SourceAdapter` interface exists and is the only entry point from raw source to `AgentEvent`.

## References

- `SPEC-andon-ingestion-contract-addendum.md` Section 2 (SourceAdapter interface and two-tier model)
- Section 2.1 (adapter interface shape)
- `SPEC-decisions-capture-andon.md` Section 3.2 (scope-expansion and retry/thrash detectors)
- `docs/posttooluse-payload.md` Section 3 (field inventory), Section 4 (AgentEvent mapping), Section 5 (detector feasibility)
- `packages/andon-core/src/status-engine.ts` — `isPathOutsideScope` and `AT_RISK_FAILURE_THRESHOLD`
