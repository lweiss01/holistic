import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  buildBeaconEvent,
  clearBeaconState,
  formatCommandOutput,
  formatInspectOutput,
  inspectBeaconState,
  loadBeaconState,
  resolveBeaconStateFile,
  saveBeaconState,
  runBeaconCommand
} from "../scripts/andon-session-beacon.mjs";
import { createAndonHandler } from "../services/andon-api/src/server.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function createDatabase(): DatabaseSync {
  const tempDir = makeTempDir("andon-session-beacon");
  const databasePath = path.join(tempDir, "andon.sqlite");
  const schema = fs.readFileSync(path.join(process.cwd(), "services/andon-api/sql/001_initial.sql"), "utf8");
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
  return database;
}

async function withApi<T>(database: DatabaseSync, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = http.createServer(createAndonHandler(database));
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

async function withFakeBeaconApi<T>(handler: http.RequestListener, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = http.createServer(handler);
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

function stateFile(name: string): string {
  return path.join(makeTempDir(name), "andon-session.json");
}

async function postEvents(baseUrl: string, events: unknown[]): Promise<void> {
  const response = await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events })
  });
  assert.equal(response.ok, true);
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Andon session beacon start emits a platform-neutral session.started event",
    run: () => {
      const { event, state } = buildBeaconEvent("start", {
        source: "local_cli",
        agent: "Local Agent",
        repo: "holistic",
        objective: "Beacon test"
      }, null, "2026-05-02T18:00:00.000Z");

      assert.equal(event.type, "session.started");
      assert.equal(event.runtime, "local_cli");
      assert.equal(event.payload.sourceType, "local_cli");
      assert.equal(event.payload.transport, "http_events");
      assert.equal(event.payload.agentName, "Local Agent");
      assert.equal(event.payload.primaryStatus, undefined);
      assert.equal(state.sourceType, "local_cli");
    }
  },
  {
    name: "Andon session beacon heartbeat work and action commands use telemetry contract events",
    run: () => {
      const state = {
        sessionId: "beacon-contract",
        sourceId: "andon-beacon-local-cli-holistic",
        sourceName: "local cli beacon",
        sourceType: "local_cli",
        transport: "http_events",
        agentName: "Local Agent",
        repo: "holistic",
        repoPath: process.cwd(),
        worktreePath: process.cwd(),
        objective: "Beacon contract",
        branch: null,
        platform: null,
        startedAt: "2026-05-02T18:00:00.000Z",
        primaryStatus: "running"
      };

      assert.equal(buildBeaconEvent("heartbeat", {}, state).event.type, "session.heartbeat");
      assert.equal(buildBeaconEvent("begin", {}, state).event.type, "work.started");
      assert.equal(buildBeaconEvent("work-completed", {}, state).event.type, "work.completed");
      assert.equal(buildBeaconEvent("request-review", {}, state).event.type, "review.requested");
      assert.equal(buildBeaconEvent("request-input", {}, state).event.type, "input.requested");
      assert.equal(buildBeaconEvent("validation-failed", {}, state).event.type, "validation.failed");
      assert.equal(buildBeaconEvent("validation-passed", {}, state).event.type, "validation.passed");
      assert.equal(buildBeaconEvent("status", { status: "awaiting_assignment" }, state).event.type, "work.completed");
      assert.equal(buildBeaconEvent("status", { status: "awaiting_assignment" }, state).event.payload.primaryStatus, undefined);
      assert.equal(buildBeaconEvent("status", { status: "waiting_for_review" }, state).event.type, "review.requested");
      assert.equal(buildBeaconEvent("status", { status: "waiting_on_human_input" }, state).event.type, "input.requested");
      assert.equal(buildBeaconEvent("status", { status: "needs_intervention" }, state).event.type, "validation.failed");
      assert.equal(buildBeaconEvent("complete", {}, state).event.type, "session.ended");
      assert.equal(buildBeaconEvent("park", {}, state).event.type, "session.parked");
      assert.equal(buildBeaconEvent("error", {}, state).event.type, "session.error");
    }
  },
  {
    name: "Andon session beacon awaiting assignment status appears as one actionable Mission Control card",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-assignment");

      await withApi(database, async (baseUrl) => {
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Complete work and await next assignment"
        }, new Date(Date.now() - 1_000).toISOString());
        await runBeaconCommand("status", {
          api: baseUrl,
          stateFile: file,
          status: "awaiting_assignment",
          message: "Work is complete; awaiting next assignment"
        }, new Date().toISOString());

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            primaryStatus: string;
            actionRequired: boolean;
            actionKind: string;
            actionLabel: string;
          }>;
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string; actionLabel: string } | null;
        };

        assert.deepEqual(mission.sessions.map((item) => item.session.id), [start.state.sessionId]);
        assert.equal(mission.sessions[0]?.primaryStatus, "awaiting_assignment");
        assert.equal(mission.sessions[0]?.actionRequired, true);
        assert.equal(mission.sessions[0]?.actionKind, "assignment");
        assert.equal(mission.sessions[0]?.actionLabel, "Give this agent its next task or complete the session.");
        assert.equal(detail.projection?.primaryStatus, "awaiting_assignment");
        assert.equal(detail.projection?.actionLabel, mission.sessions[0]?.actionLabel);
      });
    }
  },
  {
    name: "Andon session beacon begin changes awaiting assignment to running and preserves session id",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-begin");

      await withApi(database, async (baseUrl) => {
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Begin next assignment"
        }, new Date(Date.now() - 2_000).toISOString());
        await runBeaconCommand("status", {
          api: baseUrl,
          stateFile: file,
          status: "awaiting_assignment",
          message: "Work is complete; awaiting next assignment"
        }, new Date(Date.now() - 1_000).toISOString());
        const begin = await runBeaconCommand("begin", {
          api: baseUrl,
          stateFile: file,
          message: "Working on checkpoint validation"
        }, new Date().toISOString());

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            primaryStatus: string;
            actionRequired: boolean;
          }>;
          ingestionStatus: { status: string };
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string; actionRequired: boolean } | null;
        };
        const replay = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}/replay`)).json() as {
          events: Array<{ type: string; summary: string | null }>;
        };
        const saved = loadBeaconState({ stateFile: file });

        assert.equal(begin.state.sessionId, start.state.sessionId);
        assert.equal(begin.verification?.primaryStatus, "running");
        assert.equal(begin.verification?.actionRequired, false);
        assert.equal(begin.events.length, 2);
        assert.equal(begin.events[0]?.type, "work.started");
        assert.equal(begin.events[1]?.type, "session.heartbeat");
        assert.equal(saved?.sessionId, start.state.sessionId);
        assert.equal(saved?.primaryStatus, "running");
        assert.deepEqual(mission.sessions.map((item) => item.session.id), [start.state.sessionId]);
        assert.equal(mission.sessions[0]?.primaryStatus, "running");
        assert.equal(mission.sessions[0]?.actionRequired, false);
        assert.equal(detail.projection?.primaryStatus, "running");
        assert.equal(detail.projection?.actionRequired, false);
        assert.equal(replay.events.some((event) => event.type === "work.started" && /checkpoint validation/i.test(event.summary ?? "")), true);
        assert.equal(replay.events.some((event) => event.type === "session.heartbeat" && /checkpoint validation/i.test(event.summary ?? "")), true);
        assert.equal(mission.ingestionStatus.status, "active");
      });
    }
  },
  {
    name: "Andon session beacon begin fails loudly when Mission Control does not reflect running",
    run: async () => {
      const file = stateFile("andon-beacon-begin-verify");
      saveBeaconState({
        sessionId: "beacon-verify",
        sourceId: "andon-beacon-local-cli-holistic",
        sourceName: "local cli beacon",
        sourceType: "local_cli",
        transport: "http_events",
        agentName: "Local Agent",
        repo: "holistic",
        repoPath: process.cwd(),
        worktreePath: process.cwd(),
        objective: "Verify begin",
        branch: null,
        platform: null,
        startedAt: "2026-05-02T18:00:00.000Z",
        primaryStatus: "awaiting_assignment",
        apiBaseUrl: "http://127.0.0.1:1",
        lastEventAt: "2026-05-02T18:00:00.000Z"
      }, { stateFile: file });

      await withFakeBeaconApi(async (request, response) => {
        if (request.url === "/events") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ ok: true }));
          return;
        }
        if (request.url === "/mission-control") {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({
            sessions: [{
              session: { id: "beacon-verify" },
              primaryStatus: "awaiting_assignment",
              actionRequired: true,
              lastAgentSignalTimestamp: "2026-05-02T18:00:00.000Z"
            }]
          }));
          return;
        }
        response.writeHead(404);
        response.end();
      }, async (baseUrl) => {
        await assert.rejects(
          () => runBeaconCommand("begin", {
            api: baseUrl,
            stateFile: file,
            message: "Working"
          }, new Date().toISOString()),
          /mission-control did not reflect running/
        );
      });
    }
  },
  {
    name: "Andon session beacon resume can start only with explicit platform-neutral start args",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-resume-empty");

      await withApi(database, async (baseUrl) => {
        await assert.rejects(
          () => runBeaconCommand("resume", { api: baseUrl, stateFile: file }, new Date().toISOString()),
          /npm run andon:session -- start --source local_cli/
        );

        const resumed = await runBeaconCommand("resume", {
          api: baseUrl,
          stateFile: file,
          source: "unknown",
          agent: "Unknown Agent",
          repo: "holistic",
          objective: "Explicit unknown source resume"
        }, new Date().toISOString());
        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string; runtime: string; agentName: string }; primaryStatus: string }>;
        };

        assert.equal(resumed.events[0]?.type, "session.started");
        assert.equal(resumed.events[1]?.type, "session.heartbeat");
        assert.equal(mission.sessions.length, 1);
        assert.equal(mission.sessions[0]?.session.runtime, "unknown");
        assert.equal(mission.sessions[0]?.session.agentName, "Unknown Agent");
        assert.equal(mission.sessions[0]?.primaryStatus, "running");
        assert.notEqual(mission.sessions[0]?.session.agentName, "codex");
      });
    }
  },
  {
    name: "Andon session beacon action telemetry derives input review and intervention without heartbeat override",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-action-telemetry");

      await withApi(database, async (baseUrl) => {
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Action telemetry derivation"
        }, new Date(Date.now() - 5_000).toISOString());

        await runBeaconCommand("request-input", {
          api: baseUrl,
          stateFile: file,
          message: "Need operator input"
        }, new Date(Date.now() - 4_000).toISOString());
        await runBeaconCommand("heartbeat", {
          api: baseUrl,
          stateFile: file,
          message: "Still alive while waiting"
        }, new Date(Date.now() - 3_000).toISOString());
        let mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionKind: string; actionLabel: string }>;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "waiting_on_human_input");
        assert.equal(mission.sessions[0]?.actionKind, "input");

        await runBeaconCommand("input-resolved", {
          api: baseUrl,
          stateFile: file,
          message: "Input resolved"
        }, new Date(Date.now() - 2_500).toISOString());
        await runBeaconCommand("request-review", {
          api: baseUrl,
          stateFile: file,
          message: "Review requested"
        }, new Date(Date.now() - 2_000).toISOString());
        await runBeaconCommand("heartbeat", {
          api: baseUrl,
          stateFile: file,
          message: "Still alive while review waits"
        }, new Date(Date.now() - 1_500).toISOString());
        mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionKind: string; actionLabel: string }>;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "waiting_for_review");
        assert.equal(mission.sessions[0]?.actionKind, "review");

        await runBeaconCommand("review-resolved", {
          api: baseUrl,
          stateFile: file,
          message: "Review resolved"
        }, new Date(Date.now() - 1_250).toISOString());
        await runBeaconCommand("validation-failed", {
          api: baseUrl,
          stateFile: file,
          message: "Validation failed"
        }, new Date(Date.now() - 1_000).toISOString());
        await runBeaconCommand("heartbeat", {
          api: baseUrl,
          stateFile: file,
          message: "Still alive while blocked"
        }, new Date().toISOString());
        mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionKind: string; actionLabel: string }>;
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string; actionKind: string; actionLabel: string } | null;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "needs_intervention");
        assert.equal(mission.sessions[0]?.actionKind, "intervention");
        assert.equal(mission.sessions[0]?.actionLabel, "Investigate the issue.");
        assert.equal(detail.projection?.primaryStatus, "needs_intervention");
        assert.equal(detail.projection?.actionKind, "intervention");
      });
    }
  },
  {
    name: "Andon session beacon work telemetry ordering and direct primaryStatus hints cannot override canonical derivation",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-telemetry-ordering");

      await withApi(database, async (baseUrl) => {
        const baseMs = Date.now() - 4_000;
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Telemetry ordering"
        }, new Date(baseMs).toISOString());
        await runBeaconCommand("work-completed", {
          api: baseUrl,
          stateFile: file,
          message: "Work completed"
        }, new Date(baseMs + 1_000).toISOString());
        let mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionRequired: boolean }>;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "awaiting_assignment");
        assert.equal(mission.sessions[0]?.actionRequired, true);

        await runBeaconCommand("begin", {
          api: baseUrl,
          stateFile: file,
          message: "New work started"
        }, new Date(baseMs + 2_000).toISOString());
        mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionRequired: boolean }>;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "running");
        assert.equal(mission.sessions[0]?.actionRequired, false);

        const olderCompleted = buildBeaconEvent("work-completed", {
          api: baseUrl,
          stateFile: file,
          message: "Older completion should not override"
        }, start.state, new Date(baseMs + 1_500).toISOString()).event;
        await postEvents(baseUrl, [olderCompleted]);
        mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionRequired: boolean }>;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "running");

        await postEvents(baseUrl, [{
          id: "direct-primary-status-hint",
          sessionId: start.state.sessionId,
          runtime: "local_cli",
          type: "session.status_changed",
          phase: "execute",
          source: "system",
          timestamp: new Date(baseMs + 3_000).toISOString(),
          summary: "Direct status hint should be ignored",
          payload: {
            source: "test",
            sourceId: "andon-beacon-local-cli-holistic",
            sourceType: "local_cli",
            transport: "http_events",
            agentName: "Local Agent",
            repo: "holistic",
            repoPath: process.cwd(),
            worktreePath: process.cwd(),
            objective: "Telemetry ordering",
            primaryStatus: "awaiting_assignment"
          }
        }]);
        mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string; actionRequired: boolean }>;
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string; actionRequired: boolean } | null;
        };
        assert.equal(mission.sessions[0]?.primaryStatus, "running");
        assert.equal(detail.projection?.primaryStatus, "running");
        assert.equal(detail.projection?.actionRequired, false);
      });
    }
  },
  {
    name: "Andon session beacon completed quiet work stays Awaiting Assignment instead of Needs Intervention",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-completed-quiet");

      await withApi(database, async (baseUrl) => {
        const baseMs = Date.now() - 5 * 60_000;
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Complete quiet work"
        }, new Date(baseMs).toISOString());
        await runBeaconCommand("work-completed", {
          api: baseUrl,
          stateFile: file,
          message: "Work is complete; awaiting next assignment"
        }, new Date(baseMs + 1_000).toISOString());

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{
            session: { id: string };
            primaryStatus: string;
            actionKind: string;
            actionLabel: string;
            freshness: string;
            runtimeSignal: string;
          }>;
          totals: { needs_action: number; degraded_active: number };
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string; actionKind: string; runtimeSignal: string; freshness: string } | null;
        };

        assert.equal(mission.sessions[0]?.primaryStatus, "awaiting_assignment");
        assert.equal(mission.sessions[0]?.actionKind, "assignment");
        assert.equal(mission.sessions[0]?.actionLabel, "Give this agent its next task or complete the session.");
        assert.notEqual(mission.sessions[0]?.primaryStatus, "needs_intervention");
        assert.equal(detail.projection?.primaryStatus, "awaiting_assignment");
        assert.equal(detail.projection?.actionKind, "assignment");
        assert.equal(mission.totals.needs_action, 1);
        assert.equal(mission.totals.degraded_active, 0);
      });
    }
  },
  {
    name: "Andon session beacon unknown source does not default to Codex",
    run: () => {
      const { event } = buildBeaconEvent("start", {
        source: "unknown",
        agent: "Unknown Agent",
        repo: "holistic",
        objective: "Unknown source test"
      }, null, "2026-05-02T18:00:00.000Z");

      assert.equal(event.runtime, "unknown");
      assert.equal(event.payload.sourceType, "unknown");
      assert.equal(event.payload.agentName, "Unknown Agent");
      assert.notEqual(event.payload.agentName, "codex");
    }
  },
  {
    name: "Andon session beacon writes local ignored session state for follow-up commands",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-state");

      await withApi(database, async (baseUrl) => {
        await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "State test"
        }, "2026-05-02T18:00:00.000Z");

        const saved = loadBeaconState({ stateFile: file });
        assert.ok(saved);
        assert.equal(saved?.sourceType, "local_cli");
        assert.equal(saved?.apiBaseUrl, baseUrl);
        assert.equal(resolveBeaconStateFile({ stateFile: file }), file);
        assert.match(file, /andon-session\.json$/);
      });
    }
  },
  {
    name: "Andon session beacon command output includes API URL and session id on start",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-output");

      await withApi(database, async (baseUrl) => {
        const result = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Output test"
        }, "2026-05-02T18:00:00.000Z");
        const output = formatCommandOutput("start", result.event, result.state, { api: baseUrl, stateFile: file });

        assert.match(output, new RegExp(result.state.sessionId));
        assert.match(output, new RegExp(baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(output, /State file\s+:/);
        assert.match(output, /Expected\s+:/);
        assert.match(output, /Next\s+:/);
      });
    }
  },
  {
    name: "Andon session beacon local state can be inspected and no-state inspect is clear",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-inspect");

      await withApi(database, async (baseUrl) => {
        const emptyInspect = inspectBeaconState({ api: baseUrl, stateFile: file });
        assert.equal(emptyInspect.active, false);
        assert.match(formatInspectOutput(emptyInspect), /No active local Andon beacon session|Active\s+: no/);

        const started = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Inspect test"
        }, "2026-05-02T18:00:00.000Z");
        const inspect = inspectBeaconState({ stateFile: file }, "2026-05-02T18:00:30.000Z");

        assert.equal(inspect.active, true);
        assert.equal(inspect.sessionId, started.state.sessionId);
        assert.equal(inspect.apiBaseUrl, baseUrl);
        assert.equal(inspect.lastEventAge, "30s");
        assert.equal(inspect.stale, false);
        assert.match(formatInspectOutput(inspect), /Inspect test/);
      });
    }
  },
  {
    name: "Andon session beacon local_cli session appears as one Mission Control card and detail agrees",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-local-cli");

      await withApi(database, async (baseUrl) => {
        const startedAt = new Date(Date.now() - 1_000).toISOString();
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Repair Mission Control session beacon"
        }, startedAt);
        await runBeaconCommand("heartbeat", {
          api: baseUrl,
          stateFile: file,
          status: "running",
          message: "Working"
        }, new Date().toISOString());
        for (let index = 0; index < 50; index += 1) {
          await runBeaconCommand("heartbeat", {
            api: baseUrl,
            stateFile: file,
            status: "running",
            message: `Working ${index}`
          }, new Date(Date.now() + index).toISOString());
        }

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string; objective: string; agentName: string }; primaryStatus: string }>;
          sources: Array<{ sourceType: string; status: string }>;
          ingestionStatus: { status: string };
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string } | null;
        };

        assert.deepEqual(mission.sessions.map((item) => item.session.id), [start.state.sessionId]);
        assert.equal(mission.sessions[0]?.session.objective, "Repair Mission Control session beacon");
        assert.equal(mission.sessions[0]?.session.agentName, "Local Agent");
        assert.equal(mission.sessions[0]?.primaryStatus, "running");
        assert.equal(detail.projection?.primaryStatus, mission.sessions[0]?.primaryStatus);
        assert.equal(mission.sources[0]?.sourceType, "local_cli");
        assert.equal(mission.sources[0]?.status, "active");
        assert.equal(mission.ingestionStatus.status, "active");
      });
    }
  },
  {
    name: "Andon session beacon generic claude_code source uses the same Mission Control contract",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-claude-code");

      await withApi(database, async (baseUrl) => {
        const startedAt = new Date(Date.now() - 1_000).toISOString();
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "claude_code",
          agent: "Claude Code",
          repo: "holistic",
          objective: "Generic source beacon"
        }, startedAt);
        await runBeaconCommand("heartbeat", {
          api: baseUrl,
          stateFile: file
        }, new Date().toISOString());

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string; runtime: string }; primaryStatus: string }>;
          sources: Array<{ sourceType: string; status: string }>;
        };

        assert.deepEqual(mission.sessions.map((item) => item.session.id), [start.state.sessionId]);
        assert.equal(mission.sessions[0]?.session.runtime, "claude_code");
        assert.equal(mission.sessions[0]?.primaryStatus, "running");
        assert.equal(mission.sources[0]?.sourceType, "claude_code");
        assert.equal(mission.sources[0]?.status, "active");
      });
    }
  },
  {
    name: "Andon session beacon status review and complete update Mission Control History Replay",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-review-complete");

      await withApi(database, async (baseUrl) => {
        const startedAt = new Date(Date.now() - 1_000).toISOString();
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Review then complete"
        }, startedAt);
        await runBeaconCommand("request-review", {
          api: baseUrl,
          stateFile: file,
          message: "Implementation ready for review"
        }, new Date().toISOString());

        const missionReview = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };
        const detailReview = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string } | null;
        };
        assert.equal(missionReview.sessions[0]?.primaryStatus, "waiting_for_review");
        assert.equal(detailReview.projection?.primaryStatus, "waiting_for_review");

        const replay = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}/replay`)).json() as {
          events: Array<{ type: string }>;
        };
        assert.equal(replay.events.some((event) => event.type === "session.started"), true);
        assert.equal(replay.events.some((event) => event.type === "review.requested"), true);

        await runBeaconCommand("complete", {
          api: baseUrl,
          stateFile: file,
          message: "Work complete"
        }, new Date().toISOString());
        const missionDone = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
          ingestionStatus: { status: string };
        };
        const history = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };

        assert.equal(missionDone.sessions.some((item) => item.session.id === start.state.sessionId), false);
        assert.equal(history.sessions.some((item) => item.session.id === start.state.sessionId), true);
        assert.equal(loadBeaconState({ stateFile: file }), null);
      });
    }
  },
  {
    name: "Andon session beacon parked session does not render as Running",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-parked");

      await withApi(database, async (baseUrl) => {
        const start = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Park session"
        }, "2026-05-02T18:00:00.000Z");
        await runBeaconCommand("park", {
          api: baseUrl,
          stateFile: file,
          message: "Paused at a natural breakpoint"
        }, new Date().toISOString());

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
          ingestionStatus: { status: string };
        };
        const detail = await (await fetch(`${baseUrl}/sessions/${start.state.sessionId}`)).json() as {
          projection: { primaryStatus: string } | null;
        };

        assert.equal(mission.sessions.some((item) => item.session.id === start.state.sessionId), false);
        assert.equal(detail.projection?.primaryStatus, "parked_idle");
        assert.notEqual(detail.projection?.primaryStatus, "running");
      });
    }
  },
  {
    name: "Andon session beacon complete clears local state and follows stored API URL",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-complete-state");

      await withApi(database, async (baseUrl) => {
        const started = await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Stored API complete"
        }, "2026-05-02T18:00:00.000Z");
        await runBeaconCommand("complete", {
          stateFile: file,
          message: "Done using stored API"
        }, "2026-05-02T18:01:00.000Z");

        assert.equal(loadBeaconState({ stateFile: file }), null);
        const history = await (await fetch(`${baseUrl}/history`)).json() as {
          sessions: Array<{ session: { id: string }; primaryStatus: string }>;
        };
        assert.equal(history.sessions.some((item) => item.session.id === started.state.sessionId), true);
      });
    }
  },
  {
    name: "Andon session beacon stale local state fails heartbeat safely",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-stale-state");

      await withApi(database, async (baseUrl) => {
        await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Stale state"
        }, "2026-05-02T18:00:00.000Z");

        await assert.rejects(
          () => runBeaconCommand("heartbeat", {
            stateFile: file,
            status: "running"
          }, "2026-05-02T18:11:00.000Z"),
          /stale/
        );
      });
    }
  },
  {
    name: "Andon session beacon connected source with no active session reports idle",
    run: async () => {
      const database = createDatabase();
      const file = stateFile("andon-beacon-idle");

      await withApi(database, async (baseUrl) => {
        await runBeaconCommand("start", {
          api: baseUrl,
          stateFile: file,
          source: "local_cli",
          agent: "Local Agent",
          repo: "holistic",
          objective: "Complete to idle"
        }, "2026-05-02T18:00:00.000Z");
        await runBeaconCommand("complete", {
          api: baseUrl,
          stateFile: file,
          message: "Done"
        }, new Date().toISOString());

        const mission = await (await fetch(`${baseUrl}/mission-control`)).json() as {
          sessions: unknown[];
          sources: Array<{ status: string }>;
          ingestionStatus: { status: string; tone: string };
        };

        assert.deepEqual(mission.sessions, []);
        assert.equal(mission.sources[0]?.status, "idle");
        assert.equal(mission.ingestionStatus.status, "idle");
        assert.notEqual(mission.ingestionStatus.tone, "healthy");
      });
    }
  }
];

export { tests };
