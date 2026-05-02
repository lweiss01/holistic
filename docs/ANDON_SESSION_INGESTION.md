# Andon Session Ingestion

Andon Mission Control is platform-agnostic. It can only show live agent sessions from sources that emit valid Andon session events or heartbeats.

Codex, ChatGPT desktop, Claude Code, Cursor, Aider, OpenHands, Jules, GitHub Copilot coding agents, GSD scripts, Symphony-style runners, local CLI agents, and manual heartbeat writers are all just possible agent signal sources. None of them are visible by default. A source becomes visible when it registers session truth through the Andon event contract.

## Agent Signal Sources

An agent signal source is any adapter, runner, writer, or platform bridge that can report session lifecycle and liveness.

Source summaries use:

- `sourceId`: stable identifier for the adapter or runner
- `sourceName`: human-readable source name
- `sourceType`: platform or adapter family, such as `local_cli`, `claude_code`, `cursor`, `file_heartbeat`, or `custom`
- `platform`: optional platform name when it differs from the source type
- `transport`: `http_events`, `file_state`, `cli_writer`, `websocket`, `webhook`, `database`, or `unknown`
- `status`: `active`, `idle`, `stale`, `disconnected`, `uninstrumented`, `unknown`, or `error`
- `lastSignalAt`: latest session signal observed from this source
- `lastHeartbeatAt`: latest heartbeat observed from this source
- `capabilities`: optional event capabilities
- `reason`: optional diagnostic explanation

## Visibility Rules

Mission Control must distinguish source visibility from session status.

- No registered sources: no source has emitted or registered session signals.
- Connected but idle: a source is connected, but no top-level session currently belongs on Mission Control.
- Stale: a source has emitted signals, but they are too old to trust as current.
- Disconnected: a source signal is expired or absent.
- Uninstrumented: a source/platform is known, but not emitting Andon session signals.
- Active: one or more top-level sessions are backed by fresh source truth.
- Historical-only: sessions exist only in History.

Mission Control must not show a healthy/green empty state unless fresh source truth supports active sessions. A visible session card must map to one top-level agent workflow/session, not a task, checkpoint, summary, mirror event, or maintenance artifact.

## Current Sources

The current repo has these ingestion paths:

- `POST /events`: platform-neutral HTTP event ingestion.
- `scripts/andon-runtime-writer.mjs`: a file-state/CLI writer that reads Holistic local state and emits Andon events. It is one source, not the source model.
- `services/runtime-service`: adapter-driven runtime service for runtime sessions.
- Legacy `sessions` / `events`: compatibility and history, not authoritative live session truth.

No instrumentation means no live visibility. If a platform cannot emit events or heartbeats yet, Mission Control should say so instead of guessing.
