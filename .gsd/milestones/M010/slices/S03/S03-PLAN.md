# S03 — Build C: Replay summary

**Goal:** Timeline view (Mockup D) opens with a **short “what happened while away”** summary and **visible status transitions** in the event list.

## Tasks

- [ ] **T01: Summary data** — Add `GET /sessions/:id/timeline/summary` or enrich timeline response with: last status before window, current status, event counts by coarse category, time span of loaded page. Prefer small dedicated endpoint to avoid heavy client scanning.
  - Files: `services/andon-api/src/server.ts`, repository, `packages/andon-core`

- [ ] **T02: Timeline UI block** — `TimelinePage`: render summary card above list; respect reduced-motion for any expand animation.
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/api.ts`, `styles.css`

- [ ] **T03: Transition markers** — When consecutive rendered events imply a status change (from snapshot events or explicit `status_changed` types), show an inline chip or divider row.
  - Files: `apps/andon-dashboard/src/App.tsx`, event type handling in `packages/andon-core` if needed

## Success criteria

- Opening replay answers “what changed recently” in one screenful before scrolling the full log.

## Proof level

**Automated:** tests for summary aggregation logic and/or `GET` timeline/summary response; **`npm test`** green. **Manual:** timeline page.
