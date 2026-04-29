import assert from "node:assert/strict";

import {
  HOLISTIC_RUNTIME_EVENT_TYPES,
  RUNTIME_ACTIVITIES,
  RUNTIME_IDS,
  RUNTIME_STATUSES,
  type AgentRuntimeAdapter,
  type HolisticRuntimeEvent,
  type RuntimeCapabilities,
  type RuntimeSession,
  type RuntimeTaskInput
} from "../packages/runtime-core/src/index.ts";

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "runtime-core exports the canonical runtime enums and event contract",
    run: () => {
      assert.deepEqual(RUNTIME_IDS, ["local", "codex", "claude-code", "openharness", "custom"]);
      assert.equal(RUNTIME_STATUSES.includes("waiting_for_approval"), true);
      assert.equal(RUNTIME_ACTIVITIES.includes("running_tests"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("approval.requested"), true);
      assert.equal(HOLISTIC_RUNTIME_EVENT_TYPES.includes("git.conflict_detected"), true);
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
  }
];

export { tests };
