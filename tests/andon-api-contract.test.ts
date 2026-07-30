import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { HolisticRuntimeEvent, RuntimeSession } from "../packages/runtime-core/src/index.ts";
import { createAndonHandler } from "../services/andon-api/src/server.ts";
import { ingestEvents } from "../services/andon-api/src/repository.ts";
import { insertRuntimeEvent, upsertRuntimeSession } from "../services/shared/runtime-repository.ts";

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
    name: "Andon API contract no registered sources reports source configuration gap",
    run: async () => {
      const database = createDatabase();

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: unknown[];
          sources: unknown[];
          ingestionStatus: { status: string; label: string; tone: string };
        };

        assert.deepEqual(missionPayload.sessions, []);
        assert.deepEqual(missionPayload.sources, []);
        assert.equal(missionPayload.ingestionStatus.status, "no_sources_configured");
        assert.equal(missionPayload.ingestionStatus.label, "No agent signal sources configured.");
        assert.notEqual(missionPayload.ingestionStatus.tone, "healthy");
      });
    }
  },
  {
    name: "Andon API contract connected idle source is distinct from missing instrumentation",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "source-idle-session",
        runtimeId: "local_cli",
        status: "parked",
        activity: "idle",
        updatedAt: iso(-10_000),
        metadata: {
          sourceId: "local-cli-source",
          sourceName: "Local CLI source",
          sourceType: "local_cli",
          transport: "http_events"
        }
      }));
      addHeartbeat(database, "source-idle-session", iso(-5_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: unknown[];
          sources: Array<{ sourceType: string; status: string; transport: string }>;
          ingestionStatus: { status: string; label: string; message: string; tone: string };
        };

        assert.deepEqual(missionPayload.sessions, []);
        assert.equal(missionPayload.sources[0]?.sourceType, "local_cli");
        assert.equal(missionPayload.sources[0]?.status, "idle");
        assert.equal(missionPayload.sources[0]?.transport, "http_events");
        assert.equal(missionPayload.ingestionStatus.status, "idle");
        assert.equal(missionPayload.ingestionStatus.message, "Connected agent sources are idle.");
        assert.equal(missionPayload.ingestionStatus.tone, "neutral");
      });
    }
  },
  {
    name: "Andon API contract stale and uninstrumented sources are not plain idle",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "source-stale-session",
        runtimeId: "local_cli",
        status: "running",
        updatedAt: iso(-5 * 60_000),
        metadata: {
          sourceId: "stale-source",
          sourceName: "Stale local source",
          sourceType: "local_cli",
          transport: "http_events"
        }
      }));
      addHeartbeat(database, "source-stale-session", iso(-5 * 60_000));

      await withApi(database, async (baseUrl) => {
        const stalePayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: unknown[];
          sources: Array<{ status: string }>;
          ingestionStatus: { status: string; label: string; tone: string };
        };
        assert.equal(stalePayload.sources[0]?.status, "stale");
        assert.equal(stalePayload.ingestionStatus.status, "stale");
        assert.equal(stalePayload.ingestionStatus.label, "Agent signal sources are stale.");
        assert.notEqual(stalePayload.ingestionStatus.tone, "healthy");
      });

      const databaseUninstrumented = createDatabase();
      upsertRuntimeSession(databaseUninstrumented, runtimeSession({
        id: "source-uninstrumented-session",
        runtimeId: "cursor",
        status: "parked",
        activity: "idle",
        metadata: {
          sourceId: "cursor-source",
          sourceName: "Cursor source",
          sourceType: "cursor",
          transport: "unknown",
          instrumented: false
        }
      }));

      await withApi(databaseUninstrumented, async (baseUrl) => {
        const payload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: unknown[];
          sources: Array<{ sourceType: string; status: string }>;
          ingestionStatus: { status: string; label: string; tone: string };
        };
        assert.deepEqual(payload.sessions, []);
        assert.equal(payload.sources[0]?.sourceType, "cursor");
        assert.equal(payload.sources[0]?.status, "uninstrumented");
        assert.equal(payload.ingestionStatus.status, "uninstrumented");
        assert.equal(payload.ingestionStatus.label, "No instrumented agent sessions detected.");
        assert.notEqual(payload.ingestionStatus.tone, "healthy");
      });
    }
  },
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
        const missionPayload = await mission.json() as { sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string; lifecycleState: string; primaryStatus: string }> };
        const history = await fetch(`${baseUrl}/history`);
        const historyPayload = await history.json() as { sessions: Array<{ session: { id: string }; category: string }> };
        const fleet = await fetch(`${baseUrl}/fleet`);
        const fleetPayload = await fleet.json() as { sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string }> };

        assert.equal(mission.status, 200);
        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["session-active"]);
        assert.equal(missionPayload.sessions[0]?.category, "live");
        assert.equal(missionPayload.sessions[0]?.lifecycleState, "running");
        assert.equal(missionPayload.sessions[0]?.primaryStatus, "running");
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
        updatedAt: iso(-3 * 60_000)
      }));
      addHeartbeat(database, "session-input");
      addHeartbeat(database, "session-review");
      addHeartbeat(database, "session-stale-active", iso(-3 * 60_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string; derivedOperationalStatus: string; primaryStatus: string; operatorAttention: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string }>;
        };
        const byId = new Map(missionPayload.sessions.map((item) => [item.session.id, item]));

        assert.equal(byId.get("session-input")?.category, "needs_action");
        assert.equal(byId.get("session-input")?.primaryStatus, "waiting_on_human_input");
        assert.equal(byId.get("session-input")?.operatorAttention, "input_needed");
        assert.equal(byId.get("session-input")?.derivedOperationalStatus, "needs_input");
        assert.equal(byId.get("session-review")?.category, "review");
        assert.equal(byId.get("session-review")?.primaryStatus, "waiting_for_review");
        assert.notEqual(byId.get("session-review")?.category, "live");
        assert.equal(byId.get("session-stale-active"), undefined);
        assert.equal(historyPayload.sessions.some((item) => item.session.id === "session-stale-active"), true);
        assert.equal(missionPayload.sessions.some((item) => item.session.id === "session-completed-acknowledged"), false);
        assert.equal(historyPayload.sessions.some((item) => item.session.id === "session-completed-acknowledged"), true);
      });
    }
  },
  {
    name: "Andon API contract exposes operator activity and resolves unknown agent from runtime source",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "session-activity",
        runtimeId: "codex",
        agentName: "unknown",
        activity: "editing",
        metadata: { source: "andon.runtime-writer" }
      }));
      addHeartbeat(database, "session-activity", iso(-5_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string; agentName: string };
            category: string;
            operatorActivity: string;
            lifecycleState: string;
            runtimeSignal: string;
            primaryStatus: string;
            sourceOfTruth: string;
          }>;
        };
        const item = missionPayload.sessions.find((session) => session.session.id === "session-activity");

        assert.ok(item);
        assert.equal(item?.category, "live");
        assert.equal(item?.lifecycleState, "running");
        assert.equal(item?.runtimeSignal, "alive");
        assert.equal(item?.primaryStatus, "running");
        assert.equal(item?.operatorActivity, "editing");
        assert.equal(item?.session.agentName, "codex");
        assert.equal(item?.sourceOfTruth, "runtime");
      });
    }
  },
  {
    name: "Andon API contract generic local_cli source can emit an active Mission Control session",
    run: async () => {
      const database = createDatabase();

      await withApi(database, async (baseUrl) => {
        await fetch(`${baseUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                id: "local-cli-session-started",
                sessionId: "local-cli-session",
                runtime: "local_cli",
                taskId: null,
                type: "session.started",
                phase: "execute",
                source: "system",
                timestamp: iso(-60_000),
                summary: "Local CLI session started.",
                payload: {
                  sourceId: "local-cli-source",
                  sourceName: "Local CLI runner",
                  sourceType: "local_cli",
                  transport: "http_events",
                  agentName: "local-agent",
                  objective: "Run a local CLI agent",
                  repoPath: "D:\\Projects\\active\\holistic",
                  worktreePath: "D:\\Projects\\active\\holistic",
                  activity: "editing"
                }
              },
              {
                id: "local-cli-session-heartbeat",
                sessionId: "local-cli-session",
                runtime: "local_cli",
                taskId: null,
                type: "session.heartbeat",
                phase: "execute",
                source: "system",
                timestamp: iso(-5_000),
                summary: "Local CLI heartbeat.",
                payload: {
                  sourceId: "local-cli-source",
                  sourceName: "Local CLI runner",
                  sourceType: "local_cli",
                  transport: "http_events",
                  agentName: "local-agent",
                  activity: "editing"
                }
              }
            ]
          })
        });

        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string; agentName: string }; primaryStatus: string }>;
          sources: Array<{ sourceType: string; status: string; transport: string }>;
          ingestionStatus: { status: string };
        };

        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["local-cli-session"]);
        assert.equal(missionPayload.sessions[0]?.session.agentName, "local-agent");
        assert.equal(missionPayload.sessions[0]?.primaryStatus, "running");
        assert.equal(missionPayload.sources[0]?.sourceType, "local_cli");
        assert.equal(missionPayload.sources[0]?.status, "active");
        assert.equal(missionPayload.ingestionStatus.status, "active");
      });
    }
  },
  {
    name: "Andon API contract awaiting assignment is actionable and is not review",
    run: async () => {
      const database = createDatabase();

      await withApi(database, async (baseUrl) => {
        await fetch(`${baseUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                id: "assignment-session-started",
                sessionId: "assignment-session",
                runtime: "local_cli",
                taskId: null,
                type: "session.started",
                phase: "execute",
                source: "system",
                timestamp: iso(-60_000),
                summary: "Local CLI session started.",
                payload: {
                  sourceId: "local-cli-assignment-source",
                  sourceName: "Local CLI runner",
                  sourceType: "local_cli",
                  transport: "http_events",
                  agentName: "local-agent",
                  objective: "Finish work and wait for the next assignment",
                  repoPath: "D:\\Projects\\active\\holistic",
                  worktreePath: "D:\\Projects\\active\\holistic",
                  telemetryCommand: "start"
                }
              },
              {
                id: "assignment-session-status",
                sessionId: "assignment-session",
                runtime: "local_cli",
                taskId: null,
                type: "work.completed",
                phase: "execute",
                source: "system",
                timestamp: iso(-5_000),
                summary: "Work is complete; awaiting next assignment.",
                payload: {
                  sourceId: "local-cli-assignment-source",
                  sourceName: "Local CLI runner",
                  sourceType: "local_cli",
                  transport: "http_events",
                  agentName: "local-agent",
                  telemetryCommand: "work-completed"
                }
              }
            ]
          })
        });

        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            category: string;
            reason: string;
            lifecycleState: string;
            operatorAttention: string;
            primaryStatus: string;
            actionRequired: boolean;
            actionKind: string;
            actionLabel: string;
          }>;
        };
        const detailPayload = await (await fetch(`${baseUrl}/sessions/assignment-session`)).json() as {
          projection: { primaryStatus: string; actionLabel: string; operatorAttention: string } | null;
        };
        const item = missionPayload.sessions.find((session) => session.session.id === "assignment-session");

        assert.ok(item);
        assert.equal(item?.category, "needs_action");
        assert.equal(item?.reason, "awaiting_assignment");
        assert.equal(item?.lifecycleState, "awaiting_assignment");
        assert.equal(item?.operatorAttention, "assignment_needed");
        assert.equal(item?.primaryStatus, "awaiting_assignment");
        assert.equal(item?.actionRequired, true);
        assert.equal(item?.actionKind, "assignment");
        assert.equal(item?.actionLabel, "Give this agent its next task or complete the session.");
        assert.equal(detailPayload.projection?.primaryStatus, "awaiting_assignment");
        assert.equal(detailPayload.projection?.actionLabel, item?.actionLabel);
        assert.notEqual(item?.primaryStatus, "waiting_for_review");
      });
    }
  },
  {
    name: "Andon API contract derives awaiting assignment from telemetry even when runtime row still says running",
    run: async () => {
      const database = createDatabase();
      const base = Date.now() - 5_000;
      upsertRuntimeSession(database, runtimeSession({
        id: "session-telemetry-completed-row-running",
        status: "running",
        activity: "editing",
        updatedAt: new Date(base + 3_000).toISOString(),
        lastHeartbeatAt: new Date(base + 2_000).toISOString()
      }));
      insertRuntimeEvent(database, runtimeEvent({
        id: "telemetry-work-started",
        sessionId: "session-telemetry-completed-row-running",
        type: "work.started",
        timestamp: new Date(base + 1_000).toISOString(),
        message: "Work started."
      }));
      insertRuntimeEvent(database, runtimeEvent({
        id: "telemetry-heartbeat",
        sessionId: "session-telemetry-completed-row-running",
        type: "session.heartbeat",
        timestamp: new Date(base + 2_000).toISOString(),
        message: "Heartbeat."
      }));
      insertRuntimeEvent(database, runtimeEvent({
        id: "telemetry-work-completed",
        sessionId: "session-telemetry-completed-row-running",
        type: "work.completed",
        timestamp: new Date(base + 3_000).toISOString(),
        message: "Work completed."
      }));

      await withApi(database, async (baseUrl) => {
        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            rawRuntimeStatus: string;
            primaryStatus: string;
            actionRequired: boolean;
            actionKind: string;
          }>;
        };
        const item = mission.sessions.find((session) => session.session.id === "session-telemetry-completed-row-running");

        assert.ok(item);
        assert.equal(item?.rawRuntimeStatus, "running");
        assert.equal(item?.primaryStatus, "awaiting_assignment");
        assert.equal(item?.actionRequired, true);
        assert.equal(item?.actionKind, "assignment");
      });
    }
  },
  {
    name: "Andon API contract generic claude_code source can emit an active Mission Control session",
    run: async () => {
      const database = createDatabase();

      await withApi(database, async (baseUrl) => {
        await fetch(`${baseUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                id: "claude-session-started",
                sessionId: "claude-session",
                runtime: "claude_code",
                taskId: null,
                type: "session.started",
                phase: "execute",
                source: "system",
                timestamp: iso(-60_000),
                summary: "Claude Code session started.",
                payload: {
                  sourceId: "claude-code-source",
                  sourceName: "Claude Code adapter",
                  sourceType: "claude_code",
                  platform: "claude_code",
                  transport: "http_events",
                  agentName: "claude-code",
                  objective: "Run a Claude Code agent",
                  repoPath: "D:\\Projects\\active\\holistic",
                  worktreePath: "D:\\Projects\\active\\holistic",
                  activity: "editing"
                }
              },
              {
                id: "claude-session-heartbeat",
                sessionId: "claude-session",
                runtime: "claude_code",
                taskId: null,
                type: "session.heartbeat",
                phase: "execute",
                source: "system",
                timestamp: iso(-5_000),
                summary: "Claude Code heartbeat.",
                payload: {
                  sourceId: "claude-code-source",
                  sourceName: "Claude Code adapter",
                  sourceType: "claude_code",
                  platform: "claude_code",
                  transport: "http_events",
                  agentName: "claude-code",
                  activity: "editing"
                }
              }
            ]
          })
        });

        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string; runtime: string }; primaryStatus: string }>;
          sources: Array<{ sourceType: string; status: string }>;
        };

        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["claude-session"]);
        assert.equal(missionPayload.sessions[0]?.session.runtime, "claude_code");
        assert.equal(missionPayload.sessions[0]?.primaryStatus, "running");
        assert.equal(missionPayload.sources[0]?.sourceType, "claude_code");
        assert.equal(missionPayload.sources[0]?.status, "active");
      });
    }
  },
  {
    name: "Andon API contract runtime writer heartbeat produces live activity insight without summary replay spam",
    run: async () => {
      const database = createDatabase();
      ingestEvents(database, [
        {
          id: "runtime-writer-start-session-live",
          sessionId: "session-live",
          runtime: "codex",
          taskId: null,
          type: "session.started",
          phase: "execute",
          source: "system",
          timestamp: iso(-10 * 60_000),
          summary: "Runtime writer observed local session start: Fix telemetry",
          payload: {
            source: "andon.runtime-writer",
            agentName: "unknown",
            objective: "Fix telemetry",
            repoPath: "D:\\Projects\\active\\holistic",
            worktreePath: "D:\\Projects\\active\\holistic",
            startedAt: iso(-10 * 60_000),
            activity: "editing"
          }
        },
        {
          id: "runtime-writer-heartbeat-session-live-1",
          sessionId: "session-live",
          runtime: "codex",
          taskId: null,
          type: "session.heartbeat",
          phase: "execute",
          source: "system",
          timestamp: iso(-60_000),
          summary: "Runtime writer heartbeat.",
          payload: {
            source: "andon.runtime-writer",
            latestStatus: "Session started.",
            activity: "editing"
          }
        }
      ]);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string; agentName: string };
            category: string;
            operatorActivity: string;
            primaryStatus: string;
            reason: string;
          }>;
        };
        const replayPayload = await (await fetch(`${baseUrl}/sessions/session-live/replay`)).json() as {
          events: Array<{ type: string; kind: string; summary: string | null; meaningful: boolean }>;
        };
        const item = missionPayload.sessions.find((session) => session.session.id === "session-live");
        const primary = replayPayload.events.filter((event) =>
          event.meaningful
          && event.kind !== "heartbeat_liveness"
          && event.kind !== "noop_telemetry"
          && event.kind !== "compatibility_mirror"
        );

        assert.equal(item?.category, "live");
        assert.equal(item?.primaryStatus, "running");
        assert.equal(item?.operatorActivity, "editing");
        assert.equal(item?.session.agentName, "codex");
        assert.equal(primary.some((event) => event.summary === "Session started."), false);
        assert.equal(replayPayload.events.some((event) => event.type === "agent.summary_emitted"), false);
      });
    }
  },
  {
    name: "Andon API contract consolidates one workflow with twenty tasks and ten checkpoints into one Mission Control row",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({ id: "workflow-main", activity: "editing" }));
      addHeartbeat(database, "workflow-main");
      ingestEvents(database, [
        {
          id: "workflow-main-start",
          sessionId: "workflow-main",
          runtime: "codex",
          taskId: null,
          type: "session.started",
          phase: "execute",
          source: "system",
          timestamp: iso(-10 * 60_000),
          summary: "Workflow started.",
          payload: {
            agentName: "codex",
            objective: "Implement lifecycle truth",
            repoPath: "D:\\Projects\\active\\holistic",
            worktreePath: "D:\\Projects\\active\\holistic",
            startedAt: iso(-10 * 60_000)
          }
        },
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `workflow-checkpoint-${index}`,
          sessionId: "workflow-main",
          runtime: "codex",
          taskId: null,
          type: "session.checkpoint_created" as const,
          phase: "execute" as const,
          source: "system" as const,
          timestamp: iso((-9 * 60_000) + index * 1000),
          summary: `Checkpoint ${index}`,
          payload: { checkpointCount: index + 1 }
        })),
        ...Array.from({ length: 20 }, (_, index) => ({
          id: `workflow-task-${index}`,
          sessionId: "workflow-main",
          runtime: "codex",
          taskId: `task-${index}`,
          type: "task.completed" as const,
          phase: "execute" as const,
          source: "agent" as const,
          timestamp: iso((-8 * 60_000) + index * 1000),
          summary: `Internal task ${index} completed.`,
          payload: { title: `Internal task ${index}`, phase: "execute" }
        }))
      ]);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string }>;
        };
        const replayPayload = await (await fetch(`${baseUrl}/sessions/workflow-main/replay`)).json() as {
          events: Array<{ type: string; kind: string }>;
        };

        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["workflow-main"]);
        assert.equal(replayPayload.events.filter((event) => event.type === "holistic.checkpoint").length, 10);
      });
    }
  },
  {
    name: "Andon API contract compatibility mirror events do not create top-level Mission Control sessions",
    run: async () => {
      const database = createDatabase();
      ingestEvents(database, [
        {
          id: "legacy-summary-artifact",
          sessionId: "legacy-artifact",
          runtime: "codex",
          taskId: null,
          type: "agent.summary_emitted",
          phase: "execute",
          source: "system",
          timestamp: iso(-4 * 60_000),
          summary: "Legacy ingest checkpoint artifact.",
          payload: {
            agentName: "codex",
            objective: "Searchable old work",
            repoPath: "D:\\Projects\\active\\holistic",
            worktreePath: "D:\\Projects\\active\\holistic"
          }
        }
      ]);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; primaryStatus: string }>;
        };

        assert.equal(missionPayload.sessions.some((item) => item.session.id === "legacy-artifact"), false);
        const historical = historyPayload.sessions.find((item) => item.session.id === "legacy-artifact");
        assert.ok(historical);
        assert.equal(historical?.category, "historical");
        assert.equal(historical?.primaryStatus, "parked_idle");
      });
    }
  },
  {
    name: "Andon API contract many artifact sessions do not create many Mission Control cards",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({ id: "real-workflow", updatedAt: iso(-10_000) }));
      addHeartbeat(database, "real-workflow", iso(-5_000));
      ingestEvents(database, Array.from({ length: 30 }, (_, index) => ({
        id: `artifact-${index}`,
        sessionId: `artifact-session-${index}`,
        runtime: "codex" as const,
        type: index % 3 === 0
          ? "task.completed" as const
          : index % 3 === 1
            ? "session.checkpoint_created" as const
            : "agent.summary_emitted" as const,
        taskId: index % 3 === 0 ? `artifact-task-${index}` : null,
        phase: "execute" as const,
        source: "system" as const,
        timestamp: iso(-60_000 + index * 1000),
        summary: `Artifact ${index}`,
        payload: {
          agentName: "codex",
          objective: `Artifact ${index}`,
          repoPath: "D:\\Projects\\active\\holistic",
          worktreePath: "D:\\Projects\\active\\holistic",
          title: `Artifact task ${index}`
        }
      })));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };

        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["real-workflow"]);
        assert.equal(historyPayload.sessions.filter((item) => item.session.id.startsWith("artifact-session-")).length, 30);
      });
    }
  },
  {
    name: "Andon API contract suppresses child runtime sessions from top-level Mission Control rows structurally",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({ id: "workflow-main" }));
      addHeartbeat(database, "workflow-main");
      for (const [index, objective] of [
        "Prepare durable handoff",
        "Document current work",
        "Pause at natural breakpoint"
      ].entries()) {
        upsertRuntimeSession(database, runtimeSession({
          id: `housekeeping-${index}`,
          status: "running",
          metadata: { objective, topLevelWorkflow: false, sessionKind: "child_activity" }
        }));
        addHeartbeat(database, `housekeeping-${index}`);
      }

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; reason: string }>;
        };

        assert.deepEqual(missionPayload.sessions.map((item) => item.session.id), ["workflow-main"]);
        for (const id of ["housekeeping-0", "housekeeping-1", "housekeeping-2"]) {
          assert.equal(missionPayload.sessions.some((item) => item.session.id === id), false);
          assert.equal(historyPayload.sessions.some((item) => item.session.id === id && item.category === "historical"), true);
        }
      });
    }
  },
  {
    name: "Andon API contract final agent response transitions current workflow out of live",
    run: async () => {
      const database = createDatabase();
      ingestEvents(database, [
        {
          id: "workflow-final-start",
          sessionId: "workflow-final",
          runtime: "codex",
          taskId: null,
          type: "session.started",
          phase: "execute",
          source: "system",
          timestamp: iso(-10 * 60_000),
          summary: "Workflow started.",
          payload: {
            source: "andon.runtime-writer",
            agentName: "codex",
            objective: "Complete the workflow",
            repoPath: "D:\\Projects\\active\\holistic",
            worktreePath: "D:\\Projects\\active\\holistic",
            startedAt: iso(-10 * 60_000),
            activity: "editing"
          }
        },
        {
          id: "workflow-final-complete",
          sessionId: "workflow-final",
          runtime: "codex",
          taskId: null,
          type: "session.completed",
          phase: "execute",
          source: "system",
          timestamp: iso(-60_000),
          summary: "Final output returned.",
          payload: {
            source: "andon.runtime-writer",
            completionSignal: { kind: "natural-breakpoint", source: "agent" },
            agentName: "codex",
            activity: "reviewing"
          }
        }
      ]);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string; primaryStatus: string; lifecycleState: string }>;
        };
        const item = missionPayload.sessions.find((session) => session.session.id === "workflow-final");

        assert.ok(item);
        assert.equal(item?.category, "review");
        assert.equal(item?.primaryStatus, "waiting_for_review");
        assert.equal(item?.lifecycleState, "review_ready");
        assert.equal(item?.rawRuntimeStatus, "completed");
        assert.notEqual(item?.category, "live");
      });
    }
  },
  {
    name: "Andon API contract parked session with fresh heartbeat is parked not running and detail agrees",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "session-parked-heartbeat",
        status: "parked",
        activity: "idle",
        updatedAt: iso(-10_000)
      }));
      addHeartbeat(database, "session-parked-heartbeat", iso(-5_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; runtimeSignal: string }>;
        };
        const detailPayload = await (await fetch(`${baseUrl}/sessions/session-parked-heartbeat`)).json() as {
          projection: { primaryStatus: string; lifecycleState: string; runtimeSignal: string } | null;
        };

        assert.equal(missionPayload.sessions.some((item) => item.session.id === "session-parked-heartbeat"), false);
        const historyItem = historyPayload.sessions.find((item) => item.session.id === "session-parked-heartbeat");
        assert.equal(historyItem?.primaryStatus, "parked_idle");
        assert.equal(detailPayload.projection?.primaryStatus, "parked_idle");
        assert.equal(detailPayload.projection?.lifecycleState, "parked");
        assert.notEqual(detailPayload.projection?.primaryStatus, "running");
      });
    }
  },
  {
    name: "Andon API contract Mission Control and Detail use the same canonical primaryStatus",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "session-consistent",
        status: "running",
        updatedAt: iso(-10_000)
      }));
      addHeartbeat(database, "session-consistent", iso(-5_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };
        const detailPayload = await (await fetch(`${baseUrl}/sessions/session-consistent`)).json() as {
          projection: { primaryStatus: string } | null;
        };
        const missionItem = missionPayload.sessions.find((item) => item.session.id === "session-consistent");

        assert.ok(missionItem);
        assert.equal(missionItem?.primaryStatus, "running");
        assert.equal(detailPayload.projection?.primaryStatus, missionItem?.primaryStatus);
      });
    }
  },
  {
    name: "Andon API contract forty-one hour old review is historical not current Mission Control review",
    run: async () => {
      const database = createDatabase();
      const oldReview = iso(-41 * 60 * 60_000);
      upsertRuntimeSession(database, runtimeSession({
        id: "session-old-review",
        status: "awaiting_review",
        updatedAt: oldReview
      }));
      addHeartbeat(database, "session-old-review", oldReview);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; reason: string }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; reason: string }>;
        };

        assert.equal(missionPayload.sessions.some((item) => item.session.id === "session-old-review"), false);
        const historical = historyPayload.sessions.find((item) => item.session.id === "session-old-review");
        assert.ok(historical);
        assert.equal(historical?.category, "historical");
        assert.equal(historical?.reason, "stale_review");
      });
    }
  },
  {
    name: "Andon API contract abandoned needs_input card ages off Mission Control into history",
    run: async () => {
      // Observed live: a 60-day-old "Needs Input" card sat on Mission Control
      // demanding input, because needs_action had no staleness ceiling while
      // review did. Asserted end to end because the API's top-level normalizer
      // is a second gate that a projection-only test cannot see through.
      const database = createDatabase();
      const longAgo = iso(-60 * 24 * 60 * 60_000);
      upsertRuntimeSession(database, runtimeSession({
        id: "session-abandoned-input",
        status: "waiting_for_input",
        updatedAt: longAgo
      }));
      addHeartbeat(database, "session-abandoned-input", longAgo);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; reason: string; actionRequired: boolean }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; reason: string; actionRequired: boolean }>;
        };

        assert.equal(
          missionPayload.sessions.some((item) => item.session.id === "session-abandoned-input"),
          false,
          "an abandoned needs_input card must not occupy Mission Control"
        );
        const historical = historyPayload.sessions.find((item) => item.session.id === "session-abandoned-input");
        assert.ok(historical, "the aged-out card must be reachable in history");
        assert.equal(historical?.category, "historical");
        // The specific reason must survive the top-level normalizer, or the
        // operator cannot tell why the card left the board.
        assert.equal(historical?.reason, "stale_needs_action");
        assert.equal(historical?.actionRequired, false);
      });
    }
  },
  {
    name: "Andon API contract a currently waiting session still reaches Mission Control",
    run: async () => {
      // Guard against the aging rule hiding real work: hiding a live waiting
      // agent is worse than showing a stale card.
      const database = createDatabase();
      const justNow = iso(-5_000);
      upsertRuntimeSession(database, runtimeSession({
        id: "session-waiting-live",
        status: "waiting_for_input",
        updatedAt: justNow
      }));
      addHeartbeat(database, "session-waiting-live", justNow);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; actionRequired: boolean }>;
        };
        const live = missionPayload.sessions.find((item) => item.session.id === "session-waiting-live");
        assert.ok(live, "a freshly waiting session must stay on Mission Control");
        assert.equal(live?.category, "needs_action");
        assert.equal(live?.actionRequired, true);
      });
    }
  },
  {
    name: "Andon API contract shutdown restart with no fresh heartbeat does not leave zombie Live",
    run: async () => {
      const database = createDatabase();
      const oldSignal = iso(-41 * 60 * 60_000);
      upsertRuntimeSession(database, runtimeSession({
        id: "session-zombie",
        status: "running",
        updatedAt: oldSignal
      }));
      addHeartbeat(database, "session-zombie", oldSignal);

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            category: string;
            runtimeProcessAlive: boolean | "unknown";
          }>;
        };
        const historyPayload = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; category: string; rawRuntimeStatus: string; reason: string }>;
        };

        assert.equal(missionPayload.sessions.some((item) => item.session.id === "session-zombie"), false);
        const historical = historyPayload.sessions.find((item) => item.session.id === "session-zombie");
        assert.ok(historical);
        assert.equal(historical?.category, "historical");
        assert.equal(historical?.rawRuntimeStatus, "parked");
        assert.equal(historical?.reason, "parked");
      });
    }
  },
  {
    name: "Andon API contract fresh heartbeat after restart remains Live with runtime liveness proof",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "session-fresh-after-restart",
        status: "running",
        activity: "editing",
        updatedAt: iso(-30_000)
      }));
      addHeartbeat(database, "session-fresh-after-restart", iso(-20_000));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            category: string;
            operatorActivity: string;
            runtimeProcessAlive: boolean | "unknown";
            runtimeSignal: string;
            primaryStatus: string;
            agentSignalAgeMs: number | null;
          }>;
        };
        const item = missionPayload.sessions.find((session) => session.session.id === "session-fresh-after-restart");

        assert.ok(item);
        assert.equal(item?.category, "live");
        assert.equal(item?.primaryStatus, "running");
        assert.equal(item?.runtimeSignal, "alive");
        assert.equal(item?.operatorActivity, "editing");
        assert.equal(item?.runtimeProcessAlive, true);
        assert.equal(typeof item?.agentSignalAgeMs, "number");
      });
    }
  },
  {
    name: "Andon API contract API refresh alone does not make a running session Live",
    run: async () => {
      const database = createDatabase();
      upsertRuntimeSession(database, runtimeSession({
        id: "session-api-refresh-only",
        status: "running",
        updatedAt: iso(-10_000)
      }));

      await withApi(database, async (baseUrl) => {
        const missionPayload = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          generatedAt: string;
          sessions: Array<{
            session: { id: string };
            category: string;
            runtimeProcessAlive: boolean | "unknown";
            runtimeSignal: string;
            primaryStatus: string;
            lastAgentSignalTimestamp: string | null;
            agentSignalAgeMs: number | null;
          }>;
        };
        const item = missionPayload.sessions.find((session) => session.session.id === "session-api-refresh-only");

        assert.equal(item, undefined);
        assert.equal(typeof missionPayload.generatedAt, "string");
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
