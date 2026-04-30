# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```text
holistic/
├── src/                     # Holistic CLI, daemon, MCP server, and core runtime logic
├── services/                # HTTP backends (Andon API, collector, runtime service)
├── apps/                    # Frontend application(s), currently Andon dashboard
├── packages/                # Shared domain/runtime packages consumed across app/services
├── tests/                   # Root test suites and custom test runner
├── scripts/                 # Build, release, smoke, and Andon bootstrap utilities
├── docs/                    # Product and roadmap documentation
├── .planning/               # Planning artifacts and codebase mapping docs
├── bin/                     # CLI launch wrappers
└── package.json             # Workspace-level scripts and dependency surface
```

## Directory Purposes

**`src/`:**
- Purpose: Main product runtime and orchestration code.
- Contains: `cli.ts`, `daemon.ts`, `mcp-server.ts`, and `core/*`.
- Key files: `src/cli.ts`, `src/daemon.ts`, `src/mcp-server.ts`, `src/core/state.ts`.

**`services/andon-api/`:**
- Purpose: Session/fleet/timeline/event backend for Andon.
- Contains: HTTP server, repository and DB access, Holistic bridge adapters, SQL migration.
- Key files: `services/andon-api/src/server.ts`, `services/andon-api/src/repository.ts`, `services/andon-api/src/runtime-repository.ts`, `services/andon-api/sql/001_initial.sql`.

**`services/runtime-service/`:**
- Purpose: Runtime task execution control plane and adapter event stream fan-out.
- Contains: Runtime REST server, adapter registry, runtime freshness helpers.
- Key files: `services/runtime-service/src/server.ts`, `services/runtime-service/src/adapter-registry.ts`, `services/runtime-service/src/runtime-freshness.ts`.

**`services/andon-collector/`:**
- Purpose: Event collector that normalizes runtime/stream inputs and posts them to Andon API.
- Contains: Collector CLI and OpenHarness adapter.
- Key files: `services/andon-collector/src/index.ts`, `services/andon-collector/src/openharness-adapter.ts`.

**`apps/andon-dashboard/`:**
- Purpose: Operator-facing mission-control React frontend.
- Contains: React routes/components, API client, presentation styles.
- Key files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/api.ts`, `apps/andon-dashboard/src/mission-control-view-model.ts`, `apps/andon-dashboard/src/main.tsx`.

**`packages/`:**
- Purpose: Reusable contracts and decision logic shared by runtime, services, and UI.
- Contains: `andon-core`, `runtime-core`, `runtime-local`, `holistic-bridge-types`.
- Key files: `packages/andon-core/src/index.ts`, `packages/runtime-core/src/index.ts`, `packages/runtime-local/src/index.ts`, `packages/holistic-bridge-types/src/index.ts`.

**`tests/`:**
- Purpose: Integration-style and unit-style regression coverage for CLI/runtime/Andon.
- Contains: Root test modules and orchestrator runner.
- Key files: `tests/run-tests.ts`, `tests/andon.test.ts`, `tests/runtime-service.test.ts`, `tests/mission-control-view-model.test.ts`.

## Key File Locations

**Entry Points:**
- `src/cli.ts`: Primary CLI command dispatcher and lifecycle handler.
- `src/daemon.ts`: Long-running passive capture daemon.
- `src/mcp-server.ts`: MCP server and tool adapters.
- `services/andon-api/src/server.ts`: Andon backend HTTP entry.
- `services/runtime-service/src/server.ts`: Runtime control HTTP entry.
- `services/andon-collector/src/index.ts`: Collector process entry.
- `apps/andon-dashboard/src/main.tsx`: Dashboard frontend bootstrapping.

**Configuration:**
- `package.json`: Workspace scripts, engines, dependencies.
- `apps/andon-dashboard/vite.config.ts`: Dashboard build/dev config.
- `apps/andon-dashboard/tsconfig.json`, `services/*/tsconfig.json`, `packages/*/tsconfig.json`: TypeScript project configs.

**Core Logic:**
- `src/core/state.ts`: Session state machine and persistence.
- `src/core/setup.ts`: Bootstrap/repair/setup checks.
- `src/core/docs.ts`: Derived documentation generation.
- `services/andon-api/src/repository.ts`: Andon read/write domain queries and scoring.
- `services/andon-api/src/runtime-repository.ts`: Runtime SQLite persistence helpers.
- `apps/andon-dashboard/src/mission-control-view-model.ts`: UI-level sorting/filtering/attention logic.

**Testing:**
- `tests/`: Root test suites.
- `src/__tests__/`: Focused tests near source for selected modules.

## Naming Conventions

**Files:**
- Lowercase kebab-case for multiword module filenames (`mission-control-view-model.ts`, `runtime-freshness.ts`).
- `index.ts` used as package entry files (`packages/*/src/index.ts`).
- `.test.ts` suffix for tests (`tests/runtime-service.test.ts`).

**Directories:**
- Domain-oriented top-level directories (`apps`, `services`, `packages`, `src`, `tests`).
- Subsystems grouped by deployable/runtime concern (`services/andon-api`, `services/runtime-service`, `services/andon-collector`).

## Where to Add New Code

**New Feature:**
- Primary code: `src/core/` for Holistic CLI/runtime behavior; `services/andon-api/src/` or `services/runtime-service/src/` for Andon/runtime APIs; `apps/andon-dashboard/src/` for UI.
- Tests: `tests/` for integration/regression paths, plus `src/__tests__/` for focused unit coverage.

**New Component/Module:**
- Implementation: Add React view or view-model modules in `apps/andon-dashboard/src/`, API handlers in `services/*/src/`, and shared contracts in `packages/*/src/`.

**Utilities:**
- Shared helpers: Prefer colocating under owning subsystem (`src/core/`, `services/*/src/`, `apps/andon-dashboard/src/`) and promote to `packages/` only when needed by multiple subsystems.

## Special Directories

**`.holistic/`:**
- Purpose: Runtime state, generated context docs, sessions, and machine helper artifacts.
- Generated: Yes.
- Committed: Yes in normal repos; this repo also uses `.holistic-local/` for self-dogfooding runtime state.

**`.holistic-local/`:**
- Purpose: Local-only runtime state during dogfooding on this public repo.
- Generated: Yes.
- Committed: No.

**`.planning/codebase/`:**
- Purpose: Generated architecture/quality/stack mapping docs consumed by GSD planning/execution flows.
- Generated: Yes.
- Committed: Yes.

**`.gsd/`:**
- Purpose: Milestone/slice/task planning artifacts.
- Generated: Yes.
- Committed: Yes.

---

*Structure analysis: 2026-04-29*
