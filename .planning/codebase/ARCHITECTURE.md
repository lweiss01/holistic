# Architecture

**Analysis Date:** 2026-04-29

## Pattern Overview

**Overall:** Layered TypeScript monorepo with repo-memory core plus Andon observability subsystems.

**Key Characteristics:**
- Shared domain contracts in `packages/*` are consumed by CLI, services, and UI.
- Runtime state and document generation are centralized in `src/core/*`.
- HTTP services (`services/andon-api`, `services/runtime-service`) expose read/write session control surfaces to the dashboard.

## Layers

**CLI and Session Orchestration Layer:**
- Purpose: Parse commands, orchestrate state mutations, and trigger docs/sync flows.
- Location: `src/cli.ts`, `src/daemon.ts`, `src/mcp-server.ts`
- Contains: Command handlers, daemon tick loop, MCP tool endpoints.
- Depends on: `src/core/state.ts`, `src/core/setup.ts`, `src/core/docs.ts`, `src/core/git.ts`
- Used by: `bin/holistic.js` and npm scripts in `package.json`.

**Core Runtime Layer:**
- Purpose: Persist Holistic state, enforce locking, render derived docs, and manage auto-sync/checkpoint logic.
- Location: `src/core/`
- Contains: State machine and session lifecycle (`state.ts`), setup/bootstrap (`setup.ts`), sync (`sync.ts`), git integration (`git.ts`), and Andon event helpers (`andon.ts`).
- Depends on: Node built-ins and repo-local runtime paths.
- Used by: CLI entrypoints, daemon, tests, and MCP server.

**Shared Domain Layer:**
- Purpose: Define portable runtime/session/event types and decision engines.
- Location: `packages/andon-core/src/`, `packages/runtime-core/src/`, `packages/runtime-local/src/`, `packages/holistic-bridge-types/src/`
- Contains: Session status/recommendation engines, runtime adapter interfaces, local runtime adapter implementation, Holistic bridge contracts.
- Depends on: TypeScript-only package boundaries.
- Used by: `services/andon-api`, `services/runtime-service`, `apps/andon-dashboard`, and tests.

**Andon API and Runtime Services Layer:**
- Purpose: Store/query session telemetry and runtime control state via SQLite-backed HTTP APIs.
- Location: `services/andon-api/src/`, `services/runtime-service/src/`
- Contains: REST handlers, SSE broadcast loops, repository/query modules, runtime adapter registry.
- Depends on: Shared packages (`packages/andon-core`, `packages/runtime-core`, `packages/runtime-local`) plus `services/andon-api/src/runtime-repository.ts`.
- Used by: Dashboard frontend and collector; daemon can start Andon API/dashboard processes.

**Collector and Dashboard Layer:**
- Purpose: Ingest runtime events and render operator-facing mission control views.
- Location: `services/andon-collector/src/`, `apps/andon-dashboard/src/`
- Contains: Collector event normalization/posting, React routes/components, API client, mission-control view-model derivation.
- Depends on: Andon API endpoints and shared type packages.
- Used by: Human operator workflow for monitoring, intervention, and replay.

## Data Flow

**Holistic Session Flow:**
1. CLI/MCP/daemon invokes state transitions through `src/core/state.ts`.
2. Updated state is persisted and derived docs are written via `src/core/docs.ts`.
3. Optional auto-sync is scheduled via `src/core/sync.ts`.

**Andon Event Ingestion Flow:**
1. Collector posts `AgentEvent` payloads to `POST /events` in `services/andon-api/src/server.ts`.
2. Repository writes sessions/tasks/events in `services/andon-api/src/repository.ts`.
3. API broadcasts a lightweight SSE `session_update`; UI refetches detail endpoints.

**Runtime Control Flow:**
1. Runtime service receives `POST /runtime/tasks` in `services/runtime-service/src/server.ts`.
2. Adapter registry dispatches to runtime adapters (`packages/runtime-local/src/LocalRuntimeAdapter.ts` by default).
3. Runtime session/events/approvals are persisted in `services/andon-api/src/runtime-repository.ts` and streamed to clients.

