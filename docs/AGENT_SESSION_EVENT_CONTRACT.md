# Agent Session Event Contract

Andon receives platform-neutral session events. Any platform or runner can integrate if it can emit these fields to `POST /events` or another adapter that writes the same runtime records.

## Minimum Event Fields

```json
{
  "id": "event-id",
  "sessionId": "stable-session-id",
  "type": "session.heartbeat",
  "timestamp": "2026-05-02T18:00:00.000Z",
  "source": "system",
  "runtime": "unknown",
  "payload": {
    "sourceId": "local-cli-source",
    "sourceName": "Local CLI runner",
    "sourceType": "local_cli",
    "transport": "http_events",
    "repoPath": "D:/Projects/active/holistic",
    "worktreePath": "D:/Projects/active/holistic",
    "objective": "Repair Mission Control",
    "agentName": "local-agent",
    "activity": "editing"
  }
}
```

Required fields:

- `id`
- `sessionId`
- `type`
- `timestamp`
- `source`
- `payload.sourceId`
- `payload.sourceType`
- `payload.transport`

Recommended fields:

- `payload.sourceName`
- `payload.platform`
- `payload.repoPath`
- `payload.worktreePath`
- `payload.objective`
- `payload.agentName`
- `payload.branch`
- `payload.activity`
- `payload.capabilities`

## Core Event Types

- `session.started`
- `session.heartbeat`
- `work.started`
- `work.completed`
- `input.requested`
- `input.resolved`
- `review.requested`
- `review.resolved`
- `validation.passed`
- `validation.failed`
- `session.ended`
- `session.parked`
- `session.error`
- `session.paused`
- `session.resumed`
- `session.completed`
- `session.failed`
- `session.cancelled`
- `session.terminated`
- `review.acknowledged`
- `approval.requested`
- `approval.granted`
- `approval.denied`
- `agent.blocked`
- `tool.started`
- `tool.completed`
- `command.started`
- `command.completed`
- `file.changed`
- `test.started`
- `test.completed`

## Status Semantics

Heartbeats prove source/session liveness only. They do not prove progress and must not override explicit lifecycle states such as review-ready, parked, completed, failed, or waiting for input.

Meaningful activity includes real work signals: tool use, command completion, file changes, tests, questions, review transitions, completion, blockers, or actual summaries. Tasks, checkpoints, and compatibility mirror events belong in Detail or Replay, not as top-level Mission Control cards.

Agents emit telemetry; they do not own canonical status. Andon derives `running`, `awaiting_assignment`, `waiting_on_human_input`, `waiting_for_review`, `needs_intervention`, `parked_idle`, `done_historical`, or `unknown` from event sequence, freshness, and source visibility.

Use `work.completed` when an agent has finished the current task and needs the operator to choose the next assignment; Andon derives `awaiting_assignment`. Use `review.requested` only when a concrete review, acceptance, or approval action is required before the session can proceed or close. Use `input.requested` for operator input gates and `validation.failed` for proof/build/test failure that needs intervention.

Cold or missing runtime signal is telemetry/source health, not automatic intervention. Andon may expose `cold_signal`, `runtime_disconnected`, or similar warning tags while preserving the derived work state. `needs_intervention` is reserved for real failure evidence such as unresolved `validation.failed`, `session.error`, failed proof, runtime/database contradiction, or explicit intervention telemetry.

Compatibility events such as `session.status_changed`, `session.needs_input`, `session.needs_review`, and `session.failed_proof` may still be accepted at boundaries, but agent-provided `primaryStatus`, `status`, or `statusHint` values are not canonical truth.

## Platform Examples

- A Claude Code adapter can use `sourceType: "claude_code"` and `transport: "http_events"`.
- A Cursor extension can use `sourceType: "cursor"` and `transport: "websocket"` or `http_events`.
- A local shell runner can use `sourceType: "local_cli"`.
- A Holistic file-state writer can use `sourceType: "file_heartbeat"` and `transport: "cli_writer"`.
- Unknown or custom platforms should use `sourceType: "custom"` or `unknown` until an adapter identifies them.

Mission Control is truthful only when these sources emit current session signals. Without instrumentation, Andon should report that no instrumented source is connected rather than invent live activity.
