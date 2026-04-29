import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { HolisticRuntimeEvent, RuntimeSession } from "../packages/runtime-core/src/index.ts";
import {
  getRuntimeApproval,
  getRuntimeEvents,
  getRuntimeProcess,
  getRuntimeSession,
  listPendingRuntimeApprovals,
  listRuntimeSessions,
  upsertRuntimeApproval,
  upsertRuntimeProcess,
  upsertRuntimeSession,
  insertRuntimeEvent,
  type RuntimeApprovalRecord,
  type RuntimeProcessRecord
} from "../services/andon-api/src/runtime-repository.ts";

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
    name: "runtime storage schema persists and queries sessions, events, approvals, and processes",
    run: () => {
      const root = makeTempDir("runtime-storage");
      const database = createDatabase(path.join(root, "andon.sqlite"));

      const session: RuntimeSession = {
        id: "runtime-session-1",
        runtimeId: "local",
        agentName: "codex",
        repoName: "holistic",
        repoPath: "D:/Projects/active/holistic",
        worktreePath: "D:/Projects/active/holistic/.holistic/worktrees/runtime-session-1",
        branch: "holistic/runtime-session-1",
        status: "running",
        activity: "editing",
        startedAt: "2026-04-28T22:10:00.000Z",
        updatedAt: "2026-04-28T22:11:00.000Z",
        pid: 4242,
        metadata: {
          source: "test"
        }
      };

      const event: HolisticRuntimeEvent = {
        id: "runtime-event-1",
        sessionId: session.id,
        type: "file.changed",
        timestamp: "2026-04-28T22:11:30.000Z",
        severity: "info",
        activity: "editing",
        message: "Updated runtime core types",
        payload: {
          file: "packages/runtime-core/src/types.ts"
        }
      };

      const approval: RuntimeApprovalRecord = {
        id: "runtime-approval-1",
        sessionId: session.id,
        status: "pending",
        requestedAt: "2026-04-28T22:12:00.000Z",
        resolvedAt: null,
        prompt: "Install a dependency?",
        payload: {
          command: "npm install some-package"
        }
      };

      const processRecord: RuntimeProcessRecord = {
        sessionId: session.id,
        pid: 4242,
        command: "node agent-runner.js",
        cwd: "D:/Projects/active/holistic",
        startedAt: "2026-04-28T22:10:00.000Z",
        lastHeartbeatAt: "2026-04-28T22:11:45.000Z"
      };

      upsertRuntimeSession(database, session);
      insertRuntimeEvent(database, event);
      upsertRuntimeApproval(database, approval);
      upsertRuntimeProcess(database, processRecord);

      assert.equal(getRuntimeSession(database, session.id)?.runtimeId, "local");
      assert.equal(listRuntimeSessions(database).length, 1);
      assert.equal(getRuntimeEvents(database, session.id)[0]?.type, "file.changed");
      assert.equal(getRuntimeApproval(database, approval.id)?.status, "pending");
      assert.equal(listPendingRuntimeApprovals(database).length, 1);
      assert.equal(getRuntimeProcess(database, session.id)?.pid, 4242);
    }
  }
];

export { tests };
