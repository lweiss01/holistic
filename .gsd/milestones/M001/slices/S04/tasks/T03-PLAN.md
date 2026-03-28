---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T03: Lock boundary behavior with diagnostics-focused tests

Add regression and negative-case coverage for S04 boundaries so warning emission is predictable and existing startup behavior remains stable.

Steps:
1. Add tests for warning-trigger boundaries: exactly 3 days, just under 3 days, exactly 50 files, and below-threshold cases.
2. Add tests proving no-warning startup output remains unchanged when diagnostics are clear.
3. Add tests asserting warning phrasing is system-health diagnostic and does not instruct or blame users.
4. Run slice-level verification including targeted tests and build.

## Inputs

- `tests/run-tests.ts`
- `src/core/state.ts`
- `src/core/docs.ts`
- `src/cli.ts`
- `src/mcp-server.ts`

## Expected Output

- `tests/run-tests.ts`
- `.gsd/milestones/M001/slices/S04/tasks/T03-PLAN.md`

## Verification

npm test -- --grep "stale checkpoint|unusual pattern|startup warning" && npm run build
