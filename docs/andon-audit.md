# Andon Mission Control Audit

Date: 2026-04-30
Branch: `codex/recover-andon-audit`

This document audits the current Andon implementation before behavior changes. It intentionally describes the code as it exists now, including symptom-level filters and presentation choices that should be replaced by explicit product categories.

## Current Data Sources

Mission Control (`GET /fleet`) is built in `services/andon-api/src/repository.ts`.

Primary sources:

- `runtime_sessions`: used first when any runtime rows exist. `getFleet()` calls `listRuntimeSessions()` and switches into the runtime-first path if `runtimeSessions.length > 0` (`services/andon-api/src/repository.ts:541`, `services/andon-api/src/repository.ts:545`).
- `runtime_events`: loaded per runtime session with `getRuntimeEvents()` and used for last meaningful signal, evidence, recent events, and heatmap (`services/andon-api/src/repository.ts:553`, `services/andon-api/src/repository.ts:686`, `services/andon-api/src/repository.ts:708`).
- Legacy `sessions`: used as the only source when no runtime rows exist, and also mixed in as "disconnected legacy" rows when runtime rows do exist (`services/andon-api/src/repository.ts:598`, `services/andon-api/src/repository.ts:727`).
- Legacy `events`: used for status derivation, recent events, heatmap, and timelines in the legacy path (`services/andon-api/src/repository.ts:468`, `services/andon-api/src/repository.ts:686`, `services/andon-api/src/repository.ts:1007`).
- Holistic bridge context: loaded during legacy session detail/status derivation with `holisticBridge.getContext(session.id)` (`services/andon-api/src/repository.ts:302`).

Dashboard sources:

- `apps/andon-dashboard/src/api.ts` reads `/fleet`, `/sessions`, `/sessions/:id`, `/sessions/:id/timeline`, and `/sessions/stream`.
- Mission Control uses `/fleet`; History uses `/sessions`; the active-session route currently chooses from `/sessions`, not `/fleet` (`apps/andon-dashboard/src/App.tsx:328`, `apps/andon-dashboard/src/App.tsx:636`, `apps/andon-dashboard/src/App.tsx:892`).

Database path:

- Andon API and runtime service both use `ANDON_DB_PATH`, defaulting to `services/andon-api/data/andon.sqlite` (`services/andon-api/src/config.ts:8`, `services/runtime-service/src/config.ts:8`).
- A mismatched `ANDON_DB_PATH` between the API and runtime service would make Mission Control miss runtime rows even though runtime capture is running.

## Current Classification Rules

Runtime status to fleet status (`services/andon-api/src/repository.ts:119`):

- `waiting_for_input` -> `needs_input`
- `waiting_for_approval` -> `awaiting_review`
- `blocked` or `failed` -> `blocked`
- `completed` -> `awaiting_review`
- `paused` or `cancelled` -> `parked`
- `running` or `starting` -> `running` unless heartbeat freshness is `cold`, then `parked`
- anything else -> `parked`

Runtime heartbeat freshness (`services/andon-api/src/repository.ts:387`):

- `fresh`: last signal age <= 5 minutes
- `stale`: last signal age <= 20 minutes
- `cold`: last signal age > 20 minutes

Runtime supervision severity (`services/andon-api/src/repository.ts:188`):

- `blocked` -> `critical`
- `needs_input` -> `high`
- `awaiting_review` -> `medium`
- `running` -> `low`
- everything else -> `info`

Legacy status engine (`packages/andon-core/src/status-engine.ts`):

- `needs_input`: any unresolved `agent.question_asked` (`packages/andon-core/src/status-engine.ts:209`).
- `at_risk`: at least 2 recent command/test failures, scope expansion, repeated rejected approach, or out-of-scope file change (`packages/andon-core/src/status-engine.ts:215`, `packages/andon-core/src/status-engine.ts:219`).
- `blocked`: environment/tool failure, or idle detected after latest failure (`packages/andon-core/src/status-engine.ts:246`).
- `awaiting_review`: latest summary has `workComplete: true` or a `task.completed` exists, unless a newer task started or a later problem exists (`packages/andon-core/src/status-engine.ts:266`, `packages/andon-core/src/status-engine.ts:279`).
- `parked`: special background/system completion case, `session.ended`, or no operational activity within 10 minutes (`packages/andon-core/src/status-engine.ts:279`, `packages/andon-core/src/status-engine.ts:306`).
- `queued`: only `session.started` exists (`packages/andon-core/src/status-engine.ts:302`).
- `running`: default when recent activity looks healthy (`packages/andon-core/src/status-engine.ts:316`).

