# M016: OTel Adapter (Broad Tier)

## Vision

Add the broad tier: an OTel span → `AgentEvent` adapter that lets any OTel-emitting framework feed Andon's detectors. AGT is the primary concrete source for this tier (it is OTel-conformant via the `agt.*` attribute namespace). The same detectors that proved out in M015 must fire without any detector code changes — that property is the test of the adapter-agnostic design. AGT feeds Andon; AGT does not define Andon's output, and Andon does not build inside AGT.

## Owner

Andon

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | OTel adapter implementation | medium | M015 | [ ] | `services/andon-collector/src/adapters/otel.ts`: OTel span → `AgentEvent`; AGT `kind` + `decision` → `EventType` mapping; reads `agt.*` attributes for args and resource; span start time as `timestamp`; `phase` from bridge context, not adapter |
| S02 | Non-Claude OTel source validation | medium | S01 | [ ] | Validated against at least one non-Claude OTel source before AGT is pointed at it; scope-expansion and retry/thrash detectors fire correctly on OTel-produced `AgentEvent` objects with no detector code changes |
| S03 | AGT feed-not-compete validation | medium | S02 | [ ] | AGT OTel export pointed at adapter as second source; grep audits pass: no AGT-specific handling outside adapter files, no `BEHAVIOR_DRIFT` writes anywhere; rising AGT `warn` / `matched_rule` rates reach drift model as one input among many |

## Exit Criteria

- The same scope-expansion and retry/thrash detectors fire correctly on `AgentEvent` objects produced by the OTel adapter, with no detector code changed from M015.
- **Validated against at least one non-Claude OTel source before AGT is pointed at it.** (Addendum Section 4 step 4.)
- **AGT events reach Andon only through the OTel adapter.** Grep for AGT-specific handling outside `services/andon-collector/` adapter files returns nothing. (Addendum Section 5 criterion 4.)
- **No code path emits an AGT event, writes to AGT, or writes a value into a field named for AGT's `BEHAVIOR_DRIFT`.** (Addendum Section 5 criterion 5.)
- With AGT absent entirely, the deep tier (M015) and all Section 3 detectors function unchanged. (Addendum Section 5 criterion 6.)
- Detectors reference only `AgentEvent`; grep for `agt.` outside `services/andon-collector/` adapter files returns nothing.
- A rising rate of AGT `warn` outcomes or repeated `matched_rule` hits reaches Andon's drift model as one input among many; AGT `policy_version` (when present) is used to distinguish agent drift from policy change; degrades gracefully when absent.

## Notes

An AGT `BEHAVIOR_DRIFT` event that arrives through the OTel adapter MAY be passed through as one input signal. Andon MUST NOT treat it as Andon's verdict — Andon's drift verdict is computed by Andon from the trajectory. If AGT later fills in a real `BEHAVIOR_DRIFT` detector, Andon gains a second-opinion signal and loses nothing.

## References

- `SPEC-andon-ingestion-contract-addendum.md` Section 1 (field mapping and asymmetry)
- Section 2 (two-tier decision and OTel adapter role)
- Section 3 (AGT seam: feed-not-compete)
- Section 3.3 (hard boundaries: what Andon does not do with AGT)
- Section 3.4 (why this is safe against AGT moving)
- Section 4 (build order — OTel adapter is step 4, after deep tier proves detectors)
