---
title: "Spec Addendum: Andon Ingestion Contract and the AGT Feed-Not-Compete Seam"
status: draft
audience: implementing agent
extends: "SPEC-decisions-capture-andon.md (Section 3)"
repo_state_basis: "inherits the basis of the parent spec; no new repo read performed for this addendum"
owner: lweiss01
date: 2026-05-30
---

# Spec Addendum: Andon Ingestion Contract and the AGT Feed-Not-Compete Seam

## 0. How to read this document

This addendum slots into `SPEC-decisions-capture-andon.md` Section 3 (Andon drift seam). It does not replace Section 3; it sits in front of 3.2 as a settled architecture decision that the PostToolUse audit (3.2 step 1) and the collector work (3.2 steps 2 to 4) must follow.

It answers one question that Section 3 left open: when the collector turns raw events into `AgentEvent` objects, what does it read, and is that contract the native Claude Code hook payload, an OTel span, or something else. The decision below is grounded in a field-level mapping of the two candidate sources against the `AgentEvent` target shape. Read the mapping before the decision; the decision only makes sense once the asymmetry is visible.

The ownership rules in the parent spec still hold without exception. The Andon to Holistic bridge stays read-only from Andon's side. This addendum adds a third external system (AGT) and draws its boundary in the same spirit: AGT feeds Andon, AGT does not define Andon's output, and Andon does not build inside AGT.

---

## 1. Field mapping (the evidence)

Source A is AGT's Governance Event envelope (AUDIT-COMPLIANCE-1.0 Section 6.3), which is schema-frozen at `schema_version: "1"`. Source B is the Claude Code PostToolUse hook payload. The Source B column is docs-derived (code.claude.com/docs/en/hooks) and MUST be reconciled against a real capture per `posttooluse-payload.md` before any collector code is written. The mapping is stable enough to settle the contract decision regardless of that reconciliation.

Verdicts: YES (direct), DERIVED (computable from present fields), PARTIAL (present but optional or generic), NO (absent from the source).

| `AgentEvent` field | AGT Governance Event source | AGT verdict | PostToolUse source | PostToolUse verdict |
| --- | --- | --- | --- | --- |
| `id` | `event_id` (REQUIRED) | YES (reuse) | none | DERIVED (generate) |
| `sessionId` | `session_id` (OPTIONAL), `trace_id` (OPTIONAL) | PARTIAL | `session_id` (top-level, always present) | YES |
| `runtime` | not carried unless in `attributes` | PARTIAL | constant | YES |
| `type` | derive from `kind` + `decision` | DERIVED | derive from `tool_name` + `tool_response` | DERIVED |
| `phase` | none | NO | none | NO |
| `source` | constant | YES | constant | YES |
| `timestamp` | `occurred_at` (REQUIRED, ISO 8601 UTC) | YES | none in payload | PARTIAL (receipt time) |
| `summary` | `reason` (OPTIONAL) | PARTIAL | none | DERIVED |
| `payload.path` | `resource` (OPTIONAL, generic) | PARTIAL | `tool_input.file_path` (file tools) | YES (file tools) / DERIVED (Bash) |
| `payload` tool args | `action` + `attributes` | PARTIAL | `tool_input` (full args) | YES |

Detector feasibility that follows from the mapping:

| Detector | From AGT | From PostToolUse |
| --- | --- | --- |
| Scope-expansion | PARTIAL | FEASIBLE (file tools) / NEEDS-DERIVATION (Bash) |
| Out-of-scope `file.changed` | PARTIAL | FEASIBLE (file tools) |
| Retry / thrash | PARTIAL | FEASIBLE |
| Decision-contradiction | PARTIAL | FEASIBLE |
| Session correlation | PARTIAL (`session_id` optional) | FEASIBLE (always present) |

### 1.1 The asymmetry that drives the decision

The native PostToolUse hook is the stronger source for the detectors in parent-spec Section 3.2, not the weaker one. It carries an always-present `session_id` (the field the parent spec marks as the one without which all detectors degrade), the complete `tool_input` args, and a direct `file_path`. AGT is broader because any framework behind it can emit through it, but it is thinner per event: `session_id` is optional, `resource` is a generic target rather than a guaranteed path, and full args appear only if the framework adapter populated `attributes`.

Neither source carries `phase`. Phase comes from the Holistic bridge context, not from the event stream, for both sources. Treat `phase` as bridge-derived and out of the collector's input concern.

---

## 2. Decision: internal `AgentEvent`, two source adapters, two tiers

Do not define the collector against either raw source. Define it against `AgentEvent` (the existing internal shape in `packages/andon-core/src`, unchanged) and add a source-adapter seam in `services/andon-collector/`. Each adapter takes one raw source and produces `AgentEvent`. Detectors are written once against `AgentEvent` and never learn which adapter fed them.

Two adapters, two tiers:

1. **Deep tier, native Claude Code adapter.** Input: PostToolUse hook payload on stdin. Output: `AgentEvent`. This is the richest path and the one parent-spec Section 3.2 already unblocks. Build it first.
2. **Broad tier, OTel adapter.** Input: an OTel span. Output: `AgentEvent`. Vendor-neutral. AGT feeds this tier because AGT is already OTel-conformant (`agt.*` attribute namespace). Any other OTel-emitting framework feeds the same tier. Build it second, after the deep tier proves the detectors end to end.

OTel is the contract for the broad tier only. It is not the universal contract. The reason not to route Claude Code through OTel as well is in the mapping: flattening the native payload to a generic span risks dropping the guaranteed `session_id` and the full args, the two things that make the deep tier worth having, unless every field is carried faithfully as span attributes. The native adapter keeps that depth for free. The cost is maintaining two adapters, which is acceptable because they converge on one internal shape.

