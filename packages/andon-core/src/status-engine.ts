import type { HolisticContext } from "../../holistic-bridge-types/src/index.ts";

import type { AgentEvent, SessionPhase, SessionRecord, SessionStatus, StatusDecision } from "./types.ts";

const RECENT_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;
const AT_RISK_FAILURE_THRESHOLD = 2;

interface StatusInput {
  session: SessionRecord;
  events: AgentEvent[];
  holisticContext: HolisticContext | null;
  now?: Date;
}

function sortEvents(events: AgentEvent[]): AgentEvent[] {
  return [...events].sort((left, right) => {
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });
}

function buildDecision(
  status: SessionStatus,
  phase: SessionPhase,
  explanation: string,
  evidence: string[]
): StatusDecision {
  return { status, phase, explanation, evidence };
}

function isPathOutsideScope(path: string, scope: string[]): boolean {
  if (scope.length === 0) {
    return false;
  }

  return !scope.some((allowedPath) => path.startsWith(allowedPath));
}

function summariesRepeatRejectedApproach(events: AgentEvent[], holisticContext: HolisticContext | null): string[] {
  if (!holisticContext || holisticContext.rejectedApproaches.length === 0) {
    return [];
  }

  const rejected = holisticContext.rejectedApproaches.map((value) => value.toLowerCase());

  return events
    .filter((event) => event.type === "agent.summary_emitted")
    .flatMap((event) => {
      const summary = (event.summary ?? String((event.payload as { summary?: string }).summary ?? "")).toLowerCase();
      return rejected.filter((approach) => summary.includes(approach));
    });
}

interface EventScan {
  sorted: AgentEvent[];
  unresolvedQuestion: AgentEvent | undefined;
  failureEvents: AgentEvent[];
  scopeExpansion: AgentEvent | undefined;
  outOfScopeChange: AgentEvent | undefined;
  latestCompletedTask: AgentEvent | undefined;
  latestStartedTask: AgentEvent | undefined;
  latestSummary: AgentEvent | undefined;
  idleDetected: AgentEvent | undefined;
  environmentFailure: AgentEvent | undefined;
}

function scanSortedEvents(events: AgentEvent[], holisticContext: HolisticContext | null): EventScan {
  const sorted = sortEvents(events);
  let unresolvedQuestion: AgentEvent | undefined;
  const failureEvents: AgentEvent[] = [];
  let scopeExpansion: AgentEvent | undefined;
  let outOfScopeChange: AgentEvent | undefined;
  let latestCompletedTask: AgentEvent | undefined;
  let latestStartedTask: AgentEvent | undefined;
  let latestSummary: AgentEvent | undefined;
  let idleDetected: AgentEvent | undefined;
  let environmentFailure: AgentEvent | undefined;

  for (const event of sorted) {
    if (event.type === "agent.question_asked" && (event.payload as { resolved?: boolean }).resolved !== true) {
      unresolvedQuestion = event;
    }

    if (event.type === "command.failed" || event.type === "test.failed") {
      failureEvents.push(event);
      const failureKind = String(
        (event.payload as { failureKind?: string; errorKind?: string }).failureKind ??
          (event.payload as { failureKind?: string; errorKind?: string }).errorKind ??
          ""
      );
      if (failureKind === "environment" || failureKind === "tool") {
        environmentFailure = event;
      }
    }

    if (event.type === "agent.scope_expansion_detected") {
      scopeExpansion = event;
    }

    if (holisticContext && !outOfScopeChange && event.type === "file.changed") {
      const filePath = String((event.payload as { path?: string }).path ?? "");
      if (filePath.length > 0 && isPathOutsideScope(filePath, holisticContext.expectedScope)) {
        outOfScopeChange = event;
      }
    }

    if (event.type === "session.idle_detected") {
      idleDetected = event;
    }

    if (event.type === "task.completed") {
      latestCompletedTask = event;
    }
    if (event.type === "task.started") {
      latestStartedTask = event;
    }
    if (event.type === "agent.summary_emitted") {
      latestSummary = event;
    }
  }

  return {
    sorted,
    unresolvedQuestion,
    failureEvents,
    scopeExpansion,
    outOfScopeChange,
    latestCompletedTask,
    latestStartedTask,
    latestSummary,
    idleDetected,
    environmentFailure
  };
}