**UI Read Flow:**
1. Dashboard API client (`apps/andon-dashboard/src/api.ts`) calls `/fleet`, `/sessions`, `/sessions/:id`, and timeline routes.
2. `App.tsx` builds mission-control view models (`mission-control-view-model.ts`) and applies filtering/sorting.
3. Operator actions post callbacks (`approve/pause/resume`) back to API routes.

**State Management:**
- Holistic state lives under `.holistic/` (or `.holistic-local/` when repo runtime overrides apply) and is read/mutated through `getRuntimePaths`, `loadState`, and `saveState` in `src/core/state.ts`.
- Andon operational state lives in SQLite accessed through `services/andon-api/src/db.ts` and `services/runtime-service/src/db.ts`.

## Key Abstractions

**Session State Machine:**
- Purpose: Represent active session, handoff, checkpoints, pending work, and passive capture.
- Examples: `src/core/state.ts`, `src/core/types.ts`
- Pattern: Pure-transition functions wrapped with filesystem lock/persist boundaries.

**Holistic Bridge:**
- Purpose: Resolve additional contextual grounding for session detail endpoints.
- Examples: `services/andon-api/src/holistic/file-bridge.ts`, `services/andon-api/src/holistic/mock-bridge.ts`, `packages/holistic-bridge-types/src/index.ts`
- Pattern: Interface + environment-driven implementation fallback.

**Runtime Adapter Contract:**
- Purpose: Standardize task start/stop/pause/resume and event streaming across runtimes.
- Examples: `packages/runtime-core/src/adapter.ts`, `packages/runtime-local/src/LocalRuntimeAdapter.ts`, `services/runtime-service/src/adapter-registry.ts`
- Pattern: Registry of adapters selected by `runtimeId`.

## Entry Points

**CLI entrypoint:**
- Location: `src/cli.ts`
- Triggers: `holistic` command (`package.json` bin + scripts).
- Responsibilities: Command parsing, session lifecycle orchestration, diagnostics, handoff/checkpoint flows.

**Daemon entrypoint:**
- Location: `src/daemon.ts`
- Triggers: `holistic daemon`, startup hooks, or explicit watch workflows.
- Responsibilities: Passive capture ticks, auto-checkpointing, optional Andon process startup.

**MCP entrypoint:**
- Location: `src/mcp-server.ts`
- Triggers: `holistic serve` and MCP client initialization.
- Responsibilities: Expose `holistic_resume`, `holistic_slash`, `holistic_checkpoint`, `holistic_handoff`.

**Andon API entrypoint:**
- Location: `services/andon-api/src/server.ts`
- Triggers: `npm run andon:api` or daemon auto-start.
- Responsibilities: Session/fleet/timeline/event APIs plus SSE update stream.

**Runtime service entrypoint:**
- Location: `services/runtime-service/src/server.ts`
- Triggers: Runtime service process startup.
- Responsibilities: Runtime session lifecycle APIs, approvals, adapter event ingestion.

**Dashboard entrypoint:**
- Location: `apps/andon-dashboard/src/main.tsx`
- Triggers: Vite dev/build runtime.
- Responsibilities: Mount React app and render mission-control UI flows.

## Error Handling

**Strategy:** Boundary-level try/catch with structured JSON error responses in services and explicit stderr failures in CLI/daemon.

**Patterns:**
- HTTP routes return `{ error: ... }` with 4xx/5xx status in `services/andon-api/src/server.ts` and `services/runtime-service/src/server.ts`.
- CLI handlers return non-zero exit codes and explicit messages (`src/cli.ts`).
- Stream consumers swallow adapter stream failures to keep service alive (`consumeAdapterStream` in `services/runtime-service/src/server.ts`).

## Cross-Cutting Concerns

**Logging:** Console-based operational logs in entrypoints (`src/cli.ts`, `src/daemon.ts`, `services/*/src/server.ts`).
**Validation:** Lightweight runtime validation using explicit field checks and type narrowing (for example `ensureRuntimeTaskInput` in `services/runtime-service/src/server.ts`).
**Authentication:** Not detected; services expose local HTTP endpoints without auth middleware.

---

*Architecture analysis: 2026-04-29*
