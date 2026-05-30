import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DATABASE_PATH, SCHEMA_PATH } from "./config.ts";

let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  mkdirSync(dirname(DATABASE_PATH), { recursive: true });

  database = new DatabaseSync(DATABASE_PATH);
  // Apply WAL mode and synchronous=NORMAL at connection time so that BOTH new and
  // pre-existing databases get these settings on every startup.  Adding them only
  // to the SQL migration file is insufficient — migrations run inside CREATE IF NOT
  // EXISTS guards and SQLite ignores PRAGMA statements in previously-applied scripts.
  database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(SCHEMA_PATH, "utf8"));

  return database;
}
