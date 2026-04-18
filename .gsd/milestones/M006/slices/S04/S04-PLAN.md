# S04: Multi-Session Historical Analytics

**Goal:** Evolve the dashboard to allow developers to browse and supervise all historical agents, handoffs, and parked sessions in a unified historical monitor tab.

## Tasks
- [ ] **T01: API Repository & Route** - Implement `getSessionsList` in `andon-api/src/repository.ts`, then expose it as `GET /sessions` in `server.ts`.
- [ ] **T02: Dashboard API Bindings** - Introduce `fetchSessions` into `andon-dashboard/src/api.ts`.
- [ ] **T03: UX Migration** - Refactor `App.tsx` state to hold `currentView: 'monitor' | 'history'`.
- [ ] **T04: History Table Component** - Build a real-time reactive table reflecting all fetched past sessions and trigger UX flow on SSE Pings.
