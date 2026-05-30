import assert from "node:assert/strict";
import fs from "node:fs";

import type { OperationalCategory } from "../packages/andon-core/src/index.ts";
import type { AgentSessionSourceSummary, MissionControlResponse, MissionControlSession } from "../apps/andon-dashboard/src/api.ts";
import {
  buildDetailProjectionViewModel,
  buildHistorySessionViewModels,
  buildMissionControlBoardViewModel,
  buildReplayViewModel,
  buildMissionSessionViewModels,
  getCategoryPresentation,
  mapPrimaryStatusToTrafficLight,
  replayEventDisplayKind,
} from "../apps/andon-dashboard/src/mission-control-view-model.ts";
import type { SessionReplayResponse } from "../apps/andon-dashboard/src/api.ts";

const PRIMARY_STATUS_BY_CATEGORY: Record<OperationalCategory, MissionControlSession["primaryStatus"]> = {
  live: "running",
  needs_action: "waiting_on_human_input",
  degraded_active: "needs_intervention",
  review: "waiting_for_review",
  historical: "done_historical",
  unknown: "unknown",
};

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
      lastSummary: "Server projection emitted a canonical status.",
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
    lifecycleState: category === "live"
      ? "running"
      : category === "review"
        ? "review_ready"
        : category === "needs_action"
          ? "waiting_input"
          : category === "historical"
            ? "completed"
            : "stale",
    runtimeSignal: category === "live" ? "alive" : category === "historical" ? "dead" : "unknown",
    operatorAttention: category === "needs_action"
      ? "input_needed"
      : category === "review"
        ? "review_needed"
        : category === "degraded_active"
          ? "intervention_needed"
          : "none",
    primaryStatus: PRIMARY_STATUS_BY_CATEGORY[category],
    actionRequired: ["needs_action", "review", "degraded_active", "unknown"].includes(category),
    actionKind: category === "needs_action"
      ? "input"
      : category === "review"
        ? "review"
        : category === "degraded_active"
          ? "intervention"
          : category === "unknown"
            ? "state_check"
            : "none",
    actionLabel: category === "needs_action"
      ? "Provide the requested input."
      : category === "review"
        ? "Review the requested output."
        : category === "degraded_active"
          ? "Investigate the issue."
          : category === "unknown"
            ? "Check session state."
            : "No action needed.",
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

function makeSource(overrides: Partial<AgentSessionSourceSummary> = {}): AgentSessionSourceSummary {
  return {
    sourceId: "source-local-cli",
    sourceName: "Local CLI runner",
    sourceType: "local_cli",
    platform: null,
    transport: "http_events",
    status: "active",
    repo: "holistic",
    lastSignalAt: "2026-04-29T12:10:00.000Z",
    lastHeartbeatAt: "2026-04-29T12:10:00.000Z",
    capabilities: ["session.started", "session.heartbeat"],
    reason: "Source is emitting fresh session signals.",
    ...overrides,
  };
}

function ingestionFor(
  sessions: MissionControlSession[],
  sources: AgentSessionSourceSummary[],
): MissionControlResponse["ingestionStatus"] {
  const visibleCount = sessions.filter((session) => session.belongsToMissionControl && session.category !== "historical").length;
  const historicalCount = sessions.filter((session) => session.belongsToHistory || session.category === "historical").length;
  if (visibleCount > 0) {
    return {
      status: "active",
      label: `${visibleCount} active instrumented session${visibleCount === 1 ? "" : "s"}.`,
      message: "Mission Control is receiving agent-session signals.",
      tone: "healthy",
      lastSignalAt: "2026-04-29T12:10:00.000Z",
      sourceCount: sources.length,
      activeSourceCount: sources.filter((source) => source.status === "active").length,
      staleSourceCount: 0,
      historicalCount,
    };
  }
  if (sources.length === 0 && historicalCount > 0) {
    return {
      status: "historical_only",
      label: "No active agent sessions.",
      message: "Historical sessions are available in History.",
      tone: "neutral",
      lastSignalAt: null,
      sourceCount: 0,
      activeSourceCount: 0,
      staleSourceCount: 0,
      historicalCount,
    };
  }
  if (sources.length === 0) {
    return {
      status: "no_sources_configured",
      label: "No agent signal sources configured.",
      message: "Connect a runner, heartbeat writer, or platform adapter to show live sessions.",
      tone: "warning",
      lastSignalAt: null,
      sourceCount: 0,
      activeSourceCount: 0,
      staleSourceCount: 0,
      historicalCount,
    };
  }
  const stale = sources.some((source) => source.status === "stale");
  const uninstrumented = sources.some((source) => source.status === "uninstrumented");
  return {
    status: stale ? "stale" : uninstrumented ? "uninstrumented" : "idle",
    label: stale
      ? "Agent signal sources are stale."
      : uninstrumented
        ? "No instrumented agent sessions detected."
        : "No active agent sessions.",
    message: stale
      ? "Last signal was 5m ago. Mission Control may not reflect current work."
      : uninstrumented
        ? "This platform is not currently emitting Andon session signals."
        : "Connected agent sources are idle.",
    tone: stale || uninstrumented ? "warning" : "neutral",
    lastSignalAt: sources[0]?.lastSignalAt ?? null,
    sourceCount: sources.length,
    activeSourceCount: 0,
    staleSourceCount: sources.filter((source) => source.status === "stale").length,
    historicalCount,
  };
}

