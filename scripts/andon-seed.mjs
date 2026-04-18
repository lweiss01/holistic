import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "..");
const databasePath = process.env.ANDON_DB_PATH ?? resolve(repoRoot, "services/andon-api/data/andon.sqlite");
const schemaPath = resolve(repoRoot, "services/andon-api/sql/001_initial.sql");
const database = new DatabaseSync(databasePath);

const now = Date.now();
const minutesAgo = (min) => new Date(now - min * 60000).toISOString();

const session = {
  id: "session-andon-mvp",
  agentName: "codex",
  runtime: "codex",
  repoPath: "D:/Projects/active/holistic",
  worktreePath: "D:/Projects/active/holistic",
  objective: "Build the first Andon MVP scaffold inside the Holistic repo.",
  currentPhase: "execute",
  startedAt: minutesAgo(12),
  lastEventAt: minutesAgo(0),
  lastSummary: "Scaffolded the monorepo, API skeleton, and shared types for Andon."
};

const task = {
  id: "task-andon-scaffold",
  sessionId: session.id,
  title: "Create the Andon MVP scaffold",
  phase: "execute",
  state: "active",
  startedAt: minutesAgo(10),
  completedAt: null,
  metadata: {
    milestone: "mvp",
    owner: "codex"
  }
};

const events = [
  {
    id: "event-session-started",
    sessionId: session.id,
    taskId: null,
    runtime: session.runtime,
    type: "session.started",
    phase: "plan",
    source: "agent",
    summary: "Started the Andon MVP workstream.",
    payload: {
      objective: session.objective,
      agentName: session.agentName,
      runtime: session.runtime,
      repoPath: session.repoPath,
      worktreePath: session.worktreePath
    },
    createdAt: minutesAgo(12)
  },
  {
    id: "event-phase-execute",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "phase.changed",
    phase: "execute",
    source: "agent",
    summary: "Shifted from planning to implementation.",
    payload: {
      currentPhase: "execute"
    },
    createdAt: minutesAgo(11)
  },
  {
    id: "event-task-started",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "task.started",
    phase: "execute",
    source: "agent",
    summary: "Creating the initial monorepo scaffold.",
    payload: {
      title: task.title,
      startedAt: task.startedAt
    },
    createdAt: minutesAgo(10)
  },
  {
    id: "event-command-started",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "command.started",
    phase: "execute",
    source: "system",
    summary: "Reading repo guidance and package structure.",
    payload: {
      command: "Get-Content HOLISTIC.md"
    },
    createdAt: minutesAgo(9)
  },
  {
    id: "event-command-finished",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "command.finished",
    phase: "execute",
    source: "system",
    summary: "Repo guidance loaded successfully.",
    payload: {
      command: "Get-Content HOLISTIC.md",
      exitCode: 0
    },
    createdAt: minutesAgo(8)
  },
  {
    id: "event-file-changed-core",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "file.changed",
    phase: "execute",
    source: "agent",
    summary: "Added shared Andon core types.",
    payload: {
      path: "packages/andon-core/src/types.ts"
    },
    createdAt: minutesAgo(5)
  },
  {
    id: "event-file-changed-api",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "file.changed",
    phase: "execute",
    source: "agent",
    summary: "Added the Andon API skeleton.",
    payload: {
      path: "services/andon-api/src/server.ts"
    },
    createdAt: minutesAgo(2)
  },
  {
    id: "event-summary-emitted",
    sessionId: session.id,
    taskId: task.id,
    runtime: session.runtime,
    type: "agent.summary_emitted",
    phase: "execute",
    source: "agent",
    summary: "Scaffolded the monorepo, API skeleton, and shared types for Andon.",
    payload: {
      workComplete: false
    },
    createdAt: minutesAgo(0)
  }
];

database.exec("PRAGMA foreign_keys = ON;");
database.exec(readFileSync(schemaPath, "utf8"));
database.exec("DELETE FROM events;");
database.exec("DELETE FROM tasks;");
database.exec("DELETE FROM sessions;");

database
  .prepare(
    `
      INSERT INTO sessions (
        id,
        agent_name,
        runtime_name,
        repo_path,
        worktree_path,
        objective,
        current_phase,
        started_at,
        ended_at,
        last_event_at,
        last_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
  .run(
    session.id,
    session.agentName,
    session.runtime,
    session.repoPath,
    session.worktreePath,
    session.objective,
    session.currentPhase,
    session.startedAt,
    null,
    session.lastEventAt,
    session.lastSummary
  );

database
  .prepare(
    `
      INSERT INTO tasks (id, session_id, title, phase, state, started_at, completed_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  )
  .run(task.id, task.sessionId, task.title, task.phase, task.state, task.startedAt, task.completedAt, JSON.stringify(task.metadata));

const insertEvent = database.prepare(
  `
    INSERT INTO events (id, session_id, task_id, runtime_name, type, phase, source, summary, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
);

for (const event of events) {
  insertEvent.run(
    event.id,
    event.sessionId,
    event.taskId,
    event.runtime,
    event.type,
    event.phase,
    event.source,
    event.summary,
    JSON.stringify(event.payload),
    event.createdAt
  );
}

console.log(`Seeded Andon sample data at ${databasePath}`);
