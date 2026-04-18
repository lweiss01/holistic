import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { deriveRecommendation, deriveStatus, type AgentEvent, type SessionRecord } from "../packages/andon-core/src/index.ts";
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
          holisticContext: null
        }),
        true
      );

      assert.equal(
        shouldPostProgressHeartbeat({
          session: makeSession(),
          activeTask: null,
          status: { status: "awaiting_review", phase: "execute", explanation: "Done", evidence: [] },
          recommendation: { urgency: "medium", title: "Review", actionLabel: "Open", description: "Done" },
          holisticContext: null
        }),
        false
      );

      assert.equal(
        shouldPostProgressHeartbeat({
          session: makeSession(),
          activeTask: { id: "task", sessionId: "session-andon-test", title: "Task", phase: "execute", state: "active", startedAt: "2026-04-18T13:00:00.000Z", completedAt: null, metadata: {} },
          status: { status: "parked", phase: "execute", explanation: "Idle", evidence: [] },
          recommendation: { urgency: "low", title: "Resume", actionLabel: "Decide", description: "Idle" },
          holisticContext: null
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

        const seedEvent: AgentEvent = {
          id: "session-started",
          sessionId: "session-andon-mvp",
          runtime: "codex",
          taskId: null,
          type: "session.started",
          phase: "execute",
          source: "agent",
          timestamp: "2026-04-18T13:00:00.000Z",
          summary: "Started the Andon MVP session.",
          payload: {
            objective: "Build the first Andon MVP scaffold inside the Holistic repo.",
            agentName: "codex",
            runtime: "codex",
            repoPath: "D:/Projects/active/holistic",
            worktreePath: "D:/Projects/active/holistic",
            startedAt: "2026-04-18T13:00:00.000Z"
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
          timestamp: "2026-04-18T13:01:00.000Z",
          summary: "Creating the initial monorepo scaffold.",
          payload: {
            title: "Create the Andon MVP scaffold",
            startedAt: "2026-04-18T13:01:00.000Z"
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
          timestamp: "2026-04-18T13:02:00.000Z",
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

        const activeResponse = await fetch(`http://127.0.0.1:${port}/sessions/active`);
        assert.equal(activeResponse.status, 200);
        const activePayload = (await activeResponse.json()) as {
          session: SessionRecord | null;
          activeTask: { title: string } | null;
          status: { status: string } | null;
        };

        assert.equal(activePayload.session?.id, "session-andon-mvp");
        assert.equal(activePayload.activeTask?.title, "Create the Andon MVP scaffold");
        assert.equal(activePayload.status?.status, "parked");

        const detailResponse = await fetch(`http://127.0.0.1:${port}/sessions/session-andon-mvp`);
        assert.equal(detailResponse.status, 200);
        const detailPayload = (await detailResponse.json()) as {
          holisticContext: { objective: string } | null;
        };
        assert.match(detailPayload.holisticContext?.objective ?? "", /Andon MVP scaffold/i);

        const timelineResponse = await fetch(`http://127.0.0.1:${port}/sessions/session-andon-mvp/timeline`);
        assert.equal(timelineResponse.status, 200);
        const timelinePayload = (await timelineResponse.json()) as { items: AgentEvent[] };
        assert.equal(timelinePayload.items.length, 3);

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
        };

        assert.equal(runningPayload.session?.lastSummary, collectorEvent.summary);
        assert.equal(runningPayload.status?.status, "running");
        assert.match(runningPayload.status?.explanation ?? "", /healthy/i);
        assert.equal(runningPayload.recommendation?.title, "Monitor the session");
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
  }
];

export { tests };
