# M013: Automatic Capture and Escalation Predicate

## Vision

Make decision capture invisible by default. An agent following `HOLISTIC.md` records decisions inline as it works — no human prompt required. The daemon is a backstop for when agents don't self-report. A single capture entry point evaluates an escalation predicate and routes to silent-append, interactive confirm, or queue-for-resume. Confirmations cluster at dangerous edges (supersessions, rejected-approach contradictions, daemon-inferred guesses) and stay silent on the safe interior.

## Owner

Holistic

## Slice Overview

| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Capture entry point & escalation predicate | high | M011 | [ ] | Single internal function that all capture paths (MCP, daemon, git hook) funnel through; evaluates `supersedes_active`, `contradicts_rejected`, `low_confidence_source` predicate; routes to silent-append, interactive confirm, or queue-for-resume accordingly |
| S02 | Agent instruction layer | medium | S01 | [ ] | `HOLISTIC.md` generation and adapter docs under `.holistic/context/adapters/` instruct agents to record decisions inline including `title`, `rationale`, `scope`; safeMode variant is minimal; an agent following instructions records a fresh non-conflicting decision with no human interaction |
| S03 | Confirm surface & queue-for-resume | medium | S01 | [ ] | Interactive surface: one-line prompt; non-interactive / daemon-only: queue-for-resume so low-confidence or overturning captures are reviewed at next `resume` rather than landing unseen |
| S04 | Daemon backstop hardening | low | S01 | [ ] | Daemon-inferred decisions always `confidence: "low"`; daemon never writes `confidence: "high"`; disabling capture via env or config stops all writes without erroring (parallel to existing `ANDON_DISABLED` pattern) |

## Exit Criteria

- An agent following `HOLISTIC.md` records a fresh non-conflicting decision with no human interaction, and it appears in the active set at next `resume`.
- An agent recording a decision that supersedes an active one triggers a confirm (interactive) or a resume-queue entry (non-interactive); it does not land silently.
- A daemon-inferred decision is always `confidence: "low"` and never lands silently.
- Under `safeMode`, capture still functions but instruction text is minimal.
- Disabling capture stops all writes without erroring.
- No code path allows daemon-inferred supersession (Rule 2 from M011 spec is not violated).

## References

- `docs/SPEC-decisions-capture-andon.md` Section 2 (automatic capture and trigger model)
- Section 2.4 (escalation predicate — read before implementing S01)
- Section 2.5 (what to build)
- Section 2.6 (acceptance criteria)
