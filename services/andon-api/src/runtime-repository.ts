import type { DatabaseSync } from "node:sqlite";

import type {
  HolisticRuntimeEvent,
  RuntimeActivity,
  RuntimeSession,
  RuntimeStatus
} from "../../../packages/runtime-core/src/index.ts";

function parseJson(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

function stringifyJson(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {});
}

export interface RuntimeApprovalRecord {
  id: string;
  sessionId: string;
  status: "pending" | "granted" | "denied";
  requestedAt: string;
  resolvedAt: string | null;
  prompt: string;
  payload: Record<string, unknown>;
}

export interface RuntimeProcessRecord {
  sessionId: string;
  pid: number | null;
  command: string | null;
  cwd: string | null;
  startedAt: string;
  lastHeartbeatAt: string | null;
}

function mapRuntimeSession(row: Record<string, unknown>): RuntimeSession {
  return {
    id: String(row.id),
    runtimeId: String(row.runtime_id) as RuntimeSession["runtimeId"],
    agentName: String(row.agent_name),
    repoName: String(row.repo_name),
    repoPath: String(row.repo_path),
    worktreePath: row.worktree_path ? String(row.worktree_path) : undefined,
    branch: row.branch ? String(row.branch) : undefined,
    status: String(row.status) as RuntimeStatus,
    activity: String(row.activity) as RuntimeActivity,
    startedAt: String(row.started_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    pid: row.pid == null ? undefined : Number(row.pid),
    metadata: parseJson(String(row.metadata_json))
  };
}

function mapRuntimeEvent(row: Record<string, unknown>): HolisticRuntimeEvent {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    type: String(row.type) as HolisticRuntimeEvent["type"],
    timestamp: String(row.timestamp),
    severity: row.severity ? (String(row.severity) as HolisticRuntimeEvent["severity"]) : undefined,
    message: row.message ? String(row.message) : undefined,
    activity: row.activity ? (String(row.activity) as HolisticRuntimeEvent["activity"]) : undefined,
    payload: parseJson(String(row.payload_json))
  };
}

function mapRuntimeApproval(row: Record<string, unknown>): RuntimeApprovalRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    status: String(row.status) as RuntimeApprovalRecord["status"],
    requestedAt: String(row.requested_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    prompt: String(row.prompt),
    payload: parseJson(String(row.payload_json))
  };
}

function mapRuntimeProcess(row: Record<string, unknown>): RuntimeProcessRecord {
  return {
    sessionId: String(row.session_id),
    pid: row.pid == null ? null : Number(row.pid),
    command: row.command ? String(row.command) : null,
    cwd: row.cwd ? String(row.cwd) : null,
    startedAt: String(row.started_at),
    lastHeartbeatAt: row.last_heartbeat_at ? String(row.last_heartbeat_at) : null
  };
}

export function upsertRuntimeSession(database: DatabaseSync, session: RuntimeSession): void {
  database
    .prepare(
      `
        INSERT INTO runtime_sessions (
          id,
          runtime_id,
          agent_name,
          repo_name,
          repo_path,
          worktree_path,
          branch,
          status,
          activity,
          pid,
          started_at,
          updated_at,
          completed_at,
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          runtime_id = excluded.runtime_id,
          agent_name = excluded.agent_name,
          repo_name = excluded.repo_name,
          repo_path = excluded.repo_path,
          worktree_path = excluded.worktree_path,
          branch = excluded.branch,
          status = excluded.status,
          activity = excluded.activity,
          pid = excluded.pid,
          started_at = excluded.started_at,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          metadata_json = excluded.metadata_json
      `
    )
    .run(
      session.id,
      session.runtimeId,
      session.agentName,
      session.repoName,
      session.repoPath,
      session.worktreePath ?? null,
      session.branch ?? null,
      session.status,
      session.activity,
      session.pid ?? null,
      session.startedAt,
      session.updatedAt,
      session.completedAt ?? null,
      stringifyJson(session.metadata)
    );
}

export function getRuntimeSession(database: DatabaseSync, sessionId: string): RuntimeSession | null {
  const row = database
    .prepare("SELECT * FROM runtime_sessions WHERE id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;

  return row ? mapRuntimeSession(row) : null;
}

export function listRuntimeSessions(database: DatabaseSync): RuntimeSession[] {
  const rows = database
    .prepare("SELECT * FROM runtime_sessions ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];

  return rows.map(mapRuntimeSession);
}

export function insertRuntimeEvent(database: DatabaseSync, event: HolisticRuntimeEvent): void {
  database
    .prepare(
      `
        INSERT OR REPLACE INTO runtime_events (
          id,
          session_id,
          type,
          timestamp,
          severity,
          message,
          activity,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      event.id,
      event.sessionId,
      event.type,
      event.timestamp,
      event.severity ?? null,
      event.message ?? null,
      event.activity ?? null,
      stringifyJson(event.payload)
    );
}

export function getRuntimeEvents(database: DatabaseSync, sessionId: string): HolisticRuntimeEvent[] {
  const rows = database
    .prepare("SELECT * FROM runtime_events WHERE session_id = ? ORDER BY timestamp ASC")
    .all(sessionId) as Record<string, unknown>[];

  return rows.map(mapRuntimeEvent);
}

export function upsertRuntimeApproval(database: DatabaseSync, approval: RuntimeApprovalRecord): void {
  database
    .prepare(
      `
        INSERT INTO runtime_approvals (
          id,
          session_id,
          status,
          requested_at,
          resolved_at,
          prompt,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          session_id = excluded.session_id,
          status = excluded.status,
          requested_at = excluded.requested_at,
          resolved_at = excluded.resolved_at,
          prompt = excluded.prompt,
          payload_json = excluded.payload_json
      `
    )
    .run(
      approval.id,
      approval.sessionId,
      approval.status,
      approval.requestedAt,
      approval.resolvedAt,
      approval.prompt,
      stringifyJson(approval.payload)
    );
}

export function getRuntimeApproval(database: DatabaseSync, approvalId: string): RuntimeApprovalRecord | null {
  const row = database
    .prepare("SELECT * FROM runtime_approvals WHERE id = ?")
    .get(approvalId) as Record<string, unknown> | undefined;

  return row ? mapRuntimeApproval(row) : null;
}

export function listPendingRuntimeApprovals(database: DatabaseSync): RuntimeApprovalRecord[] {
  const rows = database
    .prepare("SELECT * FROM runtime_approvals WHERE status = 'pending' ORDER BY requested_at DESC")
    .all() as Record<string, unknown>[];

  return rows.map(mapRuntimeApproval);
}

export function upsertRuntimeProcess(database: DatabaseSync, process: RuntimeProcessRecord): void {
  database
    .prepare(
      `
        INSERT INTO runtime_processes (
          session_id,
          pid,
          command,
          cwd,
          started_at,
          last_heartbeat_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          pid = excluded.pid,
          command = excluded.command,
          cwd = excluded.cwd,
          started_at = excluded.started_at,
          last_heartbeat_at = excluded.last_heartbeat_at
      `
    )
    .run(
      process.sessionId,
      process.pid,
      process.command,
      process.cwd,
      process.startedAt,
      process.lastHeartbeatAt
    );
}

export function getRuntimeProcess(database: DatabaseSync, sessionId: string): RuntimeProcessRecord | null {
  const row = database
    .prepare("SELECT * FROM runtime_processes WHERE session_id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;

  return row ? mapRuntimeProcess(row) : null;
}
