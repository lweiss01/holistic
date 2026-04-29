import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  buildSupervisionSignals,
  deriveRecommendation,
  deriveStatus,
  deriveSupervisionSeverity,
  lastMeaningfulEvent,
  type AgentEvent,
  type SessionRecord
} from "../packages/andon-core/src/index.ts";
import type { RuntimeSession } from "../packages/runtime-core/src/index.ts";
import { getSessionTimeline, ingestEvents, mapFleetHeatmapRows, mapRecentFleetEvents } from "../services/andon-api/src/repository.ts";
import { upsertRuntimeSession } from "../services/andon-api/src/runtime-repository.ts";
import { createAndonHandler } from "../services/andon-api/src/server.ts";
import { shouldPostProgressHeartbeat } from "../services/andon-collector/src/index.ts";
import { normalizeOpenHarnessStreamEvent } from "../services/andon-collector/src/openharness-adapter.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-andon-test",
    agentName: "codex",
    runtime: "codex",
    repoPath: "D:/Projects/active/holistic",
    worktreePath: "D:/Projects/active/holistic",
    objective: "Validate the Andon supervision loop.",
    currentPhase: "execute",
    startedAt: "2026-04-18T13:00:00.000Z",
    endedAt: null,
    lastEventAt: "2026-04-18T13:05:00.000Z",
    lastSummary: "Working through the current Andon slice.",
    ...overrides
  };
}

function makeEvent(overrides: Partial<AgentEvent> & Pick<AgentEvent, "id" | "type" | "timestamp">): AgentEvent {
  return {
    id: overrides.id,
    sessionId: "session-andon-test",
    runtime: "codex",
    taskId: null,
    type: overrides.type,
    phase: "execute",
    source: "agent",
    timestamp: overrides.timestamp,
    summary: overrides.summary ?? null,
    payload: overrides.payload ?? {},
    ...overrides
  };
}

