# S02: Rules and API Test Coverage

**Goal:** Add automated coverage for the Andon status engine, recommendation engine, and core API flow so the MVP behavior proven in the live run is protected against regression.
**Demo:** After this: A focused Andon test command passes and covers rules decisions plus the active session, detail, timeline, and event-ingest API loop.

## Tasks
- [x] **T01: Add status and recommendation engine coverage** - Cover at least the highest-signal status paths with focused assertions.
  - Files: `tests/andon.test.ts`, `packages/andon-core/src/status-engine.ts`, `packages/andon-core/src/recommendation-engine.ts`
  - Verify: `npm run test:andon`
- [x] **T02: Add in-process API flow coverage** - Exercise the API handler against a temporary SQLite database and validate active session, detail, timeline, and ingest behavior.
  - Files: `tests/andon.test.ts`, `services/andon-api/src/server.ts`, `services/andon-api/src/repository.ts`
  - Verify: `npm run test:andon`
- [x] **T03: Expand coverage for more rule states** - Add follow-up cases for `blocked`, `awaiting_review`, `parked`, and Holistic scope risk signals.
  - Files: `tests/andon.test.ts`
  - Verify: `npm run test:andon`
- [x] **T04: Stop demo heartbeats after task completion** - Ensure the collector does not keep emitting a "still progressing" heartbeat once the session is awaiting review or parked.
  - Files: `services/andon-collector/src/index.ts`, `tests/andon.test.ts`
  - Verify: `npm run test:andon`

## Success Criteria

- Focused Andon tests run with one command
- Rules engine has regression coverage for key status paths
- API flow is covered without requiring an external server process
- Collector heartbeat behavior does not keep completed sessions artificially running
- The live-run bug around unreachable API state is not reintroduced silently
