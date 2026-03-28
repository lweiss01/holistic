---
id: S05
parent: M001
milestone: M001
provides:
  - Clear startup expectations across supported tools.
  - Visible slash helper mappings for /holistic, /checkpoint, and /handoff.
requires:
  - slice: S01
    provides: Baseline startup recap pattern and continue/tweak/start-new interaction model.
  - slice: S02
    provides: Checkpoint/handoff command semantics referenced by helper text.
affects:
  - S06
key_files:
  - README.md
  - AGENTS.md
key_decisions:
  - Treat startup behavior as capability matrix (MCP auto-start vs manual) instead of narrative prose.
  - Codify /holistic startup contract in AGENTS docs to reduce ambiguous agent behavior.
  - Expose slash helper text with CLI fallback mappings for environments without slash aliases.
patterns_established:
  - Capability matrix + action mapping for cross-tool startup clarity.
  - Behavior-contract style agent instructions for non-MCP startup paths.
observability_surfaces:
  - README startup parity matrix
  - README slash helper table
  - AGENTS startup behavior contract
drill_down_paths:
  - .gsd/milestones/M001/slices/S05/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S05/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S05/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:30:49.615Z
blocker_discovered: false
---

# S05: Documentation & Tool Parity

**Closed documentation and tool parity slice with explicit startup matrix and slash helper guidance.**

## What Happened

Completed S05 by documenting tool parity and startup expectations across primary user-facing docs. README now clearly identifies MCP auto-start support and manual startup actions per tool. AGENTS now codifies the /holistic startup flow and behavior contract for non-MCP tools. Slash helper text for /holistic, /checkpoint, and /handoff is now visible with CLI equivalents.

## Verification

Validated via doc inspection and full test-suite runs after each docs change (all green).

## Requirements Advanced

- R012 — Added explicit slash command helper text for /holistic, /checkpoint, and /handoff in README and AGENTS.
- R013 — Added explicit README startup/tool parity matrix with MCP auto-start column and manual action guidance.
- R014 — Added AGENTS /holistic startup pattern and behavior contract with continue/tweak/start-new prompt.

## Requirements Validated

- R012 — README and AGENTS now contain visible helper labels/descriptions for /holistic, /checkpoint, and /handoff with CLI equivalents.
- R013 — README 'Startup parity matrix' lists tools with MCP auto-start yes/no and explicit startup action.
- R014 — AGENTS includes dedicated '/holistic Startup Pattern (non-MCP tools)' section with expected flow and behavior contract.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

S05 plan artifact had no pre-expanded task list; closure captured executed work through task completions and slice summary.

## Known Limitations

Documentation parity is policy-level; compliance in third-party tools still needs S06 real-world validation.

## Follow-ups

Use S06 dogfooding to validate whether startup/helper wording is consistently followed by each target agent tool in practice.

## Files Created/Modified

- `README.md` — Replaced generic startup wording with parity matrix and added slash-helper table with CLI equivalents.
- `AGENTS.md` — Added explicit /holistic non-MCP startup pattern and slash helper text contract.
