# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript (ES2024 target) - CLI/runtime code in `src/`, service code in `services/`, shared models in `packages/`, dashboard code in `apps/andon-dashboard/src/`.

**Secondary:**
- JavaScript (ESM `.mjs`) - operational scripts in `scripts/`.
- SQL (SQLite schema) - schema bootstrap in `services/andon-api/sql/001_initial.sql`.

## Runtime

**Environment:**
- Node.js >=24.0.0 (required by `package.json` engines); local HTTP services run on loopback.
- Browser runtime for dashboard served by Vite (`apps/andon-dashboard`).

**Package Manager:**
- npm (root scripts in `package.json`; nested package scripts in app/service/package manifests).
- Lockfile: present (`package-lock.json`, plus app-local `apps/andon-dashboard/package-lock.json`).

## Frameworks

**Core:**
- Node.js built-ins (`node:http`, `node:sqlite`, `node:fs`, `node:child_process`) - backend/service and CLI runtime (`services/andon-api/src/server.ts`, `services/runtime-service/src/server.ts`, `src/cli.ts`).
- MCP SDK (`@modelcontextprotocol/sdk`) - MCP tool server transport/handlers in `src/mcp-server.ts`.
- React 19 + ReactDOM 19 - dashboard UI in `apps/andon-dashboard/src/`.

**Testing:**
- Custom Node TypeScript test runner via `node --experimental-strip-types ./tests/run-tests.ts` (`package.json` script `test`).

**Build/Dev:**
- TypeScript 5.9 (`tsc`) - package/service type builds and declarations.
- Vite 7 + `@vitejs/plugin-react` - frontend dev/build in `apps/andon-dashboard`.
- Node `--experimental-strip-types` execution model - TS execution for CLI/services/tests without separate transpile step.

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` - exposes Holistic MCP tools (`holistic_resume`, `holistic_checkpoint`, etc.) in `src/mcp-server.ts`.
- `react` / `react-dom` - mission-control dashboard rendering in `apps/andon-dashboard/src/App.tsx`.

**Infrastructure:**
- `typescript` and `@types/node` - type checking/build contract across monorepo-style packages.
- Image utility dev deps (`jimp`, `pngjs`, `gif-encoder-2`, `omggif`) - present in root manifest for script/test tooling usage.

## Configuration

**Environment:**
- Runtime configured primarily by environment variables read directly in code:
  - API/service ports and DB path: `ANDON_API_PORT`, `RUNTIME_SERVICE_PORT`, `ANDON_DB_PATH` (`services/andon-api/src/config.ts`, `services/runtime-service/src/config.ts`).
  - Service wiring: `ANDON_API_BASE_URL`, `VITE_ANDON_API_BASE_URL`, `HOLISTIC_REPO` (`scripts/andon-dev.mjs`, `apps/andon-dashboard/src/api.ts`, `services/andon-api/src/server.ts`).
  - Runtime behavior switches: `ANDON_COLLECTOR_MODE`, `ANDON_SESSION_ID`, `ANDON_TASK_ID`, `ANDON_DEBUG`, `ANDON_DISABLED`.

**Build:**
- Root TS config in `tsconfig.json` (`module`/`moduleResolution`: `NodeNext`, strict mode on).
- Service/package-level TS configs in `services/*/tsconfig.json` and `packages/*/tsconfig.json`.
- Frontend build config in `apps/andon-dashboard/vite.config.ts`.

## Platform Requirements

**Development:**
- Node.js 24+ with npm.
- Local loopback networking on ports 4318 (Andon API), 4320 (runtime service), 5173 (dashboard default dev server).
- File-system write access for local SQLite DB at `services/andon-api/data/andon.sqlite`.

**Production:**
- Not detected as cloud deployment target in-repo; current implementation is local-first process deployment via Node scripts (`package.json`, `scripts/andon-dev.mjs`).

---

*Stack analysis: 2026-04-29*