### 2.1 Adapter interface (shape, not final signature)

A single internal interface in `services/andon-collector/`, one implementation per source:

```ts
interface SourceAdapter {
  // returns null when the raw event is not drift-relevant and should be dropped
  toAgentEvent(raw: unknown): AgentEvent | null;
}
```

- The native adapter owns the `tool_name` to `EventType` mapping and the Bash `command` to `path` derivation.
- The OTel adapter owns the AGT `kind` plus `decision` to `EventType` mapping and reads `agt.*` attributes for args and resource.
- `phase` is set from the Holistic bridge context at `AgentEvent` assembly time, not by the adapter.
- `timestamp`: native adapter uses receipt time and records that it is receipt time in `payload`; OTel adapter uses span start time. Detectors that reason over timing MUST tolerate receipt-time jitter on the deep tier.

---

## 3. The AGT seam: feed, do not compete

### 3.1 Three-layer ownership (extends the parent spec ownership table)

| Layer | Owner | Scope |
| --- | --- | --- |
| Deterministic per-action enforcement | AGT (external) | Synchronous pre-execution gate. allow / deny / warn / escalate. Emits governance events. |
| Trajectory drift verdict | Andon | Integrated error over the event stream. Flags, does not halt. Reads Holistic context as input. |
| Project state | Holistic | Decisions, supersession, what is true now. |

AGT enforces. Andon observes and flags. Holistic records state. The three do not overlap in what they own, even though all three see tool calls.

### 3.2 What Andon consumes from AGT

Through the OTel adapter only:

- AGT `POLICY_CHECK`, `TOOL_CALL_BLOCKED`, and the `decision` outcome (`warn`, `escalate`) become inputs to Andon's drift model. A rising rate of `warn` outcomes in a session, or repeated `matched_rule` hits, is a leading drift indicator. AGT records these atomically and never integrates them over time; Andon does.
- AGT `policy_version` (when present on the mesh audit entry) lets Andon distinguish "agent drifted" from "policy changed under the agent." Use it to control that confound when available; degrade gracefully when absent.

### 3.3 What Andon does not do with AGT

These are hard boundaries, not preferences:

- Andon MUST NOT emit AGT events or write into AGT.
- Andon MUST NOT attempt to populate or define AGT's `BEHAVIOR_DRIFT` event (AUDIT-COMPLIANCE-1.0 Section 12.2.9). That event is an AGT-internal stub with no defined detection logic. Building it would mean building inside AGT's domain and coupling Andon to a third-party drafty field.
- If an AGT `BEHAVIOR_DRIFT` event arrives, the OTel adapter MAY pass it through as one input signal among many. Andon MUST NOT treat it as Andon's verdict. Andon's drift verdict is computed by Andon, from the trajectory, and owned by Andon.

### 3.4 Why this is safe against AGT moving

AGT is a fast-moving Microsoft project and its `BEHAVIOR_DRIFT` could later gain a real detector. This seam survives that: Andon consumes only the stable governance-event envelope and the OTel export, treats AGT as one source among many, and keeps its own verdict. If AGT fills in `BEHAVIOR_DRIFT`, Andon gains a second-opinion signal and loses nothing, because Andon's depth on the native Claude Code tier is the part AGT cannot easily match.

---

## 4. Build order (refines parent-spec Section 5)

This addendum changes nothing in the parent dependency order. It sequences the work inside Section 3.

1. PostToolUse payload audit (parent 3.2 step 1). Reconcile `posttooluse-payload.md` against a real capture. Confirm `session_id`, `tool_input`, `tool_input.file_path`, `tool_response`, and path form (absolute vs repo-relative vs cwd-relative, per parent Section 7).
2. Define the `SourceAdapter` interface and the `AgentEvent` assembly point in `services/andon-collector/`.
3. Build the native Claude Code adapter (deep tier). Wire the scope-expansion and retry/thrash detectors end to end against it (parent 3.2 steps 2 and 3).
4. Build the OTel adapter (broad tier). Validate with one non-Claude OTel source first, then point AGT's OTel export at it as a second source.
5. Decision-aware drift (parent 3.2 step 4) runs against `AgentEvent` and is adapter-agnostic by construction; no per-source work.

---

## 5. Acceptance criteria

1. The collector's detectors reference only `AgentEvent`, never a raw PostToolUse payload field or a raw OTel span field. A grep in `services/andon-collector/` for `tool_input`, `tool_response`, or `agt.` outside the adapter files returns nothing.
2. The native Claude Code adapter produces an `AgentEvent` with a non-null `sessionId` for every PostToolUse payload that carries `session_id`.
3. The same scope-expansion and retry/thrash detectors fire correctly on `AgentEvent` objects produced by the native adapter and by the OTel adapter, with no detector code changed between the two.
4. AGT events reach Andon only through the OTel adapter. A grep for AGT-specific handling outside `services/andon-collector/` adapter files returns nothing.
5. No code path emits an AGT event, writes to AGT, or writes a value into a field named for AGT's `BEHAVIOR_DRIFT`.
6. With AGT absent entirely, the deep tier and all Section 3 detectors function unchanged.
7. `phase` on every `AgentEvent` is sourced from the Holistic bridge context, never from an adapter.

---

## 6. Single next step

Reconcile `posttooluse-payload.md` against a real captured payload (parent-spec Section 3.2 step 1), and while doing it, record one extra fact this addendum needs: whether `session_id` is present on every payload category, not just file edits. The two-tier decision assumes the deep tier's `session_id` is always present; the audit is where that assumption is confirmed or broken. If it holds, build the native adapter against `AgentEvent` next. If it breaks, the deep tier needs a session-derivation strategy before any detector is wired.
