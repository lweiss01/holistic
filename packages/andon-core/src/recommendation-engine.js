export function deriveRecommendation(input) {
    const latestEvent = input.events.at(-1);
    switch (input.status.status) {
        case "needs_input":
            return {
                urgency: "high",
                title: "Answer the pending agent question",
                actionLabel: "Respond to the agent",
                description: latestEvent?.summary ??
                    "The agent is paused on a question. A quick human answer should unblock the next step."
            };
        case "at_risk":
            return {
                urgency: "high",
                title: "Redirect the agent before it drifts further",
                actionLabel: "Narrow the scope",
                description: input.holisticContext && input.holisticContext.acceptedApproaches.length > 0
                    ? `Re-anchor the agent on accepted approaches: ${input.holisticContext.acceptedApproaches.join(", ")}.`
                    : "Review the last few failures and restate the expected scope before more work accrues."
            };
        case "blocked":
            return {
                urgency: "high",
                title: "Clear the blocking tool or environment issue",
                actionLabel: "Fix the blocker",
                description: latestEvent?.summary ??
                    "Something external is preventing progress. Resolve the environment issue or give the agent a workaround."
            };
        case "awaiting_review":
            return {
                urgency: "medium",
                title: "Review the completed work",
                actionLabel: "Open the review",
                description: "Inspect the latest summary, changed files, and tests to decide whether to accept the work or request follow-up."
            };
        case "queued":
            return {
                urgency: "low",
                title: "Confirm the task kickoff",
                actionLabel: "Let the agent begin",
                description: "The session has started but has not produced meaningful progress yet."
            };
        case "parked":
            return {
                urgency: "low",
                title: "Resume or archive the session",
                actionLabel: "Decide whether to restart",
                description: "The session looks inactive. Resume it if the work still matters, or leave it parked if it is intentionally paused."
            };
        case "running":
        default:
            return {
                urgency: "low",
                title: "Monitor the session",
                actionLabel: "Keep watching",
                description: "No intervention is needed yet. The agent is active and the current signals look healthy."
            };
    }
}
//# sourceMappingURL=recommendation-engine.js.map