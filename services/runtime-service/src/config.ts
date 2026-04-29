import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "../../..");

export const DEFAULT_RUNTIME_SERVICE_PORT = Number(process.env.RUNTIME_SERVICE_PORT ?? "4320");
export const DATABASE_PATH = process.env.ANDON_DB_PATH ?? resolve(repoRoot, "services/andon-api/data/andon.sqlite");
export const SCHEMA_PATH = resolve(repoRoot, "services/andon-api/sql/001_initial.sql");