Legacy runtime-signal override:

- If a legacy-derived session is `needs_input` but `runtime_sessions.status` is not exactly `waiting_for_input`, it is downgraded to `parked`.
- If a legacy-derived session is `running`, `queued`, or `needs_input` and no matching runtime session row exists, it is downgraded to `parked`.
- This happens in `getFleet()` (`services/andon-api/src/repository.ts:735`, `services/andon-api/src/repository.ts:740`, `services/andon-api/src/repository.ts:743`).

## Current Filtering Rules

Mission Control server filters:

- If runtime rows exist, all runtime rows are initially included via `listRuntimeSessions()` with no status exclusion (`services/andon-api/src/repository.ts:545`).
- In runtime-first mode, up to 30 legacy rows are also loaded and included if their IDs do not exist in `runtime_sessions` (`services/andon-api/src/repository.ts:598`, `services/andon-api/src/repository.ts:603`).
- Legacy rows whose objective matches housekeeping marker substrings are excluded (`services/andon-api/src/repository.ts:39`, `services/andon-api/src/repository.ts:52`, `services/andon-api/src/repository.ts:604`).
- Parked/running/queued items with `cold` freshness and age greater than `MISSION_CONTROL_STALE_PARKED_MS` are excluded. The constant is 1 hour (`services/andon-api/src/repository.ts:284`, `services/andon-api/src/repository.ts:646`, `services/andon-api/src/repository.ts:650`, `services/andon-api/src/repository.ts:799`).

Mission Control client filters:

- Query param `status` filters by exact `SessionStatus` (`apps/andon-dashboard/src/App.tsx:332`, `apps/andon-dashboard/src/App.tsx:379`).
- Query param `repo` filters by `repoName` (`apps/andon-dashboard/src/App.tsx:337`, `apps/andon-dashboard/src/App.tsx:382`).
- Risk reason chips mutate the status filter by label text (`apps/andon-dashboard/src/App.tsx:478`).

History filters:

- None. History calls `/sessions`, which returns `SELECT * FROM sessions ORDER BY started_at DESC LIMIT 50` (`services/andon-api/src/repository.ts:382`).
- History does not read `runtime_sessions`, so runtime-only sessions are absent from History unless mirrored into legacy `sessions`.

## Current Sorting Rules

Server-side fleet sorting:

- Runtime sessions are listed from `runtime_sessions ORDER BY updated_at DESC` before mapping (`services/andon-api/src/runtime-repository.ts:154`).
- The final fleet sort is by descending `attentionRank`, then descending `session.lastEventAt` (`services/andon-api/src/repository.ts:651`).
- `attentionRank = status weight + urgency weight + freshness weight` (`services/andon-api/src/repository.ts:404`).
- Status weights: `blocked 120`, `needs_input 110`, `at_risk 100`, `awaiting_review 90`, `queued 50`, `running 40`, `parked 20`.
- Urgency weights: `high 30`, `medium 18`, `low 8`.
- Freshness weights: `fresh 10`, `stale 4`, `cold 0`.

Client-side Mission Control sorting:

- Default `attention`: descending `attentionRank`, then descending `session.lastEventAt`.
- `freshness`: freshness rank (`fresh` > `stale` > `cold`), then recency.
- `recent`: descending `session.lastEventAt`.
- These are selected by query param `sort` (`apps/andon-dashboard/src/App.tsx:338`, `apps/andon-dashboard/src/App.tsx:389`).

History sorting:

- Client sorts `/sessions` by descending `lastEventAt`, despite the server already returning by descending `startedAt` (`apps/andon-dashboard/src/App.tsx:892`).

## Runtime Session Creation

Runtime sessions are created by the runtime service:

- `POST /runtime/tasks` validates input, calls `adapter.startTask(input)`, then calls `persistSessionUpdate()` (`services/runtime-service/src/server.ts:317`, `services/runtime-service/src/server.ts:321`).
- `persistSessionUpdate()` writes `runtime_sessions`, `runtime_events`, and `runtime_processes` (`services/runtime-service/src/server.ts:125`).
- `upsertRuntimeSession()` writes `runtime_sessions` (`services/andon-api/src/runtime-repository.ts:92`).
- The local adapter creates IDs as `runtime-${Date.now()}-${random}` and starts with status `running`, activity `planning` (`packages/runtime-local/src/LocalRuntimeAdapter.ts:85`).