function makeResponse(
  sessions: MissionControlSession[],
  sources = sessions.some((session) => session.belongsToMissionControl && session.category !== "historical")
    ? [makeSource()]
    : [],
): MissionControlResponse {
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
    sources,
    ingestionStatus: ingestionFor(sessions, sources),
    historicalCount: sessions.filter((session) => session.belongsToHistory || session.category === "historical").length,
    lastSignalAt: sources[0]?.lastSignalAt ?? null,
  };
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Andon Mission Control renders one active session as one traffic-light card",
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

      assert.deepEqual(board.sessions.map((item) => item.id), ["live-1"]);
      assert.equal(board.sessionCount, 1);
      assert.equal(board.runtimeSummary.sessionCount, board.sessions.length);
      assert.equal(board.historyCount, 50);
      assert.equal(board.sessions[0]?.trafficLight.label, "Running");
    },
  },
  {
    name: "Andon Mission Control one workflow with many child events still produces one session card",
    run: () => {
      const workflow = makeMissionSession("live", {
        session: {
          id: "workflow-main",
          objective: "Complete one workflow with many child task and checkpoint events",
        },
      });
      const childArtifacts = Array.from({ length: 50 }, (_, index) =>
        makeMissionSession("historical", {
          session: { id: `child-artifact-${index}`, objective: `Internal task ${index}` },
          belongsToMissionControl: false,
          belongsToHistory: true,
        })
      );

      const board = buildMissionControlBoardViewModel(makeResponse([workflow, ...childArtifacts]));

      assert.deepEqual(board.sessions.map((item) => item.id), ["workflow-main"]);
      assert.equal(board.runtimeSummary.sessionCount, 1);
      assert.equal(board.historyCount, 50);
    },
  },
  {
    name: "Andon Mission Control renders two active sessions as two cards",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([
        makeMissionSession("live", { session: { id: "session-a" } }),
        makeMissionSession("needs_action", { session: { id: "session-b" } }),
      ]));

      assert.deepEqual(board.sessions.map((item) => item.id), ["session-b", "session-a"]);
      assert.equal(board.sessionCount, 2);
      assert.equal(board.runtimeSummary.sessionCount, 2);
      assert.equal(board.runtimeSummary.attentionCount, 1);
    },
  },
  {
    name: "Andon Mission Control renders status inside session cards and has no status lane headings",
    run: () => {
      const appSource = fs.readFileSync("apps/andon-dashboard/src/App.tsx", "utf8");
      const viewModelSource = fs.readFileSync("apps/andon-dashboard/src/mission-control-view-model.ts", "utf8");
      const stylesSource = fs.readFileSync("apps/andon-dashboard/src/styles.css", "utf8");

      assert.match(appSource, /function MissionSessionCard/);
      assert.match(appSource, /className=\{`session-card tone-\$\{item\.trafficLight\.tone\}`\}/);
      assert.match(appSource, /data-primary-status=\{item\.primaryStatus\}/);
      const removedLaneSymbols = new RegExp([
        "function Mission" + "Lane",
        "Mission" + "LaneViewModel",
        "MISSION" + "_LANES",
        "Operational " + "lanes",
      ].join("|"));
      const removedViewModelSymbols = new RegExp([
        "MISSION" + "_LANES",
        "Mission" + "LaneViewModel",
        "visible" + "Sessions",
        "hidden" + "Count",
        "lane" + "Limit",
      ].join("|"));

      assert.doesNotMatch(appSource, removedLaneSymbols);
      assert.doesNotMatch(viewModelSource, removedViewModelSymbols);
      const removedStyleSymbols = new RegExp([
        "\\.mission-" + "lane",
        "\\.board-" + "grid",
        "\\.signal-" + "strip",
        "\\.session-" + "row",
      ].join("|"));

      assert.doesNotMatch(stylesSource, removedStyleSymbols);
      assert.doesNotMatch(appSource, new RegExp([
        ">Needs Action<",
        ">Review<",
        ">Running<",
        ">Unknown<",
        ">Needs Intervention<",
      ].join("|")));
    },
  },
  {
    name: "Andon Mission Control tests do not import or validate the old lane model",
    run: () => {
      const testSource = fs.readFileSync("tests/mission-control-view-model.test.ts", "utf8");

      const removedTestSymbols = new RegExp([
        "MISSION" + "_LANES",
        "Mission" + "Lane",
        "Mission" + "LaneViewModel",
        "visible" + "Sessions",
        "hidden" + "Count",
        "lane" + "Limit",
      ].join("|"));

      assert.doesNotMatch(testSource, removedTestSymbols);
    },
  },
  {
    name: "Andon Mission Control traffic-light mapping covers every canonical primary status",
    run: () => {
      assert.deepEqual(mapPrimaryStatusToTrafficLight("running"), {
        label: "Running",
        shortLabel: "Running",
        tone: "healthy",
        marker: "circle",
        description: "Agent session is actively running now.",
      });
      assert.equal(mapPrimaryStatusToTrafficLight("awaiting_assignment").label, "Awaiting Assignment");
      assert.equal(mapPrimaryStatusToTrafficLight("awaiting_assignment").tone, "input");
      assert.equal(mapPrimaryStatusToTrafficLight("waiting_for_review").label, "Needs Review");
      assert.equal(mapPrimaryStatusToTrafficLight("waiting_for_review").tone, "review");
      assert.equal(mapPrimaryStatusToTrafficLight("waiting_on_human_input").label, "Needs Input");
      assert.equal(mapPrimaryStatusToTrafficLight("waiting_on_human_input").tone, "input");
      assert.equal(mapPrimaryStatusToTrafficLight("needs_intervention").label, "Needs Intervention");
      assert.equal(mapPrimaryStatusToTrafficLight("needs_intervention").tone, "critical");
      assert.equal(mapPrimaryStatusToTrafficLight("parked_idle").label, "Parked / Idle");
      assert.equal(mapPrimaryStatusToTrafficLight("parked_idle").tone, "idle");
      assert.equal(mapPrimaryStatusToTrafficLight("done_historical").label, "Done / Historical");
      assert.equal(mapPrimaryStatusToTrafficLight("done_historical").tone, "history");
      assert.equal(mapPrimaryStatusToTrafficLight("unknown").label, "Unknown");
      assert.equal(mapPrimaryStatusToTrafficLight("unknown").marker, "question");
    },
  },
  {
    name: "Andon Mission Control displays finished waiting work as Awaiting Assignment not review",
    run: () => {
      const [viewModel] = buildMissionSessionViewModels([
        makeMissionSession("needs_action", {
          session: {
            id: "assignment-session",
            objective: "Work is complete; awaiting next assignment",
          },
          reason: "awaiting_assignment",
          lifecycleState: "awaiting_assignment",
          operatorAttention: "assignment_needed",
          primaryStatus: "awaiting_assignment",
          actionRequired: true,
          actionKind: "assignment",
          actionLabel: "Give this agent its next task or complete the session.",
          nextRecommendedOperatorAction: "Give this agent its next task or complete the session.",
          operatorActivity: "waiting",
        }),
      ]);

      assert.ok(viewModel);
      assert.equal(viewModel.primaryStatus, "awaiting_assignment");
      assert.equal(viewModel.primaryStatusLabel, "Awaiting Assignment");
      assert.equal(viewModel.actionRequired, true);
      assert.equal(viewModel.actionKind, "assignment");
      assert.equal(viewModel.actionLabel, "Give this agent its next task or complete the session.");
      assert.equal(viewModel.nextAction, "Give this agent its next task or complete the session.");
      assert.doesNotMatch(viewModel.primaryStatusLabel, /review/i);
      assert.doesNotMatch(viewModel.nextAction, /review/i);
    },
  },
  {
    name: "Andon Mission Control action-required count follows explicit action policy",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([
        makeMissionSession("live", {
          session: { id: "running" },
          actionRequired: false,
          actionKind: "none",
          actionLabel: "No action needed.",
        }),
        makeMissionSession("needs_action", {
          session: { id: "assignment" },
          reason: "awaiting_assignment",
          lifecycleState: "awaiting_assignment",
          operatorAttention: "assignment_needed",
          primaryStatus: "awaiting_assignment",
          actionRequired: true,
          actionKind: "assignment",
          actionLabel: "Give this agent its next task or complete the session.",
        }),
        makeMissionSession("historical", {
          session: { id: "parked" },
          primaryStatus: "parked_idle",
          actionRequired: false,
          actionKind: "none",
          actionLabel: "No action needed.",
          belongsToMissionControl: true,
          belongsToHistory: false,
          category: "unknown",
        }),
      ]));

      assert.equal(board.runtimeSummary.runningCount, 1);
      assert.equal(board.runtimeSummary.attentionCount, 1);
    },
  },
  {
    name: "Andon Mission Control parked idle session does not render as Running",
    run: () => {
      const [viewModel] = buildMissionSessionViewModels([
        makeMissionSession("historical", {
          category: "unknown",
          primaryStatus: "parked_idle",
          lifecycleState: "parked",
          runtimeSignal: "alive",
          runtimeProcessAlive: true,
          belongsToMissionControl: true,
          belongsToHistory: false,
          rawRuntimeStatus: "parked",
          reason: "parked",
        }),
      ]);

      assert.ok(viewModel);
      assert.equal(viewModel.primaryStatus, "parked_idle");
      assert.equal(viewModel.primaryStatusLabel, "Parked / Idle");
      assert.notEqual(viewModel.primaryStatusLabel, "Running");
    },
  },
  {
    name: "Andon Detail and Mission Control expose the same canonical primaryStatus label",
    run: () => {
      const session = makeMissionSession("review", {
        session: { id: "review-session" },
        rawRuntimeStatus: "running",
        derivedOperationalStatus: "awaiting_review",
        reason: "awaiting_review",
      });
      const [card] = buildMissionSessionViewModels([session]);
      const detail = buildDetailProjectionViewModel(session);

      assert.ok(card);
      assert.equal(card.primaryStatus, detail.primaryStatus);
      assert.equal(card.primaryStatusLabel, detail.primaryStatusLabel);
      assert.equal(detail.primaryStatusLabel, "Needs Review");
      assert.doesNotMatch(card.primaryStatusLabel, /flowing|running/i);
    },
  },
  {
    name: "Andon Mission Control excludes old review and degraded artifacts from session cards",
    run: () => {
      const artifacts = [
        makeMissionSession("review", {
          session: { id: "old-review-artifact", objective: "Searchable old work" },
          belongsToMissionControl: false,
          belongsToHistory: true,
        }),
        makeMissionSession("degraded_active", {
          session: { id: "degraded-artifact", objective: "Track large edit set" },
          belongsToMissionControl: false,
          belongsToHistory: true,
        }),
      ];

      const board = buildMissionControlBoardViewModel(makeResponse(artifacts));

      assert.deepEqual(board.sessions, []);
      assert.equal(board.emptyState?.title, "No active agent sessions.");
      assert.equal(board.emptyState?.description, "Historical sessions are available in History.");
    },
  },
  {
    name: "Andon Mission Control header summary reconciles with visible cards",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([
        makeMissionSession("live", { session: { id: "running" } }),
        makeMissionSession("review", { session: { id: "review" } }),
        makeMissionSession("unknown", { session: { id: "unknown" } }),
      ]));

      assert.equal(board.sessionCount, board.sessions.length);
      assert.equal(board.runtimeSummary.sessionCount, board.sessions.length);
      assert.equal(board.runtimeSummary.runningCount, 1);
      assert.equal(board.runtimeSummary.attentionCount, 2);
      assert.equal(board.runtimeSummary.sourceCount, 1);
      assert.equal(board.runtimeSummary.label, "3 agent sessions");
    },
  },
  {
    name: "Andon Mission Control consumes canonical status without reclassifying raw runtime status",
    run: () => {
      const [viewModel] = buildMissionSessionViewModels([
        makeMissionSession("needs_action", {
          rawRuntimeStatus: "running",
          primaryStatus: "waiting_on_human_input",
          reason: "waiting_for_input",
          derivedOperationalStatus: "needs_input",
        }),
      ]);

      assert.ok(viewModel);
      assert.equal(viewModel.primaryStatus, "waiting_on_human_input");
      assert.equal(viewModel.primaryStatusLabel, "Needs Input");
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
    name: "Andon Mission Control normal one two and three session fixtures are capped to visible cards only",
    run: () => {
      for (const count of [1, 2, 3]) {
        const board = buildMissionControlBoardViewModel(makeResponse(
          Array.from({ length: count }, (_, index) =>
            makeMissionSession("live", { session: { id: `session-${index}` } })
          ),
        ));

        assert.equal(board.sessions.length, count);
        assert.equal(board.sessionCount, count);
      }
    },
  },
  {
    name: "Andon Mission Control no registered sources does not render plain idle success",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([], []));

      assert.equal(board.sessionCount, 0);
      assert.equal(board.emptyState?.title, "No agent signal sources configured.");
      assert.equal(board.emptyState?.description, "Connect a runner, heartbeat writer, or platform adapter to show live sessions.");
      assert.equal(board.emptyState?.tone, "warning");
      assert.notEqual(board.emptyState?.tone, "healthy");
    },
  },
  {
    name: "Andon Mission Control connected idle source renders true idle state",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([], [
        makeSource({ status: "idle", reason: "Source is connected and idle." }),
      ]));

      assert.equal(board.emptyState?.title, "No active agent sessions.");
      assert.equal(board.emptyState?.description, "Connected agent sources are idle.");
      assert.equal(board.emptyState?.tone, "neutral");
      assert.equal(board.runtimeSummary.sourceCount, 1);
      assert.equal(board.runtimeSummary.connectedSourceCount, 1);
    },
  },
  {
    name: "Andon Mission Control stale source renders stale warning",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([], [
        makeSource({
          status: "stale",
          lastSignalAt: "2026-04-29T12:05:00.000Z",
          reason: "Source has not emitted a recent signal.",
        }),
      ]));

      assert.equal(board.emptyState?.title, "Agent signal sources are stale.");
      assert.match(board.emptyState?.description ?? "", /Mission Control may not reflect current work/);
      assert.equal(board.emptyState?.tone, "warning");
      assert.notEqual(board.emptyState?.tone, "healthy");
    },
  },
  {
    name: "Andon Mission Control uninstrumented source renders instrumentation-specific message",
    run: () => {
      const board = buildMissionControlBoardViewModel(makeResponse([], [
        makeSource({
          sourceType: "cursor",
          status: "uninstrumented",
          lastSignalAt: null,
          lastHeartbeatAt: null,
          reason: "Adapter is registered but not emitting session signals.",
        }),
      ]));

      assert.equal(board.emptyState?.title, "No instrumented agent sessions detected.");
      assert.equal(board.emptyState?.description, "This platform is not currently emitting Andon session signals.");
      assert.equal(board.emptyState?.tone, "warning");
    },
  },
  {
    name: "Andon Mission Control card is the Detail link and Replay is not visible on the card",
    run: () => {
      const appSource = fs.readFileSync("apps/andon-dashboard/src/App.tsx", "utf8");

      assert.match(appSource, /className=\{`session-card tone-\$\{item\.trafficLight\.tone\}`\}/);
      assert.match(appSource, /href=\{item\.detailHref\}/);
      assert.match(appSource, /aria-label=\{`\$\{item\.agentName\}/);
      assert.doesNotMatch(appSource, /<a className="button primary" href=\{item\.detailHref\}>Detail<\/a>/);
      assert.doesNotMatch(appSource, /<a className="row-link" href=\{item\.replayHref\}>Replay<\/a>/);
      assert.match(appSource, /href=\{`\/session\/\$\{encodeURIComponent\(sessionId\)\}\/replay`\}>Open replay/);
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
    name: "Andon Detail projection exposes canonical status category reason source freshness and confidence",
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
      assert.equal(projection.primaryStatus, "needs_intervention");
      assert.equal(projection.primaryStatusLabel, "Needs Intervention");
      assert.equal(projection.reason, "stale runtime");
      assert.equal(projection.rawRuntimeStatus, "running");
      assert.equal(projection.derivedOperationalStatus, "degraded");
      assert.equal(projection.sourceOfTruth, "mixed");
      assert.equal(projection.freshness, "stale");
      assert.equal(projection.confidence, "medium");
      assert.equal(projection.operatorActivity, "blocked");
      assert.equal(projection.lastSignalAge, "10m");
      assert.equal(projection.nextAction, "Investigate the issue.");
    },
  },
  {
    name: "Andon status presentation remains available for supporting History and Detail pages",
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
    name: "Andon Dashboard API client no longer exports old fleet UI fetchers",
    run: () => {
      const apiSource = fs.readFileSync("apps/andon-dashboard/src/api.ts", "utf8");

      assert.doesNotMatch(apiSource, /getFleet|FleetResponse|getActiveSession|getSessionsList|postCallback/);
      assert.match(apiSource, /getMissionControl/);
      assert.match(apiSource, /getHistory/);
      assert.match(apiSource, /getSessionReplay/);
      assert.match(apiSource, /getAndonHealth/);
      // getTimeline is the M007 timeline panel fetcher (new {tail} contract),
      // not one of the removed legacy fleet-UI fetchers.
      assert.match(apiSource, /getTimeline/);
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
