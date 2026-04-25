# S01 — Build A (complete)

## Shipped

- **`supervision`** on `ActiveSessionResponse` and `SessionDetailResponse`: `lastMeaningfulEventAt`, `supervisionSeverity`.
- **`packages/andon-core`:** `supervision-signals.ts` (`lastMeaningfulEvent`, `deriveSupervisionSeverity`, `buildSupervisionSignals`), types `SupervisionSeverity` / `SupervisionSignals`, re-export from `index.ts`.
- **`services/andon-api`:** `buildSessionDetail` attaches `supervision`; empty active session returns `supervision: null`.
- **Dashboard:** live monitor + detail header show severity pill + “Last signal” (`timeAgo`); Focus Now + Recommendations use `panel-focus-now` (description → full-width primary button → de-emphasized urgency).
- **Docs:** `docs/andon-mvp.md` subsection; `CHANGELOG.md` bullet.

## Tests

- New unit tests: `lastMeaningfulEvent` (idle-only fallback, idle+summary), `deriveSupervisionSeverity`, `buildSupervisionSignals`.
- Extended Andon API E2E: active + detail assert `supervision`; post-collector active asserts severity + `lastMeaningfulEventAt` matches heartbeat timestamp.
- `shouldPostProgressHeartbeat` fixtures include `supervision` (type requirement).

## Proof

- `npm test` — 102 passed.
- `npm run andon:build` (dashboard) — OK.

## Follow-ups (later slices)

- S02: reuse `supervisionSeverity` for history sort keys if useful.
- Optional: surface `supervision` on SSE payload consumers (already full active snapshot).
