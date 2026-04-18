import type { DatabaseSync } from "node:sqlite";

import type {
  ActiveSessionResponse,
  AgentEvent,
  SessionDetailResponse,
  SessionRecord,
  TaskRecord,
  TimelineResponse
} from "../../../packages/andon-core/src/index.ts";
import { deriveRecommendation, deriveStatus } from "../../../packages/andon-core/src/index.ts";
import type { HolisticBridge } from "../../../packages/holistic-bridge-types/src/index.ts";

function parseJson(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    agentName: String(row.agent_name),
    runtime: String(row.runtime_name) as SessionRecord["runtime"],
    repoPath: String(row.repo_path),
    worktreePath: String(row.worktree_path),
    objective: String(row.objective),
    currentPhase: String(row.current_phase) as SessionRecord["currentPhase"],
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    lastEventAt: String(row.last_event_at),
    lastSummary: row.last_summary ? String(row.last_summary) : null
  };
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    title: String(row.title),
    phase: String(row.phase) as TaskRecord["phase"],
    state: String(row.state) as TaskRecord["state"],
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    metadata: parseJson(String(row.metadata_json))
  };
}

function mapEvent(row: Record<string, unknown>): AgentEvent {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    runtime: row.runtime_name ? (String(row.runtime_name) as AgentEvent["runtime"]) : null,
    taskId: row.task_id ? String(row.task_id) : null,
    type: String(row.type) as AgentEvent["type"],
    phase: row.phase ? (String(row.phase) as AgentEvent["phase"]) : null,
    source: String(row.source) as AgentEvent["source"],
    summary: row.summary ? String(row.summary) : null,
    timestamp: String(row.created_at),
    payload: parseJson(String(row.payload_json))
  };
}

function getSessionRow(database: DatabaseSync, sessionId: string): SessionRecord | null {
  const row = database
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;

  return row ? mapSession(row) : null;
}

function getActiveTask(database: DatabaseSync, sessionId: string): TaskRecord | null {
  const row = database
    .prepare("SELECT * FROM tasks WHERE session_id = ? AND state = 'active' ORDER BY started_at DESC LIMIT 1")
    .get(sessionId) as Record<string, unknown> | undefined;

  return row ? mapTask(row) : null;
}

function getEvents(database: DatabaseSync, sessionId: string): AgentEvent[] {
  const rows = database
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as Record<string, unknown>[];

  return rows.map(mapEvent);
}

async function buildSessionDetail(
  database: DatabaseSync,
  session: SessionRecord,
  holisticBridge: HolisticBridge
): Promise<SessionDetailResponse> {
  const activeTask = getActiveTask(database, session.id);
  const events = getEvents(database, session.id);
  const holisticContext = await holisticBridge.getContext(session.id);
  const status = deriveStatus({ session, events, holisticContext });
  const recommendation = deriveRecommendation({ session, events, holisticContext, status });

  return {
    session,
    activeTask,
    status,
    recommendation,
    holisticContext
  };
}

