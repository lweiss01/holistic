import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
        lastLifecycle: "running",
        lastLifecycleAssertAtMs: Date.parse("2026-04-30T23:04:59.000Z")
      };
      const first = writer.buildRuntimeWriterEvents(waitingSession, Date.parse("2026-04-30T23:05:00.000Z"), state, 10_000);

      assert.equal(first.events.some((event) => event.type === "session.completed"), false);
      assert.equal(first.events.some((event) => event.type === "session.needs_input"), true);
      assert.equal(first.lifecycle, "waiting");

      // Once waiting has been signalled, the writer keeps heartbeating (to hold
      // liveness) but does not re-emit needs_input every tick (until the
      // periodic re-assert interval elapses).
      state.lastLifecycle = "waiting";
      state.lastHeartbeatAtMs = Date.parse("2026-04-30T23:05:00.000Z");
      state.lastLifecycleAssertAtMs = Date.parse("2026-04-30T23:05:00.000Z");
      const second = writer.buildRuntimeWriterEvents(waitingSession, Date.parse("2026-04-30T23:05:11.000Z"), state, 10_000);
      assert.equal(second.events.some((event) => event.type === "session.needs_input"), false);
      assert.equal(second.events.some((event) => event.type === "session.heartbeat"), true);

      // After the re-assert interval, the writer re-emits needs_input to
      // self-heal in case the stored status drifted (e.g. a restart sweep).
      const third = writer.buildRuntimeWriterEvents(waitingSession, Date.parse("2026-04-30T23:06:30.000Z"), state, 10_000);
      assert.equal(third.events.some((event) => event.type === "session.needs_input"), true);
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
    name: "Andon runtime writer stays live during a long turn when only the turn-state sidecar advances",
    run: () => {
      // state.json last touched hours ago (turn hooks never write it), but the
      // sidecar shows tool activity seconds ago: the session is demonstrably
      // live and the writer must keep emitting heartbeats and asserts.
      const longTurnSession = {
        ...session,
        startedAt: "2026-04-30T20:00:00.000Z",
        updatedAt: "2026-04-30T20:00:30.000Z"
      };
      const state = {
        lastStartedSessionId: longTurnSession.id,
        lastHeartbeatAtMs: 0,
        lastCompletedSessionId: null,
        lastLifecycle: "waiting",
        lastLifecycleAssertAtMs: 0
      };
      const nowMs = Date.parse("2026-04-30T23:01:00.000Z");
      const result = writer.buildRuntimeWriterEvents(longTurnSession, nowMs, state, 10_000, "running", nowMs - 5_000);

      assert.equal(result.skippedStaleSession, false);
      assert.equal(result.events.some((event) => event.type === "session.heartbeat"), true);
      assert.equal(result.events.some((event) => event.type === "work.started"), true);
      assert.equal(result.lifecycle, "running");
    }
  },
  {
    name: "Andon runtime writer asserts waiting from a fresh sidecar even when state.json is stale",
    run: () => {
      // The Stop hook's waiting flip lands in the sidecar; a stale state.json
      // must not gate the assert, or an idle card stays frozen as running.
      const longTurnSession = {
        ...session,
        startedAt: "2026-04-30T20:00:00.000Z",
        updatedAt: "2026-04-30T20:00:30.000Z"
      };
      const state = {
        lastStartedSessionId: longTurnSession.id,
        lastHeartbeatAtMs: 0,
        lastCompletedSessionId: null,
        lastLifecycle: "running",
        lastLifecycleAssertAtMs: 0
      };
      const nowMs = Date.parse("2026-04-30T23:01:00.000Z");
      const result = writer.buildRuntimeWriterEvents(longTurnSession, nowMs, state, 10_000, "waiting", nowMs - 2_000);

      assert.equal(result.skippedStaleSession, false);
      assert.equal(result.events.some((event) => event.type === "session.needs_input"), true);
      assert.equal(result.lifecycle, "waiting");
    }
  },
  {
    name: "Andon runtime writer still decays to stale when state.json and the sidecar are both old",
    run: () => {
      const abandonedSession = {
        ...session,
        startedAt: "2026-04-30T20:00:00.000Z",
        updatedAt: "2026-04-30T20:00:30.000Z"
      };
      const state = { lastStartedSessionId: null, lastHeartbeatAtMs: 0, lastCompletedSessionId: null };
      const nowMs = Date.parse("2026-04-30T23:01:00.000Z");
      const staleSidecarMs = Date.parse("2026-04-30T20:05:00.000Z");
      const result = writer.buildRuntimeWriterEvents(abandonedSession, nowMs, state, 10_000, "running", staleSidecarMs);

      assert.equal(result.skippedStaleSession, true);
      assert.equal(result.events.length, 0);
    }
  },
  {
    name: "Andon runtime writer sidecar record exposes turnState and recordedAt for freshness",
    run: () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-writer-sidecar-"));
      try {
        const stateFile = path.join(dir, "state.json");
        fs.writeFileSync(path.join(dir, "turn-state.json"), JSON.stringify({
          turnState: "waiting",
          recordedAt: "2026-04-30T23:00:59.000Z"
        }), "utf8");

        const record = writer.readTurnStateSidecarRecord(stateFile);
        assert.equal(record.turnState, "waiting");
        assert.equal(record.recordedAtMs, Date.parse("2026-04-30T23:00:59.000Z"));

        const missing = writer.readTurnStateSidecarRecord(path.join(dir, "nope", "state.json"));
        assert.equal(missing.turnState, null);
        assert.equal(missing.recordedAtMs, null);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
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
  },
  {
    name: "Andon runtime writer uses explicit turnState=waiting over completionSignal inference",
    run: () => {
      // A session with turnState=waiting should emit needs_input even without
      // a completionSignal, because the turn hook wrote the signal directly.
      const hookWaitingSession = {
        ...session,
        turnState: "waiting",
        completionSignal: null,
        updatedAt: "2026-04-30T23:05:00.000Z"
      };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:05:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "running",
        lastLifecycleAssertAtMs: Date.parse("2026-04-30T23:04:59.000Z")
      };
      const result = writer.buildRuntimeWriterEvents(hookWaitingSession, Date.parse("2026-04-30T23:05:01.000Z"), state, 10_000);
      assert.equal(result.events.some((e) => e.type === "session.needs_input"), true, "should emit needs_input from turnState=waiting");
      assert.equal(result.events.some((e) => e.type === "session.completed"), false);
      assert.equal(result.lifecycle, "waiting");
    }
  },
  {
    name: "Andon runtime writer uses explicit turnState=running to override completionSignal inference",
    run: () => {
      // A session with turnState=running AND a completionSignal should be treated
      // as running -- the hook said the agent started a new turn.
      const hookRunningSession = {
        ...session,
        turnState: "running",
        completionSignal: {
          kind: "natural-breakpoint",
          source: "agent",
          summary: "Previous turn ended."
        },
        updatedAt: "2026-04-30T23:05:00.000Z"
      };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:05:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "waiting",
        lastLifecycleAssertAtMs: Date.parse("2026-04-30T23:04:59.000Z")
      };
      const result = writer.buildRuntimeWriterEvents(hookRunningSession, Date.parse("2026-04-30T23:05:01.000Z"), state, 10_000);
      assert.equal(result.events.some((e) => e.type === "work.started"), true, "should emit work.started from turnState=running");
      assert.equal(result.events.some((e) => e.type === "session.needs_input"), false);
      assert.equal(result.lifecycle, "running");
    }
  },
  {
    name: "Andon runtime writer falls back to completionSignal when turnState is absent",
    run: () => {
      // Sessions without turnState (older agents, no hook installed) should
      // continue to use completionSignal-based inference unchanged.
      const noTurnStateSession = {
        ...session,
        turnState: undefined,
        completionSignal: {
          kind: "natural-breakpoint",
          source: "agent",
          summary: "Task done."
        },
        updatedAt: "2026-04-30T23:05:00.000Z"
      };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:05:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "running",
        lastLifecycleAssertAtMs: Date.parse("2026-04-30T23:04:59.000Z")
      };
      const result = writer.buildRuntimeWriterEvents(noTurnStateSession, Date.parse("2026-04-30T23:05:01.000Z"), state, 10_000);
      assert.equal(result.events.some((e) => e.type === "session.needs_input"), true, "should fall back to completionSignal inference");
      assert.equal(result.lifecycle, "waiting");
    }
  },
  {
    name: "Andon runtime writer prefers the turn-state sidecar over session.turnState",
    run: () => {
      // The sidecar is what the turn hooks now write; session.turnState only
      // survives as a fallback for state left by older hook versions.
      const staleSession = { ...session, turnState: "running" as const };
      const state = {
        lastStartedSessionId: session.id,
        lastHeartbeatAtMs: Date.parse("2026-04-30T23:05:00.000Z"),
        lastCompletedSessionId: null,
        lastLifecycle: "running",
        lastLifecycleAssertAtMs: Date.parse("2026-04-30T23:04:59.000Z")
      };
      const result = writer.buildRuntimeWriterEvents(
        staleSession,
        Date.parse("2026-04-30T23:05:01.000Z"),
        state,
        10_000,
        "waiting",
      );
      assert.equal(result.lifecycle, "waiting", "sidecar value must win over session.turnState");
      assert.equal(result.events.some((e) => e.type === "session.needs_input"), true);
    }
  },
  {
    name: "Andon runtime writer reads and validates the turn-state sidecar",
    run: () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-turn-sidecar-"));
      const stateFile = path.join(dir, "state.json");
      const sidecar = writer.resolveTurnStateFile(stateFile);
      assert.equal(sidecar, path.join(dir, "turn-state.json"));

      // Missing sidecar reads as null rather than throwing.
      assert.equal(writer.readTurnStateSidecar(stateFile), null);

      fs.writeFileSync(sidecar, JSON.stringify({ turnState: "waiting", recordedAt: "2026-07-27T00:00:00Z" }), "utf8");
      assert.equal(writer.readTurnStateSidecar(stateFile), "waiting");

      fs.writeFileSync(sidecar, JSON.stringify({ turnState: "running" }), "utf8");
      assert.equal(writer.readTurnStateSidecar(stateFile), "running");

      // Garbage and unexpected values must not propagate.
      fs.writeFileSync(sidecar, "{ not json", "utf8");
      assert.equal(writer.readTurnStateSidecar(stateFile), null);
      fs.writeFileSync(sidecar, JSON.stringify({ turnState: "bogus" }), "utf8");
      assert.equal(writer.readTurnStateSidecar(stateFile), null);
    }
  },
  {
    name: "Andon runtime writer resolves a per-agent turn-state sidecar path",
    run: () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-turn-peragent-"));
      try {
        const stateFile = path.join(dir, "state.json");
        assert.equal(writer.resolveTurnStateFile(stateFile, "gemini"), path.join(dir, "turn-state.gemini.json"));
        assert.equal(writer.resolveTurnStateFile(stateFile, "claude"), path.join(dir, "turn-state.claude.json"));
        // No agent keeps the legacy shared path for older installs.
        assert.equal(writer.resolveTurnStateFile(stateFile), path.join(dir, "turn-state.json"));
        // Path traversal in an agent value can never escape the runtime dir.
        assert.equal(
          writer.resolveTurnStateFile(stateFile, "../../evil"),
          path.join(dir, "turn-state.....evil.json")
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "Andon runtime writer never lets one agent's turn signal drive another agent's session",
    run: () => {
      // The bug this guards: a single shared sidecar meant a Gemini turn flipped
      // the Claude card, because turnState came from the file while agentName
      // came from the active session.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-turn-attrib-"));
      try {
        const stateFile = path.join(dir, "state.json");
        fs.writeFileSync(
          path.join(dir, "turn-state.gemini.json"),
          JSON.stringify({ turnState: "running", recordedAt: "2026-07-30T03:14:57.000Z", agent: "gemini" }),
          "utf8"
        );

        // Gemini's own lookup sees it.
        const gemini = writer.readTurnStateSidecarRecord(stateFile, "gemini");
        assert.equal(gemini.turnState, "running");
        assert.equal(gemini.agent, "gemini");

        // Claude must NOT see it -- neither the state nor the freshness stamp,
        // or a foreign agent's activity would resurrect an abandoned session.
        const claude = writer.readTurnStateSidecarRecord(stateFile, "claude");
        assert.equal(claude.turnState, null);
        assert.equal(claude.recordedAtMs, null);

        // An unknown-agent session falls back to the legacy file only.
        const unknown = writer.readTurnStateSidecarRecord(stateFile, "");
        assert.equal(unknown.turnState, null);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "Andon runtime writer prefers a per-agent sidecar over the legacy shared one",
    run: () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-turn-precedence-"));
      try {
        const stateFile = path.join(dir, "state.json");
        // Legacy unattributed file says waiting; the agent's own file says running.
        fs.writeFileSync(
          path.join(dir, "turn-state.json"),
          JSON.stringify({ turnState: "waiting", recordedAt: "2026-07-30T03:00:00.000Z" }),
          "utf8"
        );
        assert.equal(writer.readTurnStateSidecar(stateFile, "claude"), "waiting", "legacy file serves an install with no per-agent file yet");

        fs.writeFileSync(
          path.join(dir, "turn-state.claude.json"),
          JSON.stringify({ turnState: "running", recordedAt: "2026-07-30T03:10:00.000Z", agent: "claude" }),
          "utf8"
        );
        assert.equal(writer.readTurnStateSidecar(stateFile, "claude"), "running", "per-agent file wins once present");

        // A legacy file that names a DIFFERENT agent is not usable here.
        fs.writeFileSync(
          path.join(dir, "turn-state.json"),
          JSON.stringify({ turnState: "waiting", recordedAt: "2026-07-30T03:00:00.000Z", agent: "gemini" }),
          "utf8"
        );
        assert.equal(writer.readTurnStateSidecar(stateFile, "codex"), null);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "Andon runtime writer derives the turn-state agent from the session",
    run: () => {
      assert.equal(writer.sessionTurnStateAgent({ agent: "gemini" }), "gemini");
      assert.equal(writer.sessionTurnStateAgent({ agent: "Claude" }), "claude");
      // runtime is the fallback identity when agent is absent.
      assert.equal(writer.sessionTurnStateAgent({ runtime: "codex" }), "codex");
      // Unknown must resolve to "" so the lookup does not match turn-state.unknown.json.
      assert.equal(writer.sessionTurnStateAgent({ agent: "unknown" }), "");
      assert.equal(writer.sessionTurnStateAgent({}), "");
      assert.equal(writer.sessionTurnStateAgent(undefined), "");
    }
  }
];

export { tests };
