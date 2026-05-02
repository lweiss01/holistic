import assert from "node:assert/strict";
import fs from "node:fs";

import type { OperationalCategory } from "../packages/andon-core/src/index.ts";
import type { MissionControlResponse, MissionControlSession } from "../apps/andon-dashboard/src/api.ts";
import {
  buildDetailProjectionViewModel,
  buildHistorySessionViewModels,
  buildMissionControlBoardViewModel,
  buildReplayViewModel,
  buildMissionSessionViewModels,
  getCategoryPresentation,
  replayEventDisplayKind,
  MISSION_LANES,
} from "../apps/andon-dashboard/src/mission-control-view-model.ts";
import type { SessionReplayResponse } from "../apps/andon-dashboard/src/api.ts";

function makeMissionSession(
  category: OperationalCategory,
  overrides: Partial<MissionControlSession> = {},
): MissionControlSession {
  const base: MissionControlSession = {
    session: {
      id: `${category}-session`,
      agentName: "codex",
      runtime: "codex",
      repoPath: "D:/Projects/active/holistic",
      worktreePath: "D:/Projects/active/holistic",
      objective: "Recover Andon Mission Control",
      currentPhase: "execute",
      startedAt: "2026-04-29T12:00:00.000Z",
      endedAt: category === "historical" ? "2026-04-29T12:30:00.000Z" : null,
      lastEventAt: "2026-04-29T12:10:00.000Z",
      lastSummary: "Server projection emitted an operational category.",
    },
    category,
    reason: category === "needs_action" ? "waiting_for_input" : category,
    rawRuntimeStatus: category === "historical" ? "terminated" : "running",
    derivedOperationalStatus: category,
    sourceOfTruth: "runtime",
    freshness: category === "unknown" ? "unknown" : "fresh",
    lastSignalTimestamp: "2026-04-29T12:10:00.000Z",
    signalAgeMs: 30_000,
    lastAgentSignalTimestamp: "2026-04-29T12:10:00.000Z",
    agentSignalAgeMs: 30_000,
    runtimeProcessAlive: category === "live" ? true : category === "historical" ? false : "unknown",
    lifecycleState: category === "live" ? "running" : category === "review" ? "review_ready" : category === "needs_action" ? "waiting_input" : category === "historical" ? "parked" : "stale",
    runtimeSignal: category === "live" ? "alive" : category === "historical" ? "dead" : "unknown",
    operatorAttention: category === "needs_action" ? "input_needed" : category === "review" ? "review_needed" : category === "degraded_active" ? "intervention_needed" : "none",
    primaryStatus: category === "live" ? "running" : category === "needs_action" ? "needs_action" : category === "review" ? "review" : category === "degraded_active" ? "needs_intervention" : category === "historical" ? "parked" : "unknown",
    confidence: category === "unknown" ? "low" : "high",
    operatorActivity: category === "review" ? "review-ready" : category === "needs_action" ? "waiting" : "editing",
    nextRecommendedOperatorAction: category === "needs_action" ? "Answer the agent prompt." : "Inspect when ready.",
    belongsToMissionControl: category !== "historical",
    belongsToHistory: category === "historical",
  };

  return {
    ...base,
    ...overrides,
    session: {
      ...base.session,
      ...(overrides.session ?? {}),
    },
  };
}

