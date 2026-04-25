import type {
  AgentEvent,
  EventType,
  RecommendationUrgency,
  SessionStatus,
  SupervisionSeverity,
  SupervisionSignals
} from "./types.ts";

/**
 * Events excluded when picking “last meaningful signal” time — housekeeping that
 * should not reset the supervisor’s sense of forward motion.
 */
const EXCLUDED_FROM_MEANINGFUL: ReadonlySet<EventType> = new Set(["session.idle_detected"]);

/**
 * Latest event by timestamp that counts as a meaningful supervision signal.
 * If every event is excluded (e.g. only idle pings), falls back to the newest event overall.
 */
export function lastMeaningfulEvent(events: AgentEvent[]): AgentEvent | null {
  if (events.length === 0) {
    return null;
  }

  const ranked = [...events].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );

  for (const event of ranked) {
    if (!EXCLUDED_FROM_MEANINGFUL.has(event.type)) {
      return event;
    }
  }

  return ranked[0] ?? null;
}

/** Map live status + recommendation urgency into a single attention tier for the UI. */
export function deriveSupervisionSeverity(
  status: SessionStatus,
  urgency: RecommendationUrgency
): SupervisionSeverity {
  if (status === "blocked") {
    return "critical";
  }
  if (status === "at_risk" || status === "needs_input") {
    return "high";
  }
  if (status === "awaiting_review") {
    if (urgency === "high") {
      return "high";
    }
    return "medium";
  }
  if (urgency === "high") {
    return "high";
  }
  if (urgency === "medium") {
    return "medium";
  }
  if (status === "parked") {
    return "info";
  }
  return "low";
}

export function buildSupervisionSignals(
  events: AgentEvent[],
  status: SessionStatus,
  urgency: RecommendationUrgency
): SupervisionSignals {
  const last = lastMeaningfulEvent(events);
  return {
    lastMeaningfulEventAt: last?.timestamp ?? null,
    supervisionSeverity: deriveSupervisionSeverity(status, urgency)
  };
}
