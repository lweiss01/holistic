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
- `session.completed`
- `session.paused`
- `session.resumed`
- `session.failed`
- `session.cancelled`
- `session.terminated`
- `input.requested`
- `input.resolved`
- `review.requested`
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

## Platform Examples

- A Claude Code adapter can use `sourceType: "claude_code"` and `transport: "http_events"`.
- A Cursor extension can use `sourceType: "cursor"` and `transport: "websocket"` or `http_events`.
- A local shell runner can use `sourceType: "local_cli"`.
- A Holistic file-state writer can use `sourceType: "file_heartbeat"` and `transport: "cli_writer"`.
- Unknown or custom platforms should use `sourceType: "custom"` or `unknown` until an adapter identifies them.

Mission Control is truthful only when these sources emit current session signals. Without instrumentation, Andon should report that no instrumented source is connected rather than invent live activity.