function makeResponse(sessions: MissionControlSession[]): MissionControlResponse {
  const categories: Array<OperationalCategory | "total"> = [
    "total",
    "live",
    "needs_action",
    "degraded_active",
    "review",
    "historical",
    "unknown",
  ];
  const totals = Object.fromEntries(categories.map((category) => [category, 0])) as MissionControlResponse["totals"];
  totals.total = sessions.length;
  for (const session of sessions) {
    totals[session.category] += 1;
  }

  return {
    generatedAt: "2026-04-29T12:11:00.000Z",
    totals,
    sessions,
  };
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Andon Mission Control renders one live operational row and excludes 50 historical rows",
    run: () => {
      const live = makeMissionSession("live", { session: { id: "live-1" } });
      const historical = Array.from({ length: 50 }, (_, index) =>
        makeMissionSession("historical", {
          session: { id: `historical-${index + 1}` },
          belongsToMissionControl: false,
          belongsToHistory: true,
        })
      );

      const board = buildMissionControlBoardViewModel(makeResponse([live, ...historical]));

      assert.deepEqual(board.visibleSessions.map((item) => item.id), ["live-1"]);
      assert.equal(board.lanes.find((lane) => lane.id === "live")?.count, 1);
      assert.equal(board.lanes.flatMap((lane) => lane.visibleSessions).some((item) => item.category === "historical"), false);
      assert.equal(board.historyCount, 50);
    },
  },
  {
    name: "Andon Mission Control orders needs_action before intervention, review, and running",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([
        makeMissionSession("live", { session: { id: "live" } }),
        makeMissionSession("review", { session: { id: "review" } }),
        makeMissionSession("degraded_active", { session: { id: "degraded" } }),
        makeMissionSession("needs_action", { session: { id: "needs" } }),
      ]));

      assert.deepEqual(
        board.visibleSessions.map((item) => item.id),
        ["needs", "degraded", "review", "live"],
      );
      assert.deepEqual(
        board.lanes.map((lane) => lane.id),
        ["needs_action", "degraded_unknown", "review", "live"],
      );
    },
  },
  {
    name: "Andon Mission Control renders review as Review, not Flowing or Running",
    run: () => {
      const [viewModel] = buildMissionSessionViewModels([
        makeMissionSession("review", {
          rawRuntimeStatus: "running",
          derivedOperationalStatus: "awaiting_review",
          reason: "awaiting_review",
        }),
      ]);

      assert.ok(viewModel);
      assert.equal(viewModel.category, "review");
      assert.equal(viewModel.primaryStatusLabel, "Review");
      assert.doesNotMatch(viewModel.primaryStatusLabel, /flowing|running/i);
    },
  },
  {
    name: "Andon Mission Control presents degraded and unknown as non-healthy states",
    run: () => {
      assert.equal(getCategoryPresentation("degraded_active").tone, "warning");
      assert.equal(getCategoryPresentation("degraded_active").label, "Needs Intervention");
      assert.equal(getCategoryPresentation("live").label, "Running");
      assert.equal(getCategoryPresentation("unknown").tone, "unknown");
      assert.notEqual(getCategoryPresentation("degraded_active").tone, "healthy");
      assert.notEqual(getCategoryPresentation("unknown").tone, "healthy");
    },
  },
  {
    name: "Andon Mission Control empty operational response has calm empty lanes",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([]));

      assert.equal(board.operationalTotal, 0);
      assert.equal(board.visibleSessions.length, 0);
      assert.deepEqual(board.lanes.map((lane) => lane.count), [0, 0, 0, 0]);
      assert.deepEqual(board.lanes.map((lane) => lane.isEmpty), [true, true, true, true]);
      assert.deepEqual(board.lanes.map((lane) => lane.hasPriority), [false, false, false, false]);
    },
  },
  {
    name: "Andon Mission Control consumes category and reason without reclassifying raw runtime status",
    run: () => {
      const [viewModel] = buildMissionSessionViewModels([
        makeMissionSession("needs_action", {
          rawRuntimeStatus: "running",
          reason: "waiting_for_input",
          derivedOperationalStatus: "needs_input",
        }),
      ]);

      assert.ok(viewModel);
      assert.equal(viewModel.category, "needs_action");
      assert.equal(viewModel.primaryStatusLabel, "Needs Action");
      assert.equal(viewModel.rawRuntimeStatus, "running");
      assert.equal(viewModel.reason, "waiting for input");
      assert.equal(viewModel.operatorActivity, "waiting");
    },
  },
  {
    name: "Andon Mission Control separates agent signal age from API refresh and runtime liveness",
    run: () => {
      const [viewModel] = buildMissionSessionViewModels([
        makeMissionSession("degraded_active", {
          runtimeProcessAlive: false,
          runtimeSignal: "dead",
          lastAgentSignalTimestamp: "2026-04-29T10:10:00.000Z",
          agentSignalAgeMs: 2 * 60 * 60_000,
          signalAgeMs: 30_000,
          reason: "missing_runtime_signal",
        }),
      ]);

      assert.ok(viewModel);
      assert.equal(viewModel.lastAgentSignalAge, "agent 2h");
      assert.equal(viewModel.runtimeAliveLabel, "runtime disconnected");
      assert.notEqual(viewModel.lastAgentSignalAge, viewModel.lastSignalAge);
    },
  },
  {
    name: "Andon Mission Control gives non-empty exception lanes priority over empty lanes",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([
        makeMissionSession("review", {
          session: { id: "review-ready" },
          rawRuntimeStatus: "completed",
          freshness: "cold",
        }),
      ]));

      const reviewLane = board.lanes.find((lane) => lane.id === "review");
      const needsActionLane = board.lanes.find((lane) => lane.id === "needs_action");

      assert.equal(reviewLane?.count, 1);
      assert.equal(reviewLane?.isEmpty, false);
      assert.equal(reviewLane?.hasPriority, true);
      assert.equal(needsActionLane?.isEmpty, true);
      assert.equal(needsActionLane?.hasPriority, false);
      assert.match(reviewLane?.visibleSessions[0]?.freshness ?? "", /review-ready/i);
      assert.doesNotMatch(reviewLane?.visibleSessions[0]?.freshness ?? "", /active/i);
    },
  },
  {
    name: "Andon Mission Control status presentation exists for all operational categories",
    run: () => {
      for (const category of ["needs_action", "degraded_active", "review", "live", "unknown"] as const) {
        const presentation = getCategoryPresentation(category);
        assert.ok(presentation.label);
        assert.ok(presentation.marker);
        assert.ok(presentation.tone);
      }
    },
  },
  {
    name: "Andon Mission Control never assigns historical to a live board lane",
    run: () => {
      const historical = makeMissionSession("historical", {
        belongsToMissionControl: true,
        belongsToHistory: true,
      });
      const board = buildMissionControlBoardViewModel(makeResponse([historical]));

      assert.equal(board.visibleSessions.length, 0);
      assert.equal(MISSION_LANES.some((lane) => lane.categories.includes("historical")), false);
    },
  },
  {
    name: "Andon Dashboard API client no longer exports old fleet UI fetchers",
    run: () => {
      const apiSource = fs.readFileSync("apps/andon-dashboard/src/api.ts", "utf8");

      assert.doesNotMatch(apiSource, /getFleet|FleetResponse|getActiveSession|getSessionsList|getTimeline|postCallback/);
      assert.match(apiSource, /getMissionControl/);
      assert.match(apiSource, /getHistory/);
      assert.match(apiSource, /getSessionReplay/);
      assert.match(apiSource, /getAndonHealth/);
    },
  },
  {
    name: "Andon Mission Control card primary target is detail and replay remains secondary",
    run: () => {
      const appSource = fs.readFileSync("apps/andon-dashboard/src/App.tsx", "utf8");

      assert.match(appSource, /className="session-row-main" href=\{`\/session\/\$\{encodeURIComponent\(item\.id\)\}`\}/);
      assert.match(appSource, /className="row-link" href=\{`\/session\/\$\{encodeURIComponent\(item\.id\)\}\/replay`\}/);
    },
  },
  {
    name: "Andon History renders historical sessions only",
    run: () => {
      const historical = makeMissionSession("historical", {
        session: { id: "history-1", startedAt: "2026-04-29T12:00:00.000Z", endedAt: "2026-04-29T12:45:00.000Z" },
        belongsToMissionControl: false,
        belongsToHistory: true,
      });
      const live = makeMissionSession("live", {
        session: { id: "live-should-not-render" },
        belongsToMissionControl: true,
        belongsToHistory: false,
      });

      const rows = buildHistorySessionViewModels(makeResponse([live, historical]));

      assert.deepEqual(rows.map((item) => item.id), ["history-1"]);
      assert.equal(rows[0]?.category, "historical");
      assert.equal(rows[0]?.durationLabel, "45m");
      assert.equal(rows[0]?.detailHref, "/session/history-1");
      assert.equal(rows[0]?.replayHref, "/session/history-1/replay");
    },
  },
  {
    name: "Andon Detail projection exposes category reason source freshness and confidence",
    run: () => {
      const projection = buildDetailProjectionViewModel(makeMissionSession("degraded_active", {
        reason: "stale_runtime",
        rawRuntimeStatus: "running",
        derivedOperationalStatus: "degraded",
        sourceOfTruth: "mixed",
        freshness: "stale",
        confidence: "medium",
        operatorActivity: "blocked",
        nextRecommendedOperatorAction: "Investigate stale runtime telemetry.",
        signalAgeMs: 600_000,
      }));

      assert.equal(projection.category, "degraded_active");
      assert.equal(projection.reason, "stale runtime");
      assert.equal(projection.rawRuntimeStatus, "running");
      assert.equal(projection.derivedOperationalStatus, "degraded");
      assert.equal(projection.sourceOfTruth, "mixed");
      assert.equal(projection.freshness, "stale");
      assert.equal(projection.confidence, "medium");
      assert.equal(projection.operatorActivity, "blocked");
      assert.equal(projection.lastSignalAge, "10m");
      assert.match(projection.nextAction, /stale runtime/i);
    },
  },
  {
    name: "Andon Replay keeps heartbeat noop and context spam out of primary meaningful activity",
    run: () => {
      const replay: SessionReplayResponse = {
        sessionId: "replay-1",
        generatedAt: "2026-04-29T12:30:00.000Z",
        hiddenTelemetryCount: 2,
        events: [
          {
            id: "heartbeat-1",
            sessionId: "replay-1",
            type: "session.heartbeat",
            kind: "heartbeat_liveness",
            timestamp: "2026-04-29T12:00:00.000Z",
            summary: "Runtime heartbeat",
            source: "runtime",
            meaningful: false,
          },
          {
            id: "noop-1",
            sessionId: "replay-1",
            type: "telemetry.noop",
            kind: "noop_telemetry",
            timestamp: "2026-04-29T12:01:00.000Z",
            summary: "No state change",
            source: "collector",
            meaningful: false,
          },
          {
            id: "branch-1",
            sessionId: "replay-1",
            type: "context.branch_changed",
            kind: "context_branch_change",
            timestamp: "2026-04-29T12:02:00.000Z",
            summary: "Detected branch switch; review the new branch context.",
            source: "collector",
            meaningful: true,
          },
          {
            id: "mirror-summary-1",
            sessionId: "replay-1",
            type: "agent.summary",
            kind: "compatibility_mirror",
            timestamp: "2026-04-29T12:03:01.000Z",
            summary: "Legacy ingest: agent.summary_emitted - Implemented the detail page.",
            source: "runtime",
            meaningful: false,
          },
          {
            id: "summary-1",
            sessionId: "replay-1",
            type: "agent.summary",
            kind: "agent_summary",
            timestamp: "2026-04-29T12:03:00.000Z",
            summary: "Implemented the detail page.",
            source: "agent",
            meaningful: true,
          },
        ],
      };

      const viewModel = buildReplayViewModel(replay);

      assert.deepEqual(viewModel.primaryEvents.map((item) => item.id), ["summary-1"]);
      assert.deepEqual(viewModel.groupedEvents.map((item) => item.id), ["heartbeat-1", "noop-1", "branch-1", "mirror-summary-1"]);
      assert.equal(viewModel.hiddenTelemetryCount, 2);
    },
  },
  {
    name: "Andon Replay labels normalized event kinds for operator scanning",
    run: () => {
      assert.equal(replayEventDisplayKind({ kind: "heartbeat_liveness", type: "session.heartbeat" }), "heartbeat/liveness");
      assert.equal(replayEventDisplayKind({ kind: "noop_telemetry", type: "telemetry.noop" }), "no-op telemetry");
      assert.equal(replayEventDisplayKind({ kind: "checkpoint", type: "holistic.checkpoint" }), "checkpoint");
      assert.equal(replayEventDisplayKind({ kind: "context_branch_change", type: "context.branch_changed" }), "context change");
      assert.equal(replayEventDisplayKind({ kind: "compatibility_mirror", type: "agent.summary" }), "compatibility mirror");
      assert.equal(replayEventDisplayKind({ kind: "agent_summary", type: "agent.summary" }), "agent summary");
      assert.equal(replayEventDisplayKind({ kind: "meaningful_activity", type: "tool.completed" }), "meaningful activity");
      assert.equal(replayEventDisplayKind({ kind: "meaningful_activity", type: "user.action" }), "user action");
      assert.equal(replayEventDisplayKind({ kind: "meaningful_activity", type: "input.requested" }), "review/input state");
    },
  },
];

export { tests };
