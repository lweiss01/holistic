# S01: Live Dashboard Run

**Goal:** Run the Andon API and dashboard together in a live local session, validate the three MVP pages, and capture concrete issues or missing signals before adding more code.
**Demo:** After this: A live browser session shows the active session, timeline, and detail views working against the local API while event ingestion updates the dashboard state in real time.

## Tasks
- [ ] **T01: Start the live stack** - Run the SQLite migrate/seed flow, boot the Andon API, and launch the React dashboard together with clear local commands.
  - Estimate: 20m
  - Files: `package.json`, `scripts/andon-migrate.mjs`, `scripts/andon-seed.mjs`, `services/andon-api/src/server.ts`, `apps/andon-dashboard/package.json`
  - Verify: `npm run andon:db:migrate && npm run andon:db:seed && npm run andon:api` plus `npm run andon:dashboard`
- [ ] **T02: Walk the three dashboard views live** - Exercise active session, timeline, and session detail in the browser and note any rendering, routing, or data-shape issues.
  - Estimate: 25m
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/api.ts`, `apps/andon-dashboard/src/styles.css`
  - Verify: Manual browser walkthrough with screenshots or issue notes recorded in the slice summary
- [ ] **T03: Trigger live status movement** - Post one or more live collector events while the UI is open and confirm status and recommendation updates match expectations.
  - Estimate: 20m
  - Files: `services/andon-collector/src/index.ts`, `services/andon-api/src/repository.ts`, `packages/andon-core/src/status-engine.ts`
  - Verify: Active session changes from stale or parked to running, or another expected status, after new events arrive
- [ ] **T04: Capture findings and convert them into follow-up work** - Write a short summary of defects, UX gaps, and reliability concerns uncovered during the live run, then feed the meaningful ones into S02-S04 or new tasks.
  - Estimate: 15m
  - Files: `docs/andon-mvp.md`, `.gsd/milestones/M005/slices/S01/`
  - Verify: Slice summary names the validated paths, defects found, and the exact next fix sequence

## Goal

Prove that the Andon MVP works as a live supervision loop, not just as a compilable scaffold.

## Success Criteria

- API and dashboard run together locally without hidden setup steps
- Active session page loads real data from the API
- Timeline page renders the seeded session history correctly
- Detail page shows Holistic grounding and expected scope context
- Event ingestion updates status and recommendation in a way that is visible and believable
- Any defects found are written down immediately instead of relying on memory

## Proof Level

operational - live local run of the API and dashboard, with interactive verification of the three core pages and real event ingestion

## Integration Closure

After this slice, the team will know whether the MVP is genuinely usable live, what broke under real interaction, and which hardening tasks deserve the next implementation pass.

## Observability Impact

This slice should reveal whether the current status explanations and recommendation text are legible enough during real usage, and whether additional runtime cues are needed in the dashboard.
