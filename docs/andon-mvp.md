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

## OpenHarness Fit

OpenHarness looks like a strong runtime source for Andon, but not a required dependency for the first MVP.

- Holistic remains the grounding layer for objective, constraints, prior attempts, and expected scope.
- Andon stays runtime-agnostic at the core and stores normalized events in SQLite.
- The collector can ingest OpenHarness `stream-json` output or hook-derived tool lifecycle events and convert them into the shared Andon event model.
- This keeps the MVP single-agent and local-first while leaving room for richer orchestration later.
