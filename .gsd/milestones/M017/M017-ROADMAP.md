# M017: Decision-Aware Drift

## Vision

Connect the Andon drift engine to the Holistic decision log. When the agent's actions contradict an active recorded decision, Andon surfaces a drift recommendation. This closes the loop between the state layer (Holistic decisions) and the trajectory layer (Andon drift detection). The Holistic bridge stays read-only from Andon's side — Andon recommends, it does not write. This is the final integration milestone: it depends on both the decisions log (M011) and the `AgentEvent` pipeline (M015) being in place.

## Owner

Andon

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Bridge contract update | low | M011 | [ ] | `HolisticContext` bridge type exposes `activeDecisions: DecisionRecord[]` (read-only); sourced from `resolveDecisions` fold output; no write path from Andon to Holistic |
| S02 | Decision-contradiction rule & recommendation | high | S01, M015 | [ ] | `status-engine.ts` or `recommendation-engine.ts`: when an `AgentEvent` payload/summary contradicts an active decision, emit a drift recommendation; rule is adapter-agnostic (fires on `AgentEvent` regardless of source); `contradicts_rejected` predicate also triggers as per M013 escalation logic |
| S03 | Read-only bridge verification | low | S02 | [ ] | Grep audit: no Holistic writes in `packages/andon-*` or `services/andon-*`; if Andon detects a decision should be superseded, it emits a recommendation only — the author acts through `holistic supersede` (M011) |

## Exit Criteria

- An action contradicting an active decision produces a drift recommendation and writes nothing to Holistic.
- The bridge remains read-only from Andon; grep for Holistic writes in `packages/andon-*` and `services/andon-*` returns nothing.
- The decision-contradiction rule fires correctly on `AgentEvent` objects from both the native adapter (M015) and the OTel adapter (M016) without per-adapter code.
- `HolisticContext.activeDecisions` is sourced from the fold output of `resolveDecisions`, not a raw file read.

## Notes

The Andon → Holistic bridge is **read-only from Andon's side**. This is load-bearing for the ownership split and must not be violated. If Andon concludes a decision should be superseded, the correct output is a recommendation surfaced to the operator — the operator then acts through `holistic supersede`. Andon does not call `holistic supersede` itself.

The `contradicts_rejected` condition (agent re-proposes a `rejectedApproaches` entry) is both a drift signal here and an escalation trigger in M013. The two are complementary and must not conflict.

## References

- `SPEC-decisions-capture-andon.md` Section 3.2 step 4 (decision-aware drift)
- Section 3.3 (control-loop framing: integrated error over single-event triggers)
- Section 3.4 (acceptance criteria)
- `SPEC-andon-ingestion-contract-addendum.md` Section 2 (decision-aware drift is adapter-agnostic, addendum step 5)
- Ownership table in parent spec Section 0 — Andon bridge read-only invariant
