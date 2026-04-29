# Milestone 006: Runtime Core and Persistence

This milestone is realigned from the earlier "Andon V2 (Closing the Loop)" direction.
M006 now establishes the Holistic-owned runtime contract and persistence layer that every later fleet and supervision feature depends on.

**Status (2026-04-28):** **Complete.** S01-S05 are reconciled and documented, including the S04 `repository.ts` compatibility audit. See [M006-RECONCILIATION.md](./M006-RECONCILIATION.md).

## Boundary

M006 is contract, schema, and repository work only.
It does not launch processes, stream events, or add dashboard controls yet.

## Slice Overview

| Slice | Focus | Status (2026-04-28) |
|-------|-------|---------------------|
| S01 | Runtime core package (`packages/runtime-core`, npm **`@andon/runtime-core`**) | **Done** |
| S02 | Runtime SQLite tables + indexes in shared Andon DB migration | **Done** |
| S03 | `runtime-repository.ts` read/write/query helpers | **Done** |
| S04 | Additive compatibility; MVP HTTP paths unchanged | **Done** - audited `server.ts` + `repository.ts`; runtime wiring intentionally deferred to M007 |
| S05 | Docs + verification | **Done** for canon references + tests; ongoing sync when enums/schema change |

### S01: Runtime Core Package
- **Goal:** Define the shared runtime types and interfaces in `packages/runtime-core`.
- **Scope:** `RuntimeId`, `RuntimeStatus`, `RuntimeActivity`, `RuntimeTaskInput`, `RuntimeSession`, `HolisticRuntimeEvent`, `AgentRuntimeAdapter`, and `RuntimeCapabilities`.

### S02: Runtime Storage Schema
- **Goal:** Persist runtime sessions, events, approvals, and process metadata.
- **Scope:** Add or extend SQLite tables for `runtime_sessions`, `runtime_events`, `runtime_approvals`, and `runtime_processes`.

### S03: Repository Plumbing
- **Goal:** Expose read/write stores usable by future runtime services and existing Andon read paths.
- **Scope:** Session, event, approval, and process repositories with query helpers and serialization boundaries.

### S04: Additive Compatibility
- **Goal:** Keep current Andon APIs stable while the runtime layer is added underneath.
- **Scope:** Shared exports, read-model compatibility shims, and regression checks proving existing routes are unaffected.

### S05: Docs and Verification
- **Goal:** Lock the contract in with clear docs and tests.
- **Scope:** Update runtime architecture notes, migration guidance, and test coverage for schema creation/query behavior.

## Exit Criteria

- TypeScript builds with the new runtime-core package exported cleanly.
- Runtime tables can be created, written, and queried.
- Existing Andon APIs remain additive and backward-compatible.
- The planning docs and architecture notes consistently treat Holistic as the owner of the runtime protocol.

**Reconciliation note:** Exit criteria are satisfied for M006. Remaining runtime-service integration (`andon-api` writing/reading runtime tables in live routes) is intentionally tracked in M007, not M006.




