import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { AgentEvent } from "../packages/andon-core/src/index.ts";
import { classifyReplayEventType } from "../services/andon-api/src/event-integrity.ts";
import { getSessionTimeline, ingestEvents } from "../services/andon-api/src/repository.ts";
import { getRuntimeEvents } from "../services/andon-api/src/runtime-repository.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function createDatabase(): DatabaseSync {
  const tempDir = makeTempDir("andon-event-integrity");
  const databasePath = path.join(tempDir, "andon.sqlite");
  const schema = fs.readFileSync(path.join(process.cwd(), "services/andon-api/sql/001_initial.sql"), "utf8");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
  return database;
}

function makeEvent(overrides: Partial<AgentEvent> & Pick<AgentEvent, "id" | "type" | "timestamp">): AgentEvent {
  return {
    id: overrides.id,
    sessionId: "session-integrity",
    runtime: "codex",
    taskId: null,
    type: overrides.type,
    phase: "execute",
    source: "system",
    timestamp: overrides.timestamp,
    summary: overrides.summary ?? null,
    payload: overrides.payload ?? {},
    ...overrides
  };
}

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "Andon event integrity same branch observed 100 times stores at most one branch context event",
    run: () => {
      const database = createDatabase();
      const events = Array.from({ length: 100 }, (_, index) =>
        makeEvent({
          id: `branch-same-${index}`,
          type: "agent.summary_emitted",
          timestamp: `2026-04-30T23:00:${String(index % 60).padStart(2, "0")}.000Z`,
          summary: "Detected branch switch; review the new branch context.",
          payload: {
            reason: "branch-switch",
            previousBranch: "main",
            currentBranch: "main"
          }
        })
      );

      const result = ingestEvents(database, events);
      const timeline = getSessionTimeline(database, "session-integrity");

      assert.equal(result.inserted, 1);
      assert.equal(timeline?.total, 1);
      assert.equal(timeline?.items[0]?.type, "context.branch_changed");
      assert.equal(timeline?.items[0]?.summary, "Detected branch switch; review the new branch context.");
    }
  },
  {
    name: "Andon event integrity actual branch A to B emits exactly one branch context event",
    run: () => {
      const database = createDatabase();

      ingestEvents(database, [
        makeEvent({
          id: "branch-a-b",
          type: "session.checkpoint_created",
          timestamp: "2026-04-30T23:05:00.000Z",
          summary: "Detected a branch switch from main to feature; Holistic captured a continuity checkpoint automatically.",
          payload: {
            reason: "branch-switch",
            previousBranch: "main",
            currentBranch: "feature"
          }
        })
      ]);

      const timeline = getSessionTimeline(database, "session-integrity");
      assert.equal(timeline?.total, 1);
      assert.equal(timeline?.items[0]?.type, "context.branch_changed");
      assert.equal((timeline?.items[0]?.payload as Record<string, unknown>).previousBranch, "main");
      assert.equal((timeline?.items[0]?.payload as Record<string, unknown>).currentBranch, "feature");
    }
  },
  {
    name: "Andon event integrity branch B repeated after transition emits no additional branch context spam",
    run: () => {
      const database = createDatabase();
      const first = makeEvent({
        id: "branch-main-feature",
        type: "session.checkpoint_created",
        timestamp: "2026-04-30T23:10:00.000Z",
        summary: "Detected a branch switch from main to feature; Holistic captured a continuity checkpoint automatically.",
        payload: {
          reason: "branch-switch",
          previousBranch: "main",
          currentBranch: "feature"
        }
      });
      const repeated = Array.from({ length: 25 }, (_, index) => ({
        ...first,
        id: `branch-main-feature-repeat-${index}`,
        timestamp: `2026-04-30T23:11:${String(index).padStart(2, "0")}.000Z`
      }));

      const result = ingestEvents(database, [first, ...repeated]);
      const timeline = getSessionTimeline(database, "session-integrity");

      assert.equal(result.inserted, 1);
      assert.equal(timeline?.items.filter((event) => event.type === "context.branch_changed").length, 1);
    }
  },
  {
    name: "Andon event integrity heartbeat noop and checkpoint events are not persisted as agent summaries",
    run: () => {
      const database = createDatabase();
      ingestEvents(database, [
        makeEvent({
          id: "heartbeat",
          type: "session.heartbeat",
          timestamp: "2026-04-30T23:15:00.000Z",
          summary: "Runtime heartbeat."
        }),
        makeEvent({
          id: "noop",
          type: "telemetry.noop",
          timestamp: "2026-04-30T23:15:01.000Z",
          summary: "Poll observed no change."
        }),
        makeEvent({
          id: "checkpoint",
          type: "session.checkpoint_created",
          timestamp: "2026-04-30T23:15:02.000Z",
          summary: "Saved continuity checkpoint."
        }),
        makeEvent({
          id: "summary",
          type: "agent.summary_emitted",
          timestamp: "2026-04-30T23:15:03.000Z",
          summary: "Implemented the replay integrity fix."
        })
      ]);

      const timeline = getSessionTimeline(database, "session-integrity");
      const types = timeline?.items.map((event) => event.type) ?? [];

      assert.deepEqual(types, [
        "session.heartbeat",
        "telemetry.noop",
        "holistic.checkpoint",
        "agent.summary_emitted"
      ]);
      assert.equal(types.filter((type) => type === "agent.summary_emitted").length, 1);
    }
  },
  {
    name: "Andon event integrity replay classifier distinguishes liveness noop checkpoint context summary and activity",
    run: () => {
      assert.equal(classifyReplayEventType("session.heartbeat"), "heartbeat_liveness");
      assert.equal(classifyReplayEventType("telemetry.noop"), "noop_telemetry");
      assert.equal(classifyReplayEventType("holistic.checkpoint"), "checkpoint");
      assert.equal(classifyReplayEventType("context.branch_changed"), "context_branch_change");
      assert.equal(classifyReplayEventType("agent.summary_emitted"), "agent_summary");
      assert.equal(classifyReplayEventType("file.changed"), "meaningful_activity");
    }
  },
  {
    name: "Andon event integrity runtime mirror preserves replay event semantics instead of heartbeat-wrapping everything",
    run: () => {
      const database = createDatabase();
      ingestEvents(database, [
        makeEvent({
          id: "mirror-branch",
          type: "agent.summary_emitted",
          timestamp: "2026-04-30T23:20:00.000Z",
          summary: "Detected branch switch; review the new branch context.",
          payload: {
            reason: "branch-switch",
            previousBranch: "main",
            currentBranch: "feature"
          }
        }),
        makeEvent({
          id: "mirror-checkpoint",
          type: "session.checkpoint_created",
          timestamp: "2026-04-30T23:21:00.000Z",
          summary: "Saved checkpoint."
        }),
        makeEvent({
          id: "mirror-noop",
          type: "telemetry.noop",
          timestamp: "2026-04-30T23:22:00.000Z",
          summary: "Poll observed no change."
        })
      ]);

      const runtimeEvents = getRuntimeEvents(database, "session-integrity");
      assert.deepEqual(runtimeEvents.map((event) => event.type), [
        "context.branch_changed",
        "holistic.checkpoint",
        "telemetry.noop"
      ]);
      assert.equal(runtimeEvents.some((event) => event.type === "agent.summary"), false);
    }
  }
];

export { tests };
