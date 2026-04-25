# S02 — Build B: Wallboard + attention queue

**Goal:** Session history behaves like a **light wallboard**: sortable by urgency/status/recency, optional **Top attention queue** strip (Mockup B) for sessions needing human action.

## Tasks

- [ ] **T01: List API contract** — Extend `GET /sessions` (or add query params) to return fields needed for sorting: `status`, `recommendation.urgency`, `lastEventAt`, `endedAt`. Document in `docs/andon-mvp.md`.
  - Files: `services/andon-api/src/**/*.ts`, `packages/andon-core/src/**/*.ts`

- [ ] **T02: History table UX** — `HistoryPage`: default sort by urgency then recency; column headers for Started / Status / Urgency; link to detail unchanged.
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/api.ts`

- [ ] **T03: Attention queue strip** — Optional collapsible row above the table listing top N sessions with `needs_input`, `blocked`, or `at_risk` (configurable cap).
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/styles.css`

- [ ] **T04: Repo rollups (stretch)** — If time: group-by-repo counts in API or client-only aggregation from list payload (Mockup E prep).

- [ ] **T05: Tests** — Add tests for list sort order (pure function in core or repository) and/or HTTP list payload shape; run `npm test`.

## Success criteria

- A supervisor can open History and immediately see which sessions need attention first.

## Proof level

**Automated:** at least one test covering sort keys or list API contract; **`npm test`** green. **Manual:** History page walkthrough.
