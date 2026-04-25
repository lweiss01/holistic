# Milestone 007: Andon V3 (Fine-Grained Operational Telemetry)

M007 upgrades the Andon pipeline from processing simple task checkpoints to processing high-frequency operational signals. This fills **Layer 1 & Layer 2** from the Andon spec, ensuring the status engine can actually detect when an agent is looping, stalling, or modifying files unexpectedly between check-ins.

**Boundary:** Holistic lifecycle posts (checkpoint, session start/end) **complement** but **do not replace** the high-volume stream; ingest design should assume **[OpenHarness](https://github.com/HKUDS/OpenHarness)**-style operational events as the primary volume source. See [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md).

## Slice Definition

### S01: Event Forwarding (OpenHarness Integration)
- **Goal:** Capture the operational noise required to evaluate agent health.
- **Source:** **OpenHarness** (not Holistic) owns this telemetry. OpenHarness exposes:
  - `--output-format stream-json` — streaming tool-call events in real time
  - `PostToolUse` hooks — interceptors that fire after every tool execution
  - Token counting, cost tracking, retry state — all available via OpenHarness harness lifecycle
- **Implementation:**
  - Build an OpenHarness adapter (hook or wrapper) that captures `tool.called`, `file.changed`, `command.started`, `command.failed`, `test.failed` events.
  - Forward these to the Andon API `/events` endpoint via HTTP POST.
  - Holistic lifecycle events (checkpoint, session.started, session.ended) continue to fire separately from `src/core/andon.ts`.

### S02: High-Volume Event Ingestion
- **Goal:** Safely persist large volumes of events in SQLite.
- **Implementation:**
  - Expand the `andon-api` SQLite `events` schema.
  - Implement batching or deduplication to handle high-volume command logs and file-change streams without overwhelming the database.
  - Expose API endpoints for querying timeline slices (`GET /sessions/:id/timeline`).

### S03: Granular Timeline Dashboard UI
- **Goal:** Visualize the recent operational history of an agent.
- **Implementation:**
  - Expose the "Last 10 minutes" event timeline to the active session Detail UI.
  - Filter out low-value noise and highlight critical signals (like repeating test failures or unexpected directory modifications).

## Exit Criteria
- `andon-api` successfully ingests and stores high-frequency operational events.
- The UI exposes a rich, chronological replay of what the agent did in the last 10 minutes.
- The system correctly formats events (e.g. "Ran `npm test` - Failed", "Edited `src/auth.ts`").
