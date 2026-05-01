# Andon Recovery Plan

Status: canonical recovery plan as of 2026-04-30.

This document supersedes the scattered Andon recovery, runtime-truth, and Mission Control planning threads until explicitly replaced. Future Andon work should use this file as the product and architecture contract before changing implementation code.

## 1. Canonical Product Direction

Holistic, the runtime harness, Andon, and the dashboard are separate but connected layers.

- **Holistic** is the durable repo/project context layer. It preserves plans, constraints, handoffs, decisions, rejected approaches, regression risks, and project memory.
- **Runtime Harness / Agent Tracking** is the real-time communication layer between Holistic and Andon. It captures current session truth and emits trustworthy lifecycle, status, heartbeat, task, tool, file, test, question, approval, completion, termination, error, and blocker signals.
- **Andon** is the operational supervision layer. It consumes runtime truth plus Holistic context and projects operator-visible state.
- **Andon Dashboard** is the Mission Control UI surface. It renders the operational state clearly and must not classify truth client-side.

Recovery direction: **Option D - rebuild runtime harness and dashboard around a clean contract, while salvaging useful runtime package scaffolding.**

## 2. Repo Responsibility Map

### Holistic Core

Location: `src/**`, root CLI/MCP/docs/state machinery.

Responsibilities:

- Maintain repo memory, checkpoints, handoffs, startup context, local self-dogfooding boundaries, and generated Holistic docs.
- Emit structured Holistic events only when meaningful state changes occur.
- Avoid treating passive polling, repeated branch observations, or generated handoff churn as live runtime activity.

### Runtime Harness / Agent Tracking Packages

Location: `packages/runtime-core`, `packages/runtime-local`, future `packages/runtime-*`.

Responsibilities:

- Define the canonical runtime session and event contract.
- Track actual current session lifecycle and freshness.
- Distinguish heartbeat from meaningful activity.
- Model current runtime status without UI assumptions.
- Provide adapter boundaries for Codex, local processes, Claude Code, OpenHarness, or custom runners.

Current decision: salvage and refactor the existing runtime package scaffolding. Do not delete it, but do not assume its current contract is complete enough for Mission Control.

### Andon Domain Packages

Location: `packages/andon-core`.

Responsibilities:

- Define Andon domain types, operational categories, projection inputs/outputs, recommendations, and supervision semantics.
- Contain shared server/UI contracts that do not require React to infer operational truth.
- Preserve useful domain helpers only if they align with the new runtime-backed truth model.

Current decision: refactor. Existing status names such as `running`, `parked`, and `awaiting_review` are not the canonical operational categories for the recovery model.

### Services

Locations: `services/andon-api`, `services/runtime-service`, future `services/*`.

Responsibilities:

- Expose clean API/runtime process contracts to the dashboard.
- Perform server-side operational projection.
- Keep legacy storage, runtime storage, and health diagnostics separate and explicit.
- Provide debug endpoints that explain source data, DB path, freshness, confidence, and projection reasons.

Current decision: refactor around a clean operational projection layer. The frontend must not need to know about legacy-vs-runtime confusion.

### Andon Dashboard App

Location: `apps/andon-dashboard`.

Responsibilities:

- Render Mission Control and drill-down pages from the clean API contract.
- Show only operational sessions on the live board.
- Link to detail, history, and replay instead of mixing them into the live board.
- Never classify truth client-side.

Current decision: quarantine the current Mission Control surface as a reference. Rebuild the main board after telemetry truth tests pass.

## 3. Real-Time Runtime Harness Requirements

The runtime harness must answer, in structured data:

- How did a session start?
- Which session is currently active?
- Which runtime owns it?
- Is the runtime process still alive?
- When was the last heartbeat?
- When was the last meaningful activity?
- What is the current raw runtime status?
- What is the current task/activity?
- Is the agent waiting for human input, approval, review, or an external dependency?
- Has the session completed, failed, cancelled, parked, or terminated?
- Is telemetry fresh, stale, missing, contradictory, or legacy-only?

Minimum event families:

- Session lifecycle: started, resumed, paused, completed, failed, cancelled, terminated.
- Freshness: heartbeat, last meaningful activity, stale detection.
- Task: task started, task changed, task completed.
- Tool/command: tool started/completed/failed, command started/completed/failed.
- File: file changed, file created, file deleted, relevant path metadata.
- Test: test started/completed/failed, suite metadata.
- Question/input: question asked, input requested, input resolved.
- Approval/review: approval requested/granted/denied, awaiting review, acknowledged.
- Error/blocker: blocked, warning, error, runtime mismatch, missing process, DB mismatch.

Heartbeat is not meaningful progress by itself. It proves the communication channel is alive. Meaningful activity is a state-changing runtime event such as tool use, file change, test result, task transition, question, approval, or completion.

## 4. Runtime Harness As Communication Layer

The runtime harness is the communication layer between Holistic and Andon.

- Holistic contributes durable context: objective, plan, branch/worktree, constraints, prior decisions, handoffs, and regression risks.
- The runtime harness contributes current truth: process/session lifecycle, heartbeat, activity, waiting states, blockers, and completion.
- Andon combines both on the server to project operational categories and recommended operator actions.

Holistic context can explain why a session matters, but it must not be used as proof that a session is currently active.

## 5. OpenHarness / HKUDS Reference Notes

HKUDS OpenHarness may be used as a reference for runtime/session/event concepts, agent orchestration boundaries, and adapter responsibilities.

Rules:

- Use it for inspiration, not as a source to copy blindly.
- Adapt external event shapes into Holistic's runtime contract.
- Do not let OpenHarness become the architectural owner of Holistic Layer 1-2.
- Keep OpenHarness compatibility behind adapters.

## 6. Operational Categories

These are the canonical categories Andon projects server-side.

### `live`

Runtime exists, runtime status is `starting` or `running`, heartbeat and/or last meaningful signal is fresh enough, and the session is not completed, cancelled, failed, parked, awaiting review, or waiting for human action.

### `needs_action`

The agent is waiting for a human response. Includes `waiting_for_input` and explicit unresolved user-question states.

### `degraded_active`

A session appears active but cannot be trusted as healthy. Includes stale telemetry, blocked/failed active sessions, DB/runtime mismatch, missing process for an active runtime, missing expected runtime signal, or other contradictions.

### `review`

The session is waiting for approval or review. Includes `waiting_for_approval`, `awaiting_review`, and completed-but-unacknowledged only when the product intentionally treats completion as a review queue.

### `historical`

Ended, completed and acknowledged, cancelled, terminated, cold inactive, or legacy-only sessions that are not actively running.

### `unknown`

Insufficient evidence to classify safely. Unknown is preferable to a false healthy state.

## 7. Mission Control Design Principle

Mission Control is an instrument panel, not a generic dashboard.

The primary board must be understandable in about one second and usable without scrolling on a normal laptop screen. It should answer immediately:

- What is active right now?
- What needs my action?
- What is blocked or degraded?
- What is waiting for review?
- What is historical and should not distract me?

Primary visual priority:

1. Needs Action
2. Degraded / Unknown
3. Review
4. Live

Mission Control renders only `live`, `needs_action`, `degraded_active`, `review`, and relevant `unknown` sessions. `historical` belongs in History, not on the live board.

Design constraints:

- No giant scroll page of stale cards.
- No decorative theme that obscures status.
- No novelty visuals unless they directly improve comprehension.
- No explanatory banners as a substitute for correct state.
- Status must be encoded with label, shape/position, and timestamp/freshness, not color alone.
- Every dashboard state must trace to source data.

## 8. Telemetry Truth Rules

Server-side projection is mandatory.

- Completed sessions must never be `live`.
- Parked sessions must never be `live`.
- Waiting-for-review sessions must never be `live`.
- Missing telemetry must never be healthy.
- Old terminated sessions must never count as current intervention work.
- Legacy narrative events must not classify live runtime state.
- Heartbeat freshness and meaningful activity freshness must be tracked separately.
- If confidence is low, project `unknown` or `degraded_active`, not false health.
- Dashboard React must consume projected truth, not reclassify sessions.

Required projection fields:

- `category`
- raw runtime status
- derived status / operator label
- source of truth
- last heartbeat timestamp
- last meaningful signal timestamp
- signal age
- freshness
- confidence
- operator activity insight (`editing`, `planning`, `reading`, `testing`, `waiting`, `blocked`, `idle`, `review-ready`, or `unknown`)
- projection reasons / evidence
- next recommended operator action