Legacy sessions are created by Andon event ingestion:

- `POST /events` calls `ingestEvents()` (`services/andon-api/src/server.ts:236`).
- `ingestEvents()` calls `ensureSession()` for every event (`services/andon-api/src/repository.ts:1019`).
- `ensureSession()` inserts or updates legacy `sessions` (`services/andon-api/src/repository.ts:904`).
- Holistic CLI emits legacy Andon events through `src/core/andon.ts`; event creation is best-effort with a 1 second fetch timeout (`src/core/andon.ts:10`).

## Runtime Event Creation

Runtime events are created by:

- Initial runtime-service persistence on `POST /runtime/tasks`: synthetic `session.started` event (`services/runtime-service/src/server.ts:321`).
- Adapter stream consumption: every adapter event is inserted into `runtime_events` (`services/runtime-service/src/server.ts:142`, `services/runtime-service/src/server.ts:173`).
- Runtime transitions: pause/resume/stop persist synthetic events (`services/runtime-service/src/server.ts:218`).
- Approval/denial callbacks insert `approval.granted` / `approval.denied` (`services/runtime-service/src/server.ts:356`).
- `insertRuntimeEvent()` writes `runtime_events` (`services/andon-api/src/runtime-repository.ts:162`).

Local adapter event sources:

- `session.started` and `session.heartbeat` are pushed on start (`packages/runtime-local/src/LocalRuntimeAdapter.ts:135`).
- Parsed stdout/stderr events update session activity/status and are pushed to the stream (`packages/runtime-local/src/LocalRuntimeAdapter.ts:230`).
- Exit code `0` produces `session.completed`; non-zero exit produces `session.failed` (`packages/runtime-local/src/LocalRuntimeAdapter.ts:267`, `packages/runtime-local/src/LocalRuntimeAdapter.ts:270`).

## Where Old/Terminated Sessions Are Excluded

Current exclusion is indirect and mixed with freshness/status:

- Runtime-first Mission Control does not exclude `completed`, `cancelled`, or `failed` runtime rows up front. It maps `completed` to `awaiting_review`, `cancelled` to `parked`, and `failed` to `blocked`.
- Both runtime-first and legacy paths exclude non-urgent cold sessions older than 1 hour if their mapped status is `parked`, `running`, or `queued` (`services/andon-api/src/repository.ts:646`, `services/andon-api/src/repository.ts:799`).
- Completed runtime sessions are not excluded by that rule because they map to `awaiting_review`.
- Failed runtime sessions are not excluded by that rule because they map to `blocked`.
- Legacy ended sessions can still enter Mission Control if they rank as urgent, because the query explicitly orders `ended_at IS NULL DESC` but does not filter to active-only (`services/andon-api/src/repository.ts:599`, `services/andon-api/src/repository.ts:727`).

## Hardcoded Strings, Markers, and Special Cases

Operational hardcoding:

- Housekeeping objective markers:
  - `passively capture repo activity`
  - `capture work and prepare a clean handoff`
  - `prepare a durable handoff`
  - `document the current work`
  - `pause at a natural breakpoint`
- These are substring filters for Mission Control (`services/andon-api/src/repository.ts:39`).
- Legacy background/system completion special case checks `agentName` containing `holistic`, and objective containing `Capture work and prepare a clean handoff.`, `system`, or `background` (`packages/andon-core/src/status-engine.ts:280`).
- Runtime status text is rendered into explanations as `Runtime session is ${runtimeSession.status}.` (`services/andon-api/src/repository.ts:565`).
- Missing runtime signal is converted to parked with explanation strings rather than represented as a separate category (`services/andon-api/src/repository.ts:747`).

Status labels and UI theme strings:

- `running` is labeled `Flowing`; `blocked` is labeled `Stopped`; `awaiting_review` is labeled `Review`; `parked` is labeled `Parked` (`apps/andon-dashboard/src/App.tsx:53`).
- Phase labels include decorative Japanese strings in `phaseMarks` (`apps/andon-dashboard/src/App.tsx:70`).
- Navigation brand includes a decorative mark and "Andon" label (`apps/andon-dashboard/src/App.tsx:172`).
- `QuoteBlock()` renders a decorative operational quote and Japanese text (`apps/andon-dashboard/src/App.tsx:254`, `apps/andon-dashboard/src/App.tsx:694`).
- Mission Control renders large aggregate counts including `Total sessions` and `Completed today` (`apps/andon-dashboard/src/App.tsx:456`).
- Mission Control renders an explanatory empty-state hint about old idle runs being hidden (`apps/andon-dashboard/src/App.tsx:448`).

