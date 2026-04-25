# Andon MVP

Andon is a local-first supervision layer that sits on top of Holistic. This MVP keeps the first slice intentionally small:

- one active agent session
- one repo/worktree
- SQLite-backed event history
- a rules-based status engine
- a React dashboard for active session, timeline, and detail views

## Workspace Layout

- `apps/andon-dashboard` - React dashboard
- `services/andon-api` - Node API and SQLite access
- `services/andon-collector` - simple event collector shim
- `packages/andon-core` - shared domain models and rules engines
- `packages/holistic-bridge-types` - Holistic grounding contracts

## Local Run Plan

1. Install workspace dependencies from the repo root.
2. Run `npm run andon:db:migrate`.
3. Run `npm run andon:db:seed`.
4. Start the API with `npm run andon:api` (optional: set `HOLISTIC_REPO` to an absolute path of a Holistic bootstrapped repo so the API loads real grounding from `.holistic/state.json` instead of the mock bridge).
5. Start the dashboard with `npm run andon:dashboard`.

### Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `HOLISTIC_REPO` | Andon API process | File-backed Holistic bridge; if missing or not a directory, the mock bridge is used. |
| `ANDON_API_BASE_URL` | Holistic CLI | Target for lifecycle events emitted from `src/core/andon.ts` (default `http://127.0.0.1:4318`). |
| `ANDON_DISABLED` | Holistic CLI | Set to `true` to disable outbound Andon posts. |
| `ANDON_DEBUG` | Holistic CLI | Log Andon POST failures. |
| `VITE_ANDON_API_BASE_URL` | Dashboard (`npm run dev`) | API base URL for browser fetches (default `http://127.0.0.1:4318`). |

### Timeline API (`GET /sessions/:id/timeline`)

Query parameters (all optional):

- `limit` — page size (default 500, max 10000).
- `offset` — skip this many oldest events (chronological paging).
- `tail` — when set, return only the **last** N events (overrides `offset`; `limit` is derived). Used by the live monitor for a small “last events” strip.

Responses include `total`, `hasMore`, `limit`, and `offset` so clients can load older pages without scanning the full history.

### Active session and detail (`GET /sessions/active`, `GET /sessions/:id`)

Both responses include a **`supervision`** object when a session is loaded:

- `lastMeaningfulEventAt` — ISO timestamp of the latest event that counts as a forward-motion signal (idle-only tails fall back to the newest event).
- `supervisionSeverity` — one of `info` | `low` | `medium` | `high` | `critical`, derived from session status and recommendation urgency for dashboard attention routing.

`GET /sessions/active` returns `supervision: null` when there is no open session.

The **session** row also carries **`last_summary`**, updated on each ingested `agent.summary_emitted`. The dashboard can show that as an optional “latest agent summary” line alongside the open **task title** / session **objective** from Andon’s registry (live layer). Per the design spec, **Holistic is the context layer** (intent, continuity, checkpoints): the UI shows it in a **separate grounded section**, not as a substitute for **Layer 1–2** runtime adapters that must still emit tasks and events into Andon.

## OpenHarness (agent runtime tracking)

For **Layer 1–2** in the design spec (agent runtimes + event capture/normalization), this repo treats **[OpenHarness](https://github.com/HKUDS/OpenHarness)** (HKUDS / *Open Agent Harness*) as the primary **reference harness**: live agent activity, tool lifecycle, and stream-shaped telemetry that should feed Andon’s SQLite event model.

- OpenHarness is **not** required to boot the Andon MVP (seed + Holistic CLI events still work), but it is the **intended** integration path for accurate, low-latency **task titles**, summaries, and tool/file events on the dashboard.
- Holistic remains the **context** layer (objective, constraints, continuity); OpenHarness supplies **runtime** signals; Andon normalizes and supervises.
- The collector’s [`openharness-adapter`](../services/andon-collector/src/openharness-adapter.ts) maps OpenHarness-style payloads into shared `AgentEvent` types; extend it as the upstream stream format stabilizes.
