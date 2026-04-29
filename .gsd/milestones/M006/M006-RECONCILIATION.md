# M006 reconciliation (2026-04-28)

This document records a **goal-backward** pass: what M006 promised vs what exists in the tree today, and confirms milestone closure based on the completed S04 repository audit.

## Sources compared

- Roadmap: [M006-ROADMAP.md](./M006-ROADMAP.md)
- Slice plans: [slices/S01](./slices/S01/S01-PLAN.md) through [slices/S05](./slices/S05/S05-PLAN.md)
- Code: `packages/runtime-core/**`, `services/andon-api/sql/001_initial.sql`, `services/andon-api/src/runtime-repository.ts`, `services/andon-api/src/server.ts`, `services/andon-api/src/repository.ts`, `tests/runtime-core.test.ts`, `tests/runtime-storage.test.ts`, `tests/andon.test.ts`
- Product docs already naming the contract: [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md), [`docs/andon-mvp.md`](../../../docs/andon-mvp.md), [`docs/andon-design-tokens.md`](../../../docs/andon-design-tokens.md)

## Verdict by slice

| Slice | Planned outcome | As-built (2026-04-28) | Gap |
|-------|-----------------|----------------------|-----|
| **S01** Runtime core package | Canonical TS contract in `packages/runtime-core` | **Done in repo.** Package name **`@andon/runtime-core`** (private); exports `types`, `events`, `capabilities`, `adapter` from `src/index.ts`. Covers `RuntimeId`, `RuntimeStatus`, `RuntimeActivity`, `RuntimeTaskInput`, `RuntimeSession`, `HolisticRuntimeEvent`, `AgentRuntimeAdapter`, `RuntimeCapabilities`. | None blocking M006 close. |
| **S02** Runtime storage schema | SQLite tables for sessions, events, approvals, processes | **Done in repo.** `001_initial.sql` defines `runtime_sessions`, `runtime_events`, `runtime_approvals`, `runtime_processes` plus indexes; coexists with legacy `sessions` / `tasks` / `events`. | None blocking M006 close. |
| **S03** Repository plumbing | Typed read/write helpers, opaque JSON payloads | **Done in repo.** `runtime-repository.ts` maps rows <-> `RuntimeSession` / `HolisticRuntimeEvent`, upserts, list/get, approvals, process, `insertRuntimeEvent`. | None blocking M006 close. |
| **S04** Additive compatibility | Andon MVP HTTP surface unchanged while runtime lands | **Done.** Completed read-path audit confirms `server.ts` routes remain on `repository.ts` and legacy `sessions/tasks/events` data paths; `runtime-repository.ts` remains additive and not required for current API responses. | Runtime-table adoption in live HTTP/streaming is **M007 scope**, not an M006 gap. |
| **S05** Docs and verification | Canon + tests so M007 can start without re-litigating contract | **Done.** Canon docs and milestone docs now match implementation. Verification coverage includes runtime-core, runtime storage, and route-continuity/fleet compatibility tests. | Ongoing maintenance only (keep docs synced as M007 evolves). |

## S04 repository audit notes

- `server.ts` route handlers call only `getSessionsList`, `getActiveSession`, `getSessionDetail`, `getSessionTimeline`, `getFleet`, and `ingestEvents` from `repository.ts`.
- `repository.ts` queries only legacy tables (`sessions`, `tasks`, `events`) for all read and write operations used by current routes.
- `runtime-repository.ts` is not imported by `server.ts` and does not participate in current HTTP responses.
- Additive compatibility is preserved: runtime schema/repository coexist without breaking MVP routes while M007 owns integration.

## Explicit non-goals (still true)

- M006 does **not** start processes, stream runtime NDJSON to clients, or change Mission Control UX.
- **`andon-api` does not call `runtime-repository.ts` yet**; that integration remains M007.

## Milestone closure

**M006 is complete.**

- S01-S03 delivered in code and tests.
- S04 audit completed and documented in this file.
- S05 docs/verification reconciled.

## What M007 may assume from M006 (contract handoff)

1. **Types and events** import from `@andon/runtime-core` / `packages/runtime-core/src/index.ts`.
2. **Persistence** for runtime rows uses the shapes and table names in `001_initial.sql`.
3. **Repository API** surface for tests and future services lives in `runtime-repository.ts` (list sessions, get session, events by session, approvals, process metadata).

## Historical note

Older slice summary text under `slices/S01/S01-SUMMARY.md` described pre-realignment work (e.g. SSE). That content is **not** completion proof for the current S01 definition; see this reconciliation and the updated summary file.

