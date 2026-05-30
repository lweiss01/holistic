# M015: Scope and Retry Detectors via Native Claude Code Adapter

## Vision

The point of this milestone is not the adapter — it is that `agent.scope_expansion_detected` and `agent.retry_pattern_detected` are emitted for real, using M014's normalization, and that `status-engine.ts` flips to `at_risk` on the evidence. The `SourceAdapter` interface and the native Claude Code adapter are the plumbing that makes the detectors possible. They are built here because the detectors must be wired end-to-end and proven before the OTel adapter (M016) slots in without touching detector code.

This milestone also registers the production PostToolUse hook in the repo's managed hooks. Today the repo manages only a SessionStart hook and git hooks (payload audit Section 0). Wiring the real hook is required work; it belongs here, not in M016.

## Owner

Andon

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | `SourceAdapter` interface & `AgentEvent` assembly point | low | M014 | [ ] | `SourceAdapter` interface (`toAgentEvent(raw): AgentEvent \| null`) in `services/andon-collector/`; `AgentEvent` assembly sets `phase` from bridge context, `source` to `"collector"`, `timestamp` to receipt time, `id` to `tool_use_id` |
| S02 | Native Claude Code adapter | high | S01 | [ ] | `PostToolUse` payload → `AgentEvent`; `tool_name`→`EventType` mapping; normalized path via M014 utility; `permission_mode` captured in `payload`; Bash `command` path derived best-effort; `phase` not set by adapter |
| S03 | Production PostToolUse hook registration | medium | S02 | [ ] | PostToolUse hook registered in the repo's managed hook configuration alongside the existing SessionStart hook; hook feeds the native adapter on every tool call; exits 0 so it never blocks tool execution |
| S04 | Scope-expansion detector end-to-end | high | S02, S03 | [ ] | A tool touching a path outside `expectedScope` produces `agent.scope_expansion_detected`; `status-engine.ts` flips session to `at_risk` with that evidence; no raw payload fields referenced in detector code |
| S05 | Retry/thrash detector end-to-end | medium | S02, S03 | [ ] | Repeated near-identical tool calls or edit/revert cycles produce `agent.retry_pattern_detected`; computed from event stream using `tool_use_id` for dedup and `structuredPatch` for edit-revert detection |

## Exit Criteria

- Native adapter produces `AgentEvent` with non-null `sessionId` for every PostToolUse payload (all 8 tool categories confirmed in payload audit).
- **A tool touching a path outside `expectedScope` produces `agent.scope_expansion_detected` and `status-engine.ts` flips the session to `at_risk` with that evidence, end to end.** (Parent spec Section 3.4 criterion 2.)
- **Repeated identical tool calls produce `agent.retry_pattern_detected`.** (Parent spec Section 3.4 criterion 3.)
- The production PostToolUse hook is registered in the repo's managed hooks; the hook fires on real tool calls, not only in tests.
- Detectors reference only `AgentEvent` fields; a grep in `services/andon-collector/` for `tool_input`, `tool_response` outside the adapter file returns nothing.
- `phase` on every `AgentEvent` is sourced from the Holistic bridge context, never from the adapter.
- `SourceAdapter` interface exists and is the only entry point from raw source to `AgentEvent`.

## References

- `SPEC-andon-ingestion-contract-addendum.md` Section 2 (SourceAdapter interface and two-tier model)
- Section 2.1 (adapter interface shape)
- `SPEC-decisions-capture-andon.md` Section 3.2 (scope-expansion and retry/thrash detectors)
- `docs/posttooluse-payload.md` Section 3 (field inventory), Section 4 (AgentEvent mapping), Section 5 (detector feasibility)
- `packages/andon-core/src/status-engine.ts` — `isPathOutsideScope` and `AT_RISK_FAILURE_THRESHOLD`
