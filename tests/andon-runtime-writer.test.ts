import assert from "node:assert/strict";

const writer = await import("../scripts/andon-runtime-writer.mjs");

const session = {
  id: "session-runtime-writer",
  agent: "codex",
  currentGoal: "Fix telemetry insight",
  title: "Telemetry insight",
  currentPlan: ["edit runtime writer", "test telemetry"],
  latestStatus: "Session started.",
  startedAt: "2026-04-30T23:00:00.000Z",
  checkpointCount: 2,
  branch: "main"
};

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "Andon runtime writer emits stable session.started once per session state",
    run: () => {
      const state = { lastStartedSessionId: null, lastHeartbeatAtMs: 0 };
      const first = writer.buildRuntimeWriterEvents(session, Date.parse("2026-04-30T23:01:00.000Z"), state, 10_000);
      assert.equal(first.events.filter((event) => event.type === "session.started").length, 1);
      assert.equal(first.events.find((event) => event.type === "session.started")?.id, "runtime-writer-start-session-runtime-writer");

      state.lastStartedSessionId = session.id;
      state.lastHeartbeatAtMs = Date.parse("2026-04-30T23:01:00.000Z");
      const second = writer.buildRuntimeWriterEvents(session, Date.parse("2026-04-30T23:01:05.000Z"), state, 10_000);
      assert.equal(second.events.some((event) => event.type === "session.started"), false);
    }
  },
  {
    name: "Andon runtime writer heartbeat never emits agent.summary_emitted",
    run: () => {
      const event = writer.buildHeartbeatEvent(session, "2026-04-30T23:02:00.000Z");

      assert.equal(event.type, "session.heartbeat");
      assert.notEqual(event.type, "agent.summary_emitted");
      assert.equal(event.summary, "Runtime writer heartbeat.");
      assert.equal(event.payload.latestStatus, "Session started.");
      assert.equal(event.payload.activity, "running_tests");
      assert.equal(event.payload.agentName, "codex");
    }
  }
];

export { tests };
