---
estimated_steps: 5
estimated_files: 5
skills_used:
  - test
---

# T03: Teach agents when to checkpoint and verify the full slice

**Slice:** S02 - Proactive Automatic Capture
**Milestone:** M001

## Description

Make the new proactive-capture behavior discoverable to agents and close the slice with build/test proof. This task updates generated docs and tool descriptions so natural-breakpoint checkpointing is realistic in practice, then runs the slice verification commands.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| `src/core/docs.ts` generated guidance | Fix the wording so it matches actual supported checkpoint behavior before shipping. | N/A for local docs generation code. | Remove claims that imply transcript parsing or unsupported automation. |
| `src/mcp-server.ts` / `src/cli.ts` tool descriptions | Keep help text aligned across surfaces; mismatches are a regression because agents depend on them. | N/A for synchronous text changes. | Fall back to the explicit supported examples rather than vague “automatic breakpoint detection” language. |
| Build/test commands | Stop and repair the failing surface instead of weakening verification. | Investigate hanging tests/build steps before declaring success. | If output is ambiguous, re-run the focused command until pass/fail is clear. |

## Negative Tests

- **Malformed inputs**: docs/help text must not promise unsupported free-form semantic inference.
- **Error paths**: if focused tests fail after doc wiring, do not mark the slice done; update the plan or code/tests accordingly.
- **Boundary conditions**: examples should cover at least tests passed, bug fixed, feature complete, focus change, and before compaction.

## Steps

1. Update `src/core/docs.ts` with concrete natural-breakpoint guidance tied to supported checkpoint reasons/signals.
2. Align `src/mcp-server.ts` and `src/cli.ts` descriptions/help text with the runtime metadata introduced in T02.
3. Run the slice verification commands and keep the plan artifacts intact for downstream executors.

## Must-Haves

- [ ] Agent-facing docs mention concrete natural-breakpoint examples and the `/checkpoint` / `/handoff` safety valves.
- [ ] CLI and MCP descriptions match the supported runtime behavior.
- [ ] `npm run build` and focused S02 tests pass before the task is complete.
- [ ] The slice plan and task-plan artifacts remain present on disk.

## Verification

- `npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`
- `test -f .gsd/milestones/M001/slices/S02/S02-PLAN.md && test -f .gsd/milestones/M001/slices/S02/tasks/T01-PLAN.md && test -f .gsd/milestones/M001/slices/S02/tasks/T02-PLAN.md && test -f .gsd/milestones/M001/slices/S02/tasks/T03-PLAN.md`

## Observability Impact

- Signals added/changed: documented trigger reasons and inspection paths for proactive capture.
- How a future agent inspects this: read generated docs plus the focused verification commands in this plan.
- Failure state exposed: mismatch between agent guidance and actual checkpoint/draft behavior.

## Inputs

- `src/core/docs.ts` - generated agent instructions
- `src/mcp-server.ts` - MCP tool descriptions
- `src/cli.ts` - CLI help/command wording
- `tests/run-tests.ts` - focused verification target
- `.gsd/milestones/M001/slices/S02/S02-RESEARCH.md` - planning constraints and rationale

## Expected Output

- `src/core/docs.ts` - updated breakpoint guidance
- `src/mcp-server.ts` - aligned checkpoint tool descriptions
- `src/cli.ts` - aligned command/help text
- `tests/run-tests.ts` - verification references still valid
- `.gsd/milestones/M001/slices/S02/S02-PLAN.md` - persisted slice plan artifact referenced by executors
