import type { OperationalCategory } from "../../../packages/andon-core/src/index.ts";
import type { MissionControlResponse, MissionControlSession, SessionReplayEvent, SessionReplayResponse } from "./api.ts";

export type MissionLaneId = "needs_action" | "degraded_unknown" | "review" | "live";

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
    label: "Degraded",
    shortLabel: "Degraded",
    tone: "warning",
    marker: "triangle",
  },
  review: {
    label: "Review",
    shortLabel: "Review",
    tone: "review",
    marker: "diamond",
  },
  live: {
    label: "Live",
    shortLabel: "Live",
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
    label: "Historical",
    shortLabel: "History",
    tone: "history",
    marker: "outline",
  },
};

export const MISSION_CATEGORY_ORDER: OperationalCategory[] = [
  "needs_action",
  "degraded_active",
  "unknown",
  "review",
  "live",
  "historical",
];

export const MISSION_LANES: Array<{
  id: MissionLaneId;
  label: string;
  description: string;
  categories: OperationalCategory[];
}> = [
  {
    id: "needs_action",
    label: "Needs Action",
    description: "Human intervention required now",
    categories: ["needs_action"],
  },
  {
    id: "degraded_unknown",
    label: "Degraded / Unknown",
    description: "Telemetry, blocker, or confidence problem",
    categories: ["degraded_active", "unknown"],
  },
  {
    id: "review",
    label: "Review",
    description: "Ready for inspection or approval",
    categories: ["review"],
  },
  {
    id: "live",
    label: "Live",
    description: "Fresh runtime truth confirms active work",
    categories: ["live"],
  },
];

export interface MissionSessionViewModel {
  id: string;
  source: MissionControlSession;
  category: OperationalCategory;
  presentation: CategoryPresentation;
  laneId: MissionLaneId;
  agentName: string;
  repoName: string;
  objective: string;
  reason: string;
  operatorActivity: string;
  freshness: string;
  lastSignalAge: string;
  confidenceLabel: string | null;
  nextAction: string;
  rawRuntimeStatus: string | null;
  sourceOfTruth: string;
}

export interface MissionLaneViewModel {
  id: MissionLaneId;
  label: string;
  description: string;
  categories: OperationalCategory[];
  count: number;
  isEmpty: boolean;
  hasPriority: boolean;
  visibleSessions: MissionSessionViewModel[];
  hiddenCount: number;
}

