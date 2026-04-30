# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

**MCP / Agent Protocol:**
- Model Context Protocol server - exposes Holistic tools to MCP clients.
  - SDK/Client: `@modelcontextprotocol/sdk` in `src/mcp-server.ts`.
  - Auth: Not detected (stdio transport, local process boundary).

**Internal HTTP APIs (service boundaries):**
- Andon API (`http://127.0.0.1:4318` default) - session/fleet/timeline/event ingestion for dashboard and collector.
  - Server: `services/andon-api/src/server.ts`.
  - Consumers: `apps/andon-dashboard/src/api.ts`, `services/andon-collector/src/index.ts`.
- Runtime Service (`http://127.0.0.1:4320` default) - runtime task orchestration, approvals, session control.
  - Server: `services/runtime-service/src/server.ts`.
  - Adapter boundary: `AgentRuntimeAdapter` via registry in `services/runtime-service/src/adapter-registry.ts`.

## Data Storage

**Databases:**
- SQLite (Node built-in `DatabaseSync`) shared schema/state.
  - Connection: `ANDON_DB_PATH` (`services/andon-api/src/config.ts`, `services/runtime-service/src/config.ts`).
  - Client: Node `node:sqlite`; repository access in `services/andon-api/src/repository.ts` and `services/andon-api/src/runtime-repository.ts`.

**File Storage:**
- Local filesystem only.
  - Holistic state/session JSON read for context bridge in `services/andon-api/src/holistic/file-bridge.ts`.

**Caching:**
- None detected (in-memory maps/sets only for active SSE clients and mock context data).

## Authentication & Identity

**Auth Provider:**
- Custom / none for local services.
  - Implementation: no token/session middleware detected; HTTP endpoints are local-network service endpoints with CORS `*` in `services/andon-api/src/server.ts` and `services/runtime-service/src/server.ts`.

## Monitoring & Observability

**Error Tracking:**
- None detected (no external Sentry/Datadog/etc. SDK usage in repository code).

**Logs:**
- Process stdout/stderr logging via `console.log`, `console.warn`, `console.error` across CLI and services (for example `src/cli.ts`, `services/andon-api/src/server.ts`).

## CI/CD & Deployment

**Hosting:**
- Local Node process execution model (no cloud provider deployment manifests detected).

**CI Pipeline:**
- GitHub Actions is referenced in badge/docs (`README.md`), but workflow implementation files were not part of the analyzed runtime/service surface in this pass.

## Environment Configuration

**Required env vars:**
- `HOLISTIC_REPO` (MCP/Andon bridge root resolution in `src/mcp-server.ts`, `services/andon-api/src/server.ts`).
- `ANDON_API_PORT`, `RUNTIME_SERVICE_PORT`, `ANDON_DB_PATH` (service ports and SQLite path).
- `ANDON_API_BASE_URL`, `VITE_ANDON_API_BASE_URL` (collector/dashboard API target).
- Optional mode switches: `ANDON_COLLECTOR_MODE`, `ANDON_SESSION_ID`, `ANDON_TASK_ID`, `ANDON_DISABLED`, `ANDON_DEBUG`.

**Secrets location:**
- No secret store integration detected; no `.env*` files detected in repository root during this scan.

## Webhooks & Callbacks

**Incoming:**
- Session callbacks endpoint in Andon API:
  - `POST /sessions/:sessionId/callbacks/:action` (`approve|pause|resume`) in `services/andon-api/src/server.ts`.
- Runtime action endpoints in Runtime Service:
  - `POST /runtime/sessions/:sessionId/(pause|resume|stop|approve|deny)` in `services/runtime-service/src/server.ts`.

**Outgoing:**
- Collector posts events to Andon API:
  - `POST /events` from `services/andon-collector/src/index.ts`.
- Dashboard subscribes to server-sent events:
  - `EventSource /sessions/stream` in `apps/andon-dashboard/src/api.ts`.

---

*Integration audit: 2026-04-29*
