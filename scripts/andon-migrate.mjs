import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "..");
const databasePath = process.env.ANDON_DB_PATH ?? resolve(repoRoot, "services/andon-api/data/andon.sqlite");
const schemaPath = resolve(repoRoot, "services/andon-api/sql/001_initial.sql");

mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys = ON;");
database.exec(readFileSync(schemaPath, "utf8"));

console.log(`Andon database migrated at ${databasePath}`);
