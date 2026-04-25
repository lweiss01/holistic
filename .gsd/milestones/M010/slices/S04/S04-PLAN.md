# S04 — Build D: Holistic + drift (inspector depth)

**Goal:** Detail inspector (Mockup C) shows **stronger live signals** (e.g. files touched count, retry/stuck hints from recent events) and **drift labels** aligned with spec §11 (scope / intent / strategy / context), not ad-hoc keyword scans only.

## Tasks

- [ ] **T01: Live signals from data** — Extend `SessionDetailResponse` (or compute client-side from last N events) with: `filesChangedCount`, `recentRetryCount`, optional `lastToolFailureSummary`. Prefer server-side aggregation for consistency with dashboard.
  - Files: `services/andon-api/src/**/*.ts`, `packages/andon-core/src/**/*.ts`

- [ ] **T02: Detail UI** — Replace or augment the signal grid with spec-shaped rows; ensure lamp + status strip stay consistent.
  - Files: `apps/andon-dashboard/src/App.tsx`, `styles.css`

- [ ] **T03: Drift model** — Map `holisticContext` + evidence into explicit drift dimensions (scope, intent, strategy, context) with low/med/high/none; update copy to match PDF wording where applicable.
  - Files: `packages/andon-core` rules or API mapper, `App.tsx`

## Success criteria

- Detail page gives a supervisor operational texture beyond static objective text.

## Proof level

**Automated:** unit tests for new pure mapping functions and/or API detail field assertions; **`npm test`** green. **Manual:** detail inspector.
