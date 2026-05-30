# Agent Session Beacon

The Andon session beacon is the simplest generic instrumentation path for Mission Control. It does not observe an agent automatically. It lets any agent, runner, script, or platform adapter emit the same platform-neutral session events that `/events` already accepts.

Mission Control shows live work only when an agent signal source emits fresh session truth. The beacon is one such source.

## Operator Flow

Start a session:

```bash
npm run andon:session -- start --source local_cli --agent "Local Agent" --repo holistic --objective "Repair Mission Control session beacon"
```

Heartbeat while working:

```bash
npm run andon:session -- heartbeat --message "Working"
```

## Starting A New Assignment

`awaiting_assignment` is not a working state. It means the agent finished the previous task and is waiting for the operator to choose what comes next.

When the operator gives the next task, move the same session back to Running before analysis or edits:

```bash
npm run andon:session -- begin --message "Working on checkpoint validation"
```

`begin` and `resume` reuse the active local session, preserve its source/agent/repo metadata, emit `work.started` plus a fresh `session.heartbeat`, and verify that Mission Control derives Running. If Mission Control does not reflect Running, the command fails loudly instead of pretending the session is active. If no active local session exists, pass the same required fields as `start` or run `start` first.

Inspect the active local beacon session:

```bash
npm run andon:session -- inspect
```

Mark the current work complete when the task is done and the agent needs the operator to choose the next assignment:

```bash
npm run andon:session -- work-completed --message "Work is complete; awaiting next assignment"
```

Request review only when there is a concrete review or approval gate:

```bash
npm run andon:session -- request-review --message "Please inspect the UI behavior"
```

Request operator input:

```bash
npm run andon:session -- request-input --message "Need operator input"
```

Report failed validation or proof:

```bash
npm run andon:session -- validation-failed --message "Build failed"
```

Complete or park:

```bash
npm run andon:session -- complete --message "Work complete"
npm run andon:session -- park --message "Paused at a natural breakpoint"
```

Report an error:

```bash
npm run andon:session -- error --message "Runner failed unexpectedly"
```

## Local State

The beacon stores active session metadata in:

```text
.holistic-local/andon-session.json
```

That path is local-only and ignored in this public repo. It stores the active `sessionId`, source metadata, objective, repo, agent name, and latest local beacon state so heartbeat/work-completed/complete commands do not require retyping the session id.

If no active beacon state exists, pass `--session <id>` or run `start` first.

If heartbeat or status is attempted against stale local state, the command fails with a recovery message. Start a new session, park/complete the old session, or pass `--force` only when the old session is intentionally still active.

Use `begin` or `resume` when stale local state is intentionally still the session you are continuing.

## Same API Check

The dashboard uses `VITE_ANDON_API_BASE_URL`, defaulting to:

```text
http://127.0.0.1:4318
```

The beacon uses `ANDON_API_BASE_URL`, defaulting to the same URL. You can override the beacon target with:

```bash
npm run andon:session -- start --api http://127.0.0.1:4318 --source local_cli --agent "Local Agent" --repo holistic --objective "Repair Mission Control"
```

Every beacon command prints the API URL it used. `inspect` also shows the stored API URL for the active local session:

```bash
npm run andon:session -- inspect
```

The beacon and dashboard are aligned when:

- dashboard `VITE_ANDON_API_BASE_URL` equals beacon `API URL`
- `inspect` shows the intended active `sessionId`
- `GET /mission-control` shows one card for that `sessionId`

## Platform Neutrality

Use `--source` to identify the source type. Supported values include:

- `local_cli`
- `claude_code`
- `cursor`
- `codex`
- `chatgpt`
- `aider`
- `openhands`
- `jules`
- `github_copilot`
- `gsd`
- `symphony_runner`
- `custom`
- `unknown`

Unknown values are treated as `custom`. The beacon never defaults unknown sources or agents to Codex. Codex appears only when explicitly passed.

## Event Contract

The beacon emits telemetry to `POST /events` with platform-neutral event fields. Agents do not own canonical `primaryStatus`; Andon derives status from event sequence and freshness.

```json
{
  "sessionId": "local-cli-holistic-example",
  "runtime": "local_cli",
  "type": "session.heartbeat",
  "timestamp": "2026-05-02T18:00:00.000Z",
  "source": "system",
  "payload": {
    "source": "andon.session-beacon",
    "sourceId": "andon-beacon-local-cli-holistic",
    "sourceName": "local cli beacon",
    "sourceType": "local_cli",
    "transport": "http_events",
    "agentName": "Local Agent",
    "repo": "holistic",
    "repoPath": "D:/Projects/active/holistic",
    "worktreePath": "D:/Projects/active/holistic",
    "objective": "Repair Mission Control",
    "telemetryCommand": "heartbeat"
  }
}
```

Mission Control renders one card per top-level session from these events. Tasks, checkpoints, and replay events remain detail/replay data.

## Telemetry To Derived Status

- `work.started` plus fresh heartbeat derives Running.
- `work.completed` on an open session derives Awaiting Assignment when there is no unresolved input, review, or intervention.
- `input.requested` derives Needs Input until `input.resolved` or a superseding event.
- `review.requested` derives Needs Review until `review.resolved` or a superseding event.
- `validation.failed` derives Needs Intervention.
- `session.ended` derives Done / Historical.
- `session.parked` derives Parked / Idle or moves the session out of active Mission Control according to policy.

Heartbeat is liveness telemetry only. It does not override unresolved input, review, intervention, parked, or completed states.

Cold or missing runtime signal is shown as source-health metadata such as Cold Signal or Runtime Disconnected. It does not by itself derive Needs Intervention. Use `validation-failed`, `error`, or a future explicit intervention telemetry event when Lisa needs to investigate a real failure.

## Prove It Works

1. Start the Andon API:

   ```bash
   npm run andon:api
   ```

2. Start the dashboard:

   ```bash
   npm run andon:dashboard
   ```

3. Start a beacon session:

   ```bash
   npm run andon:session -- start --source local_cli --agent "Local Agent" --repo holistic --objective "Smoke test beacon"
   ```

4. Confirm Mission Control shows exactly one session card for that objective.
5. Send a heartbeat:

   ```bash
   npm run andon:session -- heartbeat --message "Working"
   ```

6. Mark work completed:

   ```bash
   npm run andon:session -- work-completed --message "Work is complete; awaiting next assignment"
   ```

7. Open Detail and confirm the same primary status appears there.
8. Start the next assignment:

   ```bash
   npm run andon:session -- begin --message "Working on the next assignment"
   ```

9. Confirm Mission Control changes back to Running.
10. Open Replay and confirm `session.started`, `session.heartbeat`, and the status event are visible.
11. Complete the session:

   ```bash
   npm run andon:session -- complete --message "Smoke complete"
   ```

12. Confirm Mission Control no longer shows it as active and History includes the session.
