# Milestone 009: Fleet Intelligence

This milestone merges the strongest parts of the older rules-engine and drift milestones into a single intelligence layer that turns runtime events and Holistic grounding into ranked supervision decisions.

## Slice Definition

### S01: Derived Activity and Attention Rank
- **Goal:** Convert raw events and runtime state into stable labels and sort order.
- **Implementation:** Build `deriveActivityKind()` and `deriveAttentionRank()` so sessions can be compared consistently across runtimes.

### S02: Stall and Failure Detection
- **Goal:** Detect silent stalls, unstable retry loops, and failure concentration before the operator has to manually infer them.
- **Implementation:** Add `detectStallRisk()` and `detectFailureLoop()` using heartbeats, event tails, retry streaks, and failed test/command clusters.

### S03: Approval, Overlap, and Runtime Risk Visibility
- **Goal:** Surface the operational reasons a session needs attention.
- **Implementation:** Treat pending approvals, overlapping file edits, dirty worktrees, and process instability as first-class fleet signals.

### S04: Holistic-vs-Runtime Drift Reasoning
- **Goal:** Compare live runtime activity to Holistic-stated objective, expected scope, constraints, and rejected approaches.
- **Implementation:** Extend the earlier drift work so it becomes one ranked input alongside operational risk, not a separate orphan system.

### S05: Explanation and Recommendation Engine
- **Goal:** Produce stable "why this matters" and "what should I do" outputs for the dashboard and APIs.
- **Implementation:** Centralize explanation lines, severity, recommended next action, and attention score derivation so M010 can stay presentation-focused.

## Exit Criteria

- Blocked, needs-input, stale, failure-loop, overlap, and drift scenarios rank predictably.
- Sessions expose stable explanations and recommended actions that can drive the Mission Control homepage.
