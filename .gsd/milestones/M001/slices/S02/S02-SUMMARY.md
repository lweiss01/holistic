---
id: S02
parent: M001
milestone: M001
provides:
  - Automatic proactive checkpoints after 2 elapsed hours even when no meaningful files changed.
  - Immediate automatic checkpoints when 5 meaningful files accumulate, with passive state reset to avoid repeat firing.
  - Structured completion-signal checkpoint entrypoints in CLI and MCP that create or refresh one deduped draft handoff.
  - Agent-facing docs/help text that name supported natural-breakpoint examples and manual safety valves consistently across surfaces.
requires:
  - slice: S01
    provides: Existing daemon/session-state plumbing plus CLI/MCP continuity surfaces introduced by S01, which S02 extended with proactive triggers and structured completion metadata.
affects:
  - S04
  - S05
  - S06
key_files:
  - tests/run-tests.ts
  - src/core/state.ts
  - src/core/types.ts
  - src/daemon.ts
  - src/cli.ts
  - src/mcp-server.ts
  - src/core/docs.ts
  - .gsd/KNOWLEDGE.md
  - .gsd/PROJECT.md
key_decisions:
  - Use deterministic proactive triggers (2 elapsed hours or 5 meaningful files) instead of adding a new watcher or attempting transcript inference.
  - Require explicit bounded completion metadata (`kind` + `source`, plus optional `recordedAt`) before treating a checkpoint as completion-triggered.
  - Centralize completion-metadata normalization and deduped auto-draft handoff logic in core state helpers so daemon, CLI, and MCP stay aligned.
  - Document supported natural-breakpoint examples and safety valves explicitly rather than implying unsupported free-form automation.
patterns_established:
  - Keep proactive-capture and auto-draft decisions pure in `src/core/state.ts`, then have daemon/CLI/MCP consume the shared helpers instead of re-implementing threshold logic per surface.
  - Represent natural breakpoints with bounded completion metadata rather than open-ended strings so unsupported semantics are ignored instead of guessed.
  - Protect agent-facing behavior with wording-regression tests whenever docs/help output is part of the runtime contract.
observability_surfaces:
  - Focused `daemon tick`, `auto-draft handoff`, and `holistic_checkpoint` regression tests are the authoritative diagnostics for proactive-capture behavior.
  - Persisted checkpoint and draft-handoff state, including `handoff --draft` consumption, is the primary runtime evidence that proactive capture fired as intended.
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-03-28T03:07:21.410Z
blocker_discovered: false
---

# S02: Proactive Automatic Capture

**Daemon proactive capture now checkpoints at 2 hours or 5 meaningful files, and CLI/MCP checkpoints can create deduped draft handoffs from explicit natural-breakpoint completion signals.**

## What Happened

S02 turned Holistic's passive continuity capture into proactive continuity capture without introducing another watcher or fuzzy transcript parsing. T01 first pinned the slice contract in focused regression tests and pure helpers: elapsed-time checkpointing at exactly two hours, immediate checkpointing at exactly five meaningful files, completion-signal draft triggering, duplicate-draft suppression, and the preserved idle 29-vs-30 minute boundary. It also introduced bounded completion metadata types and `--grep` support in the custom test runner so the slice's verification command could stay narrow and repeatable.

T02 then wired those helpers into the real runtime. The daemon now checkpoints even when there are zero meaningful file changes once the two-hour boundary is reached, and it checkpoints immediately at five meaningful files while resetting pending passive state so it does not fire on every subsequent tick. Quiet-cluster and branch-switch behavior from earlier work stayed intact. The same task also aligned CLI and MCP checkpoint entrypoints around structured completion metadata, added shared normalization for that metadata, and reused one deduped auto-draft writer so explicit completion-signal checkpoints can create or refresh a single draft handoff instead of churning duplicates.

T03 closed the slice by making the new behavior legible to downstream agents. Generated docs, CLI help text, and MCP tool descriptions now call out concrete supported natural-breakpoint examples such as tests passed, bug fixed, feature complete, focus change, before compaction, and before handoff. The wording stays honest about what the runtime supports: structured completion metadata and explicit safety valves, not magic semantic inference from arbitrary transcript text. Wording-regression tests were added so those help surfaces stay aligned with runtime behavior. Together, the slice now delivers proactive automatic capture at the daemon layer plus aligned manual/agent entrypoints for semantically meaningful checkpoints and aggressive handoff drafting.

## Verification

