# M001 / S02 — Research

**Date:** 2026-03-27

## Summary

S02 owns **R004-R007**. The codebase already has most of the scaffolding this slice needs, but only part of the behavior is implemented. Current daemon behavior in `src/daemon.ts` is limited to: (1) immediate checkpoint on branch switch, (2) buffered file changes that checkpoint only after a quiet tick, and (3) idle/work-milestone handoff drafting checked during daemon ticks. There is **no elapsed-time trigger** for 2-hour checkpoints, and **no significant-file-count trigger** for 5+ files. `PassiveCaptureState.lastCheckpointAt` already exists in `src/core/types.ts` / `src/core/state.ts`, but `runDaemonTick()` only writes it; it is not used for decisions.

R007 is only **partially** present already: `shouldAutoDraftHandoff()` in `src/core/state.ts` supports `idle-30min`, which matches half the requirement, and a second rule `checkpointCount >= 5 && sessionHours >= 2` (`work-milestone`) which is not the roadmap’s “completion signals” behavior. Safety-valve surfaces from S01 already exist: MCP tools `holistic_checkpoint`, `holistic_handoff`, and `holistic_slash` are registered in `src/mcp-server.ts`, and CLI commands `checkpoint` / `handoff` already exist in `src/cli.ts`.

R006 is the gap with the most ambiguity. There is no semantic breakpoint detection in code today. The closest existing mechanism is the Claude Code `UserPromptSubmit` hook installed from `src/core/setup.ts`, which runs a 15-minute debounced `checkpoint --reason "auto periodic snapshot"`; that is prompt-driven and time-driven, not “tests passed / bug fixed / feature complete”. `src/core/docs.ts` already tells agents to checkpoint “when focus changes, before likely context compaction, and before handoff”, so the viable seam is to strengthen **explicit agent instructions + structured checkpoint reasons/flags**, not transcript parsing.

## Recommendation

Treat S02 as **deterministic trigger work**, not AI-semantic inference work.

1. **Extend daemon trigger logic without replacing the current quiet-cluster path.** Keep branch-switch and quiet-after-activity behavior, but add two earlier gates in `runDaemonTick()`:
   - **elapsed-time trigger**: checkpoint when the last checkpoint is 2h old, even if no files changed
   - **significant-file trigger**: checkpoint immediately when buffered meaningful files reach 5+

2. **Handle natural breakpoints via explicit metadata, not regex over arbitrary prose.** The current architecture has no conversation transcript parser and should not grow one here. Add a structured way for checkpoint callers to indicate a natural breakpoint/completion signal (for example via a boolean or reason enum), then let CLI/MCP checkpoint handlers create or refresh a draft handoff immediately when that signal is present. This maps cleanly to R006/R007 and reuses the existing draft-handoff file flow.

3. **Use generated agent docs/tool descriptions as the automation surface.** `src/core/docs.ts` and `src/mcp-server.ts` already shape agent behavior. Update those surfaces with concrete breakpoint examples (“tests passed”, “bug fixed”, “feature complete”, “before compaction”) so agents know when to call the existing safety-valve tools. This is more realistic than trying to infer meaning from free-form status text.

4. **Write tests first around pure decision rules, then wire the daemon/handlers.** This follows the installed `test` skill’s intent: add focused verification before broad integration edits. The current suite already has daemon and draft-handoff cases in `tests/run-tests.ts`; extend that file rather than inventing a new harness.

## Implementation Landscape

### Key Files

- `src/daemon.ts` — primary implementation file for R004/R005. `runDaemonTick()` currently decides between branch switch, buffered repo activity, quiet-tick checkpoint, and idle/work-milestone draft creation. Best place to insert 2h elapsed and 5-file threshold checks.
- `src/core/state.ts` — pure state logic. Contains `checkpointState()`, `shouldAutoDraftHandoff()`, `buildAutoDraftHandoff()`, session inference, and passive-capture defaults. Best place for new pure helpers like `shouldAutoCheckpointForElapsedTime(...)`, `shouldAutoCheckpointForPendingFiles(...)`, or `shouldAutoDraftAfterCheckpoint(...)`.
- `src/core/types.ts` — defines `PassiveCaptureState`, `CheckpointInput`, `HolisticState`. Likely place for any new structured checkpoint metadata (example: completion signal / breakpoint kind).
- `src/mcp-server.ts` — MCP-facing behavior. `holistic_checkpoint` / `holistic_handoff` already exist, so S02 should wire any new checkpoint metadata here and improve descriptions so agents know when to call them.
- `src/cli.ts` — CLI parity for checkpoint/handoff. `handleCheckpoint()` is the non-MCP entry point that should accept the same metadata/behavior as MCP.
- `src/core/docs.ts` — generated instructions to agents. Already contains “Record a checkpoint when focus changes, before likely context compaction, and before handoff.” Best place to add concrete natural-breakpoint examples.
- `src/core/setup.ts` — existing hook integration. Installs Claude Code `UserPromptSubmit` auto-checkpoint script with a 15-minute debounce. Important constraint: there is already client-specific passive capture here; S02 should avoid conflicting timers/duplicate checkpoint spam.
- `tests/run-tests.ts` — existing integration-style tests already cover current daemon clustering, branch-switch checkpoints, `work-milestone`, and `idle-30min` draft behavior. Natural place to add new cases for 2h elapsed, 5-file threshold, and completion-signal draft creation.
- `src/__tests__/mcp-notification.test.ts` — startup greeting tests from S01. Not central to S02 logic, but useful reference for how this repo writes small pure tests outside the main runner.

