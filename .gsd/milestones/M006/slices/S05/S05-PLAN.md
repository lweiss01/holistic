# M006 S05 — Approval gate visibility (harness / IDE blocked on human)

**Goal:** When the agent runtime is **blocked waiting for human approval** (tool/plan/permission gates in the IDE or harness), the Andon **live monitor** reflects that: status, **Why**, urgency, and **Focus now** must not read as “healthy running / no intervention” while the real bottleneck is an unanswered approval.

## Context (product gap)

Observed: dashboard shows **Running** and low-urgency copy while the operator is staring at an approval prompt. Andon only stays honest if **Layer 1–2** emits or derives a **pending approval** signal. See [`.planning/CANON-LAYERS.md`](../../../../../.planning/CANON-LAYERS.md).

## Tasks

- [ ] **T01: Event contract** — Define normalized `AgentEvent` shape(s) for “approval requested / pending” (source may be OpenHarness hooks, collector shim, or future IDE adapter). Document in `docs/andon-mvp.md` or `docs/andon-api-contract.md` once M010 S05 exists.
  - Files: `packages/andon-core`, `services/andon-collector`, `docs/`

- [ ] **T02: Status engine** — Map pending-approval state to **`needs_input`** (or spec-aligned variant) with evidence lines that name the gate (e.g. pending tool approval), not generic “human resumed.”
  - Files: `packages/andon-core/src/status-engine.ts` (and related), `services/andon-api/src/repository.ts` if snapshots need fields

- [ ] **T03: Dashboard** — Live monitor + Focus rail: primary human action should align with **answer the approval** when that signal is present; lamp/strip consistent with `needs_input`.
  - Files: `apps/andon-dashboard/src/App.tsx`, `styles.css`

- [ ] **T04: Tests** — Unit tests for status transition when approval-pending events arrive; at least one integration test with seeded timeline.
  - Files: `tests/andon.test.ts` (or focused module)

## Dependencies

- **M005 / M007:** enough **realistic** high-level events in SQLite that T02–T04 can be proven without hand-waving.
- **M006 S03** (IDE integration) may **amplify** sources of approval events but is **not** strictly required for a first slice if the collector can emit synthetic or harness-backed events.

## Success criteria

- A session with a pending-approval event in the tail is **not** presented as an all-green “no intervention” run unless approval is cleared.

## Proof

`npm test` green; manual: reproduce with harness or documented fixture path in `S05-SUMMARY.md`.