Slice-level verification was rerun sequentially and passed cleanly: `npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint" && test -f .gsd/milestones/M001/slices/S02/S02-PLAN.md` succeeded, confirming the shipped daemon/CLI/MCP behavior and required plan artifact presence. A second focused pass, `npm test -- --grep "resume payload starts empty|mcp tool list stays intentionally thin|CLI help text documents"`, also passed, confirming the generated docs/help/tool descriptions still match the bounded runtime contract. Across task execution and final slice verification, the passing checks covered exact two-hour elapsed-time checkpoint boundaries, exact five-file proactive checkpoint boundaries, passive-state reset after threshold firing, explicit completion-signal drafting, duplicate-draft suppression, idle 29-vs-30 minute drafting boundaries, malformed completion metadata being ignored safely, and CLI/MCP guidance parity.

## Requirements Advanced

- R004 — Implemented and verified elapsed-time checkpoint helpers plus daemon wiring so proactive capture fires at the 2-hour boundary even with zero file changes.
- R005 — Implemented and verified immediate threshold checkpointing at 5 meaningful files with passive state reset to prevent looped firing.
- R006 — Added bounded completion metadata, CLI/MCP entrypoints, and aligned docs so agents can explicitly checkpoint supported natural breakpoints with narration.
- R007 — Implemented and verified more aggressive handoff drafting through 30-minute idle detection and explicit completion-signal checkpoints with duplicate suppression.

## Requirements Validated

- R004 — `npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"` passed, including `daemon tick checkpoints on elapsed time with zero changed files` and the exact-two-hour boundary helper test.
- R005 — The same focused verification passed `daemon tick checkpoints immediately at five meaningful files and clears passive pending state` plus the exact-five-file boundary helper test.
- R006 — Focused proactive-capture tests verified explicit completion-signal drafting, malformed metadata rejection, and aligned CLI/MCP help surfaces for supported natural-breakpoint metadata.
- R007 — Focused proactive-capture tests passed for explicit completion-signal auto-drafts, duplicate suppression, the idle 29-vs-30 minute boundary, and `handoff --draft` consumption.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Added `--grep` support to the custom test runner so the slice's declared focused verification command is executable, and added wording-regression assertions so CLI/MCP/doc parity is enforced by tests rather than manual inspection.

## Known Limitations

Natural-breakpoint checkpointing is still explicit rather than inferred: agents must send structured completion metadata through CLI/MCP or use the manual `/checkpoint` and `/handoff` safety valves. The slice also does not add a dedicated runtime health endpoint or alert surface yet; proactive-capture health is primarily diagnosed through persisted state plus focused regression tests. Unrelated broader hook-test failures outside the S02 grep subset still exist elsewhere in the suite and were not addressed here.

## Follow-ups

1. Dogfood whether the 2-hour and 5-file thresholds feel right in real repos before locking them as long-term defaults.
2. Let S04 build on this slice's proactive behavior to surface health warnings when checkpoint cadence goes stale.
3. Let S05 reuse the bounded completion-metadata language from CLI/MCP/docs so every tool surface describes the same supported natural-breakpoint contract.

## Files Created/Modified

- `tests/run-tests.ts` — Added pure proactive-capture helpers, bounded completion metadata types, and focused S02 regression coverage for elapsed-time, file-threshold, idle-boundary, and completion-signal behavior.
- `src/core/state.ts` — Centralized proactive checkpoint decisions, completion metadata normalization, and deduped auto-draft handoff logic shared by daemon, CLI, and MCP flows.
- `src/core/types.ts` — Bounded checkpoint completion metadata so runtime surfaces can express supported natural-breakpoint semantics without free-form inference.
- `src/daemon.ts` — Wired proactive 2-hour and 5-meaningful-file checkpoint triggers into the real daemon tick flow while preserving quiet-cluster and branch-switch semantics.
- `src/cli.ts` — Documented and exposed structured completion metadata flags in CLI help and checkpoint entrypoints.
- `src/mcp-server.ts` — Kept MCP checkpoint behavior and guidance aligned with CLI behavior for structured completion signals and deduped draft handoffs.
- `src/core/docs.ts` — Updated generated agent-facing guidance so supported natural-breakpoint examples and manual safety valves are discoverable without promising unsupported transcript inference.
- `.gsd/KNOWLEDGE.md` — Recorded the sequential build/test verification gotcha so future agents do not reproduce transient source-rewrite failures.
- `.gsd/PROJECT.md` — Refreshed current project state to reflect shipped proactive capture behavior.