Special presentation filters:

- Client risk chips infer status from human-readable risk labels (`apps/andon-dashboard/src/App.tsx:478`).
- Timeline hides rows over `MAX_TIMELINE_ROWS_RENDERED = 600` for UI performance (`apps/andon-dashboard/src/App.tsx:801`).

## Product Risks Found

- Mission Control does not have a first-class category model. It maps storage statuses into dashboard statuses, then later filters based on freshness and ad hoc objective strings.
- Completed runtime sessions are presented as `awaiting_review`, so 50 terminated sessions can dominate Mission Control.
- Failed terminated sessions remain `blocked` forever unless filtered by a future explicit history model.
- Missing runtime signal is treated as `parked`, which hides the distinction between historical sessions and data-integrity/runtime-feed problems.
- Runtime-first mode still mixes legacy sessions into Mission Control, creating a blended board with inconsistent truth sources.
- History is legacy-only and therefore cannot reliably show runtime-only sessions.
- Mismatched API/runtime database paths are not detected or surfaced as a data problem.
- The dashboard adds explanatory copy and visual theme elements instead of forcing the model to return the right operational slices.

## Proposed Data Model

Introduce a single explicit Mission Control projection, derived server-side:

```ts
type OperationalCategory =
  | "live"
  | "needs_action"
  | "degraded_active"
  | "historical";

interface OperationalSession {
  category: OperationalCategory;
  reason: "runtime_active" | "waiting_for_input" | "awaiting_review" | "blocked_or_failed" | "missing_runtime_signal" | "terminated" | "stale_runtime" | "db_mismatch";
  session: SessionRecord;
  runtimeSession: RuntimeSession | null;
  status: StatusDecision;
  supervision: SupervisionSignals;
  recommendation: Recommendation;
  lastSignalAt: string | null;
  sortKey: {
    categoryRank: number;
    severityRank: number;
    lastSignalAt: string;
  };
}
```

Category rules:

- `live`: runtime exists, not completed/cancelled/failed, status is `running` or `starting`, and heartbeat is fresh/stale.
- `needs_action`: runtime exists and status is `waiting_for_input` or `waiting_for_approval`; also active legacy sessions with validated runtime waiting/approval signal.
- `degraded_active`: runtime exists and status is `blocked` or `failed`; or an apparently active legacy session has missing/mismatched runtime signal.
- `historical`: completed/cancelled sessions, ended legacy sessions, and old/cold non-flowing sessions.

Rendering rules:

- Mission Control route renders only `live`, `needs_action`, and `degraded_active`.
- Needs Action route renders only `needs_action`.
- Review route renders review-ready sessions from `needs_action` where the reason/status is approval/review.
- History route renders only `historical`.
- No route should reclassify sessions in React; client filters should only narrow already-classified data.

Sorting rules:

- Mission Control: `needs_action`, then `degraded_active`, then `live`; within each, severity rank then newest `lastSignalAt`.
- History: newest terminal/completed timestamp first, falling back to last signal.

Proposed components:

- `AppShell`: persistent useful navigation with Live, Needs Action, Review, History.
- `OperationalBoard`: consumes categorized API data and renders active operational slices only.
- `SessionSummaryCard`: compact active-session card, with objective, agent, repo, current status, last signal, and next action.
- `NeedsActionList`: focused queue for input/review/blockers.
- `HistoryList`: terminal sessions only, paged or capped.
- `SessionDetail`: shared detail route for any category.

## Test Plan Before Refactor

Add characterization tests against `getFleet()` and/or new projection helper before behavior changes:

- 1 active runtime session plus 50 terminated runtime sessions: Mission Control projection must keep the active session operational and classify terminated sessions as historical.
- Active session waiting for input: classify as `needs_action`.
- Active session awaiting review/approval: classify as `needs_action` with review reason.
- Active session blocked/failed: classify as `degraded_active`.
- Old terminated sessions with missing runtime signal: classify as `historical`, not Mission Control.
- Missing runtime entirely for an apparently active legacy session: classify as `degraded_active` or explicit data problem, not silently `parked`.
- Mismatched DB path: API/runtime service mismatch is detectable as a degraded data-source condition, not an empty healthy board.
