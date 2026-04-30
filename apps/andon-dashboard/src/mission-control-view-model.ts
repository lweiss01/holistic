import type {
  FleetSessionItem,
  SessionStatus,
} from "../../../packages/andon-core/src/index.ts";

export type MissionStatusFilter = "all" | SessionStatus;
export type MissionSort = "attention" | "freshness" | "recent";

export interface MissionSessionViewModel {
  id: string;
  item: FleetSessionItem;
  status: SessionStatus;
  urgency: FleetSessionItem["recommendation"]["urgency"];
  repoName: string;
  agentName: string;
  headline: string;
  whyNow: string;
  nextAction: string;
  latestSummary: string;
  freshnessLabel: string;
  isDegraded: boolean;
  degradedBadge: string | null;
  needsIntervention: boolean;
  attentionRank: number;
  attentionBreakdown: FleetSessionItem["attentionBreakdown"];
  lastEventAt: string;
  primaryAction: "approve" | "resume" | "pause" | null;
}

const RUNTIME_MISSING_MARKERS = [
  "no runtime session signal",
  "no runtime waiting_for_input signal",
  "runtime feed is unavailable",
  "no runtime heartbeat",
  "non-flowing",
];

function trimLine(value: string | null | undefined, max = 110): string {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function normalizeFleetItem(item: FleetSessionItem): FleetSessionItem {
  return {
    ...item,
    availableActions: item.availableActions.length > 0 ? item.availableActions : ["inspect"],
    attentionBreakdown: item.attentionBreakdown ?? { status: 0, urgency: 0, freshness: 0 },
  };
}

export function isInterventionStatus(status: SessionStatus): boolean {
  return status === "blocked" || status === "needs_input" || status === "awaiting_review" || status === "at_risk";
}

function freshnessSortValue(value: FleetSessionItem["heartbeatFreshness"]): number {
  if (value === "fresh") return 3;
  if (value === "stale") return 2;
  return 1;
}

function hasRuntimeMissingSignal(item: FleetSessionItem): boolean {
  const source = `${item.status.explanation}\n${item.status.evidence.join("\n")}`.toLowerCase();
  return RUNTIME_MISSING_MARKERS.some((marker) => source.includes(marker));
}

export function isMissionSessionDegraded(item: FleetSessionItem): boolean {
  if (hasRuntimeMissingSignal(item)) {
    return true;
  }
  return item.status.status === "parked" && item.heartbeatFreshness === "cold";
}

function degradedBadge(item: FleetSessionItem): string | null {
  if (!isMissionSessionDegraded(item)) {
    return null;
  }
  if (hasRuntimeMissingSignal(item)) {
    return "Runtime signal missing";
  }
  return "Heartbeat degraded";
}

function freshnessLabel(item: FleetSessionItem): string {
  const degraded = isMissionSessionDegraded(item);
  if (item.heartbeatFreshness === "fresh") return "Live (<5 min)";
  if (item.heartbeatFreshness === "stale") return "Quiet (5–20 min)";
  return degraded ? "Cold (>20 min) — degraded" : "Cold (>20 min)";
}

function missionWhyNow(item: FleetSessionItem): string {
  const reason = trimLine(item.blockedReason ?? item.status.evidence[0] ?? item.status.explanation, 120);
  if (hasRuntimeMissingSignal(item)) {
    return "Runtime signal missing; session is treated as non-flowing.";
  }
  const coldRuntimeWithoutRecentHeartbeat =
    item.status.status === "parked"
    && item.heartbeatFreshness === "cold"
    && (
      /runtime session is running/i.test(item.status.explanation)
      || /no runtime events recorded yet/i.test(reason)
    );
  if (coldRuntimeWithoutRecentHeartbeat) {
    return "No recent runtime heartbeat confirms active flow.";
  }
  return reason;
}

function primaryAction(actions: FleetSessionItem["availableActions"]): "approve" | "resume" | "pause" | null {
  if (actions.includes("approve")) return "approve";
  if (actions.includes("resume")) return "resume";
  if (actions.includes("pause")) return "pause";
  return null;
}

function compareByRecent(a: MissionSessionViewModel, b: MissionSessionViewModel): number {
  return new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime();
}

function compareMissionViewModels(
  a: MissionSessionViewModel,
  b: MissionSessionViewModel,
  sortBy: MissionSort,
): number {
  if (sortBy === "freshness") {
    const byFreshness = freshnessSortValue(b.item.heartbeatFreshness) - freshnessSortValue(a.item.heartbeatFreshness);
    if (byFreshness !== 0) return byFreshness;
  } else if (sortBy === "recent") {
    const byRecent = compareByRecent(a, b);
    if (byRecent !== 0) return byRecent;
  } else {
    const byIntervention = Number(b.needsIntervention) - Number(a.needsIntervention);
    if (byIntervention !== 0) return byIntervention;
    const byAttention = b.attentionRank - a.attentionRank;
    if (byAttention !== 0) return byAttention;
  }

  const byDegraded = Number(b.isDegraded) - Number(a.isDegraded);
  if (byDegraded !== 0) return byDegraded;

  const byAttention = b.attentionRank - a.attentionRank;
  if (byAttention !== 0) return byAttention;

  return compareByRecent(a, b);
}

export function buildMissionSessionViewModels(items: FleetSessionItem[]): MissionSessionViewModel[] {
  return items.map((entry) => {
    const item = normalizeFleetItem(entry);
    const degraded = isMissionSessionDegraded(item);
    const status = item.status.status;
    return {
      id: item.session.id,
      item,
      status,
      urgency: item.recommendation.urgency,
      repoName: item.repoName,
      agentName: item.session.agentName,
      headline: trimLine(item.activeTask?.title ?? item.session.objective, 96),
      whyNow: missionWhyNow(item),
      nextAction: trimLine(item.recommendedAction || item.recommendation.actionLabel, 95),
      latestSummary: trimLine(item.session.lastSummary ?? item.status.explanation, 95),
      freshnessLabel: freshnessLabel(item),
      isDegraded: degraded,
      degradedBadge: degradedBadge(item),
      needsIntervention: isInterventionStatus(status),
      attentionRank: item.attentionRank,
      attentionBreakdown: item.attentionBreakdown,
      lastEventAt: item.session.lastEventAt,
      primaryAction: primaryAction(item.availableActions),
    };
  });
}

export function filterAndSortMissionSessionViewModels(
  items: MissionSessionViewModel[],
  options: {
    statusFilter: MissionStatusFilter;
    repoFilter: string;
    sortBy: MissionSort;
  },
): MissionSessionViewModel[] {
  const { statusFilter, repoFilter, sortBy } = options;
  const filtered = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) {
      return false;
    }
    if (repoFilter !== "all" && item.repoName !== repoFilter) {
      return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) => compareMissionViewModels(a, b, sortBy));
}

export function buildAttentionQueue(items: MissionSessionViewModel[], limit = 6): MissionSessionViewModel[] {
  return [...items]
    .filter((item) => item.needsIntervention || item.isDegraded)
    .sort((a, b) => compareMissionViewModels(a, b, "attention"))
    .slice(0, limit);
}
