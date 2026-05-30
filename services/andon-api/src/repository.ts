import type { DatabaseSync } from "node:sqlite";

import type {
  ActiveSessionResponse,
  AgentEvent,
  AgentRuntime,
  FleetHeatmapCell,
  FleetRecentEvent,
  FleetResponse,
  FleetSessionItem,
  Recommendation,
  SessionDetailResponse,
  SessionRecord,
  SessionStatus,
  SupervisionSignals,
  TaskRecord,
  TimelineResponse
} from "../../../packages/andon-core/src/index.ts";
import {
  buildSupervisionSignals,
  deriveRecommendation,
  deriveStatus
} from "../../../packages/andon-core/src/index.ts";
import type { HolisticBridge } from "../../../packages/holistic-bridge-types/src/index.ts";
import type { HolisticRuntimeEvent } from "../../../packages/runtime-core/src/index.ts";
import {
  getRuntimeEvents,
  getRuntimeProcess,
  getRuntimeSession,
  insertRuntimeEvent,
  listRuntimeSessions,
  upsertRuntimeSession
} from "./runtime-repository.ts";
import type { RuntimeId, RuntimeSession } from "../../../packages/runtime-core/src/index.ts";
import {
  classifyReplayEventType,
  type ReplayEventKind,
  normalizeAgentEventForReplayIntegrity,
  replayDeduplicationKey
} from "./event-integrity.ts";
import {
  OPERATIONAL_PROJECTION_COLD_MS,
  OPERATIONAL_PROJECTION_FRESH_MS,
  projectOperationalSession,
  type OperationalProjection
} from "./operational-projection.ts";

export interface CanonicalSessionDetailResponse extends SessionDetailResponse {
  projection: OperationalSessionApiItem | null;
}

function parseJson(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

function repoName(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? repoPath;
}
const UNKNOWN_AGENT_SOURCE_LABEL = "unknown (source missing)";
const NO_RUNTIME_OBJECTIVE_LABEL = "No runtime objective";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isGenericUnknownAgent(agentName: string): boolean {
  const normalized = agentName.trim().toLowerCase();
  return normalized === "unknown" || normalized === UNKNOWN_AGENT_SOURCE_LABEL;
}

function normalizeAttributedAgentName(value: unknown): string | null {
  const normalized = asNonEmptyString(value);
  if (!normalized) {
    return null;
  }
  return isGenericUnknownAgent(normalized) ? null : normalized;
}

function agentNameFromRuntimeSource(value: unknown): string | null {
  const normalized = asNonEmptyString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "local") {
    return "local runtime";
  }
  return normalized.replace(/_/g, " ");
}

function inferAgentName(payload: Record<string, unknown>, existingAgentName: string | undefined, runtime?: unknown): string {
  const direct = normalizeAttributedAgentName(payload.agentName);
  if (direct) {
    return direct;
  }
  const alternate = normalizeAttributedAgentName(payload.agent);
  if (alternate) {
    return alternate;
  }
  const existing = normalizeAttributedAgentName(existingAgentName);
  if (existing) {
    return existing;
  }
  const source = agentNameFromRuntimeSource(payload.runtime ?? runtime ?? payload.source);
  if (source) {
    return source;
  }
  return UNKNOWN_AGENT_SOURCE_LABEL;
}

function resolveFleetAgentName(input: {
  runtimeAgentName?: unknown;
  runtimeId?: unknown;
  runtimeMetadata?: Record<string, unknown> | null;
  legacyAgentName?: unknown;
}): string {
  const runtimeDirect = normalizeAttributedAgentName(input.runtimeAgentName);
  if (runtimeDirect) {
    return runtimeDirect;
  }
  const runtimeMeta = normalizeAttributedAgentName(input.runtimeMetadata?.agentName);
  if (runtimeMeta) {
    return runtimeMeta;
  }
  const legacy = normalizeAttributedAgentName(input.legacyAgentName);
  if (legacy) {
    return legacy;
  }
  const runtimeSource = agentNameFromRuntimeSource(input.runtimeId ?? input.runtimeMetadata?.runtimeId ?? input.runtimeMetadata?.source);
  if (runtimeSource) {
    return runtimeSource;
  }
  return UNKNOWN_AGENT_SOURCE_LABEL;
}

function resolveRuntimeObjective(metadata: Record<string, unknown> | undefined): string {
  return asNonEmptyString(metadata?.objective)
    ?? asNonEmptyString(metadata?.prompt)
    ?? NO_RUNTIME_OBJECTIVE_LABEL;
}


function mapRuntimeIdToAgentRuntime(runtimeId: string): AgentRuntime {
  if (
    [
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
    ].includes(runtimeId)
  ) {
    return runtimeId as AgentRuntime;
  }
  return "unknown";
}

function runtimeEventTypeToFleetRecentType(type: string): FleetRecentEvent["type"] {
  if (type === "agent.summary") {
    return "agent.summary" as FleetRecentEvent["type"];
  }
  return type as FleetRecentEvent["type"];
}

function runtimeActivityToPhase(activity: RuntimeSession["activity"]): SessionRecord["currentPhase"] {
  if (activity === "planning" || activity === "thinking") return "plan";
  if (activity === "reading" || activity === "reviewing") return "research";
  if (activity === "running_tests") return "test";
  return "execute";
}

function runtimeSessionToSessionRecord(session: RuntimeSession): SessionRecord {
  return {
    id: session.id,
    agentName: resolveFleetAgentName({
      runtimeAgentName: session.agentName,
      runtimeId: session.runtimeId,
      runtimeMetadata: session.metadata
    }),
    runtime: mapRuntimeIdToAgentRuntime(session.runtimeId),
    repoPath: session.repoPath,
    worktreePath: session.worktreePath ?? session.repoPath,
    objective: resolveRuntimeObjective(session.metadata),
    currentPhase: runtimeActivityToPhase(session.activity),
    startedAt: session.startedAt,
    endedAt: session.completedAt ?? null,
    lastEventAt: session.updatedAt,
    lastSummary: null
  };
}

function runtimeStatusToFleetStatus(
  status: RuntimeSession["status"],
  _freshness: FleetSessionItem["heartbeatFreshness"]
): SessionStatus {
  if (status === "waiting_for_input") return "needs_input";
  if (status === "waiting_for_approval") return "awaiting_review";
  if (status === "blocked" || status === "failed") return "blocked";
  if (status === "completed") return "parked";
  if (status === "paused" || status === "cancelled") return "parked";
  if (status === "running" || status === "starting") {
    return _freshness === "cold" ? "blocked" : "running";
  }
  return "parked";
}

function isTerminalRuntimeStatus(status: RuntimeSession["status"]): boolean {
  return status === "completed" || status === "cancelled" || status === "failed";
}

function isAndonIngestMirrorSession(session: RuntimeSession): boolean {
  const metadata = session.metadata;
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  if (metadata.andonIngestMirror === true) {
    return true;
  }
  return metadata.source === "andon.ingest.mirror";
}

function hasRuntimeWaitingSignal(database: DatabaseSync, sessionId: string): boolean {
  const session = database.prepare(
    "SELECT status FROM runtime_sessions WHERE id = ? LIMIT 1"
  ).get(sessionId) as { status?: string } | undefined;
  return session?.status === "waiting_for_input";
}

function hasRuntimeSessionSignal(database: DatabaseSync, sessionId: string): boolean {
  const session = database.prepare(
    "SELECT id FROM runtime_sessions WHERE id = ? LIMIT 1"
  ).get(sessionId) as { id?: string } | undefined;
  return Boolean(session?.id);
}

function buildRuntimeRecommendation(status: SessionStatus): Recommendation {
  if (status === "blocked") {
    return {
      urgency: "high",
      title: "Clear runtime blocker",
      actionLabel: "Investigate failure",
      description: "Runtime reports a blocked or failed session that needs intervention."
    };
  }
  if (status === "needs_input") {
    return {
      urgency: "high",
      title: "Provide required input",
      actionLabel: "Answer agent prompt",
      description: "Runtime is waiting for operator input before work can continue."
    };
  }
  if (status === "awaiting_review") {
    return {
      urgency: "medium",
      title: "Review completed work",
      actionLabel: "Inspect session output",
      description: "Runtime marked this session complete and ready for review."
    };
  }
  if (status === "parked") {
    return {
      urgency: "low",
      title: "Resume or leave parked",
      actionLabel: "Decide next action",
      description: "No current runtime heartbeat indicates active execution."
    };
  }
  return {
    urgency: "low",
    title: "Monitor active runtime",
    actionLabel: "Keep watching",
    description: "Runtime heartbeat and status indicate healthy execution."
  };
}

function buildRuntimeMissingMirrorRecommendation(): Recommendation {
  return {
    urgency: "low",
    title: "Legacy session without runtime mirror",
    actionLabel: "Inspect or connect runtime",
    description:
      "This Andon session has no linked runtime session; live status is disconnected and informational only."
  };
}

function listLegacySessionsWithoutRuntimeMirror(database: DatabaseSync): SessionRecord[] {
  const rows = database
    .prepare(
      `
        SELECT s.*
        FROM sessions s
        WHERE s.ended_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM runtime_sessions r WHERE r.id = s.id)
        ORDER BY s.last_event_at DESC
        LIMIT 50
      `
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapSession);
}