## 9. Replay / Event Integrity Rules

Session Replay shows meaningful chronological events.

Rules:

- Branch switch emits once per actual branch transition.
- Re-observing the same branch during polling emits no branch-switch replay event.
- Polling/no-op checks must not emit `agent.summary_emitted`.
- Heartbeats must be heartbeat events, not summaries.
- Repeated identical no-op telemetry must not appear as meaningful replay history.
- Runtime events, Holistic checkpoints, and user actions must be distinguishable.
- Heartbeat/no-op telemetry should be hidden by default or grouped behind a raw/debug toggle.
- `agent.summary_emitted` is not a transport bucket for arbitrary housekeeping.
- Compatibility mirror events may remain for legacy ingestion, but they must be marked as plumbing and excluded from primary meaningful replay.

## 10. Required Tests

Every behavior change requires tests. Minimum recovery tests:

Telemetry projection:

- One active runtime session plus 50 terminated sessions keeps only the active/relevant sessions on Mission Control.
- Parked session is not `live`.
- Awaiting review is not `live`.
- Waiting for input becomes `needs_action`.
- Active blocked/failed becomes `degraded_active`.
- Old terminated missing telemetry becomes `historical`.
- Stale active runtime becomes `degraded_active` or `unknown`.
- DB path mismatch or missing runtime service produces a degraded/unknown condition.
- Legacy-only active-looking session without runtime truth is not `live`.

Replay integrity:

- Same branch observed 100 times emits 0 or 1 branch-switch event.
- Branch A to branch B emits exactly one branch-switch event.
- No-op polling does not create summary spam.
- Replay API does not mislabel heartbeat/poll events as agent summaries.

API contract:

- Mission Control endpoint returns operational sessions only.
- History endpoint returns historical sessions only.
- Replay endpoint returns meaningful events by default.
- Health endpoint exposes DB path/count/status diagnostics.

UI contract:

- Mission Control consumes server categories without client reclassification.
- Live board excludes historical sessions.
- Needs-action/degraded/review/live priorities are visible above the fold.

## 11. Keep / Quarantine / Rewrite Decisions

Keep:

- Holistic core continuity model.
- Runtime package scaffolding in `packages/runtime-core` and `packages/runtime-local`.
- Runtime storage scaffolding and tests where they support the new contract.
- Useful dashboard detail/history/replay components as reference material.

Refactor:

- `packages/andon-core` status/domain types around canonical operational categories.
- `services/andon-api` fleet/status read model into a server-side projection layer.
- `services/runtime-service` freshness and process truth so Andon can trust it.

Quarantine:

- Current `apps/andon-dashboard` Mission Control route as a reference UI only.
- Old planning threads that imply UI polish can precede telemetry truth.
- Legacy narrative-derived live classification paths.

Rewrite:

- Mission Control primary board after telemetry truth tests pass.
- `/fleet` or replacement `/mission-control` API contract around operational categories.
- Replay filtering/grouping around meaningful events vs raw telemetry.

Delete later, after replacement is proven:

- Ad hoc hardcoded filters.
- Dead UI components.
- Stale planning docs or route paths that keep reintroducing old semantics.

## 12. Phased Cleanup Plan

1. **Planning recovery:** make this document canonical and point planning/GSD state at it.
2. **Runtime contract:** define the minimum event/session/freshness contract Andon needs.
3. **Telemetry projection:** implement server-side categories and tests.
4. **Replay integrity:** stop bogus event emission and separate meaningful replay from raw telemetry.
5. **API cleanup:** expose Mission Control, History, Replay, and Health contracts.
6. **Mission Control rebuild:** rebuild the no-scroll instrument panel from the clean API.
7. **History/detail/replay cleanup:** separate historical review and debugging from live operations.
8. **Quarantine/delete old paths:** remove stale filters, dead UI, and superseded docs after parity is proven.

## 13. Step C Starting Point

Start Step C by designing the runtime harness contract in `packages/runtime-core` and the corresponding tests before touching the dashboard.

Deliverables for Step C:

- Runtime session lifecycle contract.
- Heartbeat vs meaningful activity contract.
- Required event families and payload minima.
- Live/stale/review/historical decision inputs.
- Tests that prove Andon can project operational categories from runtime truth without React inference.
