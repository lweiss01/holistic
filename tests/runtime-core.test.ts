import assert from "node:assert/strict";

import {
  HOLISTIC_RUNTIME_EVENT_TYPES,
  MINIMUM_ANDON_EVENT_CONTRACT,
  RUNTIME_ACTIVITIES,
  RUNTIME_FRESHNESS_STATES,
  RUNTIME_IDS,
  RUNTIME_OPERATIONAL_CATEGORIES,
  RUNTIME_STATUSES,
  isRuntimeHeartbeatEvent,
  isRuntimeHistoricalStatus,
  isRuntimeMeaningfulActivityEvent,
  isRuntimeNeedsActionStatus,
  isRuntimeReviewStatus,
  isRuntimeRunningStatus,
  isRuntimeSummaryEvent,
  runtimeEventSignificance,
  runtimeSessionCanBeTrustedAsLive,
  type AgentRuntimeAdapter,
  type HolisticRuntimeEvent,
  type RuntimeAndonTrustSnapshot,
  type RuntimeCapabilities,
  type RuntimeSession,
  type RuntimeTaskInput
} from "../packages/runtime-core/src/index.ts";

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "runtime-core exports the canonical runtime enums and event contract",
    run: () => {
      assert.deepEqual(RUNTIME_IDS, [
        "local",
        "codex",
        "chatgpt",
        "claude-code",
        "claude_code",
        "cursor",
        "aider",
        "openharness",
        "openhands",
        "jules",
        "github_copilot",
        "gsd",
        "symphony_runner",
        "local_cli",
        "file_heartbeat",
        "custom"
      ]);
      assert.equal(RUNTIME_STATUSES.includes("waiting_for_approval"), true);
      assert.equal(RUNTIME_STATUSES.includes("awaiting_review"), true);
      assert.equal(RUNTIME_STATUSES.includes("terminated"), true);
      assert.deepEqual(RUNTIME_FRESHNESS_STATES, ["fresh", "stale", "cold", "unknown"]);
      assert.deepEqual(RUNTIME_OPERATIONAL_CATEGORIES, [
        "live",
        "needs_action",
        "degraded_active",
        "review",
        "historical",
        "unknown"
      ]);
      assert.equal(RUNTIME_ACTIVITIES.includes("running_tests"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("approval.requested"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("review.requested"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("context.branch_changed"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("telemetry.noop"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("agent.summary"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("git.conflict_detected"), true);
      assert.equal(MINIMUM_ANDON_EVENT_CONTRACT.missingTelemetryBehavior, "unknown");
    }
  },
  {
    name: "runtime-core adapter contract supports a typed local adapter shape",
    run: async () => {
      const capabilities: RuntimeCapabilities = {
        canPause: true,
        canResume: true,
        canStop: true,
        canRequestApproval: true,
        canStreamStructuredEvents: true,
        canCreateWorktree: false,
        canReportToolUse: true,
        canReportTokenUsage: false,
      };

      const session: RuntimeSession = {
        id: "runtime-session-1",
        runtimeId: "local",
        agentName: "codex",
        repoName: "holistic",
        repoPath: "D:/Projects/active/holistic",
        status: "running",
        activity: "editing",
        startedAt: "2026-04-28T22:00:00.000Z",
        updatedAt: "2026-04-28T22:01:00.000Z",
        pid: 1234,
      };

      const event: HolisticRuntimeEvent = {
        id: "evt-1",
        sessionId: session.id,
        type: "session.heartbeat",
        timestamp: "2026-04-28T22:01:00.000Z",
        activity: "editing",
        severity: "info",
        payload: {
          currentFile: "src/cli.ts",
        },
      };

      const adapter: AgentRuntimeAdapter = {
        id: "local",
        label: "Local Runtime",
        capabilities,
        async startTask(input: RuntimeTaskInput): Promise<RuntimeSession> {
          assert.equal(input.runtimeId, "local");
          return session;
        },
        async pauseTask(): Promise<void> {},
        async resumeTask(): Promise<void> {},
        async stopTask(): Promise<void> {},
        async getStatus(): Promise<RuntimeSession> {
          return session;
        },
        async *streamEvents(): AsyncIterable<HolisticRuntimeEvent> {
          yield event;
        },
      };

      const started = await adapter.startTask({
        repoPath: "D:/Projects/active/holistic",
        repoName: "holistic",
        prompt: "Implement runtime core",
        agentName: "codex",
        runtimeId: "local",
      });
      assert.equal(started.runtimeId, "local");

      const streamed: HolisticRuntimeEvent[] = [];
      for await (const item of adapter.streamEvents(session.id)) {
        streamed.push(item);
      }
      assert.equal(streamed[0]?.type, "session.heartbeat");
    }
  },
  {
    name: "runtime-core contract separates heartbeat/no-op/summary/context from meaningful activity",
    run: () => {
      const heartbeat: HolisticRuntimeEvent = {
        id: "heartbeat-1",
        sessionId: "runtime-session-1",
        type: "session.heartbeat",
        timestamp: "2026-04-30T22:00:00.000Z"
      };
      const noop: HolisticRuntimeEvent = {
        id: "noop-1",
        sessionId: "runtime-session-1",
        type: "telemetry.noop",
        timestamp: "2026-04-30T22:00:01.000Z"
      };
      const branchContext: HolisticRuntimeEvent = {
        id: "branch-1",
        sessionId: "runtime-session-1",
        type: "context.branch_changed",
        timestamp: "2026-04-30T22:00:02.000Z",
        payload: {
          from: "main",
          to: "codex/recovery"
        }
      };
      const summary: HolisticRuntimeEvent = {
        id: "summary-1",
        sessionId: "runtime-session-1",
        type: "agent.summary",
        timestamp: "2026-04-30T22:00:03.000Z",
        message: "Summarized prior context."
      };
      const fileChange: HolisticRuntimeEvent = {
        id: "file-1",
        sessionId: "runtime-session-1",
        type: "file.changed",
        timestamp: "2026-04-30T22:00:04.000Z",
        payload: {
          path: "packages/runtime-core/src/events.ts"
        }
      };

      assert.equal(isRuntimeHeartbeatEvent(heartbeat), true);
      assert.equal(isRuntimeMeaningfulActivityEvent(heartbeat), false);
      assert.equal(isRuntimeSummaryEvent(heartbeat), false);
      assert.equal(runtimeEventSignificance(noop.type), "noop");
      assert.equal(isRuntimeMeaningfulActivityEvent(noop), false);
      assert.equal(isRuntimeSummaryEvent(noop), false);
      const repeatedLivenessOnly = Array.from({ length: 100 }, (_, index): HolisticRuntimeEvent => ({
        id: `liveness-${index}`,
        sessionId: "runtime-session-1",
        type: index % 2 === 0 ? "session.heartbeat" : "telemetry.noop",
        timestamp: `2026-04-30T22:01:${String(index % 60).padStart(2, "0")}.000Z`
      }));
      assert.equal(repeatedLivenessOnly.some((event) => isRuntimeSummaryEvent(event)), false);
      assert.equal(repeatedLivenessOnly.some((event) => isRuntimeMeaningfulActivityEvent(event)), false);
      assert.equal(runtimeEventSignificance(branchContext.type), "branch_environment_context");
      assert.equal(isRuntimeMeaningfulActivityEvent(branchContext), false);
      assert.equal(runtimeEventSignificance(summary.type), "summary");
      assert.equal(isRuntimeSummaryEvent(summary), true);
      assert.equal(isRuntimeMeaningfulActivityEvent(summary), false);
      assert.equal(runtimeEventSignificance(fileChange.type), "meaningful_activity");
      assert.equal(isRuntimeMeaningfulActivityEvent(fileChange), true);
    }
  },
  {
    name: "runtime-core contract keeps waiting/review/terminal statuses distinct from running",
    run: () => {
      assert.equal(isRuntimeRunningStatus("running"), true);
      assert.equal(isRuntimeRunningStatus("starting"), true);
      assert.equal(isRuntimeNeedsActionStatus("waiting_for_input"), true);
      assert.equal(isRuntimeRunningStatus("waiting_for_input"), false);
      assert.equal(isRuntimeReviewStatus("waiting_for_approval"), true);
      assert.equal(isRuntimeReviewStatus("awaiting_review"), true);
      assert.equal(isRuntimeRunningStatus("waiting_for_approval"), false);
      assert.equal(isRuntimeRunningStatus("awaiting_review"), false);
      assert.equal(isRuntimeHistoricalStatus("completed"), true);
      assert.equal(isRuntimeHistoricalStatus("terminated"), true);
      assert.equal(isRuntimeRunningStatus("completed"), false);
      assert.equal(isRuntimeRunningStatus("terminated"), false);
    }
  },
  {
    name: "runtime-core live trust requires runtime truth and fresh telemetry",
    run: () => {
      const liveSnapshot: RuntimeAndonTrustSnapshot = {
        sessionId: "runtime-session-1",
        runtimeId: "local",
        rawStatus: "running",
        runtimeExists: true,
        processAlive: true,
        freshness: "fresh",
        lastHeartbeatAt: "2026-04-30T22:00:00.000Z",
        lastMeaningfulActivityAt: "2026-04-30T22:00:00.000Z",
        telemetryMissing: false,
        sourceOfTruth: "runtime"
      };

      assert.equal(runtimeSessionCanBeTrustedAsLive(liveSnapshot), true);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        rawStatus: "waiting_for_input"
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        rawStatus: "waiting_for_approval"
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        rawStatus: "completed"
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        rawStatus: "terminated"
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        rawStatus: "missing",
        runtimeExists: false,
        freshness: "unknown",
        lastHeartbeatAt: null,
        lastMeaningfulActivityAt: null,
        telemetryMissing: true,
        sourceOfTruth: "missing"
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        rawStatus: "unknown",
        freshness: "unknown",
        telemetryMissing: true
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        freshness: "cold"
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        processAlive: false
      }), false);
      assert.equal(runtimeSessionCanBeTrustedAsLive({
        ...liveSnapshot,
        processAlive: "unknown"
      }), false);
    }
  }
];

export { tests };
