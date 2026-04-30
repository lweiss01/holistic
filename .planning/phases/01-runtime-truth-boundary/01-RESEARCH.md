# Phase 01: Runtime Truth Boundary — Research

**Researched:** 2026-04-29  
**Requirements:** RTM-01, RTM-02, RTM-03, RTM-04  
**Confidence:** HIGH

## Summary

Fleet live classification for Mission Control is concentrated in `getFleet` in `services/andon-api/src/repository.ts`. When `listRuntimeSessions(database)` is non-empty, the handler builds `FleetSessionItem` rows exclusively from `runtime_sessions` / `runtime_events` (status via `runtimeStatusToFleetStatus`, freshness via `heartbeatFreshness` on non-heartbeat runtime events). Session detail and non-fleet paths still use `deriveStatus` / legacy events — those are out of scope for RTM fleet cards but matter for hidden coupling.

`needs_input` on the fleet path must remain strictly `runtime_sessions.status === "waiting_for_input"`. `running` should reflect runtime `running`/`starting` with heartbeat semantics already covered by tests (including cold-but-running).

**Mixed fleet policy (CONTEXT vs tests):** `01-CONTEXT.md` locks that when any runtime session exists, legacy Andon `sessions` rows without a runtime mirror should still appear as **low-urgency parked** cards with explicit runtime-missing evidence — not hidden. Some existing tests still assert **exclusion** of legacy-only rows whenever runtime exists; plans must reconcile tests with the locked CONTEXT decision.

## Standard Stack

- Andon API + SQLite: `services/andon-api/src/repository.ts`, `services/andon-api/src/runtime-repository.ts`
- Types: `packages/andon-core/src/types.ts` (`FleetResponse`, `FleetSessionItem`)
- Tests: `tests/andon.test.ts`, runner `tests/run-tests.ts`

## Risks

- **Call-site drift:** Any future change that reintroduces `deriveStatus` or narrative events into `getFleet` breaks RTM-04.
- **Test/contract drift:** Assertions named “excludes legacy” conflict with CONTEXT “visible as disconnected parked”; renaming and behavior updates must happen together.

## Validation Architecture

Nyquist sampling for this phase:

| Layer | Command | When |
|-------|-----------|------|
| Fast gate | `npm run test:andon` | After each plan task batch and at end of each plan |
| Full repo | `npm test` | Before `$gsd-verify-work` on phase close |

Keep feedback latency under 120s for the Andon slice. Do not rely on watch-mode or manual-only checks for RTM assertions — fleet RTM cases must be automated in `tests/andon.test.ts`.

---

## RESEARCH COMPLETE