### Build Order

1. **Lock the trigger contract in tests first.** Add failing tests in `tests/run-tests.ts` for:
   - no file changes + last checkpoint older than 2h => daemon creates checkpoint
   - fewer than 5 changed files => still buffers / waits
   - 5+ changed files => immediate checkpoint without waiting for quiet tick
   - explicit completion signal on checkpoint => draft handoff written immediately or on the same flow
   - duplicate completion signal => no draft thrash / repeated identical draft writes

2. **Add pure decision helpers in `src/core/state.ts` / `src/core/types.ts`.** Keep thresholds and reason selection out of `runDaemonTick()` where possible so behavior stays unit-testable.

3. **Wire daemon flow in `src/daemon.ts`.** Insert elapsed-time and significant-file checks before the current quiet-tick branch, but preserve existing branch-switch behavior and pending-file reset semantics.

4. **Wire caller surfaces in `src/cli.ts` and `src/mcp-server.ts`.** If natural breakpoints use explicit metadata, both interfaces must accept it. Keep CLI/MCP parity so the same behavior is available in manual and MCP-driven flows.

5. **Update generated instruction surfaces in `src/core/docs.ts`.** Make agent-facing guidance concrete enough that natural-breakpoint checkpointing is actually likely in practice.

### Verification Approach

- **Build:** `npm run build`
- **Primary test target:** `npm test` (but see constraint below — currently red at baseline)
- **Focused regression targets in `tests/run-tests.ts`:**
  - daemon clusters repo activity until quiet point
  - daemon checkpoints branch switches immediately
  - auto-draft handoff triggers for significant work milestones
  - daemon tick saves an idle auto-drafted handoff and `handoff --draft` consumes it
  - new S02 cases for elapsed-time / file-threshold / completion-signal
- **Behavioral verification for daemon logic:** create temp repo fixtures the same way existing `makeRepo()` tests do; mutate `.git/HEAD`, touch files, and adjust timestamps in saved state to force deterministic decisions.
- **Behavioral verification for MCP/CLI parity:** call `callHolisticTool(rootDir, "holistic_checkpoint", ...)` and `handleCheckpoint`-equivalent state mutations with the same metadata and confirm draft-handoff + checkpoint state match.

## Constraints

- `captureRepoSnapshot()` in `src/core/git.ts` is the only repo-change detector. S02 should **not** introduce a separate watcher mechanism; thresholds must be based on existing snapshot diffs.
- `checkpointState()` updates `state.lastAutoCheckpoint` for every checkpoint, not just daemon checkpoints. Decide explicitly whether manual/MCP checkpoints reset the 2-hour daemon timer; current data shape implies **yes** unless changed deliberately.
- `PassiveCaptureState.lastCheckpointAt` exists and is written by the daemon, but nothing currently reads it. Avoid adding a second competing source of truth unless there is a clear reason to distinguish daemon-only vs any checkpoint.
- There is already a Claude Code `UserPromptSubmit` auto-checkpoint path in `src/core/setup.ts`; new daemon thresholds must not create obvious duplicate spam against that hook.
- **Current baseline:** `npm run build` passes, but `npm test` currently fails before S02 work with `ERR_MODULE_NOT_FOUND` for `src/core/cli-fallback.js` while importing `src/cli.ts` under `node --experimental-strip-types`. Planner should treat test-runner repair as either a prerequisite task or an acknowledged unrelated baseline issue.

## Common Pitfalls

- **Requirement tension: roadmap says OR, milestone research warns about spam** — roadmap / requirements for S02 are explicit: 2hr elapsed **or** 5+ files. If spam control is needed, debounce with existing state resets instead of silently changing semantics to AND.
- **Completion detection via free-form status parsing** — brittle and tool-specific. Prefer explicit checkpoint metadata or a constrained reason vocabulary.
- **File-threshold loops** — if pending files are not cleared after an immediate 5+ file checkpoint, the daemon will re-fire every tick.
- **Draft duplication** — checkpoint-driven draft creation should reuse the same dedupe behavior as daemon idle drafting (`isSameDraft(...)`) to avoid rewriting the same draft file repeatedly.

## Open Risks

- R004 says “even without file changes”. Current passive session creation is tied to checkpoint flows; the team still needs to choose what the resulting status text should say when nothing changed in the repo but 2 hours elapsed.
- Cross-tool “natural breakpoint” automation will remain partly instruction-driven until there is a richer event model than today’s CLI/MCP inputs.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| MCP / agent integration | `modelcontextprotocol/ext-apps@create-mcp-app` | available via `npx skills add modelcontextprotocol/ext-apps@create-mcp-app` |
| MCP patterns | `0xdarkmatter/claude-mods@mcp-patterns` | available via `npx skills add 0xdarkmatter/claude-mods@mcp-patterns` |
| TypeScript CLI | `hairyf/skills@arch-tsdown-cli` | available via `npx skills add hairyf/skills@arch-tsdown-cli` |
| Verification | installed `test` skill | available now |
