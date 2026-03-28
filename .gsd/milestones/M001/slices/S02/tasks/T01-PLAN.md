---
estimated_steps: 6
estimated_files: 4
skills_used:
  - test
  - debug-like-expert
---

# T01: Lock proactive capture rules in tests and pure state helpers

**Slice:** S02 - Proactive Automatic Capture
**Milestone:** M001

## Description

Define the proactive-capture contract before runtime wiring changes. This task makes the slice safe to implement by extending the existing test runner with explicit S02 scenarios and extracting deterministic helper logic for elapsed-time, pending-file threshold, and completion-signal draft decisions.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| `tests/run-tests.ts` harness | Stop and fix the failing test fixture before changing runtime behavior further. | N/A for local test code; a hung test indicates a broken fixture or loop and should be isolated. | Rewrite the fixture/assertion to reflect the actual state shape before proceeding. |
| `src/core/state.ts` helpers | Keep logic pure and small so failures stay localizable rather than hidden in daemon flow. | N/A for pure helpers. | Reject ambiguous helper contracts and replace them with typed, deterministic inputs/outputs. |
| `src/core/types.ts` metadata | Narrow the new metadata to explicit supported values and update tests alongside type changes. | N/A for type-only work. | Do not leave partially typed metadata that forces unchecked casts in runtime code. |

## Load Profile

- **Shared resources**: `.holistic/state.json` semantics are shared across daemon, CLI, and MCP flows even though this task is test-first.
- **Per-operation cost**: temp repo setup plus local state mutations in the test runner; trivial runtime cost but high regression value.
- **10x breakpoint**: flaky tests or over-coupled helper APIs would fail first by making future daemon changes hard to diagnose.

## Negative Tests

- **Malformed inputs**: null/empty last-checkpoint timestamp, pending file counts below threshold, and missing completion metadata should all return “do not trigger”.
- **Error paths**: duplicate completion-signal drafts should not rewrite identical handoff files; legacy idle draft logic should still work.
- **Boundary conditions**: exactly 2 hours elapsed, exactly 5 meaningful files, 4 files, and 29 vs 30 idle minutes.

## Steps

1. Extend `tests/run-tests.ts` with explicit S02 cases for elapsed-time checkpoints, 5-file checkpoints, completion-signal handoff drafting, duplicate-draft suppression, and preserved quiet-cluster / branch-switch behavior.
2. Add pure helper functions in `src/core/state.ts` for elapsed-time threshold checks, pending-file threshold checks, and completion-signal draft decisions.
3. Add the minimum type changes in `src/core/types.ts` needed to model explicit breakpoint/completion metadata without introducing open-ended parsing.
4. Keep thresholds aligned with the roadmap and research: 2 hours and 5 meaningful files, with no new watcher mechanism.

## Must-Haves

- [ ] `tests/run-tests.ts` contains named S02 scenarios that fail until the runtime work is implemented.
- [ ] Helper logic for elapsed-time, pending-file, and completion-signal decisions is pure and directly testable.
- [ ] Any new checkpoint metadata in `src/core/types.ts` is explicit and bounded.
- [ ] Existing idle-30min handoff behavior remains covered.

## Verification

- `npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`
- Inspect changed assertions in `tests/run-tests.ts` to confirm they cover exactly-2-hours and exactly-5-files boundaries.

## Observability Impact

- Signals added/changed: test-visible checkpoint reasons, elapsed-time decisions, and completion-signal draft decisions.
- How a future agent inspects this: read `tests/run-tests.ts` and the pure helpers in `src/core/state.ts`.
- Failure state exposed: whether a trigger failed because time, file-count, or completion-signal logic returned the wrong decision.

## Inputs

- `tests/run-tests.ts` - existing daemon and draft-handoff coverage to extend
- `src/core/state.ts` - current draft-decision logic and state helpers
- `src/core/types.ts` - checkpoint and passive-capture type definitions
- `src/daemon.ts` - current runtime flow that the tests will constrain

## Expected Output

- `tests/run-tests.ts` - focused S02 regression coverage
- `src/core/state.ts` - pure proactive-capture decision helpers
- `src/core/types.ts` - explicit checkpoint completion metadata definitions
