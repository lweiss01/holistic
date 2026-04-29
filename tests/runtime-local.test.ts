import assert from "node:assert/strict";

import type { HolisticRuntimeEvent, RuntimeTaskInput } from "../packages/runtime-core/src/index.ts";
import { LocalRuntimeAdapter, parseRuntimeChunk } from "../packages/runtime-local/src/index.ts";

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "runtime-local parser consumes NDJSON and falls back for malformed lines",
    run: () => {
      const chunk = [
        JSON.stringify({ type: "command.completed", message: "ok", activity: "running_command", payload: { command: "echo ok" } }),
        "not-json-line"
      ].join("\n");

      const parsed = parseRuntimeChunk("session-1", "stdout", `${chunk}\n`);
      assert.equal(parsed.events.length, 2);
      assert.equal(parsed.events[0]?.type, "command.completed");
      assert.equal(parsed.events[1]?.type, "tool.completed");
      assert.equal(parsed.remainder, "");
    }
  },
  {
    name: "runtime-local adapter emits lifecycle and heartbeat events",
    run: async () => {
      const adapter = new LocalRuntimeAdapter({ heartbeatIntervalMs: 20 });
      const input: RuntimeTaskInput = {
        runtimeId: "local",
        agentName: "codex",
        repoName: "holistic",
        repoPath: process.cwd(),
        prompt: "Run fake adapter"
      };

      const session = await adapter.startTask(input);
      assert.equal(session.status, "running");
      assert.equal(session.runtimeId, "local");

      const stream = adapter.streamEvents(session.id)[Symbol.asyncIterator]();
      const observed: HolisticRuntimeEvent[] = [];
      const deadline = Date.now() + 1500;

      while (Date.now() < deadline) {
        const next = await Promise.race([
          stream.next(),
          new Promise<IteratorResult<HolisticRuntimeEvent>>((resolve) => {
            setTimeout(() => resolve({ done: true, value: undefined }), 120);
          })
        ]);

        if (next.done || !next.value) {
          continue;
        }
        observed.push(next.value);
        if (next.value.type === "session.completed" || next.value.type === "session.failed") {
          break;
        }
      }

      assert.ok(observed.some((event) => event.type === "session.started"));
      assert.ok(observed.some((event) => event.type === "session.heartbeat"));
      assert.ok(observed.some((event) => event.type === "session.completed" || event.type === "session.failed"));
    }
  },
  {
    name: "runtime-local adapter can stop an active session",
    run: async () => {
      const adapter = new LocalRuntimeAdapter({ heartbeatIntervalMs: 40 });
      const session = await adapter.startTask({
        runtimeId: "local",
        agentName: "codex",
        repoName: "holistic",
        repoPath: process.cwd(),
        prompt: "Stop test"
      });

      await adapter.stopTask(session.id);
      const status = await adapter.getStatus(session.id);
      assert.equal(status.status, "cancelled");
    }
  }
];

export { tests };
