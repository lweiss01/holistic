# M006 S02 - Runtime Storage Schema

## Tasks

- [x] Extend the SQLite schema with `runtime_sessions`, `runtime_events`, `runtime_approvals`, and `runtime_processes`.
- [x] Decide the minimum columns required for lifecycle state, approvals, heartbeats, process metadata, and event payload JSON. *(See `services/andon-api/sql/001_initial.sql`.)*
- [x] Add migration and seed-safe behavior so the existing Andon database can evolve without breaking current tables. *(Runtime DDL is additive in the same initial migration as MVP tables.)*
- [x] Add tests that create the schema and verify basic insert/query flows for every runtime table. *(See `tests/runtime-storage.test.ts`.)*

## Success Criteria

- Runtime storage exists as durable event history, not just latest-state snapshots.
