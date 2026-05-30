# M012: Trust Provenance Documentation

## Vision

Close the in-boundary trust documentation gap and name the cross-operator future so the architecture does not foreclose it. Two artifacts: an explicit named precondition in `SECURITY.md` and a future-work stub that records the verifiable-log direction. Pure docs; no new code.

## Owner

Holistic

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | SECURITY.md trust precondition | low | — | [ ] | `SECURITY.md` names the in-boundary trust assumption explicitly as a precondition: the repo works as a coordination substrate because every writing agent is inside one operator's trust boundary; stated as a precondition, not an afterthought |
| S02 | Cross-operator trust future-work stub | low | — | [ ] | `docs/FUTURE-cross-operator-trust.md` exists, records that the correct primitive for cross-operator cases is an append-only log both sides can verify but neither can edit, and that the JSONL choice is signable-in-principle; explicitly marks this as out of scope for current implementation |

## Exit Criteria

- `SECURITY.md` names the in-boundary trust assumption explicitly as a precondition.
- `docs/FUTURE-cross-operator-trust.md` exists and records the verifiable-log direction.
- No in-boundary design assumes a single trusted writer in a way that would be impossible to relax later.

## Notes

Can land alongside or immediately after M011. Has no blocking dependency on M011's code, but the provenance enforcement on `DecisionRecord` (mandatory `sessionId` + `agent`) that makes anonymous decisions impossible is delivered in M011.

## References

- `SPEC-decisions-capture-andon.md` Section 4 (trust and provenance)
- Section 4.1 (in-boundary, mostly built)
- Section 4.2 (cross-operator, named not built)
- Section 4.3 (acceptance criteria)
