# S02: Proactive Automatic Capture

**Goal:** Deliver proactive continuity capture so Holistic checkpoints after 2 hours without repo changes, checkpoints immediately when 5+ meaningful files accumulate, lets agents mark natural breakpoints explicitly, and auto-drafts handoffs on idle or completion signals without duplicate draft churn.
**Demo:** After this: daemon checkpoints on time elapsed (2hr) OR significant files (5+); agents initiate checkpoints at natural breakpoints in conversation; handoff drafts trigger after 30min idle or completion signals; `/checkpoint` and `/handoff` slash commands available as safety valves.

## Must-Haves

- R004: daemon checkpoints automatically when the last checkpoint is at least 2 hours old, even if no meaningful files changed.
- R005: daemon checkpoints immediately when 5 or more meaningful changed files are pending, without waiting for a quiet tick.
- R006: agents can mark natural breakpoints explicitly through supported checkpoint metadata, and docs/tool descriptions tell them when to do it.
- R007: auto-draft handoffs trigger for 30 minutes idle and explicit completion signals, with duplicate draft suppression.

## Threat Surface

- **Abuse**: Replayed or noisy completion-signal checkpoints could spam continuity history or repeatedly rewrite draft handoffs if dedupe/reset logic is wrong.
- **Data exposure**: Checkpoints and drafts persist repo/work summaries but should not add any new secret-bearing logs or state fields.
- **Input trust**: CLI flags and MCP tool arguments are trusted user/agent input that flow into state files, so completion metadata must stay constrained and deterministic rather than driving open-ended parsing.

## Requirement Impact

- **Requirements touched**: R004, R005, R006, R007.
- **Re-verify**: daemon quiet-cluster checkpoints, branch-switch auto-checkpoints, CLI `checkpoint`, MCP `holistic_checkpoint`, and `handoff --draft` draft consumption.
- **Decisions revisited**: D001.

## Proof Level

- This slice proves: **integration**
- Real runtime required: **no**
- Human/UAT required: **no**

## Verification

- `npm run build`
- `npm test -- --grep "daemon tick"`
- `npm test -- --grep "auto-draft handoff"`
- `npm test -- --grep "holistic_checkpoint"`
- `test -f .gsd/milestones/M001/slices/S02/S02-PLAN.md`
- `test -f .gsd/milestones/M001/slices/S02/tasks/T01-PLAN.md`
- `test -f .gsd/milestones/M001/slices/S02/tasks/T02-PLAN.md`
- `test -f .gsd/milestones/M001/slices/S02/tasks/T03-PLAN.md`

## Observability / Diagnostics

- Runtime signals: `passiveCapture.lastCheckpointAt`, checkpoint reasons, and draft-handoff reason fields must make trigger source inspectable.
- Inspection surfaces: `.holistic/state.json`, `.holistic/draft-handoff.json`, CLI `status` / `handoff --draft`, and focused assertions in `tests/run-tests.ts`.
- Failure visibility: tests should distinguish elapsed-time misses, file-threshold loops, and duplicate draft rewrites.
- Redaction constraints: do not introduce secret-bearing logs or persist more free-form text than the existing checkpoint/handoff surfaces already store.

## Integration Closure

- Upstream surfaces consumed: `src/daemon.ts`, `src/core/state.ts`, `src/core/types.ts`, `src/cli.ts`, `src/mcp-server.ts`, `src/core/docs.ts`, `src/core/setup.ts`, `tests/run-tests.ts`
- New wiring introduced in this slice: daemon trigger helpers, explicit checkpoint completion metadata through CLI/MCP, completion-signal handoff drafting, and updated agent guidance.
- What remains before the milestone is truly usable end-to-end: S05 must document `/checkpoint` and `/handoff`; S06 should dogfood threshold tuning in real workflows.

## Tasks

- [ ] **T01: Lock proactive capture rules in tests and pure state helpers** `est:1.5h`
  - Why: The daemon changes are stateful and easy to regress, so the slice needs executable contract coverage before runtime wiring starts.
  - Files: `tests/run-tests.ts`, `src/core/state.ts`, `src/core/types.ts`, `src/daemon.ts`
  - Do: Extend the existing test runner with explicit S02 cases for elapsed-time checkpoints, immediate 5-file checkpoints, completion-signal draft creation, duplicate-draft suppression, and preserved quiet-cluster/branch-switch behavior. Add pure helper APIs and any small type additions needed so threshold and completion decisions are deterministic outside `runDaemonTick()`.
  - Verify: `npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`
  - Done when: Failing/then-passing tests name each S02 scenario explicitly, helper APIs expose the trigger contract, and idle-30min draft behavior is still covered.
- [ ] **T02: Wire daemon and checkpoint entrypoints for proactive triggers** `est:2h`
  - Why: This task closes the main runtime gap by making the daemon and manual safety-valve entrypoints honor the S02 rules consistently.
  - Files: `src/daemon.ts`, `src/cli.ts`, `src/mcp-server.ts`, `src/core/state.ts`, `src/core/types.ts`, `tests/run-tests.ts`
  - Do: Update daemon flow to checkpoint on 2-hour elapsed time and 5+ meaningful pending files while preserving branch-switch and quiet-cluster semantics. Thread explicit completion metadata through CLI and MCP checkpoint handlers, trigger or refresh draft handoffs on completion signals, and reset tracker state to prevent threshold loops.
  - Verify: `npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`
  - Done when: Elapsed-time checkpoints fire without file changes, 5-file checkpoints fire immediately without repeated ticks, completion signals can create/update a deduped draft handoff, and legacy daemon paths still pass.
- [ ] **T03: Teach agents when to checkpoint and verify the full slice** `est:1h`
  - Why: Natural-breakpoint automation will remain partly instruction-driven, so the user-facing/docs surface must match the runtime contract and the slice must end with build/test proof.
  - Files: `src/core/docs.ts`, `src/mcp-server.ts`, `src/cli.ts`, `tests/run-tests.ts`, `.gsd/milestones/M001/slices/S02/S02-PLAN.md`
  - Do: Update generated agent docs and tool descriptions with concrete breakpoint examples such as tests passed, bug fixed, feature complete, focus change, and before compaction. Reconcile wording with the metadata introduced in T02 and run the slice verification commands.
  - Verify: `npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`
  - Done when: Agent-facing instructions point to supported checkpoint reasons/signals, verification passes, and the plan/task artifacts are complete for downstream executors.

## Files Likely Touched

- `src/daemon.ts`
- `src/core/state.ts`
- `src/core/types.ts`
- `src/cli.ts`
- `src/mcp-server.ts`
- `src/core/docs.ts`
- `tests/run-tests.ts`
- `.gsd/milestones/M001/slices/S02/S02-PLAN.md`
