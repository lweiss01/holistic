# S01: Real-Time Integration (SSE)

**Goal:** Provide an instantly updating dashboard without manual refreshes.

## Tasks
- [ ] **T01: API Event Stream Endpoint** - Create a `GET /sessions/stream` endpoint in `server.ts` that acts as a Server-Sent Events (SSE) source.
- [ ] **T02: Broadcast Pings** - Update the `POST /events` ingest endpoint so it iterates over all active SSE client connections and flushes a `ping` payload when new events arrive.
- [ ] **T03: Dashboard Hook** - Implement an `EventSource` connection in `App.tsx` that triggers the `loadData()` reload callback upon receiving a ping from the API.

## Success Criteria
- Opening the dashboard establishes a continuous connection.
- When `npm run andon:collector` is executed (mocking a heartbeat), the dashboard UI automatically refreshes timeline and session timing without manual user intervention.
