import type { OperationalCategory } from "../../../packages/andon-core/src/index.ts";
import type { MissionControlResponse, MissionControlSession } from "./api.ts";

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

function repoName(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).at(-1) ?? repoPath;
}

function trimLine(value: string | null | undefined, max = 88): string {
  if (!value) return "-";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
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
        freshness: item.freshness,
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