function buildDisconnectedLegacyFleetItem(
  database: DatabaseSync,
  session: SessionRecord,
  now: number
): FleetSessionItem {
  const events = getEventsTailForRules(database, session.id, 200);
  const statusValue: SessionStatus = "parked";
  const recommendation = buildRuntimeMissingMirrorRecommendation();
  const supervision = buildSupervisionSignals(events, statusValue, recommendation.urgency);
  const referenceTimestamp = supervision.lastMeaningfulEventAt ?? session.lastEventAt;
  const freshness = heartbeatFreshness(referenceTimestamp, now);
  const itemBase: Omit<FleetSessionItem, "attentionRank" | "attentionBreakdown"> = {
    session,
    activeTask: null,
    status: {
      status: statusValue,
      phase: session.currentPhase,
      explanation: "No linked runtime session; this row is legacy Andon telemetry only.",
      evidence: [
        "Runtime mirror missing for this session id.",
        events.length > 0
          ? `Last legacy signal: ${events.at(-1)?.type ?? "event"}.`
          : "No legacy events recorded."
      ]
    },
    recommendation,
    supervision,
    category: "historical",
    categoryReason: "missing_runtime_signal",
    rawRuntimeStatus: null,
    lastSignalAt: referenceTimestamp,
    signalAgeMs: signalAgeMs(referenceTimestamp, now),
    freshness,
    heartbeatFreshness: freshness,
    blockedReason: null,
    recommendedAction: recommendation.actionLabel,
    availableActions: availableFleetActions(statusValue),
    repoName: session.repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? session.repoPath,
    worktreeName: session.worktreePath !== session.repoPath
      ? (session.worktreePath.split(/[\\/]/).filter(Boolean).at(-1) ?? session.worktreePath)
      : null
  };

  const attentionBreakdown = attentionScoreParts(
    itemBase.status.status,
    itemBase.recommendation.urgency,
    itemBase.heartbeatFreshness
  );

  return {
    ...itemBase,
    attentionBreakdown,
    attentionRank: attentionBreakdown.status + attentionBreakdown.urgency + attentionBreakdown.freshness
  };
}

function buildRuntimeSupervision(
  runtimeEvents: Array<{ timestamp: string; type: string }>,
  status: SessionStatus
): SupervisionSignals {
  const lastMeaningful = [...runtimeEvents]
    .reverse()
    .find((event) => event.type !== "session.heartbeat")
    ?.timestamp ?? null;

  const supervisionSeverity = status === "blocked"
    ? "critical"
    : status === "needs_input"
      ? "high"
      : status === "awaiting_review"
        ? "medium"
        : status === "running"
          ? "low"
          : "info";

  return {
    lastMeaningfulEventAt: lastMeaningful,
    supervisionSeverity
  };
}

function heartbeatReferenceTimestamp(item: Pick<FleetSessionItem, "session" | "supervision">): string {
  return item.supervision.lastMeaningfulEventAt ?? item.session.startedAt;
}

