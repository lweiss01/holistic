# Codebase Concerns

**Analysis Date:** 2026-04-29

## Tech Debt

**Monolithic custom test harness and oversized test modules:**
- Issue: A single runner aggregates all suites in one process, and some files are very large, increasing maintenance cost and masking isolation issues.
- Files: `tests/run-tests.ts`, `tests/andon.test.ts`
- Impact: Slower debugging, harder targeted ownership, and elevated risk of hidden cross-test coupling.
- Fix approach: Split `tests/andon.test.ts` by bounded domains (API/repository/status-engine), and move `tests/run-tests.ts` orchestration into per-package scripts with smaller entrypoints.

**Experimental runtime dependency for core scripts:**
- Issue: Production-critical commands rely on `node --experimental-strip-types` and Node `>=24.0.0`.
- Files: `package.json`
- Impact: Environment drift can break bootstrap/test flows on machines pinned to LTS defaults.
- Fix approach: Compile TypeScript before execution (`dist/`) for operational commands, reserving experimental flags for local dev only.

## Known Bugs

**Runtime stream failures are silently dropped:**
- Symptoms: Runtime event streaming can stop updating with no surfaced error when adapter streams throw.
- Files: `services/runtime-service/src/server.ts`
- Trigger: Exceptions from `adapter.streamEvents(sessionId)` are swallowed in `consumeAdapterStream`.
- Workaround: Restart runtime service/session and inspect persisted runtime tables for stale state.

## Security Considerations

**Unauthenticated localhost control endpoints with permissive CORS:**
- Risk: Any local webpage can issue cross-origin requests to mutate runtime/session state if browser can reach localhost service ports.
- Files: `services/andon-api/src/server.ts`, `services/runtime-service/src/server.ts`
- Current mitigation: Services bind to `127.0.0.1` only.
- Recommendations: Require a local auth token/header for mutating routes (`POST /events`, callbacks, runtime actions) and restrict CORS origins by explicit allowlist.

## Performance Bottlenecks

**High per-request event loads for status/recommendation derivation:**
- Problem: Detail endpoints load large event tails for every request.
- Files: `services/andon-api/src/repository.ts`
- Cause: `MAX_EVENTS_FOR_RULES = 8000` and repeated `getEventsTailForRules` calls in `buildSessionDetail`.
- Improvement path: Cap default to smaller windows, precompute rollups, and cache derived status per session with invalidation on new event insert.

**Timeline endpoints permit very large pages:**
- Problem: Timeline reads can request up to 10,000 rows and UI repeatedly fetches large pages.
- Files: `services/andon-api/src/repository.ts`, `apps/andon-dashboard/src/App.tsx`
- Cause: `MAX_TIMELINE_LIMIT = 10_000` with paged fetch/render loops.
- Improvement path: Lower max page size, add cursor pagination, and return lightweight summaries for history views.

## Fragile Areas

**Event type to runtime status mapping is hand-maintained and brittle:**
- Files: `services/runtime-service/src/server.ts`
- Why fragile: `runtimeStatusFromEventType` is a manual switch-like chain that can drift as new event types are introduced.
- Safe modification: Centralize event/status contract in shared types and enforce exhaustive mapping tests.
- Test coverage: Needs explicit tests for unknown/new event types and downgrade/upgrade transitions.

## Scaling Limits

**Single-process in-memory SSE fanout:**
- Current capacity: Per-process `Set<ServerResponse>` tracking in API/runtime servers.
- Limit: Process-bound fanout and no brokered backpressure for many concurrent dashboard clients.
- Scaling path: Introduce a message bus/pub-sub boundary and externalize stream state for multi-instance deployments.

## Dependencies at Risk

**Node experimental TypeScript execution path:**
- Risk: Behavior of `--experimental-strip-types` can change across Node versions.
- Impact: CLI/service/test startup regressions and inconsistent local/CI execution.
- Migration plan: Ship precompiled JS artifacts for runtime code paths and pin tested Node versions in CI matrix.

## Missing Critical Features

**No authorization layer for operator actions:**
- Problem: Approval/pause/resume callbacks and runtime actions are accepted without identity checks.
- Blocks: Safe exposure beyond strictly trusted local development environments.

## Test Coverage Gaps

**Operational resilience paths are under-tested:**
- What's not tested: Explicit failure/alert paths for runtime stream errors and API mutation authorization controls.
- Files: `services/runtime-service/src/server.ts`, `services/andon-api/src/server.ts`, `tests/runtime-service.test.ts`, `tests/andon.test.ts`
- Risk: Silent degradation or unauthorized local control can ship unnoticed.
- Priority: High

---

*Concerns audit: 2026-04-29*
