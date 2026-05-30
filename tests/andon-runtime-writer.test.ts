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
  updatedAt: "2026-04-30T23:00:30.000Z",
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
    name: "Andon runtime writer treats a turn-completion signal as waiting-for-input, not session end",
    run: () => {
      // An active session (no endedAt) that carries a completion signal means
      // the agent finished its TURN and is waiting for the human — it must NOT
      // be marked completed/historical.
      const waitingSession = {
        ...session,
        completionSignal: {
          kind: "natural-breakpoint",
          source: "agent",
          summary: "Final answer returned."
        },
        latestStatus: "Final answer returned."
      };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:01:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "running"
      };
      const first = writer.buildRuntimeWriterEvents(waitingSession, Date.parse("2026-04-30T23:05:00.000Z"), state, 10_000);

      assert.equal(first.events.some((event) => event.type === "session.completed"), false);
      assert.equal(first.events.some((event) => event.type === "session.needs_input"), true);
      assert.equal(first.lifecycle, "waiting");

      // Once waiting has been signalled, the writer keeps heartbeating (to hold
      // liveness) but does not re-emit needs_input every tick.
      state.lastLifecycle = "waiting";
      state.lastHeartbeatAtMs = Date.parse("2026-04-30T23:05:00.000Z");
      const second = writer.buildRuntimeWriterEvents(waitingSession, Date.parse("2026-04-30T23:05:11.000Z"), state, 10_000);
      assert.equal(second.events.some((event) => event.type === "session.needs_input"), false);
      assert.equal(second.events.some((event) => event.type === "session.heartbeat"), true);
    }
  },
  {
    name: "Andon runtime writer emits session.completed exactly once only when the session has ended",
    run: () => {
      const endedSession = {
        ...session,
        endedAt: "2026-04-30T23:05:00.000Z",
        latestStatus: "Session ended."
      };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:01:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "running"
      };
      const first = writer.buildRuntimeWriterEvents(endedSession, Date.parse("2026-04-30T23:05:30.000Z"), state, 10_000);
      assert.equal(first.events.some((event) => event.type === "session.completed"), true);
      assert.equal(first.events.some((event) => event.type === "session.heartbeat"), false);
      assert.equal(first.lifecycle, "completed");

      state.lastCompletedSessionId = session.id;
      const second = writer.buildRuntimeWriterEvents(endedSession, Date.parse("2026-04-30T23:06:00.000Z"), state, 10_000);
      assert.equal(second.events.some((event) => event.type === "session.completed"), false);
    }
  },
  {
    name: "Andon runtime writer flips back to running (work.started) when work resumes after waiting",
    run: () => {
      const resumedSession = {
        ...session,
        updatedAt: "2026-04-30T23:04:58.000Z",
        completionSignal: null
      };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:05:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "waiting"
      };
      const result = writer.buildRuntimeWriterEvents(resumedSession, Date.parse("2026-04-30T23:05:00.000Z"), state, 10_000);
      assert.equal(result.events.some((event) => event.type === "work.started"), true);
      assert.equal(result.lifecycle, "running");
    }
  },
  {
    name: "Andon runtime writer does not resurrect a stale active session after restart",
    run: () => {
      const staleSession = {
        ...session,
        startedAt: "2026-04-30T20:00:00.000Z",
        updatedAt: "2026-04-30T20:00:30.000Z"
      };
      const state = { lastStartedSessionId: null, lastHeartbeatAtMs: 0, lastCompletedSessionId: null };
      const result = writer.buildRuntimeWriterEvents(staleSession, Date.parse("2026-04-30T23:01:00.000Z"), state, 10_000);

      assert.equal(result.events.length, 0);
      assert.equal(result.shouldEmitStart, false);
      assert.equal(result.shouldEmitHeartbeat, false);
      assert.equal(result.skippedStaleSession, true);
    }
  },
  {
    name: "Andon runtime writer fresh heartbeat after restart can prove liveness",
    run: () => {
      const freshSession = {
        ...session,
        updatedAt: "2026-04-30T23:00:58.000Z"
      };
      const state = { lastStartedSessionId: freshSession.id, lastHeartbeatAtMs: 0, lastCompletedSessionId: null };
      const result = writer.buildRuntimeWriterEvents(freshSession, Date.parse("2026-04-30T23:01:00.000Z"), state, 10_000);

      assert.equal(result.events.filter((event) => event.type === "session.heartbeat").length, 1);
      assert.equal(result.shouldEmitHeartbeat, true);
      assert.equal(result.skippedStaleSession, false);
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
  },
  {
    name: "Andon runtime writer does not default unknown platform identity to Codex",
    run: () => {
      const unknownSession = {
        ...session,
        agent: "unknown",
        runtime: "unknown"
      };
      const event = writer.buildHeartbeatEvent(unknownSession, "2026-04-30T23:02:00.000Z");

      assert.equal(event.runtime, "unknown");
      assert.equal(event.payload.agentName, "unknown");
      assert.equal(event.payload.sourceType, "file_heartbeat");
      assert.equal(event.payload.sourceId, "holistic-file-state-writer");
      assert.equal(event.payload.transport, "cli_writer");
      assert.notEqual(event.payload.agentName, "codex");
    }
  }
];

export { tests };
