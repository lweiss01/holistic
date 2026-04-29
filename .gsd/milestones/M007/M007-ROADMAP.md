# Milestone 007: Runtime Service and Local Adapter

This milestone is realigned from the earlier "Andon V3 (Fine-Grained Operational Telemetry)" direction.
M007 now turns the runtime contract into a working service boundary with a local adapter and structured live event flow.

## Boundary

M007 owns process orchestration, NDJSON event parsing, lifecycle tracking, and runtime APIs.
It does not yet own approval policy tiers, worktree isolation, or higher-order fleet intelligence.

## Slice Overview

### S01: Runtime Service API
- **Goal:** Create `services/runtime-service` with the core task and session endpoints plus an adapter registry.
- **Scope:** `POST /runtime/tasks`, session reads, approve/deny hooks, stop/pause/resume entrypoints, and `GET /runtime/stream`.

### S02: Local Adapter and Structured Events
- **Goal:** Ship `packages/runtime-local` as the first real runtime implementation.
- **Scope:** Subprocess launch, NDJSON event parsing, stdout/stderr handling, exit-state mapping, and normalized lifecycle events.

### S03: Heartbeats, Stale Detection, and End-to-End Verification
- **Goal:** Track active runtime health honestly.
- **Scope:** Heartbeats, staged stale detection, event streaming, fake-runner verification, and API tests proving the runtime can be started, observed, and stopped.

## Exit Criteria

- A fake local runtime task can be started through the runtime API.
- Structured runtime events are persisted and streamable.
- Session status updates correctly through start, heartbeat, success, and failure states.
- The local adapter proves the protocol before external adapters are attempted.
