import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DATABASE_PATH, SCHEMA_PATH } from "./config.ts";

let database: DatabaseSync | null = null;

export function getRuntimeDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  database = new DatabaseSync(DATABASE_PATH);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return database;
}
