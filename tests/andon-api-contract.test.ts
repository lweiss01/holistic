import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { HolisticRuntimeEvent, RuntimeSession } from "../packages/runtime-core/src/index.ts";
import { createAndonHandler } from "../services/andon-api/src/server.ts";
import { insertRuntimeEvent, upsertRuntimeSession } from "../services/andon-api/src/runtime-repository.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function createDatabase(): DatabaseSync {
  const tempDir = makeTempDir("andon-api-contract");
  const databasePath = path.join(tempDir, "andon.sqlite");
  const schema = fs.readFileSync(path.join(process.cwd(), "services/andon-api/sql/001_initial.sql"), "utf8");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
  return database;
}

async function withApi<T>(database: DatabaseSync, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(createAndonHandler(database));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(baseUrl);
  } finally {
    server.close();
  }
}

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function runtimeSession(overrides: Partial<RuntimeSession> = {}): RuntimeSession {
  const timestamp = iso(-60_000);
  return {
    id: "session-runtime",
    runtimeId: "local",
    agentName: "codex",
    repoName: "holistic",
    repoPath: "D:\\Projects\\active\\holistic",
    status: "running",
    activity: "editing",
    startedAt: iso(-10 * 60_000),
    updatedAt: timestamp,
    ...overrides
  };
}

function runtimeEvent(overrides: Partial<HolisticRuntimeEvent> & Pick<HolisticRuntimeEvent, "id" | "sessionId" | "type">): HolisticRuntimeEvent {
  return {
    id: overrides.id,
    sessionId: overrides.sessionId,
    type: overrides.type,
    timestamp: iso(-60_000),
    message: overrides.message ?? null ?? undefined,
    payload: overrides.payload ?? {},
    ...overrides
  };
}

function addHeartbeat(database: DatabaseSync, sessionId: string, timestamp = iso(-60_000)): void {
  insertRuntimeEvent(database, runtimeEvent({
    id: `heartbeat-${sessionId}`,
    sessionId,
    type: "session.heartbeat",
    timestamp,
    message: "Runtime heartbeat."
  }));
}

