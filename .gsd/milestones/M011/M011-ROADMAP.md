# M011: Decision Records and Supersession Lifecycle

## Vision

Give Holistic a first-class decision concept. Decisions are semantic acts that cannot be observed from filesystem churn — they need a named, versioned home so a cold-booting agent reads current truth, not overturned history. This milestone builds the append-only storage, schema, fold logic, and the two CLI commands that all later milestones (capture, drift detection) depend on.

## Owner

Holistic

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Schema & storage | medium | — | [ ] | `DecisionRecord`, `DecisionStatus`, `DecisionScope` added to `src/core/types.ts`; `.holistic/decisions.jsonl` created on init; `// FUTURE:` notes left on `assumptions[]` and `impactNotes[]` |
| S02 | Fold logic & cycle detection | medium | S01 | [ ] | `resolveDecisions(lines)` in `src/core/decisions.ts` resolves chains, returns active set, flags cycles using Degraded Mode pattern without hanging |
| S03 | CLI commands | high | S01, S02 | [ ] | `holistic decide` appends a valid active decision; `holistic supersede` validates target is active, appends superseding record with mandatory `--rationale`, auto-fills `sessionId` + `agent`; both in Guarded Mutation tier per `SECURITY.md` |
| S04 | Surfacing in resume and HOLISTIC.md | low | S02, S03 | [ ] | `holistic resume` and generated `HOLISTIC.md` show active decision set inline; superseded decisions reachable behind a history affordance; a zero-context agent can list active decisions without custom tooling |

## Exit Criteria

- `holistic decide` appends a valid line to `.holistic/decisions.jsonl`; no other file is mutated except state metadata pointers.
- `holistic supersede` on an active decision produces a fold where the target is `superseded` and the new record is `active`; the target line is byte-for-byte unchanged on disk.
- `holistic supersede` on a non-existent or already-superseded id is rejected with a clear error and writes nothing.
- `holistic supersede` with empty or missing `--rationale` is rejected and writes nothing.
- `resolveDecisions` resolves a 3-deep chain correctly; flags a cycle without hanging.
- Two concurrent appends from different branches merge without losing either decision.
- No code path other than an explicit `holistic supersede` writes a non-null `supersedes` value.

## References

- `SPEC-decisions-capture-andon.md` Section 1 (decision records and supersession lifecycle)
- Section 1.3.3a (supersession semantics: Rule 1, Rule 2, Rule 3) — read before implementing S03
- Section 1.5 (acceptance criteria)
- `.beads/issues.jsonl` — structural precedent for append-only JSONL