function isPrimaryMissionControlItem(item: FleetSessionItem, now: number): boolean {
  const ageMs = now - new Date(item.supervision.lastMeaningfulEventAt ?? item.session.startedAt).getTime();
  const staleBeyondWindow = ageMs > MISSION_CONTROL_STALE_PARKED_MS;
  if (staleBeyondWindow && item.heartbeatFreshness === "cold") {
    return false;
  }
  return true;
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    agentName: resolveFleetAgentName({ legacyAgentName: row.agent_name }),
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

/** Default page size for GET /sessions/:id/timeline (chronological, oldest first in `items`). */
export const DEFAULT_TIMELINE_LIMIT = 500;
export const MAX_TIMELINE_LIMIT = 10_000;
/** Max events loaded for rules engines (status + recommendation tail). */
export const MAX_EVENTS_FOR_RULES = 8000;
/** Parked sessions older than this are removed from Mission Control fleet view. */
export const MISSION_CONTROL_STALE_PARKED_MS = 60 * 60 * 1000;

export interface OperationalSessionApiItem {
  session: SessionRecord;
  category: OperationalProjection["category"];
  reason: OperationalProjection["reason"];
  rawRuntimeStatus: OperationalProjection["rawRuntimeStatus"];
  derivedOperationalStatus: OperationalProjection["derivedOperationalStatus"];
  sourceOfTruth: OperationalProjection["sourceOfTruth"];
  freshness: OperationalProjection["freshness"];
  lastSignalTimestamp: string | null;
  signalAgeMs: number | null;
  lastAgentSignalTimestamp: string | null;
  agentSignalAgeMs: number | null;
  runtimeProcessAlive: boolean | "unknown";
  lifecycleState: OperationalProjection["lifecycleState"];
  runtimeSignal: OperationalProjection["runtimeSignal"];
  operatorAttention: OperationalProjection["operatorAttention"];
  primaryStatus: OperationalProjection["primaryStatus"];
  actionRequired: boolean;
  actionKind: OperationalProjection["actionKind"];
  actionLabel: string;
  confidence: OperationalProjection["confidence"];
  operatorActivity: OperationalProjection["operatorActivity"];
  nextRecommendedOperatorAction: string;
  belongsToMissionControl: boolean;
  belongsToHistory: boolean;
  projection: OperationalProjection;
}

export type AgentSessionSourceType =
  | "codex"
  | "chatgpt"
  | "claude_code"
  | "cursor"
  | "aider"
  | "openhands"
  | "jules"
  | "github_copilot"
  | "gsd"
  | "symphony_runner"
  | "local_cli"
  | "file_heartbeat"
  | "http_event_source"
  | "manual"
  | "custom"
  | "unknown";

export type AgentSessionSourceTransport =
  | "http_events"
  | "file_state"
  | "cli_writer"
  | "websocket"
  | "webhook"
  | "database"
  | "unknown";

export type AgentSessionSourceStatus =
  | "connected"
  | "idle"
  | "active"
  | "stale"
  | "disconnected"
  | "uninstrumented"
  | "unknown"
  | "error";

export interface AgentSessionSourceSummary {
  sourceId: string;
  sourceName: string;
  sourceType: AgentSessionSourceType;
  platform: string | null;
  transport: AgentSessionSourceTransport;
  status: AgentSessionSourceStatus;
  repo: string | null;
  lastSignalAt: string | null;
  lastHeartbeatAt: string | null;
  capabilities: string[];
  reason: string | null;
}

export type IngestionStatus =
  | "active"
  | "idle"
  | "stale"
  | "disconnected"
  | "uninstrumented"
  | "unknown"
  | "error"
  | "no_sources_configured"
  | "historical_only";

export interface AgentSignalIngestionStatus {
  status: IngestionStatus;
  label: string;
  message: string;
  tone: "healthy" | "neutral" | "warning" | "critical" | "unknown";
  lastSignalAt: string | null;
  sourceCount: number;
  activeSourceCount: number;
  staleSourceCount: number;
  historicalCount: number;
}

export interface OperationalSessionsResponse {
  generatedAt: string;
  totals: Record<OperationalProjection["category"] | "total", number>;
  sessions: OperationalSessionApiItem[];
  sources: AgentSessionSourceSummary[];
  ingestionStatus: AgentSignalIngestionStatus;
  historicalCount: number;
  lastSignalAt: string | null;
}

export interface ReplayEventItem {
  id: string;
  sessionId: string;
  type: string;
  kind: ReplayEventKind;
  timestamp: string;
  summary: string | null;
  source: string;
  meaningful: boolean;
  raw: AgentEvent | HolisticRuntimeEvent;
}

export interface SessionReplayResponse {
  sessionId: string;
  generatedAt: string;
  events: ReplayEventItem[];
  hiddenTelemetryCount: number;
}

function countEventsForSession(database: DatabaseSync, sessionId: string): number {
  const row = database
    .prepare("SELECT COUNT(*) AS c FROM events WHERE session_id = ?")
    .get(sessionId) as { c: number | bigint } | undefined;

  if (!row) {
    return 0;
  }
  return Number(row.c);
}

/** Last N events in chronological order (for status / recommendation). */
function getEventsTailForRules(database: DatabaseSync, sessionId: string, maxRows: number): AgentEvent[] {
  const capped = Math.min(Math.max(maxRows, 1), MAX_TIMELINE_LIMIT);
  const rows = database
    .prepare(
      `
        SELECT * FROM (
          SELECT * FROM events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
        ) ORDER BY created_at ASC
      `
    )
    .all(sessionId, capped) as Record<string, unknown>[];

  return rows.map(mapEvent);
}

function listAllLegacySessions(database: DatabaseSync): SessionRecord[] {
  const rows = database
    .prepare("SELECT * FROM sessions ORDER BY last_event_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(mapSession);
}

function metadataBoolean(metadata: Record<string, unknown> | undefined, key: string): boolean {
  return metadata?.[key] === true;
}

function timestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function newestTimestamp(values: Array<string | null | undefined>): string | null {
  let newest: { value: string; time: number } | null = null;
  for (const value of values) {
    const time = timestampMs(value);
    if (value && time !== null && (!newest || time > newest.time)) {
      newest = { value, time };
    }
  }
  return newest?.value ?? null;
}

function runtimeLivenessEvidence(
  database: DatabaseSync,
  runtimeSession: RuntimeSession,
  runtimeEvents: HolisticRuntimeEvent[],
  now: number
): { alive: boolean | "unknown"; lastRuntimeSignalAt: string | null; ageMs: number | null } {
  const lastRuntimeHeartbeatAt = newestTimestamp(
    runtimeEvents
      .filter((event) => event.type === "session.heartbeat")
      .map((event) => event.timestamp)
  );
  const process = getRuntimeProcess(database, runtimeSession.id);
  const lastRuntimeSignalAt = newestTimestamp([
    lastRuntimeHeartbeatAt,
    runtimeSession.lastHeartbeatAt,
    process?.lastHeartbeatAt
  ]);
  const age = signalAgeMs(lastRuntimeSignalAt, now);
  if (age !== null && age <= OPERATIONAL_PROJECTION_COLD_MS) {
    return { alive: true, lastRuntimeSignalAt, ageMs: age };
  }
  if (age !== null) {
    return { alive: false, lastRuntimeSignalAt, ageMs: age };
  }
  return { alive: "unknown", lastRuntimeSignalAt: null, ageMs: null };
}

function runtimeProjection(
  database: DatabaseSync,
  runtimeSession: RuntimeSession,
  runtimeEvents: HolisticRuntimeEvent[],
  canonicalStatusHint: SessionStatus | null,
  now: number
): OperationalProjection {
  const liveness = runtimeLivenessEvidence(database, runtimeSession, runtimeEvents, now);
  const isMirror = isAndonIngestMirrorSession(runtimeSession);
  return projectOperationalSession({
    sessionId: runtimeSession.id,
    runtimeSession,
    runtimeEvents,
    sourceOfTruth: isMirror ? "mixed" : "runtime",
    runtimeProcessAlive: liveness.alive,
    completedAcknowledged: metadataBoolean(runtimeSession.metadata, "completedAcknowledged")
      || metadataBoolean(runtimeSession.metadata, "acknowledged"),
    canonicalStatusHint,
    now
  });
}

function legacyStatusHint(session: SessionRecord, events: AgentEvent[], now: number): string | null {
  if (session.endedAt) {
    return "ended";
  }
  if (
    events.length > 0
    && events.every((event) =>
      ["checkpoint", "noop_telemetry", "heartbeat_liveness", "context_branch_change"].includes(classifyReplayEventType(event.type))
    )
  ) {
    return "parked";
  }
  if (events.some((event) => event.type === "agent.question_asked" && (event.payload as { resolved?: boolean }).resolved === false)) {
    return "waiting_for_input";
  }
  const lastEventTime = new Date(session.lastEventAt).getTime();
  if (Number.isFinite(lastEventTime) && now - lastEventTime > MISSION_CONTROL_STALE_PARKED_MS) {
    return "stale_legacy";
  }
  return null;
}

function legacyEventsCanOverrideRuntimeLifecycle(events: AgentEvent[]): boolean {
  return events.some((event) => {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "session.ended" || event.type === "session.completed") return true;
    if (event.type === "session.failed" || event.type === "agent.blocked" || event.type === "command.failed" || event.type === "test.failed") {
      return true;
    }
    if ((event.type === "agent.question_asked" || event.type === "agent.question" || event.type === "input.requested") && payload.resolved === false) {
      return true;
    }
    if ((event.type === "agent.summary_emitted" || event.type === "agent.summary") && (payload.signal || payload.completionSignal)) {
      return true;
    }
    return false;
  });
}

function runtimeTelemetryStatusHint(events: HolisticRuntimeEvent[]): SessionStatus | null {
  const ordered = [...events]
    .filter((event) => {
      switch (event.type) {
        case "work.started":
        case "work.completed":
        case "input.requested":
        case "input.resolved":
        case "approval.requested":
        case "approval.granted":
        case "approval.denied":
        case "review.requested":
        case "review.resolved":
        case "review.acknowledged":
        case "validation.passed":
        case "validation.failed":
        case "session.needs_input":
        case "session.needs_review":
        case "session.failed_proof":
        case "session.error":
        case "session.failed":
        case "agent.blocked":
        case "session.parked":
          return true;
        default:
          return false;
      }
    })
    .sort((left, right) => {
      const leftTime = timestampMs(left.timestamp) ?? 0;
      const rightTime = timestampMs(right.timestamp) ?? 0;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.id.localeCompare(right.id);
    });

  let workState: "running" | "completed" | null = null;
  let inputPending = false;
  let reviewPending = false;
  let failurePending = false;
  let parked = false;

  for (const event of ordered) {
    switch (event.type) {
      case "work.started":
        workState = "running";
        inputPending = false;
        reviewPending = false;
        failurePending = false;
        parked = false;
        break;
      case "work.completed":
        workState = "completed";
        break;
      case "input.requested":
      case "approval.requested":
      case "session.needs_input":
        inputPending = true;
        parked = false;
        break;
      case "input.resolved":
      case "approval.granted":
      case "approval.denied":
        inputPending = false;
        workState = "running";
        parked = false;
        break;
      case "review.requested":
      case "session.needs_review":
        reviewPending = true;
        parked = false;
        break;
      case "review.resolved":
      case "review.acknowledged":
        reviewPending = false;
        workState = "running";
        parked = false;
        break;
      case "validation.failed":
      case "session.failed_proof":
      case "session.error":
      case "session.failed":
      case "agent.blocked":
        failurePending = true;
        parked = false;
        break;
      case "validation.passed":
        failurePending = false;
        workState = "running";
        parked = false;
        break;
      case "session.parked":
        parked = true;
        inputPending = false;
        reviewPending = false;
        failurePending = false;
        break;
    }
  }

  if (failurePending) return "blocked";
  if (inputPending) return "needs_input";
  if (reviewPending) return "awaiting_review";
  if (parked) return "parked";
  if (workState === "completed") return "awaiting_assignment";
  if (workState === "running") return "running";
  return null;
}

function legacyProjection(session: SessionRecord, events: AgentEvent[], now: number): OperationalProjection {
  const status = legacyStatusHint(session, events, now);
  return projectOperationalSession({
    sessionId: session.id,
    legacySession: {
      id: session.id,
      status,
      endedAt: session.endedAt,
      lastEventAt: session.lastEventAt,
      appearsActive: !session.endedAt && status !== "stale_legacy"
    },
    humanInputNeeded: events.some((event) =>
      event.type === "agent.question_asked" && (event.payload as { resolved?: boolean }).resolved === false
    ),
    now
  });
}

function operationalItem(session: SessionRecord, projection: OperationalProjection): OperationalSessionApiItem {
  const item = {
    session,
    category: projection.category,
    reason: projection.reason,
    rawRuntimeStatus: projection.rawRuntimeStatus,
    derivedOperationalStatus: projection.derivedOperationalStatus,
    sourceOfTruth: projection.sourceOfTruth,
    freshness: projection.freshness,
    lastSignalTimestamp: projection.lastSignalTimestamp,
    signalAgeMs: projection.signalAgeMs,
    lastAgentSignalTimestamp: projection.lastAgentSignalTimestamp,
    agentSignalAgeMs: projection.agentSignalAgeMs,
    runtimeProcessAlive: projection.runtimeProcessAlive,
    lifecycleState: projection.lifecycleState,
    runtimeSignal: projection.runtimeSignal,
    operatorAttention: projection.operatorAttention,
    primaryStatus: projection.primaryStatus,
    actionRequired: projection.actionRequired,
    actionKind: projection.actionKind,
    actionLabel: projection.actionLabel,
    confidence: projection.confidence,
    operatorActivity: projection.operatorActivity,
    nextRecommendedOperatorAction: projection.nextRecommendedOperatorAction,
    belongsToMissionControl: projection.belongsOnMissionControl,
    belongsToHistory: projection.belongsInHistory,
    projection
  };

  return normalizeTopLevelOperationalItem(item);
}

function normalizeTopLevelOperationalItem(item: OperationalSessionApiItem): OperationalSessionApiItem {
  const hasDirectRuntimeTruth = item.sourceOfTruth === "runtime";
  const hasRuntimeSignal = item.runtimeSignal !== "unknown" || item.lastAgentSignalTimestamp !== null;
  const hasExplicitInput = item.category === "needs_action" && item.reason === "waiting_for_input";
  const hasDirectRuntimeIntervention =
    hasDirectRuntimeTruth
    && item.primaryStatus === "needs_intervention"
    && (
      hasRuntimeSignal
      || item.rawRuntimeStatus === "blocked"
      || item.rawRuntimeStatus === "failed"
    );
  const isTopLevelMissionSession =
    (hasDirectRuntimeTruth && item.primaryStatus === "running")
    || (hasDirectRuntimeTruth && item.primaryStatus === "awaiting_assignment")
    || (hasDirectRuntimeTruth && item.primaryStatus === "waiting_for_review")
    || hasDirectRuntimeIntervention
    || hasExplicitInput;

  if (isTopLevelMissionSession) {
    return item;
  }

  const projection: OperationalProjection = {
    ...item.projection,
    category: "historical",
    reason: "parked",
    derivedOperationalStatus: "historical",
    operatorActivity: "idle",
    lifecycleState: "parked",
    runtimeSignal: item.projection.runtimeSignal,
    operatorAttention: "none",
    primaryStatus: "parked_idle",
    actionRequired: false,
    actionKind: "none",
    actionLabel: "No action needed.",
    confidence: "high",
    nextRecommendedOperatorAction: "No live operator action",
    belongsOnMissionControl: false,
    belongsInHistory: true,
    evidence: [
      ...item.projection.evidence,
      hasDirectRuntimeTruth
        ? "Session does not meet the top-level human-attention eligibility contract."
        : "Compatibility, legacy, task, checkpoint, and mirror telemetry is child/debug material, not a Mission Control workflow row."
    ]
  };

  return {
    ...item,
    category: projection.category,
    reason: projection.reason,
    derivedOperationalStatus: projection.derivedOperationalStatus,
    lastSignalTimestamp: projection.lastSignalTimestamp,
    signalAgeMs: projection.signalAgeMs,
    lastAgentSignalTimestamp: projection.lastAgentSignalTimestamp,
    agentSignalAgeMs: projection.agentSignalAgeMs,
    runtimeProcessAlive: projection.runtimeProcessAlive,
    lifecycleState: projection.lifecycleState,
    runtimeSignal: projection.runtimeSignal,
    operatorAttention: projection.operatorAttention,
    primaryStatus: projection.primaryStatus,
    actionRequired: projection.actionRequired,
    actionKind: projection.actionKind,
    actionLabel: projection.actionLabel,
    confidence: projection.confidence,
    operatorActivity: projection.operatorActivity,
    nextRecommendedOperatorAction: projection.nextRecommendedOperatorAction,
    belongsToMissionControl: projection.belongsOnMissionControl,
    belongsToHistory: projection.belongsInHistory,
    projection
  };
}

function operationalCategoryTotals(sessions: OperationalSessionApiItem[]): OperationalSessionsResponse["totals"] {
  return {
    total: sessions.length,
    live: sessions.filter((item) => item.category === "live").length,
    needs_action: sessions.filter((item) => item.category === "needs_action").length,
    degraded_active: sessions.filter((item) => item.category === "degraded_active").length,
    review: sessions.filter((item) => item.category === "review").length,
    historical: sessions.filter((item) => item.category === "historical").length,
    unknown: sessions.filter((item) => item.category === "unknown").length
  };
}

function normalizeSourceType(value: unknown): AgentSessionSourceType | null {
  const normalized = asNonEmptyString(value)?.toLowerCase().replace(/-/g, "_");
  if (!normalized) return null;
  if (
    [
      "codex",
      "chatgpt",
      "claude_code",
      "cursor",
      "aider",
      "openhands",
      "jules",
      "github_copilot",
      "gsd",
      "symphony_runner",
      "local_cli",
      "file_heartbeat",
      "http_event_source",
      "manual",
      "custom",
      "unknown"
    ].includes(normalized)
  ) {
    return normalized as AgentSessionSourceType;
  }
  if (normalized === "local") return "local_cli";
  if (normalized === "openharness") return "custom";
  return "custom";
}

function normalizeTransport(value: unknown): AgentSessionSourceTransport | null {
  const normalized = asNonEmptyString(value)?.toLowerCase().replace(/-/g, "_");
  if (!normalized) return null;
  if (["http_events", "file_state", "cli_writer", "websocket", "webhook", "database", "unknown"].includes(normalized)) {
    return normalized as AgentSessionSourceTransport;
  }
  return "unknown";
}

function sourceTypeForRuntimeSession(session: RuntimeSession): AgentSessionSourceType {
  return normalizeSourceType(session.metadata?.sourceType)
    ?? normalizeSourceType(session.metadata?.platform)
    ?? normalizeSourceType(session.runtimeId)
    ?? "unknown";
}

function transportForRuntimeSession(session: RuntimeSession): AgentSessionSourceTransport {
  return normalizeTransport(session.metadata?.transport)
    ?? (session.metadata?.source === "andon.runtime-writer" ? "cli_writer" : null)
    ?? "http_events";
}

function sourceIdForRuntimeSession(session: RuntimeSession): string {
  return asNonEmptyString(session.metadata?.sourceId)
    ?? asNonEmptyString(session.metadata?.source)
    ?? `${sourceTypeForRuntimeSession(session)}:${transportForRuntimeSession(session)}`;
}

function sourceNameForRuntimeSession(session: RuntimeSession): string {
  return asNonEmptyString(session.metadata?.sourceName)
    ?? asNonEmptyString(session.metadata?.platform)
    ?? sourceTypeForRuntimeSession(session).replace(/_/g, " ");
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .map((value) => value ? new Date(value).getTime() : Number.NaN)
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function sourceStatusFor(input: {
  sourceSessions: RuntimeSession[];
  sourceItems: OperationalSessionApiItem[];
  lastSignalAt: string | null;
  now: number;
}): AgentSessionSourceStatus {
  if (input.sourceSessions.some((session) => session.metadata?.instrumented === false)) {
    return "uninstrumented";
  }
  if (input.sourceItems.some((item) => item.belongsToMissionControl)) {
    return "active";
  }
  if (!input.lastSignalAt) {
    return "unknown";
  }

  const age = signalAgeMs(input.lastSignalAt, input.now);
  if (age === null) return "unknown";
  if (age <= OPERATIONAL_PROJECTION_COLD_MS) return "idle";
  if (age <= 10 * 60 * 1000) return "stale";
  return "disconnected";
}

function sourceReasonFor(status: AgentSessionSourceStatus, lastSignalAt: string | null): string | null {
  if (status === "active") return "Source is emitting fresh session signals for at least one Mission Control session.";
  if (status === "idle") return "Source is connected and no top-level session currently needs Mission Control.";
  if (status === "stale") return "Source has not emitted a recent signal.";
  if (status === "disconnected") return "Source signal is expired or absent.";
  if (status === "uninstrumented") return "Source is registered but marked as not emitting Andon session signals.";
  if (!lastSignalAt) return "No source signal has been recorded.";
  return null;
}

function buildAgentSessionSources(
  runtimeSessions: RuntimeSession[],
  items: OperationalSessionApiItem[],
  now: number
): AgentSessionSourceSummary[] {
  const itemBySessionId = new Map(items.map((item) => [item.session.id, item]));
  const groups = new Map<string, RuntimeSession[]>();
  for (const session of runtimeSessions) {
    const sourceId = sourceIdForRuntimeSession(session);
    groups.set(sourceId, [...(groups.get(sourceId) ?? []), session]);
  }

  return [...groups.entries()].map(([sourceId, sourceSessions]) => {
    const first = sourceSessions[0]!;
    const sourceItems = sourceSessions
      .map((session) => itemBySessionId.get(session.id))
      .filter((item): item is OperationalSessionApiItem => Boolean(item));
    const lastSignalAt = latestIso(sourceItems.map((item) => item.lastAgentSignalTimestamp ?? item.lastSignalTimestamp ?? item.session.lastEventAt));
    const lastHeartbeatAt = latestIso(sourceItems.map((item) => item.projection.lastHeartbeatAt));
    const status = sourceStatusFor({ sourceSessions, sourceItems, lastSignalAt, now });
    const capabilities = Array.isArray(first.metadata?.capabilities)
      ? first.metadata.capabilities.map(String)
      : [];

    return {
      sourceId,
      sourceName: sourceNameForRuntimeSession(first),
      sourceType: sourceTypeForRuntimeSession(first),
      platform: asNonEmptyString(first.metadata?.platform),
      transport: transportForRuntimeSession(first),
      status,
      repo: first.repoName || repoName(first.repoPath),
      lastSignalAt,
      lastHeartbeatAt,
      capabilities,
      reason: sourceReasonFor(status, lastSignalAt)
    };
  }).sort((a, b) =>
    new Date(b.lastSignalAt ?? 0).getTime() - new Date(a.lastSignalAt ?? 0).getTime()
  );
}

function sourceVisibilityTone(status: IngestionStatus): AgentSignalIngestionStatus["tone"] {
  if (status === "active") return "healthy";
  if (status === "idle" || status === "historical_only") return "neutral";
  if (status === "stale" || status === "uninstrumented" || status === "no_sources_configured" || status === "unknown") return "warning";
  return "critical";
}

function buildIngestionStatus(input: {
  sources: AgentSessionSourceSummary[];
  visibleSessionCount: number;
  historicalCount: number;
}): AgentSignalIngestionStatus {
  const lastSignalAt = latestIso(input.sources.map((source) => source.lastSignalAt));
  const activeSourceCount = input.sources.filter((source) => source.status === "active").length;
  const staleSourceCount = input.sources.filter((source) => source.status === "stale").length;
  let status: IngestionStatus;
  let label: string;
  let message: string;

  if (input.sources.length === 0 && input.historicalCount > 0) {
    status = "historical_only";
    label = "No active agent sessions.";
    message = "Historical sessions are available in History.";
  } else if (input.sources.length === 0) {
    status = "no_sources_configured";
    label = "No agent signal sources configured.";
    message = "Connect a runner, heartbeat writer, or platform adapter to show live sessions.";
  } else if (activeSourceCount > 0 || input.visibleSessionCount > 0) {
    status = "active";
    label = input.visibleSessionCount === 1 ? "1 active instrumented session." : `${input.visibleSessionCount} active instrumented sessions.`;
    message = "Mission Control is receiving agent-session signals.";
  } else if (input.sources.some((source) => source.status === "idle")) {
    status = "idle";
    label = "No active agent sessions.";
    message = "Connected agent sources are idle.";
  } else if (staleSourceCount > 0) {
    status = "stale";
    label = "Agent signal sources are stale.";
    message = lastSignalAt
      ? `Last signal was ${formatSourceAge(lastSignalAt)} ago. Mission Control may not reflect current work.`
      : "Mission Control may not reflect current work.";
  } else if (input.sources.some((source) => source.status === "uninstrumented")) {
    status = "uninstrumented";
    label = "No instrumented agent sessions detected.";
    message = "This platform is not currently emitting Andon session signals.";
  } else if (input.sources.some((source) => source.status === "disconnected")) {
    status = "disconnected";
    label = "Agent signal sources are disconnected.";
    message = lastSignalAt
      ? `Last signal was ${formatSourceAge(lastSignalAt)} ago. Mission Control may not reflect current work.`
      : "No current agent source signal is available.";
  } else {
    status = "unknown";
    label = "Agent signal source status is unknown.";
    message = "Mission Control is online, but source visibility could not be determined.";
  }

  return {
    status,
    label,
    message,
    tone: sourceVisibilityTone(status),
    lastSignalAt,
    sourceCount: input.sources.length,
    activeSourceCount,
    staleSourceCount,
    historicalCount: input.historicalCount
  };
}

function formatSourceAge(timestamp: string): string {
  const age = signalAgeMs(timestamp, Date.now());
  if (age === null) return "unknown";
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function buildOperationalSessions(database: DatabaseSync, now = Date.now()): OperationalSessionApiItem[] {
  const runtimeSessions = listRuntimeSessions(database);
  const runtimeIds = new Set(runtimeSessions.map((session) => session.id));
  const runtimeItems = runtimeSessions.map((session) => {
    const runtimeEvents = getRuntimeEvents(database, session.id);
    const sessionRecord = runtimeSessionToSessionRecord(session);
    const legacyEvents = getEventsTailForRules(database, session.id, 200);
    const runtimeStatusHint = runtimeTelemetryStatusHint(runtimeEvents);
    const legacyStatus = legacyEventsCanOverrideRuntimeLifecycle(legacyEvents)
      ? deriveStatus({ session: sessionRecord, events: legacyEvents, holisticContext: null }).status
      : null;
    const canonicalStatusHint = runtimeStatusHint
      ?? (legacyStatus && legacyStatus !== "queued" ? legacyStatus : null);
    return operationalItem(
      sessionRecord,
      runtimeProjection(database, session, runtimeEvents, canonicalStatusHint, now)
    );
  });

  const legacyItems = listAllLegacySessions(database)
    .filter((session) => !runtimeIds.has(session.id))
    .map((session) => operationalItem(session, legacyProjection(session, getEventsTailForRules(database, session.id, 200), now)));

  return [...runtimeItems, ...legacyItems];
}

export interface RuntimeStartupReconciliationResult {
  inspected: number;
  parked: number;
  parkedSessionIds: string[];
}

export function reconcileRuntimeSessionsOnStartup(
  database: DatabaseSync,
  now = Date.now()
): RuntimeStartupReconciliationResult {
  const parkedSessionIds: string[] = [];
  const sessions = listRuntimeSessions(database);

  for (const session of sessions) {
    if (session.status !== "running" && session.status !== "starting") {
      continue;
    }

    const runtimeEvents = getRuntimeEvents(database, session.id);
    const liveness = runtimeLivenessEvidence(database, session, runtimeEvents, now);
    const sessionUpdateAge = signalAgeMs(session.updatedAt, now);
    const staleAge = liveness.ageMs ?? sessionUpdateAge;
    if (liveness.alive === true || staleAge === null || staleAge <= OPERATIONAL_PROJECTION_COLD_MS) {
      continue;
    }

    upsertRuntimeSession(database, {
      ...session,
      status: "parked",
      activity: "idle",
      metadata: {
        ...session.metadata,
        lifecycleReconciledAt: new Date(now).toISOString(),
        lifecycleReconciliationReason: "stale_runtime_after_restart"
      }
    });
    parkedSessionIds.push(session.id);
  }

  return {
    inspected: sessions.length,
    parked: parkedSessionIds.length,
    parkedSessionIds
  };
}

function getCanonicalProjectionForSession(
  database: DatabaseSync,
  sessionId: string,
  now = Date.now()
): OperationalSessionApiItem | null {
  return buildOperationalSessions(database, now).find((item) => item.session.id === sessionId) ?? null;
}

async function buildSessionDetail(
  database: DatabaseSync,
  session: SessionRecord,
  holisticBridge: HolisticBridge
): Promise<CanonicalSessionDetailResponse> {
  const activeTask = getActiveTask(database, session.id);
  const events = getEventsTailForRules(database, session.id, MAX_EVENTS_FOR_RULES);
  const holisticContext = await holisticBridge.getContext(session.id);
  const status = deriveStatus({ session, events, holisticContext });
  const recommendation = deriveRecommendation({ session, events, holisticContext, status });
  const supervision = buildSupervisionSignals(events, status.status, recommendation.urgency);
  const projection = getCanonicalProjectionForSession(database, session.id);

  return {
    session,
    activeTask,
    status,
    recommendation,
    holisticContext,
    supervision,
    projection
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
      holisticContext: null,
      supervision: null
    };
  }

  const session = mapSession(row);
  const detail = await buildSessionDetail(database, session, holisticBridge);

  return {
    session: detail.session,
    activeTask: detail.activeTask,
    status: detail.status,
    recommendation: detail.recommendation,
    holisticContext: detail.holisticContext,
    supervision: detail.supervision
  };
}

export async function getSessionDetail(
  database: DatabaseSync,
  holisticBridge: HolisticBridge,
  sessionId: string
): Promise<CanonicalSessionDetailResponse | null> {
  const session = getSessionRow(database, sessionId)
    ?? (getRuntimeSession(database, sessionId) ? runtimeSessionToSessionRecord(getRuntimeSession(database, sessionId)!) : null);
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

function heartbeatFreshness(lastEventAt: string, now = Date.now()): "fresh" | "stale" | "cold" {
  const ageMs = now - new Date(lastEventAt).getTime();
  if (ageMs <= 5 * 60 * 1000) {
    return "fresh";
  }
  if (ageMs <= 20 * 60 * 1000) {
    return "stale";
  }
  return "cold";
}

function signalAgeMs(lastSignalAt: string | null, now: number): number | null {
  if (!lastSignalAt) {
    return null;
  }
  const timestamp = new Date(lastSignalAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, now - timestamp);
}

function categoryRank(category: FleetSessionItem["category"]): number {
  const weights: Record<FleetSessionItem["category"], number> = {
    needs_action: 300,
    degraded_active: 200,
    unknown: 175,
    review: 150,
    live: 100,
    historical: 0
  };
  return weights[category];
}

function runtimeCategory(
  runtimeSession: RuntimeSession,
  freshness: FleetSessionItem["heartbeatFreshness"]
): Pick<FleetSessionItem, "category" | "categoryReason"> {
  if (isAndonIngestMirrorSession(runtimeSession)) {
    return freshness === "cold"
      ? { category: "historical", categoryReason: "stale_runtime" }
      : { category: "degraded_active", categoryReason: "missing_runtime_signal" };
  }
  if (runtimeSession.status === "completed" || runtimeSession.status === "cancelled") {
    return { category: "historical", categoryReason: "terminated" };
  }
  if (runtimeSession.status === "paused") {
    return { category: "historical", categoryReason: "parked" };
  }
  if (runtimeSession.status === "waiting_for_input") {
    return { category: "needs_action", categoryReason: "waiting_for_input" };
  }
  if (runtimeSession.status === "waiting_for_approval") {
    return { category: "needs_action", categoryReason: "awaiting_review" };
  }
  if (runtimeSession.status === "blocked" || runtimeSession.status === "failed") {
    return { category: "degraded_active", categoryReason: "blocked_or_failed" };
  }
  if (runtimeSession.status === "running" || runtimeSession.status === "starting") {
    return freshness === "cold"
      ? { category: "degraded_active", categoryReason: "stale_runtime" }
      : { category: "live", categoryReason: "runtime_active" };
  }
  return { category: "degraded_active", categoryReason: "unknown" };
}

function legacyCategory(
  item: Pick<FleetSessionItem, "session" | "status" | "heartbeatFreshness">
): Pick<FleetSessionItem, "category" | "categoryReason"> {
  if (item.session.endedAt) {
    return { category: "historical", categoryReason: "terminated" };
  }
  if (item.status.status === "parked") {
    return { category: "historical", categoryReason: "parked" };
  }
  if (item.heartbeatFreshness === "cold") {
    return { category: "historical", categoryReason: "stale_runtime" };
  }
  if (item.status.status === "awaiting_review") {
    return { category: "needs_action", categoryReason: "awaiting_review" };
  }
  if (item.status.status === "needs_input") {
    return { category: "needs_action", categoryReason: "waiting_for_input" };
  }
  if (item.status.status === "blocked" || item.status.status === "at_risk") {
    return { category: "degraded_active", categoryReason: "blocked_or_failed" };
  }
  return { category: "degraded_active", categoryReason: "missing_runtime_signal" };
}

function attentionScore(item: Omit<FleetSessionItem, "attentionRank">): number {
  const parts = attentionScoreParts(item.status.status, item.recommendation.urgency, item.heartbeatFreshness);
  return parts.status + parts.urgency + parts.freshness;
}

function attentionScoreParts(
  status: FleetSessionItem["status"]["status"],
  urgency: FleetSessionItem["recommendation"]["urgency"],
  freshness: FleetSessionItem["heartbeatFreshness"]
): { status: number; urgency: number; freshness: number } {
  const statusWeight: Record<string, number> = {
    blocked: 120,
    needs_input: 110,
    at_risk: 100,
    awaiting_review: 90,
    queued: 50,
    running: 40,
    parked: 20
  };
  const urgencyWeight: Record<string, number> = {
    high: 30,
    medium: 18,
    low: 8
  };
  const freshnessWeight: Record<string, number> = {
    fresh: 10,
    stale: 4,
    cold: 0
  };
  return {
    status: statusWeight[status] ?? 0,
    urgency: urgencyWeight[urgency] ?? 0,
    freshness: freshnessWeight[freshness] ?? 0
  };
}

function getRecentFleetEvents(database: DatabaseSync): FleetRecentEvent[] {
  const rows = database.prepare(
    `
      SELECT
        e.id,
        e.session_id,
        e.type,
        e.summary,
        e.created_at,
        s.agent_name,
        s.repo_path
      FROM events e
      JOIN sessions s ON s.id = e.session_id
      ORDER BY e.created_at DESC
      LIMIT 40
    `
  ).all() as Record<string, unknown>[];

  return mapRecentFleetEvents(rows);
}

export function mapRecentFleetEvents(rows: Record<string, unknown>[]): FleetRecentEvent[] {
  return rows.map((row) => ({
    id: String(row.id),
    sessionId: String(row.session_id),
    type: String(row.type) as FleetRecentEvent["type"],
    summary: row.summary ? String(row.summary) : null,
    createdAt: String(row.created_at),
    agentName: String(row.agent_name),
    repoName: repoName(String(row.repo_path))
  }));
}

function getRuntimeRecentEvents(database: DatabaseSync): FleetRecentEvent[] {
  const rows = database.prepare(
    `
      SELECT
        e.id,
        e.session_id,
        e.type,
        e.message AS summary,
        e.timestamp AS created_at,
        s.agent_name,
        s.runtime_id,
        s.repo_path,
        s.metadata_json
      FROM runtime_events e
      JOIN runtime_sessions s ON s.id = e.session_id
      ORDER BY e.timestamp DESC
      LIMIT 40
    `
  ).all() as Record<string, unknown>[];

  return rows.map((row) => {
    const metadata = row.metadata_json
      ? parseJson(String(row.metadata_json))
      : {};
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      type: runtimeEventTypeToFleetRecentType(String(row.type)),
      summary: row.summary ? String(row.summary) : String(row.type),
      createdAt: String(row.created_at),
      agentName: resolveFleetAgentName({
        runtimeAgentName: row.agent_name,
        runtimeId: row.runtime_id,
        runtimeMetadata: metadata
      }),
      repoName: repoName(String(row.repo_path))
    };
  });
}

function getFleetHeatmap(database: DatabaseSync): FleetHeatmapCell[] {
  const rows = database.prepare(
    `
      SELECT
        strftime('%Y-%m-%dT%H:00:00.000Z', created_at) AS hour_start,
        COUNT(*) AS c
      FROM events
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY hour_start
      ORDER BY hour_start DESC
      LIMIT 24
    `
  ).all() as Array<{ hour_start: string; c: number | bigint }>;

  return mapFleetHeatmapRows(rows);
}

export function mapFleetHeatmapRows(
  rows: Array<{ hour_start: string; c: number | bigint }>
): FleetHeatmapCell[] {
  return rows
    .map((row) => ({
      hourStart: row.hour_start,
      count: Number(row.c)
    }))
    .reverse();
}

function availableFleetActions(status: FleetSessionItem["status"]["status"]): Array<"inspect" | "pause" | "resume" | "approve"> {
  const base: Array<"inspect" | "pause" | "resume" | "approve"> = ["inspect"];
  if (status === "awaiting_review") {
    return [...base, "approve"];
  }
  if (status === "parked") {
    return [...base, "resume"];
  }
  return [...base, "pause"];
}

function normalizeRiskReason(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("question") || lower.includes("needs a human answer") || lower.includes("needs input")) {
    return "Needs human answer";
  }
  if (lower.includes("blocked") || lower.includes("idle after") || lower.includes("failure")) {
    return "Blocked or failing";
  }
  if (lower.includes("review") || lower.includes("handoff")) {
    return "Awaiting review";
  }
  if (lower.includes("risk") || lower.includes("scope")) {
    return "Scope or risk drift";
  }
  return "Operational risk";
}

function summarizeRiskReasons(sessions: FleetSessionItem[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of sessions) {
    if (!["blocked", "needs_input", "at_risk", "awaiting_review"].includes(item.status.status)) {
      continue;
    }
    const source = item.blockedReason ?? item.status.evidence[0] ?? item.status.explanation;
    const label = normalizeRiskReason(source);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function statusFromProjection(projection: OperationalProjection): SessionStatus {
  if (projection.category === "live") return "running";
  if (projection.category === "needs_action") return "needs_input";
  if (projection.category === "review") return "awaiting_review";
  if (projection.category === "degraded_active") return "blocked";
  if (projection.category === "unknown") return "at_risk";
  return "parked";
}

function fleetItemFromOperational(item: OperationalSessionApiItem): FleetSessionItem {
  const statusValue = statusFromProjection(item.projection);
  const heartbeatFreshness = item.freshness === "unknown" ? "cold" : item.freshness;
  const recommendation = buildRuntimeRecommendation(statusValue);
  const supervision: SupervisionSignals = {
    lastMeaningfulEventAt: item.projection.lastMeaningfulActivityAt,
    supervisionSeverity: statusValue === "blocked" ? "critical" : statusValue === "needs_input" ? "high" : statusValue === "awaiting_review" ? "medium" : "low"
  };

  const itemBase: Omit<FleetSessionItem, "attentionRank" | "attentionBreakdown"> = {
    session: {
      ...item.session,
      lastEventAt: item.lastSignalTimestamp ?? item.session.lastEventAt
    },
    activeTask: null,
    status: {
      status: statusValue,
      phase: item.session.currentPhase,
      explanation: item.projection.evidence[0] ?? `Operational category is ${item.category}.`,
      evidence: item.projection.evidence
    },
    recommendation,
    supervision,
    category: item.category,
    categoryReason: item.reason as FleetSessionItem["categoryReason"],
    rawRuntimeStatus: item.rawRuntimeStatus === "missing" ? null : item.rawRuntimeStatus,
    derivedOperationalStatus: item.derivedOperationalStatus,
    sourceOfTruth: item.sourceOfTruth,
    confidence: item.confidence,
    operatorActivity: item.operatorActivity,
    nextRecommendedOperatorAction: item.nextRecommendedOperatorAction,
    belongsToMissionControl: item.belongsToMissionControl,
    belongsToHistory: item.belongsToHistory,
    lastSignalAt: item.lastSignalTimestamp,
    signalAgeMs: item.signalAgeMs,
    freshness: item.freshness,
    heartbeatFreshness,
    blockedReason: statusValue === "blocked" ? (item.projection.evidence[0] ?? "Operational projection is degraded.") : null,
    recommendedAction: item.nextRecommendedOperatorAction,
    availableActions: availableFleetActions(statusValue),
    repoName: repoName(item.session.repoPath),
    worktreeName: item.session.worktreePath !== item.session.repoPath
      ? repoName(item.session.worktreePath)
      : null
  };
  const attentionBreakdown = attentionScoreParts(
    itemBase.status.status,
    itemBase.recommendation.urgency,
    itemBase.heartbeatFreshness
  );

  return {
    ...itemBase,
    attentionBreakdown,
    attentionRank: categoryRank(itemBase.category) + attentionBreakdown.status + attentionBreakdown.urgency + attentionBreakdown.freshness
  };
}

function sortOperationalSessions(sessions: OperationalSessionApiItem[]): OperationalSessionApiItem[] {
  return [...sessions].sort((a, b) => {
    if (categoryRank(b.category) !== categoryRank(a.category)) {
      return categoryRank(b.category) - categoryRank(a.category);
    }
    return new Date(b.lastSignalTimestamp ?? b.session.lastEventAt).getTime()
      - new Date(a.lastSignalTimestamp ?? a.session.lastEventAt).getTime();
  });
}

export function getMissionControl(database: DatabaseSync): OperationalSessionsResponse {
  const now = Date.now();
  const runtimeSessions = listRuntimeSessions(database);
  const allSessions = buildOperationalSessions(database, now);
  const sessions = sortOperationalSessions(
    allSessions.filter((item) => item.belongsToMissionControl)
  );
  const historicalCount = allSessions.filter((item) => item.belongsToHistory).length;
  const sources = buildAgentSessionSources(runtimeSessions, allSessions, now);
  return {
    generatedAt: new Date(now).toISOString(),
    totals: operationalCategoryTotals(sessions),
    sessions,
    sources,
    ingestionStatus: buildIngestionStatus({
      sources,
      visibleSessionCount: sessions.length,
      historicalCount
    }),
    historicalCount,
    lastSignalAt: latestIso(sources.map((source) => source.lastSignalAt))
  };
}

export function getHistory(database: DatabaseSync): OperationalSessionsResponse {
  const now = Date.now();
  const runtimeSessions = listRuntimeSessions(database);
  const allSessions = buildOperationalSessions(database, now);
  const sessions = sortOperationalSessions(
    allSessions.filter((item) => item.belongsToHistory)
  );
  const historicalCount = sessions.length;
  const sources = buildAgentSessionSources(runtimeSessions, allSessions, now);
  return {
    generatedAt: new Date(now).toISOString(),
    totals: operationalCategoryTotals(sessions),
    sessions,
    sources,
    ingestionStatus: buildIngestionStatus({
      sources,
      visibleSessionCount: allSessions.filter((item) => item.belongsToMissionControl).length,
      historicalCount
    }),
    historicalCount,
    lastSignalAt: latestIso(sources.map((source) => source.lastSignalAt))
  };
}

export async function getFleet(
  database: DatabaseSync,
  _holisticBridge: HolisticBridge
): Promise<FleetResponse> {
  const now = Date.now();
  const missionControl = getMissionControl(database);
  const fleetSessionsCombined = missionControl.sessions.map(fleetItemFromOperational);
  const completedToday = fleetSessionsCombined.filter((item) => {
    if (!item.session.endedAt) {
      return false;
    }
    return new Date(item.session.endedAt).toDateString() === new Date(now).toDateString();
  }).length;
  const heatmapRows = database.prepare(
    `
      SELECT
        strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) AS hour_start,
        COUNT(*) AS c
      FROM runtime_events
      WHERE timestamp >= datetime('now', '-24 hours')
      GROUP BY hour_start
      ORDER BY hour_start DESC
      LIMIT 24
    `
  ).all() as Array<{ hour_start: string; c: number | bigint }>;

  return {
    generatedAt: missionControl.generatedAt,
    totals: {
      totalSessions: fleetSessionsCombined.length,
      activeAgents: fleetSessionsCombined.filter((item) => item.category === "live").length,
      needsHuman: fleetSessionsCombined.filter((item) =>
        ["needs_input", "blocked", "awaiting_review", "at_risk"].includes(item.status.status)
      ).length,
      blocked: fleetSessionsCombined.filter((item) => item.status.status === "blocked").length,
      atRisk: fleetSessionsCombined.filter((item) => item.status.status === "at_risk").length,
      awaitingReview: fleetSessionsCombined.filter((item) => item.status.status === "awaiting_review").length,
      completedToday
    },
    riskReasons: summarizeRiskReasons(fleetSessionsCombined),
    sessions: fleetSessionsCombined,
    recentEvents: listRuntimeSessions(database).length > 0 ? getRuntimeRecentEvents(database) : getRecentFleetEvents(database),
    heatmap: mapFleetHeatmapRows(heatmapRows)
  };
}

export interface TimelinePageOptions {
  limit?: number;
  offset?: number;
  /** When set, return the last N events (ignores offset; still respects max cap). */
  tail?: number;
}

export function getSessionTimeline(
  database: DatabaseSync,
  sessionId: string,
  page: TimelinePageOptions = {}
): TimelineResponse | null {
  const session = getSessionRow(database, sessionId);
  if (!session) {
    return null;
  }

  const total = countEventsForSession(database, sessionId);
  if (total === 0) {
    return {
      sessionId,
      items: [],
      total: 0,
      limit: page.limit ?? page.tail ?? DEFAULT_TIMELINE_LIMIT,
      offset: 0,
      hasMore: false
    };
  }

  let limit = page.limit ?? DEFAULT_TIMELINE_LIMIT;
  limit = Math.min(Math.max(limit, 1), MAX_TIMELINE_LIMIT);
  let offset = Math.max(page.offset ?? 0, 0);

  if (page.tail != null) {
    const tail = Math.min(Math.max(page.tail, 1), MAX_TIMELINE_LIMIT);
    limit = Math.min(tail, total);
    offset = Math.max(0, total - limit);
  } else if (offset + limit > total) {
    limit = Math.min(limit, Math.max(0, total - offset));
  }

  const rows = database
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?")
    .all(sessionId, limit, offset) as Record<string, unknown>[];

  const items = rows.map(mapEvent);
  const hasMore = offset + items.length < total;

  return {
    sessionId,
    items,
    total,
    limit,
    offset,
    hasMore
  };
}

function replayItemFromLegacyEvent(event: AgentEvent): ReplayEventItem {
  const kind = classifyReplayEventType(event.type);
  return {
    id: event.id,
    sessionId: event.sessionId,
    type: event.type,
    kind,
    timestamp: event.timestamp,
    summary: event.summary ?? null,
    source: event.source,
    meaningful: kind === "agent_summary" || kind === "meaningful_activity" || kind === "context_branch_change" || kind === "checkpoint",
    raw: event
  };
}

function replayItemFromRuntimeEvent(event: HolisticRuntimeEvent): ReplayEventItem {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const kind: ReplayEventKind = payload.compatibilityMirror === true
    ? "compatibility_mirror"
    : classifyReplayEventType(event.type);
  return {
    id: event.id,
    sessionId: event.sessionId,
    type: event.type,
    kind,
    timestamp: event.timestamp,
    summary: event.message ?? null,
    source: "runtime",
    meaningful: kind === "agent_summary" || kind === "meaningful_activity" || kind === "context_branch_change" || kind === "checkpoint",
    raw: event
  };
}

export function getSessionReplay(database: DatabaseSync, sessionId: string): SessionReplayResponse | null {
  const session = getSessionRow(database, sessionId);
  const runtimeSession = getRuntimeSession(database, sessionId);
  if (!session && !runtimeSession) {
    return null;
  }

  const legacyRows = database
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as Record<string, unknown>[];
  const legacyItems = legacyRows.map(mapEvent).map(replayItemFromLegacyEvent);
  const runtimeItems = getRuntimeEvents(database, sessionId).map(replayItemFromRuntimeEvent);
  const deduped = new Map<string, ReplayEventItem>();
  for (const item of [...legacyItems, ...runtimeItems]) {
    const key = `${item.type}:${item.timestamp}:${item.summary ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }
  const events = [...deduped.values()].sort((left, right) =>
    new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    events,
    hiddenTelemetryCount: events.filter((event) =>
      event.kind === "heartbeat_liveness" || event.kind === "noop_telemetry" || event.kind === "compatibility_mirror"
    ).length
  };
}

function ensureSession(database: DatabaseSync, event: AgentEvent): void {
  const payload = event.payload as Record<string, unknown>;
  const existing = getSessionRow(database, event.sessionId);
  const nextPhase = (event.phase ?? payload.currentPhase ?? "plan") as SessionRecord["currentPhase"];
  const payloadObjective = asNonEmptyString(payload.objective);
  const payloadPrompt = asNonEmptyString(payload.prompt);
  const objective = event.type === "session.started"
    ? (payloadObjective ?? payloadPrompt ?? NO_RUNTIME_OBJECTIVE_LABEL)
    : (payloadObjective ?? payloadPrompt ?? existing?.objective ?? "Unknown objective");
  const agentName = inferAgentName(payload, existing?.agentName, event.runtime);
  const runtime = String(payload.runtime ?? event.runtime ?? payload.sourceType ?? existing?.runtime ?? "unknown");
  const repoPath = String(payload.repoPath ?? existing?.repoPath ?? process.cwd());
  const worktreePath = String(payload.worktreePath ?? existing?.worktreePath ?? process.cwd());
  const startedAt = String(payload.startedAt ?? existing?.startedAt ?? event.timestamp);
  const endedAt = event.type === "session.ended" ? event.timestamp : (existing?.endedAt ?? null);
  const lastSummary =
    event.type === "agent.summary_emitted" || event.type === "agent.summary"
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

function phaseToMirrorRuntimeActivity(phase: SessionRecord["currentPhase"]): RuntimeSession["activity"] {
  if (phase === "plan") {
    return "planning";
  }
  if (phase === "research") {
    return "reading";
  }
  if (phase === "test") {
    return "running_tests";
  }
  return "editing";
}

function coerceMirrorRuntimeId(session: SessionRecord, payload: Record<string, unknown> = {}): RuntimeId {
  const candidate = normalizeSourceType(payload.runtime ?? payload.sourceType ?? session.runtime);
  if (candidate && candidate !== "unknown" && candidate !== "http_event_source" && candidate !== "manual") {
    return candidate === "claude_code" ? "claude_code" : candidate as RuntimeId;
  }
  return "local";
}

function legacyAgentEventToMirrorRuntimeStatus(
  event: AgentEvent,
  existingRuntime: RuntimeSession | null
): RuntimeSession["status"] {
  const payload = event.payload as Record<string, unknown>;
  if (event.type === "session.ended" || event.type === "session.completed") {
    return "completed";
  }
  if (event.type === "work.started") {
    return "running";
  }
  if (event.type === "work.completed") {
    return "awaiting_assignment";
  }
  if (event.type === "session.parked") {
    return "parked";
  }
  if (event.type === "session.error") {
    return "failed";
  }
  if (event.type === "session.needs_input") {
    return "waiting_for_input";
  }
  if (event.type === "session.needs_review") {
    return "awaiting_review";
  }
  if (event.type === "session.failed_proof") {
    return "blocked";
  }
  if (event.type === "review.requested") {
    return "awaiting_review";
  }
  if (event.type === "review.resolved") {
    return existingRuntime?.status === "awaiting_review" ? "running" : (existingRuntime?.status ?? "unknown");
  }
  if (event.type === "validation.failed") {
    return "blocked";
  }
  if (event.type === "validation.passed") {
    return existingRuntime?.status === "blocked" || existingRuntime?.status === "failed" ? "running" : (existingRuntime?.status ?? "running");
  }
  if (
    (event.type === "agent.summary_emitted" || event.type === "agent.summary")
    && (payload.signal || payload.completionSignal)
  ) {
    // A turn-completion summary is a TURN boundary, not a session end. The
    // agent finished its output and is waiting for the human. Only an explicit
    // session.ended/session.completed (with endedAt) marks the session done.
    return "waiting_for_input";
  }
  if (event.type === "agent.question_asked" || event.type === "agent.question" || event.type === "input.requested") {
    if (payload.resolved === false) {
      return "waiting_for_input";
    }
    if (event.type === "input.requested") {
      return "waiting_for_input";
    }
  }
  if (event.type === "input.resolved") {
    return existingRuntime?.status === "waiting_for_input" ? "running" : (existingRuntime?.status ?? "unknown");
  }
  if (event.type === "session.status_changed") {
    return existingRuntime?.status ?? "unknown";
  }
  if (
    event.type === "session.heartbeat"
    || event.type === "telemetry.noop"
    || event.type === "holistic.checkpoint"
    || event.type === "context.branch_changed"
    || event.type === "context.environment_changed"
  ) {
    return existingRuntime?.status ?? "unknown";
  }
  return "running";
}

function legacyEventToRuntimeEventType(type: AgentEvent["type"]): HolisticRuntimeEvent["type"] {
  switch (type) {
    case "session.started":
    case "session.heartbeat":
    case "session.status_changed":
    case "session.needs_input":
    case "session.needs_review":
    case "session.failed_proof":
    case "session.paused":
    case "session.resumed":
    case "session.parked":
    case "session.error":
    case "session.completed":
    case "session.failed":
    case "session.cancelled":
    case "session.terminated":
    case "work.started":
    case "work.completed":
    case "task.started":
    case "task.updated":
    case "task.completed":
    case "phase.changed":
    case "tool.started":
    case "tool.completed":
    case "tool.failed":
    case "command.started":
    case "command.completed":
    case "command.failed":
    case "file.changed":
    case "test.started":
    case "test.completed":
    case "test.failed":
    case "input.requested":
    case "input.resolved":
    case "review.requested":
    case "review.resolved":
    case "validation.passed":
    case "validation.failed":
    case "git.branch_created":
    case "context.branch_changed":
    case "context.environment_changed":
    case "git.commit_created":
    case "git.conflict_detected":
    case "agent.question":
    case "agent.summary":
    case "agent.warning":
    case "agent.blocked":
    case "holistic.checkpoint":
    case "telemetry.noop":
      return type;
    case "session.ended":
      return "session.completed";
    case "session.checkpoint_created":
      return "holistic.checkpoint";
    case "session.idle_detected":
      return "telemetry.noop";
    case "command.finished":
      return "command.completed";
    case "test.finished":
      return "test.completed";
    case "agent.question_asked":
      return "agent.question";
    case "agent.summary_emitted":
      return "agent.summary";
    case "agent.retry_pattern_detected":
    case "agent.scope_expansion_detected":
      return "agent.warning";
    case "user.resumed":
      return "user.action";
    default:
      return "telemetry.noop";
  }
}

/**
 * When legacy Andon events arrive via POST /events, upsert a minimal runtime_sessions row so Mission Control
 * has a real fleet card without requiring a separate runtime-service task start. Rows are tagged in metadata
 * so runtime-service (non-mirror) sessions are never overwritten.
 */
function maybeUpsertMirrorRuntimeFromLegacyEvent(database: DatabaseSync, event: AgentEvent): void {
  const sessionRow = getSessionRow(database, event.sessionId);
  if (!sessionRow) {
    return;
  }

  const existingRt = getRuntimeSession(database, event.sessionId);
  const eventPayload = (event.payload ?? {}) as Record<string, unknown>;
  const isRuntimeWriterEvent = eventPayload.source === "andon.runtime-writer"
    || event.id.startsWith("runtime-writer-start-")
    || event.id.startsWith("runtime-writer-heartbeat-");
  const isDirectAgentSourceEvent = Boolean(
    asNonEmptyString(eventPayload.sourceId)
    || asNonEmptyString(eventPayload.sourceType)
    || asNonEmptyString(eventPayload.transport)
  );
  const existingRuntimeWriter = existingRt?.metadata?.source === "andon.runtime-writer";
  const sameDirectSource = isDirectAgentSourceEvent
    && (
      asNonEmptyString(existingRt?.metadata?.sourceId) === asNonEmptyString(eventPayload.sourceId)
      || asNonEmptyString(existingRt?.metadata?.sourceType) === asNonEmptyString(eventPayload.sourceType)
    );
  if (existingRt && existingRt.metadata?.andonIngestMirror !== true && !existingRuntimeWriter && !sameDirectSource) {
    return;
  }
  const existingUpdatedAtMs = Date.parse(existingRt?.updatedAt ?? "");
  const eventTimestampMs = Date.parse(event.timestamp);
  if (
    Number.isFinite(existingUpdatedAtMs)
    && Number.isFinite(eventTimestampMs)
    && eventTimestampMs < existingUpdatedAtMs
  ) {
    return;
  }
  const status = legacyAgentEventToMirrorRuntimeStatus(event, existingRt);
  const payloadActivity = asNonEmptyString(eventPayload.activity) as RuntimeSession["activity"] | null;
  const activity = payloadActivity ?? phaseToMirrorRuntimeActivity(sessionRow.currentPhase);
  const completedAt = status === "completed" ? event.timestamp : undefined;

  const metadata: Record<string, unknown> = {
    andonIngestMirror: !isRuntimeWriterEvent && !isDirectAgentSourceEvent,
    source: isRuntimeWriterEvent
      ? "andon.runtime-writer"
      : isDirectAgentSourceEvent
        ? (asNonEmptyString(eventPayload.source) ?? asNonEmptyString(eventPayload.sourceId) ?? "andon.http-events")
        : "andon.ingest.mirror",
    sourceId: asNonEmptyString(eventPayload.sourceId) ?? (isRuntimeWriterEvent ? "holistic-file-state-writer" : "andon-http-events"),
    sourceName: asNonEmptyString(eventPayload.sourceName) ?? (isRuntimeWriterEvent ? "Holistic file-state writer" : "Andon HTTP event source"),
    sourceType: normalizeSourceType(eventPayload.sourceType ?? eventPayload.runtime ?? event.runtime ?? sessionRow.runtime) ?? "http_event_source",
    platform: asNonEmptyString(eventPayload.platform) ?? normalizeSourceType(eventPayload.runtime ?? event.runtime ?? sessionRow.runtime),
    transport: normalizeTransport(eventPayload.transport) ?? (isRuntimeWriterEvent ? "cli_writer" : "http_events"),
    capabilities: Array.isArray(eventPayload.capabilities) ? eventPayload.capabilities.map(String) : ["session.started", "session.heartbeat"],
    completedAcknowledged: metadataBoolean(eventPayload, "completedAcknowledged") || metadataBoolean(eventPayload, "acknowledged"),
    acknowledged: metadataBoolean(eventPayload, "completedAcknowledged") || metadataBoolean(eventPayload, "acknowledged"),
    objective: sessionRow.objective,
    prompt: sessionRow.objective,
    agentName: sessionRow.agentName,
    lastLegacyEventType: event.type
  };

  const runtimeSession: RuntimeSession = {
    id: sessionRow.id,
    runtimeId: coerceMirrorRuntimeId(sessionRow, eventPayload),
    agentName: sessionRow.agentName,
    repoName: repoName(sessionRow.repoPath),
    repoPath: sessionRow.repoPath,
    worktreePath: sessionRow.worktreePath,
    branch: undefined,
    status,
    activity,
    pid: existingRt?.pid,
    startedAt: sessionRow.startedAt,
    updatedAt: event.timestamp,
    completedAt,
    metadata
  };

  upsertRuntimeSession(database, runtimeSession);

  const rtEvent: HolisticRuntimeEvent = {
    id: `mirror-evt-${event.id}`,
    sessionId: sessionRow.id,
    type: legacyEventToRuntimeEventType(event.type),
    timestamp: event.timestamp,
    message: `Legacy ingest: ${event.type}${event.summary ? ` — ${event.summary}` : ""}`,
    activity,
    payload: {
      legacyEventId: event.id,
      legacyEventType: event.type,
      replayKind: classifyReplayEventType(event.type),
      compatibilityMirror: !isDirectAgentSourceEvent,
      plumbing: !isDirectAgentSourceEvent
    }
  };
  insertRuntimeEvent(database, rtEvent);
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

function hasDuplicateReplayContextEvent(database: DatabaseSync, event: AgentEvent): boolean {
  const key = replayDeduplicationKey(event);
  if (!key) {
    return false;
  }

  const rows = database
    .prepare("SELECT type, summary, payload_json FROM events WHERE session_id = ? AND type = ?")
    .all(event.sessionId, event.type) as Array<{ type: string; summary: string | null; payload_json: string }>;

  return rows.some((row) => {
    const existing: AgentEvent = {
      id: "existing",
      sessionId: event.sessionId,
      taskId: null,
      runtime: null,
      type: String(row.type) as AgentEvent["type"],
      phase: null,
      source: "system",
      timestamp: "",
      summary: row.summary,
      payload: parseJson(row.payload_json)
    };
    return replayDeduplicationKey(existing) === key;
  });
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

    let inserted = 0;
    for (const event of events) {
      const normalizedEvent = normalizeAgentEventForReplayIntegrity(event);

      if (hasDuplicateReplayContextEvent(database, normalizedEvent)) {
        continue;
      }

      ensureSession(database, normalizedEvent);

      if (normalizedEvent.type === "task.started" || normalizedEvent.type === "task.completed") {
        upsertTask(database, normalizedEvent);
      }

      insertEvent.run(
        normalizedEvent.id,
        normalizedEvent.sessionId,
        normalizedEvent.taskId ?? null,
        normalizedEvent.runtime ?? null,
        normalizedEvent.type,
        normalizedEvent.phase ?? null,
        normalizedEvent.source,
        normalizedEvent.summary ?? null,
        JSON.stringify(normalizedEvent.payload ?? {}),
        normalizedEvent.timestamp
      );

      maybeUpsertMirrorRuntimeFromLegacyEvent(database, normalizedEvent);
      inserted += 1;
    }

    database.exec("COMMIT");
    return { inserted };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