function insertLegacySession(database: DatabaseSync, input: {
  id: string;
  lastEventAt: string;
  endedAt?: string | null;
}): void {
  database.prepare(
    `
      INSERT INTO sessions (
        id,
        agent_name,
        runtime_name,
        repo_path,
        worktree_path,
        objective,
        current_phase,
        started_at,
        ended_at,
        last_event_at,
        last_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    input.id,
    "codex",
    "codex",
    "D:\\Projects\\active\\holistic",
    "D:\\Projects\\active\\holistic",
    "Legacy stale session",
    "execute",
    iso(-3 * 60 * 60_000),
    input.endedAt ?? null,
    input.lastEventAt,
    null
  );
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Andon API contract mission-control returns one active runtime and history returns fifty terminated",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({ id: "session-active" }));
      addHeartbeat(database, "session-active");
      for (let index = 0; index < 50; index++) {
        upsertRuntimeSession(database, runtimeSession({
          id: `session-terminated-${index}`,
          status: "terminated",
          updatedAt: iso(-2 * 60 * 60_000),
          metadata: { acknowledged: true }
        }));
      }

      await withApi(database, async (baseUrl) => {
        const mission = await fetch(`${baseUrl}/mission-control`);
        const missionPayload = await mission.json() as { sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string }> };
        const history = await fetch(`${baseUrl}/history`);
        const historyPayload = await history.json() as { sessions: Array<{ session: { id: string }; category: string }> };
        const fleet = await fetch(`${baseUrl}/fleet`);
        const fleetPayload = await fleet.json() as { sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string }> };

        assert.equal(mission.status, 200);
        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["session-active"]);
        assert.equal(missionPayload.sessions[0]?.category, "live");
        assert.equal(fleetPayload.sessions.length, 1);
        assert.equal(fleetPayload.sessions[0]?.category, "live");
        assert.equal(history.status, 200);
        assert.equal(historyPayload.sessions.length, 50);
        assert.equal(historyPayload.sessions.every((item) => item.category === "historical"), true);
      });
    }
  },
  {
    name: "Andon API contract waiting review input completed and stale states project server-side",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({ id: "session-input", status: "waiting_for_input" }));
      upsertRuntimeSession(database, runtimeSession({ id: "session-review", status: "awaiting_review" }));
      upsertRuntimeSession(database, runtimeSession({
        id: "session-completed-acknowledged",
        status: "completed",
        completedAt: iso(-5 * 60_000),
        metadata: { completedAcknowledged: true }
      }));
      upsertRuntimeSession(database, runtimeSession({
        id: "session-stale-active",
        status: "running",
        updatedAt: iso(-10 * 60_000)
      }));
      addHeartbeat(database, "session-input");
      addHeartbeat(database, "session-review");
      addHeartbeat(database, "session-stale-active", iso(-10 * 60_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string; derivedOperationalStatus: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string }>;
        };
        const byId = new Map(missionPayload.sessions.map((item) => [item.session.id, item]));

        assert.equal(byId.get("session-input")?.category, "needs_action");
        assert.equal(byId.get("session-input")?.derivedOperationalStatus, "needs_input");
        assert.equal(byId.get("session-review")?.category, "review");
        assert.notEqual(byId.get("session-review")?.category, "live");
        assert.equal(byId.get("session-stale-active")?.category, "degraded_active");
        assert.notEqual(byId.get("session-stale-active")?.category, "live");
        assert.equal(missionPayload.sessions.some((item) => item.session.id === "session-completed-acknowledged"), false);
        assert.equal(historyPayload.sessions.some((item) => item.session.id === "session-completed-acknowledged"), true);
      });
    }
  },
  {
    name: "Andon API contract stale legacy-only sessions go to history not live Mission Control",
    run: async () => {
      const database = createDatabase();
      insertLegacySession(database, {
        id: "session-stale-legacy",
        lastEventAt: iso(-3 * 60 * 60_000)
      });

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; sourceOfTruth: string }>;
        };

        assert.equal(missionPayload.sessions.some((item) => item.session.id === "session-stale-legacy"), false);
        const historical = historyPayload.sessions.find((item) => item.session.id === "session-stale-legacy");
        assert.ok(historical);
        assert.equal(historical?.category, "historical");
        assert.notEqual(historical?.category, "live");
      });
    }
  },
  {
    name: "Andon API contract replay preserves normalized event semantics",
    run: async () => {
      const database = createDatabase();
      const events = [
        {
          id: "branch-context",
          sessionId: "session-replay",
          runtime: "codex",
          taskId: null,
          type: "agent.summary_emitted",
          phase: "execute",
          source: "system",
          timestamp: iso(-4 * 60_000),
          summary: "Detected branch switch; review the new branch context.",
          payload: { reason: "branch-switch", previousBranch: "main", currentBranch: "feature" }
        },
        {
          id: "heartbeat",
          sessionId: "session-replay",
          runtime: "codex",
          taskId: null,
          type: "session.heartbeat",
          phase: "execute",
          source: "system",
          timestamp: iso(-3 * 60_000),
          summary: "Runtime heartbeat.",
          payload: {}
        },
        {
          id: "summary",
          sessionId: "session-replay",
          runtime: "codex",
          taskId: null,
          type: "agent.summary_emitted",
          phase: "execute",
          source: "agent",
          timestamp: iso(-2 * 60_000),
          summary: "Implemented replay endpoint.",
          payload: {}
        }
      ] as const;

      const response = await withApi(database, async (baseUrl) => {
        await fetch(`${baseUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events })
        });
        return fetch(`${baseUrl}/sessions/session-replay/replay`);
      });

      const payload = await response.json() as {
        events: Array<{ type: string; kind: string; summary: string | null }>;
      };
      assert.equal(response.status, 200);
      assert.equal(payload.events.some((event) => event.type === "context.branch_changed" && event.kind === "context_branch_change"), true);
      assert.equal(payload.events.some((event) => event.type === "session.heartbeat" && event.kind === "heartbeat_liveness"), true);
      assert.equal(payload.events.some((event) => event.type === "agent.summary_emitted" && event.summary === "Implemented replay endpoint."), true);
      assert.equal(payload.events.some((event) => event.type === "agent.summary_emitted" && /branch switch/i.test(event.summary ?? "")), false);
      assert.equal(payload.events.some((event) => event.type === "agent.summary_emitted" && /heartbeat/i.test(event.summary ?? "")), false);
    }
  },
  {
    name: "Andon API contract health endpoint reports DB path and operational counts",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({ id: "session-active-health" }));
      addHeartbeat(database, "session-active-health");
      insertLegacySession(database, { id: "session-history-health", lastEventAt: iso(-3 * 60 * 60_000) });

      await withApi(database, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health/andon`);
        const payload = await response.json() as {
          databasePath: string;
          counts: {
            runtimeSessions: number;
            runtimeEvents: number;
            legacySessions: number;
            legacyEvents: number;
            currentOperational: number;
            historical: number;
          };
        };

        assert.equal(response.status, 200);
        assert.equal(typeof payload.databasePath, "string");
        assert.equal(payload.counts.runtimeSessions, 1);
        assert.equal(payload.counts.runtimeEvents, 1);
        assert.equal(payload.counts.legacySessions, 1);
        assert.equal(payload.counts.legacyEvents, 0);
        assert.equal(payload.counts.currentOperational, 1);
        assert.equal(payload.counts.historical, 1);
      });
    }
  }
];

export { tests };
