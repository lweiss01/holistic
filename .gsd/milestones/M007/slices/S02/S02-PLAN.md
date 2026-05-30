---
slice: S02
type: execute
wave: 1
depends_on: []
files_modified:
  - services/andon-api/src/db.ts
  - services/andon-api/sql/001_initial.sql
  - scripts/smoke-timeline.ts
autonomous: true
must_haves:
  truths:
    - "SQLite WAL mode is active on both new and existing andon-api databases after restart"
    - "WAL mode is applied at connection time in db.ts, not only via migration SQL"
    - "A smoke-timeline script can query the timeline for the most recent session and print results"
  artifacts:
    - path: "services/andon-api/src/db.ts"
      provides: "WAL PRAGMA and synchronous=NORMAL applied at connection open, before migrations"
    - path: "services/andon-api/sql/001_initial.sql"
      provides: "PRAGMA documentation for new database creation"
    - path: "scripts/smoke-timeline.ts"
      provides: "Manual smoke test for querying the event timeline"
  key_links:
    - from: "services/andon-api/src/db.ts"
      to: "SQLite database file"
      via: "PRAGMA journal_mode = WAL at connection open"
      pattern: "journal_mode.*WAL"
---

# M007 S02 — SQLite WAL Mode and Timeline Smoke Script

Enable WAL journal mode on the andon-api SQLite database for write concurrency under hook-driven
event volume. Add a smoke-timeline script for manual verification of the event pipeline end to end.

## Tasks

### Task 1: Apply WAL mode in `db.ts` at connection time

**Files:** `services/andon-api/src/db.ts`, `services/andon-api/sql/001_initial.sql`

**Action:**

Read `services/andon-api/src/db.ts` to understand how the database connection is opened (likely
via `better-sqlite3` or a similar driver). Then:

**Primary step (what actually matters for existing databases):** Immediately after opening the
database connection — before running any migrations — execute these two PRAGMAs:

```typescript
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
```

This is the step that matters. Adding PRAGMAs to a SQL migration file does NOT apply them to
databases that were created before this change. Only the connection-time application in `db.ts`
works for existing databases.

`PRAGMA journal_mode = WAL` enables Write-Ahead Logging, which allows concurrent readers during
writes. `PRAGMA synchronous = NORMAL` is the recommended companion setting — it trades a small
durability window for significantly better write throughput while remaining safe enough for
development telemetry data.

**Secondary step (documentation for new databases):** Also add these PRAGMAs to
`services/andon-api/sql/001_initial.sql` as the first statements in the file:

```sql
-- WAL mode and synchronous=NORMAL are set at connection time in db.ts for all databases.
-- These statements document the intent for new databases; the db.ts application is authoritative.
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
```

The comment is important — it prevents future maintainers from thinking the SQL file is the
primary location for these settings.

Do NOT remove the connection-time application in `db.ts` or treat the SQL file as sufficient.
The SQL approach alone would silently fail for any database created before this PR.

**Verification checklist:**
- [ ] `db.ts` applies `PRAGMA journal_mode = WAL` before running migrations
- [ ] `db.ts` applies `PRAGMA synchronous = NORMAL` before running migrations
- [ ] `001_initial.sql` contains the PRAGMAs with the explanatory comment
- [ ] WAL mode is active on a database created BEFORE this change — after restarting andon-api,
  run `PRAGMA journal_mode;` against the live database file and confirm it returns `wal`
  (not `delete`). Use `better-sqlite3` or `sqlite3` CLI: `sqlite3 <db_file> "PRAGMA journal_mode;"`

**Done:** `db.ts` applies WAL mode at connection open. Both new and pre-existing databases use WAL
after the next restart. The SQL file documents the intent for new databases with a clarifying comment.

---

### Task 2: Write `scripts/smoke-timeline.ts`

**Files:** `scripts/smoke-timeline.ts`

**Action:**

Create a smoke-test script that queries the andon-api database directly and prints the timeline
(events) for the most recent session. This provides a fast manual check of the full hook-to-DB
pipeline after S01 and S02 are deployed.

The script should:

1. Open the same SQLite database that andon-api uses (read the DB path from the same config or
   environment variable that `db.ts` uses — do not hardcode a path).
2. Query for the most recent session: `SELECT id FROM sessions ORDER BY started DESC LIMIT 1`.
3. **Handle the case where no sessions exist yet:** if the query returns no rows, print
   `"No sessions found — start a Holistic session and run some tool calls first."` and exit 0
   gracefully. Do not throw or crash.
4. If a session exists, query its events:
   `SELECT type, source, summary, timestamp FROM events WHERE sessionId = ? ORDER BY timestamp DESC LIMIT 50`
5. Print each event as a formatted line: `[timestamp] [type] [source] summary`
6. Print a summary line: `"Found N events for session <id>"`.

Run via: `node --experimental-strip-types scripts/smoke-timeline.ts`

The script is a development tool only — it does not need to be wired into any automated test suite.

**Verification checklist:**
- [ ] `node --experimental-strip-types scripts/smoke-timeline.ts` runs without crashing
- [ ] When no sessions exist: prints the "No sessions found" message and exits 0
- [ ] When sessions exist: prints event rows with correct columns
- [ ] Database path is read from config, not hardcoded

**Done:** `scripts/smoke-timeline.ts` exists and can be used to manually verify that hook events
are reaching the database.

---

## Verification

After applying Task 1, verify WAL mode on an existing database:

```bash
sqlite3 <path_to_andon_db> "PRAGMA journal_mode;"
# Expected output: wal
```

After S01 hook scripts are installed and a few tool calls have been made:

```bash
node --experimental-strip-types scripts/smoke-timeline.ts
# Expected: prints recent events with type, source, and summary
```

## Success Criteria

- WAL mode is applied at connection time in `db.ts` for both new and existing databases
- `001_initial.sql` documents the PRAGMAs with a comment explaining the `db.ts` application is authoritative
- `scripts/smoke-timeline.ts` queries and prints the event timeline, handling the no-sessions case gracefully
