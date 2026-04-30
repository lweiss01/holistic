import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { DATABASE_PATH } from "./config.ts";
import { listRuntimeSessions } from "./runtime-repository.ts";

function resolveOpenDatabasePath(database: DatabaseSync): string {
  const rows = database.prepare("PRAGMA database_list").all() as Array<{ name: string; file: string | null }>;
  const main = rows.find((row) => row.name === "main");
  const file = main?.file;
  if (file && file.length > 0) {
    return file;
  }
  return DATABASE_PATH;
}

export interface AndonHealthPayload {
  ok: true;
  service: "andon-api";
  databasePath: string;
  envAndonDbPath: string | null;
  counts: {
    runtimeSessions: number;
    runtimeEvents: number;
    legacySessions: number;
    legacyEvents: number;
  };
  activeSessionIds: string[];
  /** True when GET /fleet will include at least one session row (runtime-backed path). */
  fleetWillRenderCards: boolean;
  warnings: string[];
}

function countScalar(database: DatabaseSync, sql: string): number {
  const row = database.prepare(sql).get() as { c: number | bigint } | undefined;
  if (!row) {
    return 0;
  }
  return Number(row.c);
}

export function buildAndonHealthPayload(database: DatabaseSync): AndonHealthPayload {
  const runtimeSessions = countScalar(database, "SELECT COUNT(*) AS c FROM runtime_sessions");
  const runtimeEvents = countScalar(database, "SELECT COUNT(*) AS c FROM runtime_events");
  const legacySessions = countScalar(database, "SELECT COUNT(*) AS c FROM sessions");
  const legacyEvents = countScalar(database, "SELECT COUNT(*) AS c FROM events");

  const warnings: string[] = [];
  if (legacyEvents > 0 && runtimeSessions === 0) {
    warnings.push(
      "Legacy events exist but runtime_sessions is empty. Data was likely inserted outside POST /events (ingest mirror did not run), or rows were deleted."
    );
  }

  const openPath = resolveOpenDatabasePath(database);
  const envPath = process.env.ANDON_DB_PATH?.trim();
  if (envPath) {
    const resolvedEnv = path.resolve(envPath);
    const resolvedOpen = path.resolve(openPath);
    if (resolvedEnv !== resolvedOpen) {
      warnings.push(
        `ANDON_DB_PATH (${resolvedEnv}) does not match the SQLite file backing this API connection (${resolvedOpen}).`
      );
    }
  }

  const fleetWillRenderCards = listRuntimeSessions(database).length > 0;
  const activeSessionRows = database.prepare(
    `
      SELECT id
      FROM runtime_sessions
      WHERE status NOT IN ('completed', 'cancelled', 'failed')
      ORDER BY updated_at DESC
      LIMIT 100
    `
  ).all() as Array<{ id: string }>;
  const activeSessionIds = activeSessionRows.map((row) => String(row.id));

  return {
    ok: true,
    service: "andon-api",
    databasePath: openPath,
    envAndonDbPath: process.env.ANDON_DB_PATH?.trim() || null,
    counts: {
      runtimeSessions,
      runtimeEvents,
      legacySessions,
      legacyEvents
    },
    activeSessionIds,
    fleetWillRenderCards,
    warnings
  };
}