export async function getActiveSession(
  database: DatabaseSync,
  holisticBridge: HolisticBridge
): Promise<ActiveSessionResponse> {
  const row = database
    .prepare("SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY last_event_at DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined;

  if (!row) {
    return {
      session: null,
      activeTask: null,
      status: null,
      recommendation: null,
      holisticContext: null
    };
  }

  const session = mapSession(row);
  const detail = await buildSessionDetail(database, session, holisticBridge);

  return {
    session: detail.session,
    activeTask: detail.activeTask,
    status: detail.status,
    recommendation: detail.recommendation,
    holisticContext: detail.holisticContext
  };
}

export async function getSessionDetail(
  database: DatabaseSync,
  holisticBridge: HolisticBridge,
  sessionId: string
): Promise<SessionDetailResponse | null> {
  const session = getSessionRow(database, sessionId);
  if (!session) {
    return null;
  }

  return buildSessionDetail(database, session, holisticBridge);
}

export function getSessionsList(database: DatabaseSync): SessionRecord[] {
  const rows = database
    .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT 50")
    .all() as Record<string, unknown>[];
    
  return rows.map(mapSession);
}

export function getSessionTimeline(database: DatabaseSync, sessionId: string): TimelineResponse | null {
  const session = getSessionRow(database, sessionId);
  if (!session) {
    return null;
  }

  return {
    sessionId,
    items: getEvents(database, sessionId)
  };
}

function ensureSession(database: DatabaseSync, event: AgentEvent): void {
  const payload = event.payload as Record<string, unknown>;
  const existing = getSessionRow(database, event.sessionId);
  const nextPhase = (event.phase ?? payload.currentPhase ?? "plan") as SessionRecord["currentPhase"];
  const objective = String(payload.objective ?? existing?.objective ?? "Unknown objective");
  const agentName = String(payload.agentName ?? existing?.agentName ?? "codex");
  const runtime = String(payload.runtime ?? event.runtime ?? existing?.runtime ?? "unknown");
  const repoPath = String(payload.repoPath ?? existing?.repoPath ?? process.cwd());
  const worktreePath = String(payload.worktreePath ?? existing?.worktreePath ?? process.cwd());
  const startedAt = String(payload.startedAt ?? existing?.startedAt ?? event.timestamp);
  const endedAt = event.type === "session.ended" ? event.timestamp : (existing?.endedAt ?? null);
  const lastSummary =
    event.type === "agent.summary_emitted"
      ? (event.summary ?? String(payload.summary ?? ""))
      : (existing?.lastSummary ?? null);

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
        ON CONFLICT(id) DO UPDATE SET
          agent_name = excluded.agent_name,
          runtime_name = excluded.runtime_name,
          repo_path = excluded.repo_path,
          worktree_path = excluded.worktree_path,
          objective = excluded.objective,
          current_phase = excluded.current_phase,
          ended_at = excluded.ended_at,
          last_event_at = excluded.last_event_at,
          last_summary = excluded.last_summary
      `
    )
    .run(
      event.sessionId,
      agentName,
      runtime,
      repoPath,
      worktreePath,
      objective,
      nextPhase,
      startedAt,
      endedAt,
      event.timestamp,
      lastSummary
    );
}

function upsertTask(database: DatabaseSync, event: AgentEvent): void {
  if (!event.taskId) {
    return;
  }

  const payload = event.payload as Record<string, unknown>;
  const title = String(payload.title ?? "Untitled task");
  const phase = (event.phase ?? payload.phase ?? "plan") as TaskRecord["phase"];
  const state: TaskRecord["state"] = event.type === "task.completed" ? "completed" : "active";
  const completedAt = event.type === "task.completed" ? event.timestamp : null;

  database
    .prepare(
      `
        INSERT INTO tasks (id, session_id, title, phase, state, started_at, completed_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          phase = excluded.phase,
          state = excluded.state,
          completed_at = excluded.completed_at,
          metadata_json = excluded.metadata_json
      `
    )
    .run(
      event.taskId,
      event.sessionId,
      title,
      phase,
      state,
      String(payload.startedAt ?? event.timestamp),
      completedAt,
      JSON.stringify(payload)
    );
}

export function ingestEvents(database: DatabaseSync, events: AgentEvent[]): { inserted: number } {
  database.exec("BEGIN");

  try {
    const insertEvent = database.prepare(
      `
        INSERT OR REPLACE INTO events (
          id,
          session_id,
          task_id,
          runtime_name,
          type,
          phase,
          source,
          summary,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    for (const event of events) {
      ensureSession(database, event);

      if (event.type === "task.started" || event.type === "task.completed") {
        upsertTask(database, event);
      }

      insertEvent.run(
        event.id,
        event.sessionId,
        event.taskId ?? null,
        event.runtime ?? null,
        event.type,
        event.phase ?? null,
        event.source,
        event.summary ?? null,
        JSON.stringify(event.payload ?? {}),
        event.timestamp
      );
    }

    database.exec("COMMIT");
    return { inserted: events.length };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
