# S01 — Build A: Attention density

**Goal:** Every supervision state surfaces **severity** and **time since last meaningful signal** beside status (spec §6.1), and the “Focus now” rail reads as **one clear primary action** above secondary meta.

## Tasks

- [x] **T01: API or derived fields** — Add `supervision` on `ActiveSessionResponse` / `SessionDetailResponse`: `lastMeaningfulEventAt`, `supervisionSeverity` (pure helpers in `andon-core`, composed in `repository.buildSessionDetail`).
  - Files: `packages/andon-core/src/supervision-signals.ts`, `types.ts`, `index.ts`, `services/andon-api/src/repository.ts`
  - **Tests:** Unit tests for `lastMeaningfulEvent` / `deriveSupervisionSeverity` / `buildSupervisionSignals` in `tests/andon.test.ts` (or dedicated `tests/andon-supervision-signals.test.ts` if imported from `run-tests.ts`).

- [x] **T02: Live monitor layout** — On `ActiveSessionPage`, add a compact row: **severity** pill + **last signal** relative time (`tabular-nums`); keep `StatusIndicator` for status hue.
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/styles.css`
  - **Tests:** Extend Andon API integration test: `GET /sessions/active` JSON includes `supervision` with expected shape after seed ingest.

- [x] **T03: Focus rail hierarchy** — Focus Now: primary action visually first after copy; urgency de-emphasized (muted meta below button).
  - Files: `apps/andon-dashboard/src/App.tsx`, `apps/andon-dashboard/src/styles.css`
  - **Tests:** Optional snapshot-free: none required if purely CSS order; otherwise minimal DOM structure assertion skipped — prefer manual + `npm run andon:build`.

## Success criteria

- Active session shows severity + last-signal time without cluttering the “Why” list.
- Primary human action is visually dominant in the right rail.

## Proof level

**Automated:** new/extended tests in `tests/` for core helpers + active session JSON; **`npm test`** green. **Manual:** seeded API + dashboard screenshots optional.
