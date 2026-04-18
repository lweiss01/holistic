import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "../../..");

export const DEFAULT_API_PORT = Number(process.env.ANDON_API_PORT ?? "4318");
export const DATABASE_PATH = process.env.ANDON_DB_PATH ?? resolve(repoRoot, "services/andon-api/data/andon.sqlite");
export const SCHEMA_PATH = resolve(repoRoot, "services/andon-api/sql/001_initial.sql");
