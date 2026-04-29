# Andon MVP

Andon is a local-first supervision layer that sits on top of Holistic.
The current in-repo MVP is intentionally small and serves as the baseline for a runtime-first fleet program.

Current MVP scope:

- one active agent session
- one repo or worktree view at a time
- SQLite-backed event history
- a rules-based status engine
- a React dashboard for active session, timeline, and detail views

## Workspace Layout

Current baseline:

- `apps/andon-dashboard` - React dashboard
- `services/andon-api` - Node API and SQLite access
- `services/andon-collector` - simple event collector shim
- `packages/andon-core` - shared domain models and rules engines
- `packages/holistic-bridge-types` - Holistic grounding contracts

Runtime-first additions planned by the milestone realignment:

- `packages/runtime-core` - canonical runtime types, events, adapters, and capabilities
- `packages/runtime-local` - first local runtime adapter
- `services/runtime-service` - runtime control-plane API

## Local Run Plan

### Recommended: one command for local dev

From the repo root:

```bash
npm run andon:dev
```

This will:

- run the DB migration
- reuse an already-running Andon API when one is healthy on `127.0.0.1:4318`
- otherwise start the API with `HOLISTIC_REPO` defaulted to the current repo
- start the dashboard with the API URL wired in

### Manual startup

1. Install workspace dependencies from the repo root.
2. Run `npm run andon:db:migrate`.
3. Run `npm run andon:db:seed`.
4. Start the API with `npm run andon:api`.
   When launched from the repo root, the API now defaults `HOLISTIC_REPO` to the current repo if it is not set.
   Optional: explicitly set `HOLISTIC_REPO` to an absolute path of a Holistic-enabled repo so the API loads real grounding from `.holistic/state.json` instead of the mock bridge.
5. Start the dashboard with `npm run andon:dashboard`.

If port `4318` is already occupied by a healthy Andon API, `npm run andon:api` now exits cleanly and tells you to reuse the existing backend instead of throwing a raw `EADDRINUSE` stack trace.

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `HOLISTIC_REPO` | Andon API process | File-backed Holistic bridge; if missing or not a directory, the mock bridge is used. |
| `ANDON_API_BASE_URL` | Holistic CLI | Target for lifecycle events emitted from `src/core/andon.ts` (default `http://127.0.0.1:4318`). |
| `ANDON_DISABLED` | Holistic CLI | Set to `true` to disable outbound Andon posts. |
| `ANDON_DEBUG` | Holistic CLI | Log Andon POST failures. |
| `VITE_ANDON_API_BASE_URL` | Dashboard (`npm run dev`) | API base URL for browser fetches (default `http://127.0.0.1:4318`). |

## Current API Baseline

### Timeline API (`GET /sessions/:id/timeline`)

Query parameters (all optional):

- `limit` - page size (default 500, max 10000)
- `offset` - skip this many oldest events
- `tail` - return only the last N events for compact live strips

Responses include `total`, `hasMore`, `limit`, and `offset` so clients can load older pages without scanning the full history.

### Active session and detail (`GET /sessions/active`, `GET /sessions/:id`)

Both responses include a `supervision` object when a session is loaded:

- `lastMeaningfulEventAt` - latest event that counts as forward-motion signal
- `supervisionSeverity` - `info`, `low`, `medium`, `high`, or `critical`

The session row also carries `last_summary`, updated on each ingested `agent.summary_emitted`.
The UI should treat that as runtime-layer support data and keep Holistic grounding as a separate labeled section.

## Runtime-first realignment

The next major steps are now:

1. **M006 - Runtime Core and Persistence**
   `runtime-core`, runtime SQLite tables, and `runtime-repository` are in-repo; Andon HTTP still uses the MVP `sessions`/`events` path until M007 wires the runtime store. Status: [.gsd/milestones/M006/M006-RECONCILIATION.md](../.gsd/milestones/M006/M006-RECONCILIATION.md).
2. **M007 - Runtime Service and Local Adapter**
   Add `runtime-service`, local process orchestration, NDJSON events, and heartbeats.
3. **M008 - Guardrails, Approvals, and Worktree Isolation**
   Add approval gating, process safety, and isolated worktrees.
4. **M009 - Fleet Intelligence**
   Add derived activity, ranking, stall and failure detection, and drift reasoning.
5. **M010 - Mission Control UX**
   Add `GET /fleet` and rebuild `/` into the fleet homepage.

## Runtime adapters and event sources

Holistic now owns the runtime protocol in this repo.
That means external harnesses are adapters into Holistic's contract, not the other way around.

- The first shipped runtime is `runtime-local`.
- OpenHarness remains a useful later adapter target and event-shape reference.
- Codex, Claude Code, and custom runtimes should also map into the same normalized runtime session and event model.
- Natural-language logs remain helpful for humans, but structured NDJSON events are the preferred machine path.

The collector's existing `openharness-adapter` remains useful as a compatibility path and fixture source, but it is no longer the primary architectural owner of Layers 1-2.

## UX direction

The current dashboard is a good single-session baseline, but it is not the end state.
The eventual root route `/` should become a Mission Control homepage with:

- Fleet Header
- Attention Queue
- Agent Grid
- Activity Heatmap
- Recent Signals Rail

The existing detail routes remain useful drill-down surfaces:

- `/session/:id`
- `/session/:id/timeline`
- `/history`
