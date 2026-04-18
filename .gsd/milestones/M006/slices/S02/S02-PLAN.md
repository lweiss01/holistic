# S02: Interactive Callbacks & Remediation

**Goal:** Close the loop by sending human steering commands ("Approve", "Pause", "Resume") back to the agent session via the dashboard.

## Tasks
- [ ] **T01: Extend Event Types** - Introduce `user.resumed` to `packages/andon-core/src/types.ts` to allow waking parked sessions without tricking the rules engine.
- [ ] **T02: Webhook API Routes** - Add custom POST hooks for `/callbacks/approve`, `/callbacks/pause`, and `/callbacks/resume` into `services/andon-api/src/server.ts` that synthesize state-changing events.
- [ ] **T03: Dashboard Fetch Wrappers** - Add the `postCallback` API method wrapper to `apps/andon-dashboard/src/api.ts`.
- [ ] **T04: Contextual UI Buttons** - Conditionally render interactive buttons in the Next Human Action panel based on the rules engine's calculation of the agent's current state.

## Success Criteria
- Action buttons only appear when appropriate (e.g. no "Resume" button if it's already "Running").
- Clicking an action instantly updates the status (because it triggers the SSE ping we built in S01).
