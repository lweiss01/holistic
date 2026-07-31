import type { OperationalCategory } from "../../../packages/andon-core/src/index.ts";
import type {
  AgentSignalIngestionStatus,
  AgentSessionSourceSummary,
  MissionControlResponse,
  MissionControlSession,
  SessionReplayEvent,
  SessionReplayResponse
} from "./api.ts";

export type MissionPrimaryStatus = MissionControlSession["primaryStatus"];

export interface CategoryPresentation {
  label: string;
  shortLabel: string;
  tone: "critical" | "warning" | "review" | "healthy" | "unknown" | "history";
  marker: "octagon" | "triangle" | "diamond" | "circle" | "outline";
}

export const CATEGORY_PRESENTATION: Record<OperationalCategory, CategoryPresentation> = {
  needs_action: {
    label: "Needs Action",
    shortLabel: "Action",
    tone: "critical",
    marker: "octagon",
  },
  degraded_active: {
    label: "Needs Intervention",
    shortLabel: "Intervention",
    tone: "warning",
    marker: "triangle",
  },
  review: {
    label: "Needs Review",
    shortLabel: "Review",
    tone: "review",
    marker: "diamond",
  },
  live: {
    label: "Running",
    shortLabel: "Running",
    tone: "healthy",
    marker: "circle",
  },
  unknown: {
    label: "Unknown",
    shortLabel: "Unknown",
    tone: "unknown",
    marker: "outline",
  },
  historical: {
    label: "Parked / Done",
    shortLabel: "Parked",
    tone: "history",
    marker: "outline",
  },
};

export interface TrafficLightPresentation {
  label: string;
  shortLabel: string;
  tone: "healthy" | "review" | "input" | "critical" | "idle" | "history" | "unknown";
  marker: "circle" | "diamond" | "triangle" | "octagon" | "outline" | "question";
  description: string;
}

export const TRAFFIC_LIGHT_PRESENTATION: Record<MissionPrimaryStatus, TrafficLightPresentation> = {
  running: {
    label: "Running",
    shortLabel: "Running",
    tone: "healthy",
    marker: "circle",
    description: "Agent session is actively running now.",
  },
  awaiting_assignment: {
    label: "Awaiting Assignment",
    shortLabel: "Assignment",
    tone: "input",
    marker: "triangle",
    description: "Agent has finished the current task and is waiting for its next assignment.",
  },
  waiting_for_review: {
    label: "Needs Review",
    shortLabel: "Review",
    tone: "review",
    marker: "diamond",
    description: "Agent needs a specific output review before proceeding.",
  },
  waiting_on_human_input: {
    label: "Needs Input",
    shortLabel: "Input",
    tone: "input",
    marker: "triangle",
    description: "Agent is blocked until a human responds.",
  },
  needs_intervention: {
    label: "Needs Intervention",
    shortLabel: "Intervention",
    tone: "critical",
    marker: "octagon",
    description: "Agent session needs operator intervention.",
  },
  parked_idle: {
    label: "Parked / Idle",
    shortLabel: "Parked",
    tone: "idle",
    marker: "outline",
    description: "Agent session is parked or idle.",
  },
  done_historical: {
    label: "Done / Historical",
    shortLabel: "Done",
    tone: "history",
    marker: "outline",
    description: "Agent session is done and belongs in history.",
  },
  unknown: {
    label: "Unknown",
    shortLabel: "Unknown",
    tone: "unknown",
    marker: "question",
    description: "Andon lacks enough truth to call the current state.",
  },
};

export interface MissionSessionViewModel {
  id: string;
  source: MissionControlSession;
  category: OperationalCategory;
  trafficLight: TrafficLightPresentation;
  primaryStatus: MissionPrimaryStatus;
  agentName: string;
  repoName: string;
  objective: string;
  reason: string;
  operatorActivity: string;
  freshness: string;
  lastSignalAge: string;
  lastAgentSignalAge: string;
  runtimeAliveLabel: string;
  primaryStatusLabel: string;
  actionRequired: boolean;
  actionKind: string;
  actionLabel: string;
  confidenceLabel: string | null;
  nextAction: string;
  rawRuntimeStatus: string | null;
  sourceOfTruth: string;
  attentionFlags: string[];
  isHistorical: boolean;
  detailHref: string;
}

