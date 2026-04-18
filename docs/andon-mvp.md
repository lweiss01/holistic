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
4. Start the API with `npm run andon:api`.
5. Start the dashboard with `npm run andon:dashboard`.

## OpenHarness Fit

OpenHarness looks like a strong runtime source for Andon, but not a required dependency for the first MVP.

- Holistic remains the grounding layer for objective, constraints, prior attempts, and expected scope.
- Andon stays runtime-agnostic at the core and stores normalized events in SQLite.
- The collector can ingest OpenHarness `stream-json` output or hook-derived tool lifecycle events and convert them into the shared Andon event model.
- This keeps the MVP single-agent and local-first while leaving room for richer orchestration later.
