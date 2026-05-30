/**
 * smoke-timeline.mjs
 *
 * Manual smoke test: queries the andon-api SQLite database directly and prints
 * the most recent 50 events for the latest session.
 *
 * Usage:
 *   node scripts/smoke-timeline.mjs
 *
 * Environment:
 *   ANDON_DB_PATH  Override the database file path.
 *                  Default: services/andon-api/data/andon.sqlite (relative to repo root)
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFile), "..");

const DATABASE_PATH =
  process.env.ANDON_DB_PATH ??
  resolve(repoRoot, "services/andon-api/data/andon.sqlite");

if (!existsSync(DATABASE_PATH)) {
  console.log(`No database found at ${DATABASE_PATH}`);
  console.log("No sessions found — start a Holistic session and run some tool calls first.");
  process.exit(0);
}

const db = new DatabaseSync(DATABASE_PATH, { open: true });

const sessionRow = db
  .prepare("SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1")
  .get();

if (!sessionRow) {
  console.log("No sessions found — start a Holistic session and run some tool calls first.");
  db.close();
  process.exit(0);
}

const sessionId = String(sessionRow.id);

const eventRows = db
  .prepare(
    "SELECT type, source, summary, created_at FROM events WHERE session_id = ? ORDER BY created_at DESC LIMIT 50"
  )
  .all(sessionId);

if (eventRows.length === 0) {
  console.log(`Session ${sessionId} has no events yet.`);
  db.close();
  process.exit(0);
}

// Print newest-first (already DESC from query)
for (const row of eventRows) {
  const ts = String(row.created_at ?? "");
  const type = String(row.type ?? "");
  const source = String(row.source ?? "");
  const summary = row.summary ? String(row.summary) : "";
  console.log(`[${ts}] [${type}] [${source}] ${summary}`);
}

console.log(`\nFound ${eventRows.length} events for session ${sessionId}`);

db.close();
