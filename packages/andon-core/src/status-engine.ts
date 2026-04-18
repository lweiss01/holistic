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

function findLatest(events: AgentEvent[], type: AgentEvent["type"]): AgentEvent | undefined {
  return [...events].reverse().find((event) => event.type === type);
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

export function deriveStatus(input: StatusInput): StatusDecision {
  const now = input.now ?? new Date();
  const events = sortEvents(input.events);
  const latestEvent = events.at(-1);
  const phase = input.session.currentPhase;

  const unresolvedQuestion = [...events].reverse().find((event) => {
    if (event.type !== "agent.question_asked") {
      return false;
    }

    return (event.payload as { resolved?: boolean }).resolved !== true;
  });

  if (unresolvedQuestion) {
    return buildDecision("needs_input", phase, "The agent has asked a question that still needs a human answer.", [
      unresolvedQuestion.summary ?? "Unresolved agent question detected."
    ]);
  }

  const failureEvents = events.filter((event) => event.type === "command.failed" || event.type === "test.failed");
  const recentFailures = failureEvents.slice(-AT_RISK_FAILURE_THRESHOLD);
  const scopeExpansion = findLatest(events, "agent.scope_expansion_detected");
  const rejectedApproachRepeats = summariesRepeatRejectedApproach(events, input.holisticContext);
  const outOfScopeChange = input.holisticContext
    ? events.find((event) => {
        if (event.type !== "file.changed") {
          return false;
        }

        const filePath = String((event.payload as { path?: string }).path ?? "");
        return filePath.length > 0 && isPathOutsideScope(filePath, input.holisticContext.expectedScope);
      })
    : undefined;

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
  const idleDetected = findLatest(events, "session.idle_detected");
  const environmentFailure = [...failureEvents].reverse().find((event) => {
    const failureKind = String(
      (event.payload as { failureKind?: string; errorKind?: string }).failureKind ??
        (event.payload as { failureKind?: string; errorKind?: string }).errorKind ??
        ""
    );

    return failureKind === "environment" || failureKind === "tool";
  });

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

  const latestCompletedTask = findLatest(events, "task.completed");
  const latestStartedTask = findLatest(events, "task.started");
  const latestSummary = findLatest(events, "agent.summary_emitted");
  
  // If we started a new task AFTER the last completed task, then work is not complete.
  const taskCompletedTime = latestCompletedTask ? new Date(latestCompletedTask.timestamp).getTime() : 0;
  const taskStartedTime = latestStartedTask ? new Date(latestStartedTask.timestamp).getTime() : 0;
  const isCurrentlyWorkingOnNewTask = taskStartedTime > taskCompletedTime;

  const workComplete =
    ((latestSummary?.payload as { workComplete?: boolean } | undefined)?.workComplete === true || Boolean(latestCompletedTask)) &&
    !isCurrentlyWorkingOnNewTask;
  const laterProblems = events.some((event) => {
    if (!latestCompletedTask && !latestSummary) {
      return false;
    }

    const pivotTime = new Date((latestCompletedTask ?? latestSummary)!.timestamp).getTime();
    const eventTime = new Date(event.timestamp).getTime();
    return eventTime > pivotTime && ["command.failed", "test.failed", "agent.question_asked"].includes(event.type);
  });

  if (workComplete && !laterProblems) {
    if (input.session.agentName.toLowerCase().includes("holistic") || ["Capture work and prepare a clean handoff.", "system", "background"].some(t => input.session.objective.includes(t))) {
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
  if (events.length <= 1 && latestEvent?.type === "session.started") {
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
