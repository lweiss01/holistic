# S02: Proactive Automatic Capture — UAT

**Milestone:** M001
**Written:** 2026-03-28T03:07:21.411Z

# S02: Proactive Automatic Capture — UAT

**Milestone:** M001
**Written:** 2026-03-28

## UAT Type

- UAT mode: mixed
- Why this mode is sufficient: S02 is mostly runtime policy and agent-surface behavior. The authoritative proof is the focused regression suite exercising daemon decisions, CLI/MCP entrypoints, and handoff persistence, plus build verification that the shipped surfaces compile together.

## Preconditions

- Run from `C:\Users\lweis\Documents\holistic` with dependencies already installed.
- Do **not** run `npm run build` in parallel with source-mode test commands; run verification sequentially because the build temporarily rewrites imports during compilation.
- The repository contains the S02 plan/task artifacts under `.gsd/milestones/M001/slices/S02/`.

## Smoke Test

1. Run `npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"`.
2. **Expected:** Build succeeds and the focused proactive-capture suite reports all targeted daemon/handoff/checkpoint tests passing.

## Test Cases

### 1. Elapsed-time checkpoints fire without file churn

1. Run `npm test -- --grep "daemon tick helper triggers an elapsed-time checkpoint at exactly two hours|daemon tick checkpoints on elapsed time with zero changed files"`.
2. Review the passing output.
3. **Expected:** Both tests pass, proving the helper boundary is exact and the daemon checkpoints after two hours even when zero meaningful files changed.

### 2. Five-file threshold checkpoints fire once and reset passive state

1. Run `npm test -- --grep "daemon tick helper triggers a checkpoint at exactly five meaningful files|daemon tick checkpoints immediately at five meaningful files and clears passive pending state"`.
2. Review the passing output.
3. **Expected:** Both tests pass, proving the checkpoint fires immediately at the five-file threshold and passive pending state is cleared so repeated ticks do not spam checkpoints.

### 3. Explicit completion signals create one deduped draft handoff

1. Run `npm test -- --grep "auto-draft handoff triggers immediately for an explicit completion signal|auto-draft handoff suppresses duplicate completion-signal drafts for unchanged sessions|daemon tick saves an idle auto-drafted handoff and handoff --draft consumes it"`.
2. Review the passing output.
3. **Expected:** All tests pass, proving explicit completion-signal checkpoints can create a draft handoff, unchanged sessions do not churn duplicate drafts, and the saved draft remains consumable through `handoff --draft`.

### 4. CLI/MCP guidance matches the supported completion-metadata contract

1. Run `npm test -- --grep "CLI help text documents completion metadata and natural breakpoint safety valves|mcp tool list stays intentionally thin and tool calls persist state"`.
2. Review the passing output.
3. **Expected:** Both tests pass, proving CLI help and the MCP tool surface expose the supported completion-metadata workflow and remain aligned with runtime behavior.

## Edge Cases

- Malformed completion metadata should be ignored rather than guessed; normal checkpoint creation should still succeed.
- Idle auto-drafting must preserve the 29-minute vs 30-minute boundary so drafts are not created too early.
- Existing quiet-cluster and branch-switch checkpoint behavior must remain intact while proactive triggers are added.
- Sequential build/test discipline is required during verification because parallel execution can cause transient source-import rewrite failures.

