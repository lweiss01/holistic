---
estimated_steps: 6
estimated_files: 6
skills_used:
  - test
  - debug-like-expert
---

# T02: Wire daemon and checkpoint entrypoints for proactive triggers

**Slice:** S02 - Proactive Automatic Capture
**Milestone:** M001

## Description

Implement the runtime behavior defined in T01. This task updates the daemon to fire proactive checkpoints at the right times, threads explicit completion metadata through CLI and MCP checkpoint entrypoints, and ensures handoff drafting stays deduped and inspectable.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| `src/daemon.ts` tick flow | Fail the focused daemon tests and inspect passive-capture state resets before retrying. | A hanging daemon-style test indicates a loop or repeated trigger; stop and isolate the tracker reset logic. | Reject helper outputs or state mutations that leave `pendingFiles`/`quietTicks` inconsistent after a checkpoint. |
| `src/cli.ts` checkpoint handler | Preserve current checkpoint behavior and surface invalid metadata as a bounded no-op or validation path instead of corrupting state. | N/A for synchronous CLI parsing. | Ignore unsupported metadata rather than inferring semantics from arbitrary text. |
| `src/mcp-server.ts` checkpoint tool | Keep MCP parity with CLI and return a clear failure if required reason input is missing. | N/A for local tool execution in tests. | Filter tool args to explicit supported fields and do not trust arbitrary object shapes. |

## Load Profile

- **Shared resources**: `.holistic/state.json`, `.holistic/draft-handoff.json`, daemon passive-capture tracker, and checkpoint history.
- **Per-operation cost**: one repo snapshot comparison plus one checkpoint/draft write when thresholds fire; should remain near current daemon cost.
- **10x breakpoint**: repeated threshold firing or duplicate draft rewrites would create the first operational pain under noisy edit patterns.

## Negative Tests

- **Malformed inputs**: unsupported or missing completion metadata must not create drafts or break checkpoint creation.
- **Error paths**: threshold-triggered checkpoints must clear pending state so the next tick does not refire immediately.
- **Boundary conditions**: zero changed files with >=2h elapsed, exactly 5 meaningful files, 4 meaningful files, and repeated identical completion signals.

## Steps

1. Update `src/daemon.ts` to consume the pure helpers from T01 and checkpoint on 2-hour elapsed time or 5+ pending meaningful files while preserving branch-switch and quiet-cluster behavior.
2. Reset `pendingFiles`, `activityTicks`, `quietTicks`, and `lastCheckpointAt` correctly after proactive checkpoints to prevent loops.
3. Extend `src/cli.ts` checkpoint parsing and `src/mcp-server.ts` checkpoint tool handling with explicit completion/breakpoint metadata that aligns with the new types.
4. Trigger or refresh draft handoffs from completion-signal checkpoints using the same dedupe behavior as daemon idle drafts.

## Must-Haves

- [ ] Elapsed-time checkpoints fire even with zero meaningful file changes.
- [ ] 5-file checkpoints fire immediately and do not repeat on every tick.
- [ ] CLI and MCP checkpoint entrypoints accept the same explicit completion metadata.
- [ ] Completion signals can create or refresh a deduped draft handoff without regressing branch-switch or quiet-point checkpointing.

## Verification

- `npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`
- Inspect test fixtures or state assertions to confirm `passiveCapture.pendingFiles` is empty after an immediate threshold checkpoint.

## Observability Impact

- Signals added/changed: proactive checkpoint reasons, completion-signal draft reason, and updated `passiveCapture.lastCheckpointAt` behavior.
- How a future agent inspects this: review `.holistic/state.json`, `.holistic/draft-handoff.json`, and focused daemon tests.
- Failure state exposed: whether a bad trigger came from timer logic, file-threshold logic, or CLI/MCP metadata handling.

## Inputs

- `src/daemon.ts` - current daemon tick implementation
- `src/cli.ts` - manual checkpoint entrypoint
- `src/mcp-server.ts` - MCP `holistic_checkpoint` surface
- `src/core/state.ts` - pure helper logic from T01
- `src/core/types.ts` - explicit checkpoint metadata types
- `tests/run-tests.ts` - executable contract coverage from T01

## Expected Output

- `src/daemon.ts` - proactive trigger wiring and tracker reset behavior
- `src/cli.ts` - checkpoint metadata parsing parity
- `src/mcp-server.ts` - MCP checkpoint metadata parity
- `src/core/state.ts` - draft-trigger integration helpers
- `src/core/types.ts` - finalized metadata contract