export interface MissionControlBoardViewModel {
  generatedAt: string;
  generatedAge: string;
  totals: Record<OperationalCategory | "total", number>;
  sessionCount: number;
  historyCount: number;
  runtimeSummary: {
    label: string;
    sessionCount: number;
    runningCount: number;
    attentionCount: number;
    sourceCount: number;
    activeSourceCount: number;
    connectedSourceCount: number;
    lastAgentSignalAge: string;
  };
  sessions: MissionSessionViewModel[];
  sources: AgentSessionSourceSummary[];
  ingestionStatus: AgentSignalIngestionStatus;
  emptyState: {
    title: string;
    description: string;
    tone: AgentSignalIngestionStatus["tone"];
    status: AgentSignalIngestionStatus["status"];
  } | null;
}

export interface HistorySessionViewModel {
  id: string;
  category: OperationalCategory;
  presentation: CategoryPresentation;
  agentName: string;
  repoName: string;
  objective: string;
  reason: string;
  rawRuntimeStatus: string | null;
  sourceOfTruth: string;
  freshness: string;
  lastAgentSignalAge: string;
  runtimeAliveLabel: string;
  confidence: string;
  endedAtLabel: string;
  durationLabel: string;
  lastSignalAge: string;
  detailHref: string;
  replayHref: string;
}

export interface DetailProjectionViewModel {
  id: string;
  category: OperationalCategory;
  presentation: CategoryPresentation;
  primaryStatus: string;
  primaryStatusLabel: string;
  lifecycleState: string;
  runtimeSignal: string;
  operatorAttention: string;
  reason: string;
  rawRuntimeStatus: string | null;
  derivedOperationalStatus: string;
  sourceOfTruth: string;
  freshness: string;
  lastSignalAge: string;
  lastAgentSignalAge: string;
  runtimeAliveLabel: string;
  confidence: string;
  operatorActivity: string;
  nextAction: string;
  actionRequired: boolean;
  actionKind: string;
  actionLabel: string;
  belongsToMissionControl: boolean;
  belongsToHistory: boolean;
}

export type ReplayDisplayKind =
  | "heartbeat/liveness"
  | "no-op telemetry"
  | "checkpoint"
  | "context change"
  | "compatibility mirror"
  | "agent summary"
  | "meaningful activity"
  | "user action"
  | "review/input state";

export interface ReplayEventViewModel {
  id: string;
  type: string;
  source: string;
  kind: string;
  displayKind: ReplayDisplayKind;
  timestamp: string;
  summary: string;
  isPrimary: boolean;
  isTelemetry: boolean;
  isContext: boolean;
  raw: unknown;
}

export interface ReplayViewModel {
  sessionId: string;
  generatedAt: string;
  primaryEvents: ReplayEventViewModel[];
  groupedEvents: ReplayEventViewModel[];
  hiddenTelemetryCount: number;
}

function repoName(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? repoPath;
}

