import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { HolisticRuntimeEvent, RuntimeSession } from "../packages/runtime-core/src/index.ts";
import { createRuntimeAdapterRegistry } from "../services/runtime-service/src/adapter-registry.ts";
import { createRuntimeServiceHandler } from "../services/runtime-service/src/server.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function createDatabase(databasePath: string): DatabaseSync {
  const schema = fs.readFileSync(path.join(process.cwd(), "services/andon-api/sql/001_initial.sql"), "utf8");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
  return database;
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "runtime service exposes empty states and missing-session errors",
    run: async () => {
      const database = createDatabase(path.join(makeTempDir("runtime-service-empty"), "andon.sqlite"));
      const server = createServer(createRuntimeServiceHandler(database, createRuntimeAdapterRegistry()));

      try {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Missing runtime-service test port");
        }

        const base = `http://127.0.0.1:${address.port}`;

        const sessionsResponse = await fetch(`${base}/runtime/sessions`);
        assert.equal(sessionsResponse.status, 200);
        const sessionsPayload = (await sessionsResponse.json()) as { sessions: RuntimeSession[] };
        assert.equal(sessionsPayload.sessions.length, 0);

        const missingDetail = await fetch(`${base}/runtime/sessions/missing`);
        assert.equal(missingDetail.status, 404);

        const missingEvents = await fetch(`${base}/runtime/sessions/missing/events`);
        assert.equal(missingEvents.status, 404);
      } finally {
        database.close();
        server.close();
      }
    }
  },
  {
    name: "runtime service can start/query/transition sessions and stream normalized local events",
    run: async () => {
      const database = createDatabase(path.join(makeTempDir("runtime-service-actions"), "andon.sqlite"));
      const server = createServer(createRuntimeServiceHandler(database));

      try {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Missing runtime-service test port");
        }

        const base = `http://127.0.0.1:${address.port}`;
        const repoPath = process.cwd();
        const startResponse = await fetch(`${base}/runtime/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runtimeId: "local",
            prompt: "Run fake task",
            agentName: "codex",
            repoPath,
            repoName: "holistic",
            metadata: {
              localEnv: {
                HOLISTIC_FAKE_MALFORMED: "1"
              }
            }
          })
        });
        assert.equal(startResponse.status, 202);
        const started = (await startResponse.json()) as { session: RuntimeSession & { freshness: { freshness: string } } };

        const detailResponse = await fetch(`${base}/runtime/sessions/${started.session.id}`);
        assert.equal(detailResponse.status, 200);
        const detailPayload = (await detailResponse.json()) as { session: RuntimeSession & { freshness: { freshness: string } } };
        assert.equal(detailPayload.session.freshness.freshness, "active");

        // Stream ingest is async; allow a short retry window for emitted local events.
        let events: HolisticRuntimeEvent[] = [];
        for (let i = 0; i < 25; i += 1) {
          const eventsResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/events`);
          const payload = (await eventsResponse.json()) as { events: HolisticRuntimeEvent[] };
          events = payload.events;
          if (events.some((event) => event.type === "session.completed" || event.type === "session.failed")) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        assert.ok(events.some((event) => event.type === "session.started"));
        assert.ok(events.some((event) => event.type === "phase.changed"));
        assert.ok(events.some((event) => event.type === "file.changed"));
        assert.ok(events.some((event) => event.type === "session.heartbeat"));

        const pauseResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/pause`, { method: "POST" });
        assert.equal(pauseResponse.status, 200);
        const paused = (await pauseResponse.json()) as { session: RuntimeSession };
        assert.equal(paused.session.status, "paused");

        const resumeResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/resume`, { method: "POST" });
        assert.equal(resumeResponse.status, 200);
        const resumed = (await resumeResponse.json()) as { session: RuntimeSession };
        assert.equal(resumed.session.status, "running");

        const stopResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/stop`, { method: "POST" });
        assert.equal(stopResponse.status, 200);
        const stopped = (await stopResponse.json()) as { session: RuntimeSession };
        assert.equal(stopped.session.status, "cancelled");

        const approveResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId: "approval-runtime-1", prompt: "Approve runtime action" })
        });
        assert.equal(approveResponse.status, 200);

        const denyResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/deny`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId: "approval-runtime-2", prompt: "Deny runtime action" })
        });
        assert.equal(denyResponse.status, 200);

        const finalEventsResponse = await fetch(`${base}/runtime/sessions/${started.session.id}/events`);
        const finalEventsPayload = (await finalEventsResponse.json()) as { events: HolisticRuntimeEvent[] };
        assert.ok(finalEventsPayload.events.some((event) => event.type === "session.paused"));
        assert.ok(finalEventsPayload.events.some((event) => event.type === "approval.granted"));
        assert.ok(finalEventsPayload.events.some((event) => event.type === "approval.denied"));
      } finally {
        database.close();
        server.close();
      }
    }
  }
];

export { tests };