export interface MissionControlBoardViewModel {
  generatedAt: string;
  generatedAge: string;
  totals: Record<OperationalCategory | "total", number>;
  operationalTotal: number;
  historyCount: number;
  lanes: MissionLaneViewModel[];
  visibleSessions: MissionSessionViewModel[];
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
  reason: string;
  rawRuntimeStatus: string | null;
  derivedOperationalStatus: string;
  sourceOfTruth: string;
  freshness: string;
  lastSignalAge: string;
  confidence: string;
  operatorActivity: string;
  nextAction: string;
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

export function formatSignalAge(signalAgeMs: number | null, fallbackTimestamp?: string | null): string {
  const ageMs = signalAgeMs ?? (
    fallbackTimestamp ? Math.max(0, Date.now() - new Date(fallbackTimestamp).getTime()) : null
  );
  if (ageMs == null || !Number.isFinite(ageMs)) {
    return "no signal";
  }
  const seconds = Math.floor(ageMs / 1000);
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

function laneForCategory(category: OperationalCategory): MissionLaneId | null {
  if (category === "historical") return null;
  if (category === "degraded_active" || category === "unknown") return "degraded_unknown";
  return category;
}

function compareMissionSessions(a: MissionSessionViewModel, b: MissionSessionViewModel): number {
  const categoryDelta = MISSION_CATEGORY_ORDER.indexOf(a.category) - MISSION_CATEGORY_ORDER.indexOf(b.category);
  if (categoryDelta !== 0) return categoryDelta;

  const confidenceWeight: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const confidenceDelta =
    (confidenceWeight[a.source.confidence] ?? 1) - (confidenceWeight[b.source.confidence] ?? 1);
  if (confidenceDelta !== 0) return confidenceDelta;

  return (a.source.signalAgeMs ?? Number.MAX_SAFE_INTEGER) - (b.source.signalAgeMs ?? Number.MAX_SAFE_INTEGER);
}

function operationalFreshnessLabel(item: MissionControlSession): string {
  if (item.category === "review") {
    return `${item.freshness} signal; review-ready`;
  }
  if (item.category === "needs_action") {
    return `${item.freshness} signal; waiting for input`;
  }
  if (item.category === "degraded_active") {
    return `${item.freshness} signal; degraded`;
  }
  if (item.category === "unknown") {
    return `${item.freshness} signal; unknown`;
  }
  if (item.category === "live") {
    return `${item.freshness} signal; active`;
  }
  return `${item.freshness} signal`;
}

export function buildMissionSessionViewModels(
  sessions: MissionControlSession[],
): MissionSessionViewModel[] {
  return sessions
    .filter((item) => item.belongsToMissionControl !== false)
    .filter((item) => item.category !== "historical")
    .map((item) => {
      const laneId = laneForCategory(item.category);
      if (!laneId) {
        return null;
      }

      return {
        id: item.session.id,
        source: item,
        category: item.category,
        presentation: getCategoryPresentation(item.category),
        laneId,
        agentName: item.session.agentName,
        repoName: repoName(item.session.repoPath),
        objective: trimLine(item.session.objective, 76),
        reason: trimLine(item.reason.replace(/_/g, " "), 64),
        operatorActivity: item.operatorActivity.replace(/-/g, " "),
        freshness: operationalFreshnessLabel(item),
        lastSignalAge: formatSignalAge(item.signalAgeMs, item.lastSignalTimestamp ?? item.session.lastEventAt),
        confidenceLabel: item.confidence === "high" ? null : `${item.confidence} confidence`,
        nextAction: trimLine(item.nextRecommendedOperatorAction, 78),
        rawRuntimeStatus: item.rawRuntimeStatus,
        sourceOfTruth: item.sourceOfTruth,
      } satisfies MissionSessionViewModel;
    })
    .filter((item): item is MissionSessionViewModel => Boolean(item))
    .sort(compareMissionSessions);
}

export function buildMissionControlBoardViewModel(
  response: MissionControlResponse,
  options: { laneLimit?: number; focusCategory?: OperationalCategory | null } = {},
): MissionControlBoardViewModel {
  const laneLimit = options.laneLimit ?? 3;
  const sessions = buildMissionSessionViewModels(response.sessions);
  const focusedSessions = options.focusCategory
    ? sessions.filter((item) => item.category === options.focusCategory)
    : sessions;
  const generatedAge = formatSignalAge(null, response.generatedAt);

  const lanes = MISSION_LANES.map((lane) => {
    const laneSessions = focusedSessions.filter((item) => item.laneId === lane.id);
    return {
      ...lane,
      count: laneSessions.length,
      isEmpty: laneSessions.length === 0,
      hasPriority: laneSessions.length > 0 && lane.id !== "live",
      visibleSessions: laneSessions.slice(0, laneLimit),
      hiddenCount: Math.max(0, laneSessions.length - laneLimit),
    };
  });

  return {
    generatedAt: response.generatedAt,
    generatedAge,
    totals: response.totals,
    operationalTotal: sessions.length,
    historyCount: response.totals.historical ?? response.sessions.filter((item) => item.category === "historical").length,
    lanes,
    visibleSessions: sessions,
  };
}

export function buildHistorySessionViewModels(response: MissionControlResponse): HistorySessionViewModel[] {
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
      confidence: item.confidence,
      endedAtLabel: formatDateTime(item.session.endedAt ?? item.lastSignalTimestamp ?? item.session.lastEventAt),
      durationLabel: formatDuration(item.session.startedAt, item.session.endedAt),
      lastSignalAge: formatSignalAge(item.signalAgeMs, item.lastSignalTimestamp ?? item.session.lastEventAt),
      detailHref: `/session/${encodeURIComponent(item.session.id)}`,
      replayHref: `/session/${encodeURIComponent(item.session.id)}/replay`,
    }));
}

export function buildDetailProjectionViewModel(item: MissionControlSession): DetailProjectionViewModel {
  return {
    id: item.session.id,
    category: item.category,
    presentation: getCategoryPresentation(item.category),
    reason: item.reason.replace(/_/g, " "),
    rawRuntimeStatus: item.rawRuntimeStatus,
    derivedOperationalStatus: item.derivedOperationalStatus,
    sourceOfTruth: item.sourceOfTruth,
    freshness: item.freshness,
    lastSignalAge: formatSignalAge(item.signalAgeMs, item.lastSignalTimestamp ?? item.session.lastEventAt),
    confidence: item.confidence,
    operatorActivity: item.operatorActivity.replace(/-/g, " "),
    nextAction: item.nextRecommendedOperatorAction,
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