export function deriveStatus(input: StatusInput): StatusDecision {
  const now = input.now ?? new Date();
  const scan = scanSortedEvents(input.events, input.holisticContext);
  const { sorted, unresolvedQuestion, failureEvents, scopeExpansion, outOfScopeChange } = scan;
  const latestEvent = sorted.at(-1);
  const phase = input.session.currentPhase;

  if (unresolvedQuestion) {
    return buildDecision("needs_input", phase, "The agent has asked a question that still needs a human answer.", [
      unresolvedQuestion.summary ?? "Unresolved agent question detected."
    ]);
  }

  const recentFailures = failureEvents.slice(-AT_RISK_FAILURE_THRESHOLD);
  const rejectedApproachRepeats = summariesRepeatRejectedApproach(sorted, input.holisticContext);

  if (
    recentFailures.length >= AT_RISK_FAILURE_THRESHOLD ||
    scopeExpansion ||
    rejectedApproachRepeats.length > 0 ||
    outOfScopeChange
  ) {
    const evidence: string[] = [];

    if (recentFailures.length >= AT_RISK_FAILURE_THRESHOLD) {
      evidence.push(`Recent failures: ${recentFailures.map((event) => event.type).join(", ")}`);
    }

    if (scopeExpansion) {
      evidence.push(scopeExpansion.summary ?? "The agent is expanding beyond the original scope.");
    }

    if (rejectedApproachRepeats.length > 0) {
      evidence.push(`Summary repeated rejected approaches: ${rejectedApproachRepeats.join(", ")}`);
    }

    if (outOfScopeChange) {
      evidence.push(outOfScopeChange.summary ?? "A changed file appears outside the Holistic expected scope.");
    }

    return buildDecision("at_risk", phase, "The session shows signs of drift, churn, or repeated failure.", evidence);
  }

  const latestFailure = failureEvents.at(-1);
  const { idleDetected, environmentFailure } = scan;

  if (
    environmentFailure ||
    (idleDetected &&
      latestFailure &&
      new Date(idleDetected.timestamp).getTime() >= new Date(latestFailure.timestamp).getTime())
  ) {
    return buildDecision("blocked", phase, "Progress is blocked by a failure followed by inactivity or a tool issue.", [
      environmentFailure?.summary ?? latestFailure?.summary ?? "Recent blocking failure detected.",
      idleDetected?.summary ?? "The session became idle after the failure."
    ]);
  }

  const { latestCompletedTask, latestStartedTask, latestSummary } = scan;

  const taskCompletedTime = latestCompletedTask ? new Date(latestCompletedTask.timestamp).getTime() : 0;
  const taskStartedTime = latestStartedTask ? new Date(latestStartedTask.timestamp).getTime() : 0;
  const isCurrentlyWorkingOnNewTask = taskStartedTime > taskCompletedTime;

  const workComplete =
    ((latestSummary?.payload as { workComplete?: boolean } | undefined)?.workComplete === true || Boolean(latestCompletedTask)) &&
    !isCurrentlyWorkingOnNewTask;
  const laterProblems = sorted.some((event) => {
    if (!latestCompletedTask && !latestSummary) {
      return false;
    }

    const pivotTime = new Date((latestCompletedTask ?? latestSummary)!.timestamp).getTime();
    const eventTime = new Date(event.timestamp).getTime();
    return eventTime > pivotTime && ["command.failed", "test.failed", "agent.question_asked"].includes(event.type);
  });

  if (workComplete && !laterProblems) {
    if (
      input.session.agentName.toLowerCase().includes("holistic") ||
      ["Capture work and prepare a clean handoff.", "system", "background"].some((t) => input.session.objective.includes(t))
    ) {
      return buildDecision(
        "parked",
        phase,
        "The background system agent has completed its internal updates.",
        [latestSummary?.summary ?? latestCompletedTask?.summary ?? "System task reached completion."]
      );
    }

    return buildDecision(
      "awaiting_review",
      phase,
      "The agent appears to have completed its current work and is ready for human review.",
      [latestSummary?.summary ?? latestCompletedTask?.summary ?? "Work completion signal detected."]
    );
  }

  const latestEventTime = new Date(input.session.lastEventAt).getTime();
  if (sorted.length <= 1 && latestEvent?.type === "session.started") {
    return buildDecision("queued", phase, "The session has started but meaningful work has not begun yet.", [
      latestEvent.summary ?? "Waiting for the first substantial action."
    ]);
  }

  if (latestEvent?.type === "session.ended" || now.getTime() - latestEventTime > RECENT_ACTIVITY_WINDOW_MS) {
    return buildDecision("parked", phase, "The session is inactive and likely waiting to be resumed later.", [
      latestEvent?.summary ?? "No recent healthy activity detected."
    ]);
  }

  return buildDecision("running", phase, "Recent activity looks healthy and the agent is making progress.", [
    latestEvent?.summary ?? "Recent activity is flowing normally."
  ]);
}
