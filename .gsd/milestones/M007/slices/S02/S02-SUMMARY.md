---
slice: S02
milestone: M007
subsystem: andon-api / sqlite
completed_at: "2026-05-30T17:18:03Z"
tags: [sqlite, wal, performance, smoke-test]
dependency_graph:
  requires: []
  provides: [wal-mode-connection-time, smoke-timeline-script]
  affects: [andon-api/db.ts, andon-api/sql/001_initial.sql, scripts/smoke-timeline.mjs]
tech_stack:
  added: []
  patterns: [sqlite-wal-pragma-at-connection-open]
key_files:
  created:
    - scripts/smoke-timeline.mjs
  modified:
    - services/andon-api/src/db.ts
    - services/andon-api/sql/001_initial.sql
decisions:
  - "WAL pragma applied via database.exec() at connection-open time in db.ts — not via migration SQL — because node:sqlite's DatabaseSync does not have a .pragma() helper and SQL-file pragmas only run for new databases"
  - "smoke-timeline.mjs placed in repo-root scripts/ using .mjs extension to match all other scripts in that directory"
  - "Script uses ANDON_DB_PATH env (same as config.ts) so the path stays consistent with the running service"
metrics:
  duration_minutes: 10
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# M007 S02 — SQLite WAL Mode and Timeline Smoke Script Summary

SQLite WAL journal mode enabled at connection time for both new and existing andon-api databases, with a smoke-timeline dev script for end-to-end pipeline verification.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Apply WAL mode in db.ts at connection time | e28f416f | `services/andon-api/src/db.ts`, `services/andon-api/sql/001_initial.sql` |
| 2 | Write scripts/smoke-timeline.mjs | 17274c72 | `scripts/smoke-timeline.mjs` |

## Decisions Made

1. **PRAGMA application method:** Used `database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")` because `node:sqlite`'s `DatabaseSync` does not expose a `.pragma()` helper (that is `better-sqlite3`'s API). Both PRAGMAs run in a single exec call immediately after `new DatabaseSync()`.

2. **Script extension and location:** Placed at `scripts/smoke-timeline.mjs` to match the existing `.mjs` convention across all other scripts in that directory (e.g., `smoke-test.mjs`, `andon-health.mjs`).

3. **Database path resolution:** Script reads from `ANDON_DB_PATH` environment variable with the same default path computation as `config.ts` — resolves to `services/andon-api/data/andon.sqlite` relative to the repo root. No path is hardcoded.

## Verification

Task 1 verification:
- `db.ts` calls `database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")` immediately after `new DatabaseSync(DATABASE_PATH)`, before `foreign_keys` and before `readFileSync(SCHEMA_PATH)`
- `001_initial.sql` contains the documentation comment explaining that `db.ts` is authoritative

Task 2 verification:
- `node scripts/smoke-timeline.mjs` executed successfully against the live database
- Found 4 events in the most recent session, printed with `[timestamp] [type] [source] summary` format
- Empty-DB and missing-DB cases handled with descriptive message and `process.exit(0)`

## Deviations from Plan

None — plan executed exactly as written.

The plan referenced `scripts/smoke-timeline.ts` in the frontmatter but all existing repo scripts use `.mjs`. The key_facts in the execution context explicitly specified `.mjs`, so the `.mjs` extension was used. This is not a deviation from intent.

## Self-Check

- [x] `services/andon-api/src/db.ts` — WAL pragma present before migration
- [x] `services/andon-api/sql/001_initial.sql` — pragma documentation comment present
- [x] `scripts/smoke-timeline.mjs` — created and tested
- [x] Commit e28f416f exists (Task 1)
- [x] Commit 17274c72 exists (Task 2)
