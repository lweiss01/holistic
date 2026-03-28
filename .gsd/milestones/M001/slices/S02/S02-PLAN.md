# S02: Proactive Automatic Capture

**Goal:** Deliver proactive continuity capture so Holistic checkpoints after 2 hours without repo changes, checkpoints immediately when 5+ meaningful files accumulate, lets agents mark natural breakpoints explicitly, and auto-drafts handoffs on idle or completion signals without duplicate draft churn.
**Demo:** After this: daemon checkpoints on time elapsed (2hr) OR significant files (5+); agents initiate checkpoints at natural breakpoints in conversation; handoff drafts trigger after 30min idle or completion signals; `/checkpoint` and `/handoff` slash commands available as safety valves

## Tasks
- [x] **T01: Added pure proactive-capture helpers, bounded completion-signal types, and S02 boundary tests for elapsed-time, file-threshold, and completion-triggered handoff decisions.** — Add or extend focused tests around the S02 contract before wiring daemon behavior so executors can change runtime code safely.

Steps:
1. Extend `tests/run-tests.ts` with failing cases for elapsed-time checkpoints, immediate 5-file checkpoints, completion-signal handoff drafting, duplicate-draft suppression, and preserved quiet-cluster / branch-switch behavior.
2. Add pure decision helpers and any small type additions in `src/core/state.ts` and `src/core/types.ts` so threshold logic and completion-signal rules are deterministic and unit-testable.
3. Keep thresholds aligned with roadmap/research: 2 hours and 5 meaningful files, with no new file watcher.

Must-haves:
- Tests name the exact S02 scenarios and fail against the current baseline before implementation is wired.
- Helper APIs expose elapsed-time, pending-file threshold, and completion-signal draft decisions without burying all logic inside `runDaemonTick()`.
- Any new checkpoint metadata is constrained and documented in types.
- Existing idle-30min behavior remains covered.

  - Estimate: 1.5h
  - Files: tests/run-tests.ts, src/core/state.ts, src/core/types.ts
  - Verify: npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"
- [x] **T02: Wired proactive daemon checkpoints plus CLI/MCP completion-signal entrypoints with deduped draft handoffs.** — Implement the runtime behavior once the contract is pinned down.

Steps:
1. Update `src/daemon.ts` to consume the new pure helpers, triggering checkpoints for 2-hour elapsed time and 5+ pending meaningful files while preserving branch-switch and quiet-cluster semantics.
2. Clear/reset pending-file and checkpoint timing state correctly after immediate threshold checkpoints to avoid repeated firing on every tick.
3. Extend `src/cli.ts` and `src/mcp-server.ts` to accept explicit natural-breakpoint/completion metadata on checkpoints, and trigger or refresh auto-draft handoffs when completion signals are present.
4. Keep CLI and MCP behavior aligned so manual safety valves behave the same across tool surfaces.

Must-haves:
- Daemon elapsed-time checkpoints fire even with zero meaningful file changes.
- Significant-file checkpoints fire immediately at 5+ meaningful files and do not loop.
- Completion-signal checkpoints can create/update a draft handoff without duplicate rewrites.
- Branch-switch and quiet-point checkpointing still work.

  - Estimate: 2h
  - Files: src/daemon.ts, src/cli.ts, src/mcp-server.ts, src/core/state.ts, src/core/types.ts
  - Verify: npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"
- [ ] **T03: Teach agents when to checkpoint and verify the full slice** — Finish the slice by making the new behavior discoverable to agents and by running the required regression/build checks.

Steps:
1. Update generated instruction surfaces in `src/core/docs.ts` and any relevant CLI/MCP tool descriptions so agents are told to checkpoint at concrete natural breakpoints such as tests passed, bug fixed, feature complete, focus change, or before compaction.
2. Reconcile wording with the runtime metadata introduced in T02 so docs point agents toward supported checkpoint reasons/signals rather than free-form inference magic.
3. Run build and focused tests, then record any follow-up threshold-tuning risk for downstream dogfooding rather than silently changing semantics.

Must-haves:
- Agent-facing docs and tool descriptions explicitly mention natural-breakpoint examples and the manual safety-valve commands.
- Verification proves CLI/MCP parity plus daemon trigger behavior without broad regressions.
- The slice outputs a complete plan artifact and task artifacts for downstream executors.

  - Estimate: 1h
  - Files: src/core/docs.ts, src/mcp-server.ts, src/cli.ts, tests/run-tests.ts, .gsd/milestones/M001/slices/S02/S02-PLAN.md
  - Verify: npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint" && test -f .gsd/milestones/M001/slices/S02/S02-PLAN.md
