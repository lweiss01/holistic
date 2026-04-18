# S03: IDE/CLI Integration

**Goal:** Allow native `holistic` CLI executions to emit telemetry to the local Andon API so the Dashboard automatically monitors background terminal activity.

## Tasks
- [ ] **T01: Dispatcher Client** - Create `src/core/andon.ts` containing a fail-safe async fetch wrapper that casts payloads to the running `andon-api`.
- [ ] **T02: Telemetry on Start** - Wire `startNewSession()` in `src/core/state.ts` to emit `session.started` and `task.started`.
- [ ] **T03: Telemetry on Checkpoint** - Wire `checkpointState()` in `src/core/state.ts` to emit `task.completed` and `agent.summary_emitted`.
- [ ] **T04: Telemetry on Handoff** - Wire `applyHandoff()` to emit `session.ended`.