function createDatabase(databasePath: string): void {
  const schema = fs.readFileSync(path.join(process.cwd(), "services/andon-api/sql/001_initial.sql"), "utf8");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Andon lastMeaningfulEvent skips idle pings but falls back to newest event",
    run: () => {
      const idleOnly: AgentEvent[] = [
        makeEvent({
          id: "idle-1",
          type: "session.idle_detected",
          timestamp: "2026-04-18T13:10:00.000Z",
          summary: "Idle",
          payload: {}
        })
      ];
      assert.equal(lastMeaningfulEvent(idleOnly)?.id, "idle-1");

      const idleThenSummary: AgentEvent[] = [
        makeEvent({
          id: "idle-2",
          type: "session.idle_detected",
          timestamp: "2026-04-18T13:10:00.000Z",
          summary: "Idle",
          payload: {}
        }),
        makeEvent({
          id: "sum",
          type: "agent.summary_emitted",
          timestamp: "2026-04-18T13:09:00.000Z",
          summary: "Progress",
          payload: {}
        })
      ];
      assert.equal(lastMeaningfulEvent(idleThenSummary)?.id, "sum");
    }
  },
  {
    name: "Andon deriveSupervisionSeverity maps blocked to critical and parked to info",
    run: () => {
      assert.equal(deriveSupervisionSeverity("blocked", "high"), "critical");
      assert.equal(deriveSupervisionSeverity("parked", "low"), "info");
      assert.equal(deriveSupervisionSeverity("running", "high"), "high");
      assert.equal(deriveSupervisionSeverity("awaiting_review", "medium"), "medium");
    }
  },
  {
    name: "Andon buildSupervisionSignals composes last timestamp and severity",
    run: () => {
      const events: AgentEvent[] = [
        makeEvent({
          id: "e1",
          type: "task.started",
          timestamp: "2026-04-18T13:01:00.000Z",
          summary: "T",
          payload: {}
        }),
        makeEvent({
          id: "e2",
          type: "agent.summary_emitted",
          timestamp: "2026-04-18T13:02:00.000Z",
          summary: "S",
          payload: {}
        })
      ];
      const sig = buildSupervisionSignals(events, "parked", "low");
      assert.equal(sig.lastMeaningfulEventAt, "2026-04-18T13:02:00.000Z");
      assert.equal(sig.supervisionSeverity, "info");
    }
  },
  {
    name: "Andon status Why keeps substantive work first and surfaces latest checkpoint when distinct",
    run: () => {
      const session = makeSession({ lastEventAt: "2026-04-18T15:00:00.000Z" });
      const events: AgentEvent[] = [
        makeEvent({
          id: "task-m007",
          type: "task.started",
          timestamp: "2026-04-18T14:00:00.000Z",
          summary: "Implementing M007: Event Forwarding (Daemon & Wrappers)",
          payload: {}
        }),
        makeEvent({
          id: "chk-m010",
          type: "session.checkpoint_created",
          timestamp: "2026-04-18T15:00:00.000Z",
          summary:
            "M010 Andon design-spec (Builds A–E) tracked: roadmap + S01–S05 slice plans; dashboard lamp/sticky/motion/tabular UX landed; GSD milestone sequence updated.",
          payload: {}
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: null,
        now: new Date("2026-04-18T15:01:00.000Z")
      });

      assert.equal(status.status, "running");
      assert.equal(status.evidence[0], "Implementing M007: Event Forwarding (Daemon & Wrappers)");
      assert.match(status.evidence[1] ?? "", /Latest Holistic checkpoint:/i);
      assert.match(status.evidence[1] ?? "", /M010/i);
    }
  },
  {
    name: "Andon status engine prioritizes unresolved agent questions as needs_input",
    run: () => {
      const session = makeSession();
      const events: AgentEvent[] = [
        makeEvent({
          id: "question",
          type: "agent.question_asked",
          timestamp: "2026-04-18T13:05:00.000Z",
          summary: "Should I proceed with the OpenHarness integration?",
          payload: { resolved: false }
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: null,
        now: new Date("2026-04-18T13:06:00.000Z")
      });
      const recommendation = deriveRecommendation({
        session,
        status,
        events,
        holisticContext: null
      });

      assert.equal(status.status, "needs_input");
      assert.match(status.explanation, /needs a human answer/i);
      assert.equal(recommendation.actionLabel, "Respond to the agent");
    }
  },
  {
    name: "Andon status engine marks repeated failures as at_risk",
    run: () => {
      const session = makeSession({ lastEventAt: "2026-04-18T13:08:00.000Z" });
      const events: AgentEvent[] = [
        makeEvent({
          id: "failure-1",
          type: "command.failed",
          timestamp: "2026-04-18T13:06:00.000Z",
          summary: "First command failed.",
          source: "system",
          payload: { command: "npm run build" }
        }),
        makeEvent({
          id: "failure-2",
          type: "test.failed",
          timestamp: "2026-04-18T13:08:00.000Z",
          summary: "Tests failed again.",
          source: "system",
          payload: { suite: "andon-api" }
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: null,
        now: new Date("2026-04-18T13:09:00.000Z")
      });
      const recommendation = deriveRecommendation({
        session,
        status,
        events,
        holisticContext: null
      });

      assert.equal(status.status, "at_risk");
      assert.ok(status.evidence.some((item) => item.includes("Recent failures")));
      assert.equal(recommendation.actionLabel, "Narrow the scope");
    }
  },
  {
    name: "Andon status engine marks idle-after-failure sessions as blocked",
    run: () => {
      const session = makeSession({ lastEventAt: "2026-04-18T13:08:00.000Z" });
      const events: AgentEvent[] = [
        makeEvent({
          id: "failure",
          type: "command.failed",
          timestamp: "2026-04-18T13:06:00.000Z",
          summary: "The build tool is unavailable.",
          source: "system",
          payload: { errorKind: "tool" }
        }),
        makeEvent({
          id: "idle",
          type: "session.idle_detected",
          timestamp: "2026-04-18T13:08:00.000Z",
          summary: "The session went idle after the failure.",
          source: "system",
          payload: {}
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: null,
        now: new Date("2026-04-18T13:09:00.000Z")
      });
      const recommendation = deriveRecommendation({
        session,
        status,
        events,
        holisticContext: null
      });

      assert.equal(status.status, "blocked");
      assert.match(status.explanation, /blocked/i);
      assert.equal(recommendation.actionLabel, "Fix the blocker");
    }
  },
  {
    name: "Andon status engine marks completed work as awaiting_review",
    run: () => {
      const session = makeSession({ lastEventAt: "2026-04-18T13:06:00.000Z" });
      const events: AgentEvent[] = [
        makeEvent({
          id: "summary-complete",
          type: "agent.summary_emitted",
          timestamp: "2026-04-18T13:06:00.000Z",
          summary: "Finished the current Andon MVP task.",
          payload: { workComplete: true }
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: null,
        now: new Date("2026-04-18T13:07:00.000Z")
      });
      const recommendation = deriveRecommendation({
        session,
        status,
        events,
        holisticContext: null
      });

      assert.equal(status.status, "awaiting_review");
      assert.equal(recommendation.title, "Review the completed work");
    }
  },
  {
    name: "Andon status engine flags Holistic scope drift as at_risk",
    run: () => {
      const session = makeSession({ lastEventAt: "2026-04-18T13:06:00.000Z" });
      const events: AgentEvent[] = [
        makeEvent({
          id: "scope-drift",
          type: "file.changed",
          timestamp: "2026-04-18T13:06:00.000Z",
          summary: "Changed a file outside the expected scope.",
          payload: { path: "src/unrelated/legacy.ts" }
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: {
          sessionId: session.id,
          objective: session.objective,
          currentPhase: "execute",
          constraints: [],
          priorAttempts: [],
          acceptedApproaches: [],
          rejectedApproaches: [],
          expectedScope: ["apps/andon-dashboard", "services/andon-api"],
          successCriteria: [],
          updatedAt: "2026-04-18T13:00:00.000Z"
        },
        now: new Date("2026-04-18T13:07:00.000Z")
      });

      assert.equal(status.status, "at_risk");
      assert.ok(status.evidence.some((item) => item.includes("Changed a file outside the expected scope.")));
    }
  },
  {
    name: "Andon status engine parks inactive sessions after the activity window expires",
    run: () => {
      const session = makeSession({ lastEventAt: "2026-04-18T13:00:00.000Z" });
      const events: AgentEvent[] = [
        makeEvent({
          id: "healthy-summary",
          type: "agent.summary_emitted",
          timestamp: "2026-04-18T13:00:00.000Z",
          summary: "Still making progress earlier in the session.",
          payload: { workComplete: false }
        })
      ];

      const status = deriveStatus({
        session,
        events,
        holisticContext: null,
        now: new Date("2026-04-18T13:20:30.000Z")
      });
      const recommendation = deriveRecommendation({
        session,
        status,
        events,
        holisticContext: null
      });

      assert.equal(status.status, "parked");
      assert.equal(recommendation.title, "Resume or archive the session");
    }
  },
  {
    name: "Andon collector skips still-progressing heartbeats after task completion or parking",
    run: () => {
      assert.equal(
        shouldPostProgressHeartbeat({
          session: makeSession(),
          activeTask: { id: "task", sessionId: "session-andon-test", title: "Task", phase: "execute", state: "active", startedAt: "2026-04-18T13:00:00.000Z", completedAt: null, metadata: {} },
          status: { status: "running", phase: "execute", explanation: "Healthy", evidence: [] },
          recommendation: { urgency: "low", title: "Monitor", actionLabel: "Watch", description: "Healthy" },
          holisticContext: null,
          supervision: { lastMeaningfulEventAt: "2026-04-18T13:00:00.000Z", supervisionSeverity: "low" }
        }),
        true
      );

      assert.equal(
        shouldPostProgressHeartbeat({
          session: makeSession(),
          activeTask: null,
          status: { status: "awaiting_review", phase: "execute", explanation: "Done", evidence: [] },
          recommendation: { urgency: "medium", title: "Review", actionLabel: "Open", description: "Done" },
          holisticContext: null,
          supervision: { lastMeaningfulEventAt: "2026-04-18T13:00:00.000Z", supervisionSeverity: "medium" }
        }),
        false
      );

      assert.equal(
        shouldPostProgressHeartbeat({
          session: makeSession(),
          activeTask: { id: "task", sessionId: "session-andon-test", title: "Task", phase: "execute", state: "active", startedAt: "2026-04-18T13:00:00.000Z", completedAt: null, metadata: {} },
          status: { status: "parked", phase: "execute", explanation: "Idle", evidence: [] },
          recommendation: { urgency: "low", title: "Resume", actionLabel: "Decide", description: "Idle" },
          holisticContext: null,
          supervision: { lastMeaningfulEventAt: "2026-04-18T13:00:00.000Z", supervisionSeverity: "info" }
        }),
        false
      );
    }
  },
  {
    name: "Andon API serves active session, timeline, detail, and ingests events end to end",
    run: async () => {
      const tempDir = makeTempDir("andon-api-test");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }

        const port = address.port;

        // Recent timestamps so Mission Control fleet view does not treat the session as stale/cold parked.
        const t0 = Date.now();
        const iso = (deltaMs: number) => new Date(t0 + deltaMs).toISOString();
        const tSession = iso(-180_000);
        const tTask = iso(-120_000);
        const tSummary = iso(-60_000);

        const seedEvent: AgentEvent = {
          id: "session-started",
          sessionId: "session-andon-mvp",
          runtime: "codex",
          taskId: null,
          type: "session.started",
          phase: "execute",
          source: "agent",
          timestamp: tSession,
          summary: "Started the Andon MVP session.",
          payload: {
            objective: "Build the first Andon MVP scaffold inside the Holistic repo.",
            agentName: "codex",
            runtime: "codex",
            repoPath: "D:/Projects/active/holistic",
            worktreePath: "D:/Projects/active/holistic",
            startedAt: tSession
          }
        };

        const taskStarted: AgentEvent = {
          id: "task-started",
          sessionId: "session-andon-mvp",
          runtime: "codex",
          taskId: "task-andon-scaffold",
          type: "task.started",
          phase: "execute",
          source: "agent",
          timestamp: tTask,
          summary: "Creating the initial monorepo scaffold.",
          payload: {
            title: "Create the Andon MVP scaffold",
            startedAt: tTask
          }
        };

        const summaryEvent: AgentEvent = {
          id: "summary",
          sessionId: "session-andon-mvp",
          runtime: "codex",
          taskId: "task-andon-scaffold",
          type: "agent.summary_emitted",
          phase: "execute",
          source: "agent",
          timestamp: tSummary,
          summary: "Scaffolded the Andon MVP.",
          payload: { workComplete: false }
        };

        const ingestResponse = await fetch(`http://127.0.0.1:${port}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ events: [seedEvent, taskStarted, summaryEvent] })
        });
        assert.equal(ingestResponse.status, 202);

        upsertRuntimeSession(database, {
          id: "session-andon-mvp",
          runtimeId: "local",
          agentName: "codex",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: tSession,
          updatedAt: tSummary
        });

        const activeResponse = await fetch(`http://127.0.0.1:${port}/sessions/active`);
        assert.equal(activeResponse.status, 200);
        const activePayload = (await activeResponse.json()) as {
          session: SessionRecord | null;
          activeTask: { title: string } | null;
          status: { status: string } | null;
          supervision: { lastMeaningfulEventAt: string | null; supervisionSeverity: string } | null;
        };

        assert.equal(activePayload.session?.id, "session-andon-mvp");
        assert.equal(activePayload.activeTask?.title, "Create the Andon MVP scaffold");
        assert.equal(activePayload.status?.status, "running");
        assert.equal(activePayload.supervision?.supervisionSeverity, "low");
        assert.equal(activePayload.supervision?.lastMeaningfulEventAt, tSummary);

        const detailResponse = await fetch(`http://127.0.0.1:${port}/sessions/session-andon-mvp`);
        assert.equal(detailResponse.status, 200);
        const detailPayload = (await detailResponse.json()) as {
          holisticContext: { objective: string } | null;
          supervision: { lastMeaningfulEventAt: string | null; supervisionSeverity: string };
        };
        assert.match(detailPayload.holisticContext?.objective ?? "", /Andon MVP scaffold/i);
        assert.equal(detailPayload.supervision.supervisionSeverity, "low");
        assert.equal(detailPayload.supervision.lastMeaningfulEventAt, tSummary);

        const timelineResponse = await fetch(`http://127.0.0.1:${port}/sessions/session-andon-mvp/timeline`);
        assert.equal(timelineResponse.status, 200);
        const timelinePayload = (await timelineResponse.json()) as {
          items: AgentEvent[];
          total: number;
          hasMore: boolean;
          limit: number;
          offset: number;
        };
        assert.equal(timelinePayload.items.length, 3);
        assert.equal(timelinePayload.total, 3);
        assert.equal(timelinePayload.hasMore, false);
        assert.equal(timelinePayload.offset, 0);

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const fleetPayload = (await fleetResponse.json()) as {
          generatedAt: string;
          totals: {
            totalSessions: number;
            activeAgents: number;
            needsHuman: number;
          };
          riskReasons: Array<{ label: string; count: number }>;
          sessions: Array<{
            session: { id: string };
            status: { status: string };
            attentionRank: number;
            attentionBreakdown: { status: number; urgency: number; freshness: number };
            recommendedAction: string;
            availableActions: string[];
          }>;
          recentEvents: Array<{ sessionId: string; type: string }>;
          heatmap: Array<{ hourStart: string; count: number }>;
        };
        assert.ok(Boolean(fleetPayload.generatedAt));
        assert.equal(fleetPayload.totals.totalSessions, 1);
        assert.equal(fleetPayload.totals.activeAgents, 1);
        assert.ok(Array.isArray(fleetPayload.riskReasons));
        assert.equal(fleetPayload.sessions[0]?.session.id, "session-andon-mvp");
        assert.equal(typeof fleetPayload.sessions[0]?.attentionRank, "number");
        assert.equal(typeof fleetPayload.sessions[0]?.attentionBreakdown.status, "number");
        assert.equal(typeof fleetPayload.sessions[0]?.attentionBreakdown.urgency, "number");
        assert.equal(typeof fleetPayload.sessions[0]?.attentionBreakdown.freshness, "number");
        assert.equal(typeof fleetPayload.sessions[0]?.recommendedAction, "string");
        assert.ok(Array.isArray(fleetPayload.sessions[0]?.availableActions));
        assert.ok(fleetPayload.sessions[0]?.availableActions.includes("inspect"));
        assert.ok(Array.isArray(fleetPayload.recentEvents));

        const collectorEvent: AgentEvent = {
          id: "collector-heartbeat",
          sessionId: "session-andon-mvp",
          runtime: "openharness",
          taskId: "task-andon-scaffold",
          type: "agent.summary_emitted",
          phase: "execute",
          source: "collector",
          timestamp: new Date().toISOString(),
          summary: "Collector heartbeat: agent is still progressing through the MVP scaffold.",
          payload: { workComplete: false }
        };

        const collectorResponse = await fetch(`http://127.0.0.1:${port}/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(collectorEvent)
        });
        assert.equal(collectorResponse.status, 202);

        const runningResponse = await fetch(`http://127.0.0.1:${port}/sessions/active`);
        const runningPayload = (await runningResponse.json()) as {
          session: SessionRecord | null;
          status: { status: string; explanation: string } | null;
          recommendation: { title: string } | null;
          supervision: { lastMeaningfulEventAt: string | null; supervisionSeverity: string } | null;
        };

        assert.equal(runningPayload.session?.lastSummary, collectorEvent.summary);
        assert.equal(runningPayload.status?.status, "running");
        assert.match(runningPayload.status?.explanation ?? "", /healthy/i);
        assert.equal(runningPayload.recommendation?.title, "Monitor the session");
        assert.equal(runningPayload.supervision?.supervisionSeverity, "low");
        assert.equal(runningPayload.supervision?.lastMeaningfulEventAt, collectorEvent.timestamp);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon timeline pagination and tail slice",
    run: () => {
      const tempDir = makeTempDir("andon-timeline-page");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);

      const batch: AgentEvent[] = [];
      for (let i = 0; i < 5; i += 1) {
        batch.push(
          makeEvent({
            id: `e-page-${i}`,
            type: "agent.summary_emitted",
            timestamp: `2026-04-18T15:0${i}:00.000Z`,
            summary: `Event ${i}`
          })
        );
      }
      ingestEvents(database, batch);

      const firstPage = getSessionTimeline(database, "session-andon-test", { limit: 2, offset: 0 });
      assert.ok(firstPage);
      assert.equal(firstPage!.total, 5);
      assert.equal(firstPage!.items.length, 2);
      assert.equal(firstPage!.hasMore, true);

      const tailPage = getSessionTimeline(database, "session-andon-test", { tail: 3 });
      assert.ok(tailPage);
      assert.equal(tailPage!.items.length, 3);
      assert.equal(tailPage!.offset, 2);
      assert.equal(tailPage!.hasMore, false);

      database.close();
    }
  },
  {
    name: "Andon fleet heatmap mapper returns chronological cells with numeric counts",
    run: () => {
      const mapped = mapFleetHeatmapRows([
        { hour_start: "2026-04-28T14:00:00.000Z", c: 9n },
        { hour_start: "2026-04-28T13:00:00.000Z", c: 3 }
      ]);

      assert.equal(mapped.length, 2);
      assert.equal(mapped[0]?.hourStart, "2026-04-28T13:00:00.000Z");
      assert.equal(mapped[1]?.hourStart, "2026-04-28T14:00:00.000Z");
      assert.equal(mapped[0]?.count, 3);
      assert.equal(mapped[1]?.count, 9);
    }
  },
  {
    name: "Andon recent-signal mapper normalizes fleet event summary fields",
    run: () => {
      const mapped = mapRecentFleetEvents([
        {
          id: "evt-1",
          session_id: "session-1",
          type: "agent.summary_emitted",
          summary: "Progress update",
          created_at: "2026-04-28T12:00:00.000Z",
          agent_name: "codex",
          repo_path: "D:/Projects/active/holistic"
        }
      ]);

      assert.equal(mapped.length, 1);
      assert.equal(mapped[0]?.id, "evt-1");
      assert.equal(mapped[0]?.sessionId, "session-1");
      assert.equal(mapped[0]?.type, "agent.summary_emitted");
      assert.equal(mapped[0]?.summary, "Progress update");
      assert.equal(mapped[0]?.agentName, "codex");
      assert.equal(mapped[0]?.repoName, "holistic");
    }
  },
  {
    name: "Andon fleet ranks blocked and needs-input sessions above routine running work",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-rank");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const runningSeed: AgentEvent[] = [
          {
            id: "running-session-start",
            sessionId: "session-running",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            summary: "Running session started",
            payload: {
              objective: "Routine implementation",
              agentName: "codex-a",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "running-summary",
            sessionId: "session-running",
            runtime: "codex",
            taskId: null,
            type: "agent.summary_emitted",
            phase: "execute",
            source: "agent",
            timestamp: new Date(Date.now() - 60 * 1000).toISOString(),
            summary: "Routine progress continues",
            payload: { workComplete: false }
          }
        ];

        const urgentSeed: AgentEvent[] = [
          {
            id: "urgent-session-start",
            sessionId: "session-urgent",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            summary: "Urgent session started",
            payload: {
              objective: "Answer unresolved implementation question",
              agentName: "codex-b",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "urgent-question",
            sessionId: "session-urgent",
            runtime: "codex",
            taskId: null,
            type: "agent.question_asked",
            phase: "execute",
            source: "agent",
            timestamp: new Date(Date.now() - 30 * 1000).toISOString(),
            summary: "Need a human decision on API shape before continuing",
            payload: { resolved: false }
          }
        ];

        ingestEvents(database, [...runningSeed, ...urgentSeed]);
        const runtimeNow = new Date().toISOString();
        const runtimeSessionUrgent: RuntimeSession = {
          id: "session-urgent",
          runtimeId: "local",
          agentName: "codex-b",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "waiting_for_input",
          activity: "waiting",
          startedAt: runtimeNow,
          updatedAt: runtimeNow
        };
        const runtimeSessionRunning: RuntimeSession = {
          id: "session-running",
          runtimeId: "local",
          agentName: "codex-a",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: runtimeNow,
          updatedAt: runtimeNow
        };
        upsertRuntimeSession(database, runtimeSessionUrgent);
        upsertRuntimeSession(database, runtimeSessionRunning);

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const fleetPayload = (await fleetResponse.json()) as {
          sessions: Array<{
            session: { id: string };
            status: { status: string };
            attentionRank: number;
            blockedReason: string | null;
          }>;
          totals: {
            totalSessions: number;
            blocked: number;
            needsHuman: number;
          };
          riskReasons: Array<{ label: string; count: number }>;
        };

        assert.equal(fleetPayload.totals.totalSessions, 2);
        assert.equal(fleetPayload.totals.blocked, 0);
        assert.equal(fleetPayload.totals.needsHuman, 1);
        assert.equal(fleetPayload.sessions[0]?.session.id, "session-urgent");
        assert.equal(fleetPayload.sessions[0]?.status.status, "needs_input");
        assert.ok((fleetPayload.sessions[0]?.attentionRank ?? 0) > (fleetPayload.sessions[1]?.attentionRank ?? 0));
        assert.ok(fleetPayload.sessions[0]?.availableActions.includes("pause"));
        assert.ok(fleetPayload.riskReasons.length >= 1);
        assert.equal(typeof fleetPayload.riskReasons[0]?.label, "string");
        assert.equal(typeof fleetPayload.riskReasons[0]?.count, "number");
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet tie-break keeps equal-rank sessions ordered by newest lastEventAt",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-tiebreak");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const olderTs = new Date(Date.now() - 4 * 60 * 1000).toISOString();
        const newerTs = new Date(Date.now() - 2 * 60 * 1000).toISOString();

        const seedEvents: AgentEvent[] = [
          {
            id: "session-a-start",
            sessionId: "session-a",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: olderTs,
            summary: "Session A started",
            payload: {
              objective: "Routine A",
              agentName: "agent-a",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "session-a-summary",
            sessionId: "session-a",
            runtime: "codex",
            taskId: null,
            type: "agent.summary_emitted",
            phase: "execute",
            source: "agent",
            timestamp: olderTs,
            summary: "Routine progress A",
            payload: { workComplete: false }
          },
          {
            id: "session-b-start",
            sessionId: "session-b",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: newerTs,
            summary: "Session B started",
            payload: {
              objective: "Routine B",
              agentName: "agent-b",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "session-b-summary",
            sessionId: "session-b",
            runtime: "codex",
            taskId: null,
            type: "agent.summary_emitted",
            phase: "execute",
            source: "agent",
            timestamp: newerTs,
            summary: "Routine progress B",
            payload: { workComplete: false }
          }
        ];

        ingestEvents(database, seedEvents);
        upsertRuntimeSession(database, {
          id: "session-a",
          runtimeId: "local",
          agentName: "agent-a",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: olderTs,
          updatedAt: olderTs
        });
        upsertRuntimeSession(database, {
          id: "session-b",
          runtimeId: "local",
          agentName: "agent-b",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: newerTs,
          updatedAt: newerTs
        });

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const fleetPayload = (await fleetResponse.json()) as {
          sessions: Array<{
            session: { id: string; lastEventAt: string };
            attentionRank: number;
            status: { status: string };
          }>;
        };

        assert.equal(fleetPayload.sessions.length, 2);
        assert.equal(fleetPayload.sessions[0]?.status.status, "running");
        assert.equal(fleetPayload.sessions[1]?.status.status, "running");
        assert.equal(fleetPayload.sessions[0]?.attentionRank, fleetPayload.sessions[1]?.attentionRank);
        assert.equal(fleetPayload.sessions[0]?.session.id, "session-b");
        assert.equal(fleetPayload.sessions[1]?.session.id, "session-a");
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet ignores legacy unresolved questions without runtime waiting signal",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-legacy-question");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const now = Date.now();
        const sessionStartedAt = new Date(now - 2 * 60 * 1000).toISOString();
        const questionAt = new Date(now - 60 * 1000).toISOString();
        ingestEvents(database, [
          {
            id: "legacy-question-session-start",
            sessionId: "session-legacy-question",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: sessionStartedAt,
            summary: "Legacy-only session started",
            payload: {
              objective: "Legacy narrative-only unresolved question",
              agentName: "legacy-agent",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "legacy-question-unresolved",
            sessionId: "session-legacy-question",
            runtime: "codex",
            taskId: null,
            type: "agent.question_asked",
            phase: "execute",
            source: "agent",
            timestamp: questionAt,
            summary: "Need approval to proceed",
            payload: { resolved: false }
          }
        ]);

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const fleetPayload = (await fleetResponse.json()) as {
          totals: { needsHuman: number };
          sessions: Array<{ session: { id: string }; status: { status: string } }>;
        };

        const legacy = fleetPayload.sessions.find((item) => item.session.id === "session-legacy-question");
        assert.ok(legacy);
        assert.equal(legacy?.status.status, "parked");
        assert.equal(fleetPayload.totals.needsHuman, 0);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet marks legacy-only sessions without runtime state as non-flowing",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-legacy-runtime-missing");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const now = Date.now();
        const sessionStartedAt = new Date(now - 3 * 60 * 1000).toISOString();
        const summaryAt = new Date(now - 2 * 60 * 1000).toISOString();

        ingestEvents(database, [
          {
            id: "legacy-runtime-missing-start",
            sessionId: "session-runtime-missing",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: sessionStartedAt,
            summary: "Legacy-only started",
            payload: {
              objective: "Session without runtime mirror",
              agentName: "legacy-agent",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "legacy-runtime-missing-summary",
            sessionId: "session-runtime-missing",
            runtime: "codex",
            taskId: null,
            type: "agent.summary_emitted",
            phase: "execute",
            source: "agent",
            timestamp: summaryAt,
            summary: "Still working based on legacy events",
            payload: { workComplete: false }
          }
        ]);

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const fleetPayload = (await fleetResponse.json()) as {
          sessions: Array<{
            session: { id: string };
            status: { status: string; explanation: string; evidence: string[] };
          }>;
          totals: { activeAgents: number };
        };

        const item = fleetPayload.sessions.find((session) => session.session.id === "session-runtime-missing");
        assert.ok(item);
        assert.equal(item?.status.status, "parked");
        assert.match(item?.status.explanation ?? "", /no runtime heartbeat/i);
        assert.ok(item?.status.evidence.some((line) => /no runtime session signal/i.test(line)));
        assert.equal(fleetPayload.totals.activeAgents, 0);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet treats cold running runtime sessions as parked and non-active",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-runtime-cold-running");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const oldTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        upsertRuntimeSession(database, {
          id: "runtime-cold-running",
          runtimeId: "local",
          agentName: "runtime-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: oldTimestamp,
          updatedAt: oldTimestamp
        });

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const payload = (await fleetResponse.json()) as {
          sessions: Array<{ session: { id: string }; status: { status: string }; heartbeatFreshness: string }>;
          totals: { activeAgents: number };
        };

        const item = payload.sessions.find((session) => session.session.id === "runtime-cold-running");
        assert.ok(item);
        assert.equal(item?.heartbeatFreshness, "cold");
        assert.equal(item?.status.status, "parked");
        assert.equal(payload.totals.activeAgents, 0);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet maps runtime waiting_for_input as the only needs_input status",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-runtime-waiting-only");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const now = new Date().toISOString();
        upsertRuntimeSession(database, {
          id: "runtime-waiting-input",
          runtimeId: "local",
          agentName: "runtime-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "waiting_for_input",
          activity: "waiting",
          startedAt: now,
          updatedAt: now
        });

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const payload = (await fleetResponse.json()) as {
          sessions: Array<{ session: { id: string }; status: { status: string } }>;
          totals: { needsHuman: number };
        };

        const waiting = payload.sessions.find((session) => session.session.id === "runtime-waiting-input");
        assert.ok(waiting);
        assert.equal(waiting?.status.status, "needs_input");
        assert.equal(payload.totals.needsHuman, 1);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet keeps legacy-only sessions visible as runtime-missing parked entries",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-runtime-missing-visible");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const now = Date.now();
        const runtimeTs = new Date(now - 60 * 1000).toISOString();
        const legacyTs = new Date(now - 90 * 1000).toISOString();
        upsertRuntimeSession(database, {
          id: "runtime-session",
          runtimeId: "local",
          agentName: "runtime-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: runtimeTs,
          updatedAt: runtimeTs
        });
        ingestEvents(database, [
          {
            id: "legacy-visible-start",
            sessionId: "legacy-visible-session",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: legacyTs,
            summary: "Legacy-only started",
            payload: {
              objective: "Legacy fallback visibility",
              agentName: "legacy-agent",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "legacy-visible-question",
            sessionId: "legacy-visible-session",
            runtime: "codex",
            taskId: null,
            type: "agent.question_asked",
            phase: "execute",
            source: "agent",
            timestamp: new Date(now - 30 * 1000).toISOString(),
            summary: "Need a human answer",
            payload: { resolved: false }
          }
        ]);

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const payload = (await fleetResponse.json()) as {
          sessions: Array<{
            session: { id: string };
            status: { status: string; explanation: string };
          }>;
        };

        const legacyItem = payload.sessions.find((item) => item.session.id === "legacy-visible-session");
        assert.ok(legacyItem);
        assert.equal(legacyItem?.status.status, "parked");
        assert.match(legacyItem?.status.explanation ?? "", /runtime/i);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet maps non-input runtime waiting states to non-needs_input statuses",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-runtime-waiting-table");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;
        const now = new Date().toISOString();

        upsertRuntimeSession(database, {
          id: "runtime-waiting-approval",
          runtimeId: "local",
          agentName: "runtime-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "waiting_for_approval",
          activity: "waiting",
          startedAt: now,
          updatedAt: now
        });
        upsertRuntimeSession(database, {
          id: "runtime-paused",
          runtimeId: "local",
          agentName: "runtime-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "paused",
          activity: "waiting",
          startedAt: now,
          updatedAt: now
        });
        upsertRuntimeSession(database, {
          id: "runtime-completed",
          runtimeId: "local",
          agentName: "runtime-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "completed",
          activity: "waiting",
          startedAt: now,
          updatedAt: now
        });

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const payload = (await fleetResponse.json()) as {
          sessions: Array<{ session: { id: string }; status: { status: string } }>;
          totals: { needsHuman: number };
        };

        const statusById = new Map(payload.sessions.map((item) => [item.session.id, item.status.status]));
        assert.equal(statusById.get("runtime-waiting-approval"), "awaiting_review");
        assert.equal(statusById.get("runtime-paused"), "parked");
        assert.equal(statusById.get("runtime-completed"), "awaiting_review");
        assert.equal(payload.totals.needsHuman, 2);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon route continuity keeps sessions list, detail, active, and timeline endpoints compatible",
    run: async () => {
      const tempDir = makeTempDir("andon-route-continuity");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const sessionId = "session-continuity";
        const seedEvents: AgentEvent[] = [
          {
            id: "continuity-start",
            sessionId,
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            summary: "Continuity session started",
            payload: {
              objective: "Preserve route continuity",
              agentName: "continuity-agent",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "continuity-summary",
            sessionId,
            runtime: "codex",
            taskId: null,
            type: "agent.summary_emitted",
            phase: "execute",
            source: "agent",
            timestamp: new Date(Date.now() - 60 * 1000).toISOString(),
            summary: "Continuity signal",
            payload: { workComplete: false }
          }
        ];
        ingestEvents(database, seedEvents);

        const listResponse = await fetch(`http://127.0.0.1:${port}/sessions`);
        assert.equal(listResponse.status, 200);
        const listPayload = (await listResponse.json()) as {
          sessions: Array<{ id: string }>;
        };
        assert.ok(listPayload.sessions.some((s) => s.id === sessionId));

        const activeResponse = await fetch(`http://127.0.0.1:${port}/sessions/active`);
        assert.equal(activeResponse.status, 200);
        const activePayload = (await activeResponse.json()) as {
          session: { id: string } | null;
        };
        assert.equal(activePayload.session?.id, sessionId);

        const detailResponse = await fetch(`http://127.0.0.1:${port}/sessions/${sessionId}`);
        assert.equal(detailResponse.status, 200);
        const detailPayload = (await detailResponse.json()) as {
          session: { id: string; runtime: string };
          status: { status: string };
          recommendation: { title: string };
        };
        assert.equal(detailPayload.session.id, sessionId);
        assert.ok(Boolean(detailPayload.session.runtime));
        assert.ok(Boolean(detailPayload.status.status));
        assert.ok(Boolean(detailPayload.recommendation.title));

        const timelineResponse = await fetch(`http://127.0.0.1:${port}/sessions/${sessionId}/timeline?tail=10`);
        assert.equal(timelineResponse.status, 200);
        const timelinePayload = (await timelineResponse.json()) as {
          sessionId: string;
          items: Array<{ id: string }>;
          total: number;
        };
        assert.equal(timelinePayload.sessionId, sessionId);
        assert.equal(timelinePayload.total, 2);
        assert.ok(timelinePayload.items.length >= 1);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon fleet omits parked stale sessions older than one hour from mission control",
    run: async () => {
      const tempDir = makeTempDir("andon-fleet-stale-parked");
      const databasePath = path.join(tempDir, "andon.sqlite");
      createDatabase(databasePath);
      const database = new DatabaseSync(databasePath);
      const httpServer = createServer(createAndonHandler(database));

      try {
        httpServer.listen(0, "127.0.0.1");
        await once(httpServer, "listening");
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Could not determine the Andon API test port");
        }
        const port = address.port;

        const staleTimestamp = new Date(Date.now() - (70 * 60 * 1000)).toISOString();
        const freshTimestamp = new Date(Date.now() - (2 * 60 * 1000)).toISOString();

        const events: AgentEvent[] = [
          {
            id: "stale-start",
            sessionId: "session-stale-parked",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: staleTimestamp,
            summary: "Old parked session started",
            payload: {
              objective: "Stale parked objective",
              agentName: "old-agent",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "fresh-start",
            sessionId: "session-fresh",
            runtime: "codex",
            taskId: null,
            type: "session.started",
            phase: "execute",
            source: "agent",
            timestamp: freshTimestamp,
            summary: "Fresh running session started",
            payload: {
              objective: "Fresh objective",
              agentName: "fresh-agent",
              runtime: "codex",
              repoPath: "D:/Projects/active/holistic",
              worktreePath: "D:/Projects/active/holistic"
            }
          },
          {
            id: "fresh-summary",
            sessionId: "session-fresh",
            runtime: "codex",
            taskId: null,
            type: "agent.summary_emitted",
            phase: "execute",
            source: "agent",
            timestamp: freshTimestamp,
            summary: "Fresh progress",
            payload: { workComplete: false }
          }
        ];
        ingestEvents(database, events);
        upsertRuntimeSession(database, {
          id: "session-fresh",
          runtimeId: "local",
          agentName: "fresh-agent",
          repoName: "holistic",
          repoPath: "D:/Projects/active/holistic",
          status: "running",
          activity: "editing",
          startedAt: freshTimestamp,
          updatedAt: freshTimestamp
        });

        const fleetResponse = await fetch(`http://127.0.0.1:${port}/fleet`);
        assert.equal(fleetResponse.status, 200);
        const fleetPayload = (await fleetResponse.json()) as {
          sessions: Array<{ session: { id: string } }>;
          totals: { totalSessions: number; activeAgents: number };
        };

        assert.equal(fleetPayload.sessions.some((item) => item.session.id === "session-stale-parked"), false);
        assert.equal(fleetPayload.sessions.some((item) => item.session.id === "session-fresh"), true);
        assert.equal(fleetPayload.totals.totalSessions, 1);
        assert.equal(fleetPayload.totals.activeAgents, 1);
      } finally {
        database.close();
        httpServer.close();
      }
    }
  },
  {
    name: "Andon OpenHarness adapter normalizes known event types and drops unknown types",
    run: () => {
      const options = { sessionId: "session-openharness", taskId: "task-openharness" };

      // Valid session mapped
      const sessionStart = normalizeOpenHarnessStreamEvent(
        { type: "session_start", summary: "Started OpenHarness" },
        options
      );
      assert.ok(sessionStart);
      assert.equal(sessionStart?.type, "session.started");
      assert.equal(sessionStart?.summary, "Started OpenHarness");
      assert.equal(sessionStart?.source, "collector");
      assert.equal(sessionStart?.runtime, "openharness");
      assert.equal(sessionStart?.sessionId, "session-openharness");

      // Valid assistant mapped via message fallback
      const assistantMessage = normalizeOpenHarnessStreamEvent(
        { type: "assistant_message", message: "Here is what I plan to do." },
        options
      );
      assert.ok(assistantMessage);
      assert.equal(assistantMessage?.type, "agent.summary_emitted");
      assert.equal(assistantMessage?.summary, "Here is what I plan to do.");

      // Valid test failed
      const testFailed = normalizeOpenHarnessStreamEvent(
        { type: "test_failed", content: "Test timed out" },
        options
      );
      assert.ok(testFailed);
      assert.equal(testFailed?.type, "test.failed");
      assert.equal(testFailed?.summary, "Test timed out");

      // Invalid unknown payload safely dropped
      const unknownEvent = normalizeOpenHarnessStreamEvent(
        { type: "browser_interaction", url: "https://example.com" },
        options
      );
      assert.equal(unknownEvent, null);
    }
  },
  {
    name: "File HolisticBridge returns grounding from state.json activeSession",
    run: async () => {
      const root = makeTempDir("andon-file-bridge");
      fs.mkdirSync(path.join(root, ".holistic"), { recursive: true });
      fs.writeFileSync(
        path.join(root, ".holistic", "state.json"),
        JSON.stringify({
          version: 1,
          activeSession: {
            id: "sess-ground-1",
            currentGoal: "Wire Andon grounding",
            title: "T",
            updatedAt: "2026-04-18T12:00:00.000Z",
            assumptions: ["Assume A"],
            blockers: ["Block B"],
            triedItems: ["Try 1"],
            workDone: ["Done 1"],
            changedFiles: ["src/foo.ts"],
            nextSteps: ["Next 1"],
            status: "active"
          }
        }),
        "utf8"
      );

      const { createFileHolisticBridge } = await import("../services/andon-api/src/holistic/file-bridge.ts");
      const bridge = createFileHolisticBridge(root);
      const ctx = await bridge.getContext("sess-ground-1");
      assert.ok(ctx);
      assert.equal(ctx!.objective, "Wire Andon grounding");
      assert.equal(ctx!.currentPhase, "execute");
      assert.ok(ctx!.constraints.includes("Assume A"));
      assert.ok(ctx!.constraints.includes("Block B"));
      assert.deepEqual(ctx!.priorAttempts, ["Try 1"]);
      assert.deepEqual(ctx!.acceptedApproaches, ["Done 1"]);
      assert.deepEqual(ctx!.expectedScope, ["src/foo.ts"]);
      assert.deepEqual(ctx!.successCriteria, ["Next 1"]);

      const missing = await bridge.getContext("other-id");
      assert.equal(missing, null);
    }
  }
];

export { tests };