function trimLine(value: string | null | undefined, max = 88): string {
  if (!value) return "-";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string | null | undefined, endedAt: string | null | undefined): string {
  if (!startedAt || !endedAt) return "-";
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return "-";
  }
  const minutes = Math.floor((ended - started) / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function formatSignalAge(
  signalAgeMs: number | null,
  fallbackTimestampMs?: number | null,
  nowMs: number = Date.now()
): string {
  const computedAgeMs =
    signalAgeMs ?? (fallbackTimestampMs != null ? Math.max(0, nowMs - fallbackTimestampMs) : null);
  if (computedAgeMs == null || !Number.isFinite(computedAgeMs)) {
    return "no signal";
  }
  const seconds = Math.floor(computedAgeMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function getCategoryPresentation(category: OperationalCategory): CategoryPresentation {
  return CATEGORY_PRESENTATION[category];
}

export function mapPrimaryStatusToTrafficLight(status: MissionPrimaryStatus): TrafficLightPresentation {
  return TRAFFIC_LIGHT_PRESENTATION[status] ?? TRAFFIC_LIGHT_PRESENTATION.unknown;
}

function compareMissionSessions(a: MissionSessionViewModel, b: MissionSessionViewModel): number {
  const statusOrder: MissionPrimaryStatus[] = [
    "waiting_on_human_input",
    "needs_intervention",
    "awaiting_assignment",
    "waiting_for_review",
    "running",
    "unknown",
    "parked_idle",
    "done_historical",
  ];
  const statusDelta = statusOrder.indexOf(a.primaryStatus) - statusOrder.indexOf(b.primaryStatus);
  if (statusDelta !== 0) return statusDelta;

  const confidenceWeight: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const confidenceDelta =
    (confidenceWeight[a.source.confidence] ?? 1) - (confidenceWeight[b.source.confidence] ?? 1);
  if (confidenceDelta !== 0) return confidenceDelta;

  return (a.source.signalAgeMs ?? Number.MAX_SAFE_INTEGER) - (b.source.signalAgeMs ?? Number.MAX_SAFE_INTEGER);
}

function runtimeAliveLabel(item: MissionControlSession): string {
  if (item.runtimeSignal === "alive") return "runtime connected";
  if (item.runtimeSignal === "dead") return "runtime disconnected";
  if (item.runtimeSignal === "stale") return "runtime stale";
  return "runtime unknown";
}

function primaryStatusLabel(item: MissionControlSession): string {
  return mapPrimaryStatusToTrafficLight(item.primaryStatus).label;
}

function attentionFlags(item: MissionControlSession): string[] {
  const flags: string[] = [];
  if (item.confidence !== "high") flags.push(`${item.confidence} confidence`);
  if (item.runtimeSignal === "stale") flags.push("stale signal");
  if (item.runtimeSignal === "dead") flags.push("runtime disconnected");
  if (item.runtimeSignal === "unknown") flags.push("runtime unknown");
  if (item.freshness === "cold") flags.push("cold signal");
  if (item.freshness === "unknown") flags.push("unknown signal");
  return [...new Set(flags)];
}

function summarizeMissionRuntime(
  sessions: MissionSessionViewModel[],
  sources: AgentSessionSourceSummary[],
  nowMs: number
): MissionControlBoardViewModel["runtimeSummary"] {
  const runningCount = sessions.filter((session) => session.primaryStatus === "running").length;
  const attentionCount = sessions.filter((session) =>
    session.actionRequired
  ).length;
  const activeSourceCount = sources.filter((source) => source.status === "active").length;
  const connectedSourceCount = sources.filter((source) => source.status === "active" || source.status === "idle" || source.status === "connected").length;
  const youngestSignalMs = sessions.reduce<number | null>((youngest, session) => {
    const age = session.source.agentSignalAgeMs;
    if (age === null) return youngest;
    return youngest === null ? age : Math.min(youngest, age);
  }, null);

  return {
    label: sessions.length === 1 ? "1 agent session" : `${sessions.length} agent sessions`,
    sessionCount: sessions.length,
    runningCount,
    attentionCount,
    sourceCount: sources.length,
    activeSourceCount,
    connectedSourceCount,
    lastAgentSignalAge: formatSignalAge(youngestSignalMs, null, nowMs),
  };
}

export function buildMissionSessionViewModels(
  sessions: MissionControlSession[],
  nowMs: number = Date.now()
): MissionSessionViewModel[] {
  return sessions
    .filter((item) => item.belongsToMissionControl !== false)
    .filter((item) => item.category !== "historical")
    .map((item) => {
      const trafficLight = mapPrimaryStatusToTrafficLight(item.primaryStatus);

      // Parse timestamps once per session to avoid repeated Date parsing
      const lastSignalMs = item.lastSignalTimestamp
        ? new Date(item.lastSignalTimestamp).getTime()
        : item.session.lastEventAt
        ? new Date(item.session.lastEventAt).getTime()
        : null;
      const lastAgentSignalMs = item.lastAgentSignalTimestamp
        ? new Date(item.lastAgentSignalTimestamp).getTime()
        : null;

      return {
        id: item.session.id,
        source: item,
        category: item.category,
        trafficLight,
        primaryStatus: item.primaryStatus,
        agentName: item.session.agentName,
        repoName: repoName(item.session.repoPath),
        objective: trimLine(item.session.objective, 76),
        reason: trimLine(item.reason.replace(/_/g, " "), 64),
        operatorActivity: item.operatorActivity.replace(/-/g, " "),
        freshness: `${item.freshness} signal`,
        lastSignalAge: formatSignalAge(item.signalAgeMs, lastSignalMs, nowMs),
        lastAgentSignalAge: `agent ${formatSignalAge(item.agentSignalAgeMs, lastAgentSignalMs, nowMs)}`,
        runtimeAliveLabel: runtimeAliveLabel(item),
        primaryStatusLabel: primaryStatusLabel(item),
        actionRequired: item.actionRequired,
        actionKind: item.actionKind.replace(/_/g, " "),
        actionLabel: trimLine(item.actionLabel, 78),
        confidenceLabel: item.confidence === "high" ? null : `${item.confidence} confidence`,
        nextAction: trimLine(item.actionLabel ?? item.nextRecommendedOperatorAction, 78),
        rawRuntimeStatus: item.rawRuntimeStatus,
        sourceOfTruth: item.sourceOfTruth,
        attentionFlags: attentionFlags(item),
        isHistorical: item.belongsToHistory,
        detailHref: `/session/${encodeURIComponent(item.session.id)}`,
      } satisfies MissionSessionViewModel;
    })
    .sort(compareMissionSessions);
}

export function buildMissionControlBoardViewModel(
  response: MissionControlResponse,
): MissionControlBoardViewModel {
  const nowMs = Date.now();
  const sessions = buildMissionSessionViewModels(response.sessions, nowMs);
  const generatedAge = formatSignalAge(null, response.generatedAt ? new Date(response.generatedAt).getTime() : null, nowMs);
  const sources = response.sources ?? [];
  const ingestionStatus = response.ingestionStatus ?? {
    status: "unknown",
    label: "Agent signal source status is unknown.",
    message: "Mission Control is online, but source visibility could not be determined.",
    tone: "unknown",
    lastSignalAt: null,
    sourceCount: sources.length,
    activeSourceCount: 0,
    staleSourceCount: 0,
    historicalCount: response.historicalCount ?? response.totals.historical ?? 0,
  } satisfies AgentSignalIngestionStatus;

  return {
    generatedAt: response.generatedAt,
    generatedAge,
    totals: response.totals,
    sessionCount: sessions.length,
    historyCount: response.historicalCount ?? response.totals.historical ?? response.sessions.filter((item) => item.category === "historical").length,
    runtimeSummary: summarizeMissionRuntime(sessions, sources, nowMs),
    sessions,
    sources,
    ingestionStatus,
    emptyState: sessions.length === 0
      ? {
          title: ingestionStatus.label,
          description: ingestionStatus.message,
          tone: ingestionStatus.tone,
          status: ingestionStatus.status,
        }
      : null,
  };
}

export function buildHistorySessionViewModels(
  response: MissionControlResponse,
  nowMs: number = Date.now()
): HistorySessionViewModel[] {
  return response.sessions
    .filter((item) => item.belongsToHistory !== false)
    .filter((item) => item.category === "historical")
    .map((item) => ({
      id: item.session.id,
      category: item.category,
      presentation: getCategoryPresentation(item.category),
      agentName: item.session.agentName,
      repoName: repoName(item.session.repoPath),
      objective: trimLine(item.session.objective, 120),
      reason: trimLine(item.reason.replace(/_/g, " "), 72),
      rawRuntimeStatus: item.rawRuntimeStatus,
      sourceOfTruth: item.sourceOfTruth,
      freshness: item.freshness,
      lastAgentSignalAge: formatSignalAge(
        item.agentSignalAgeMs,
        item.lastAgentSignalTimestamp ? new Date(item.lastAgentSignalTimestamp).getTime() : null,
        nowMs
      ),
      runtimeAliveLabel: runtimeAliveLabel(item),
      confidence: item.confidence,
      endedAtLabel: formatDateTime(item.session.endedAt ?? item.lastSignalTimestamp ?? item.session.lastEventAt),
      durationLabel: formatDuration(item.session.startedAt, item.session.endedAt),
      lastSignalAge: formatSignalAge(
        item.signalAgeMs,
        (item.lastSignalTimestamp ?? item.session.lastEventAt) ? new Date(item.lastSignalTimestamp ?? item.session.lastEventAt).getTime() : null,
        nowMs
      ),
      detailHref: `/session/${encodeURIComponent(item.session.id)}`,
      replayHref: `/session/${encodeURIComponent(item.session.id)}/replay`,
    }));
}

export function buildDetailProjectionViewModel(
  item: MissionControlSession,
  nowMs: number = Date.now()
): DetailProjectionViewModel {
  return {
    id: item.session.id,
    category: item.category,
    presentation: getCategoryPresentation(item.category),
    primaryStatus: item.primaryStatus,
    primaryStatusLabel: primaryStatusLabel(item),
    lifecycleState: item.lifecycleState.replace(/_/g, " "),
    runtimeSignal: item.runtimeSignal,
    operatorAttention: item.operatorAttention.replace(/_/g, " "),
    reason: item.reason.replace(/_/g, " "),
    rawRuntimeStatus: item.rawRuntimeStatus,
    derivedOperationalStatus: item.derivedOperationalStatus,
    sourceOfTruth: item.sourceOfTruth,
    freshness: item.freshness,
    lastSignalAge: formatSignalAge(
      item.signalAgeMs,
      (item.lastSignalTimestamp ?? item.session.lastEventAt) ? new Date(item.lastSignalTimestamp ?? item.session.lastEventAt).getTime() : null,
      nowMs
    ),
    lastAgentSignalAge: formatSignalAge(
      item.agentSignalAgeMs,
      item.lastAgentSignalTimestamp ? new Date(item.lastAgentSignalTimestamp).getTime() : null,
      nowMs
    ),
    runtimeAliveLabel: runtimeAliveLabel(item),
    confidence: item.confidence,
    operatorActivity: item.operatorActivity.replace(/-/g, " "),
    nextAction: item.actionLabel ?? item.nextRecommendedOperatorAction,
    actionRequired: item.actionRequired,
    actionKind: item.actionKind.replace(/_/g, " "),
    actionLabel: item.actionLabel ?? item.nextRecommendedOperatorAction,
    belongsToMissionControl: item.belongsToMissionControl,
    belongsToHistory: item.belongsToHistory,
  };
}

export function findProjectionSession(
  sessionId: string,
  ...responses: Array<MissionControlResponse | null | undefined>
): MissionControlSession | null {
  for (const response of responses) {
    const match = response?.sessions.find((item) => item.session.id === sessionId);
    if (match) return match;
  }
  return null;
}

export function replayEventDisplayKind(event: Pick<SessionReplayEvent, "kind" | "type">): ReplayDisplayKind {
  if (event.type.startsWith("input.") || event.type.includes("approval") || event.type.includes("review")) {
    return "review/input state";
  }
  if (event.type.startsWith("user.")) {
    return "user action";
  }

  if (event.kind === "heartbeat_liveness") return "heartbeat/liveness";
  if (event.kind === "noop_telemetry") return "no-op telemetry";
  if (event.kind === "checkpoint") return "checkpoint";
  if (event.kind === "context_branch_change") return "context change";
  if (event.kind === "compatibility_mirror") return "compatibility mirror";
  if (event.kind === "agent_summary") return "agent summary";
  return "meaningful activity";
}

function isReplayTelemetry(event: Pick<SessionReplayEvent, "kind">): boolean {
  return event.kind === "heartbeat_liveness" || event.kind === "noop_telemetry" || event.kind === "compatibility_mirror";
}

function isReplayContext(event: Pick<SessionReplayEvent, "kind">): boolean {
  return event.kind === "context_branch_change";
}

function isPrimaryReplayEvent(event: Pick<SessionReplayEvent, "kind" | "meaningful">): boolean {
  return event.meaningful && !isReplayTelemetry(event) && !isReplayContext(event);
}

export function buildReplayViewModel(response: SessionReplayResponse): ReplayViewModel {
  const events = response.events.map((event) => {
    const isTelemetry = isReplayTelemetry(event);
    const isContext = isReplayContext(event);
    return {
      id: event.id,
      type: event.type,
      source: event.source,
      kind: event.kind,
      displayKind: replayEventDisplayKind(event),
      timestamp: event.timestamp,
      summary: trimLine(event.summary ?? event.type, 150),
      isPrimary: isPrimaryReplayEvent(event),
      isTelemetry,
      isContext,
      raw: event.raw ?? event,
    } satisfies ReplayEventViewModel;
  });

  return {
    sessionId: response.sessionId,
    generatedAt: response.generatedAt,
    primaryEvents: events.filter((event) => event.isPrimary),
    groupedEvents: events.filter((event) => !event.isPrimary),
    hiddenTelemetryCount: response.hiddenTelemetryCount,
  };
}
