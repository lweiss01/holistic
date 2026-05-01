import type { HolisticContext } from "../../holistic-bridge-types/src/index.ts";

export const SESSION_STATUSES = [
  "running",
  "queued",
  "needs_input",
  "at_risk",
  "blocked",
  "awaiting_review",
  "parked"
] as const;

export const SESSION_PHASES = ["plan", "research", "execute", "test"] as const;

export const EVENT_TYPES = [
  "session.started",
  "session.ended",
  "session.idle_detected",
  "session.checkpoint_created",
  "session.heartbeat",
  "session.paused",
  "session.resumed",
  "session.completed",
  "session.failed",
  "session.cancelled",
  "session.terminated",
  "task.started",
  "task.updated",
  "task.completed",
  "phase.changed",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "command.started",
  "command.finished",
  "command.completed",
  "command.failed",
  "file.changed",
  "test.started",
  "test.finished",
  "test.completed",
  "test.failed",
  "input.requested",
  "input.resolved",
  "git.branch_created",
  "context.branch_changed",
  "context.environment_changed",
  "git.commit_created",
  "git.conflict_detected",
  "agent.question",
  "agent.question_asked",
  "agent.summary",
  "agent.summary_emitted",
  "agent.warning",
  "agent.blocked",
  "agent.retry_pattern_detected",
  "agent.scope_expansion_detected",
  "holistic.checkpoint",
  "telemetry.noop",
  "user.action",
  "user.resumed"
] as const;

export const EVENT_SOURCES = ["agent", "collector", "system", "user"] as const;
export const AGENT_RUNTIMES = ["codex", "openharness", "unknown"] as const;

export const RECOMMENDATION_URGENCY = ["low", "medium", "high"] as const;

/** Dashboard attention tier (Build A); not the same axis as `SessionStatus`. */
export const SUPERVISION_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export const OPERATIONAL_CATEGORIES = ["live", "needs_action", "degraded_active", "review", "historical", "unknown"] as const;
export const SIGNAL_FRESHNESS_STATES = ["fresh", "stale", "cold", "unknown"] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type SessionPhase = (typeof SESSION_PHASES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventSource = (typeof EVENT_SOURCES)[number];
export type AgentRuntime = (typeof AGENT_RUNTIMES)[number];
export type RecommendationUrgency = (typeof RECOMMENDATION_URGENCY)[number];
export type SupervisionSeverity = (typeof SUPERVISION_SEVERITIES)[number];
export type OperationalCategory = (typeof OPERATIONAL_CATEGORIES)[number];
export type SignalFreshnessState = (typeof SIGNAL_FRESHNESS_STATES)[number];

export interface SupervisionSignals {
  lastMeaningfulEventAt: string | null;
  supervisionSeverity: SupervisionSeverity;
}

export interface SessionRecord {
  id: string;
  agentName: string;
  runtime: AgentRuntime;
  repoPath: string;
  worktreePath: string;
  objective: string;
  currentPhase: SessionPhase;
  startedAt: string;
  endedAt: string | null;
  lastEventAt: string;
  lastSummary: string | null;
}

export interface TaskRecord {
  id: string;
  sessionId: string;
  title: string;
  phase: SessionPhase;
  state: "active" | "completed";
  startedAt: string;
  completedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface AgentEvent<TPayload = Record<string, unknown>> {
  id: string;
  sessionId: string;
  runtime?: AgentRuntime | null;
  taskId?: string | null;
  type: EventType;
  phase?: SessionPhase | null;
  source: EventSource;
  timestamp: string;
  summary?: string | null;
  payload: TPayload;
}

export interface StatusDecision {
  status: SessionStatus;
  phase: SessionPhase;
  explanation: string;
  evidence: string[];
}

export interface Recommendation {
  urgency: RecommendationUrgency;
  title: string;
  actionLabel: string;
  description: string;
}

export interface ActiveSessionResponse {
  session: SessionRecord | null;
  activeTask: TaskRecord | null;
  status: StatusDecision | null;
  recommendation: Recommendation | null;
  holisticContext: HolisticContext | null;
  /** Present when `session` is non-null; derived for supervision UI (Build A). */
  supervision: SupervisionSignals | null;
}

export interface SessionDetailResponse {
  session: SessionRecord;
  activeTask: TaskRecord | null;
  status: StatusDecision;
  recommendation: Recommendation;
  holisticContext: HolisticContext | null;
  supervision: SupervisionSignals;
}

export interface TimelineResponse {
  sessionId: string;
  items: AgentEvent[];
  /** Total rows for this session (for pagination). */
  total: number;
  /** Requested page size (may be clamped server-side). */
  limit: number;
  /** Offset from oldest event (chronological paging). */
  offset: number;
  /** True when more older events exist beyond this page. */
  hasMore: boolean;
}

export interface FleetTotals {
  totalSessions: number;
  activeAgents: number;
  needsHuman: number;
  blocked: number;
  atRisk: number;
  awaitingReview: number;
  completedToday: number;
}

export interface FleetSessionItem {
  session: SessionRecord;
  activeTask: TaskRecord | null;
  status: StatusDecision;
  recommendation: Recommendation;
  supervision: SupervisionSignals;
  category: OperationalCategory;
  categoryReason:
    | "runtime_active"
    | "waiting_for_input"
    | "awaiting_review"
    | "blocked_or_failed"
    | "missing_runtime_signal"
    | "terminated"
    | "unacknowledged_completion"
    | "parked"
    | "stale_runtime"
    | "db_mismatch"
    | "legacy_active"
    | "legacy_active_without_runtime"
    | "stale_legacy_only"
    | "runtime_db_mismatch"
    | "contradictory_telemetry"
    | "insufficient_evidence"
    | "unknown";
  rawRuntimeStatus: string | null;
  derivedOperationalStatus?: string;
  sourceOfTruth?: string;
  confidence?: string;
  nextRecommendedOperatorAction?: string;
  belongsToMissionControl?: boolean;
  belongsToHistory?: boolean;
  lastSignalAt: string | null;
  signalAgeMs: number | null;
  freshness: SignalFreshnessState;
  attentionRank: number;
  attentionBreakdown: {
    status: number;
    urgency: number;
    freshness: number;
  };
  heartbeatFreshness: "fresh" | "stale" | "cold";
  blockedReason: string | null;
  recommendedAction: string;
  availableActions: Array<"inspect" | "pause" | "resume" | "approve">;
  repoName: string;
  worktreeName: string | null;
}

export interface FleetRecentEvent {
  id: string;
  sessionId: string;
  agentName: string;
  repoName: string;
  type: EventType;
  summary: string | null;
  createdAt: string;
}

export interface FleetHeatmapCell {
  hourStart: string;
  count: number;
}

export interface FleetResponse {
  generatedAt: string;
  totals: FleetTotals;
  riskReasons: Array<{
    label: string;
    count: number;
  }>;
  sessions: FleetSessionItem[];
  recentEvents: FleetRecentEvent[];
  heatmap: FleetHeatmapCell[];
}
