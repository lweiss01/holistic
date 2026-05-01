import assert from "node:assert/strict";

import type { OperationalCategory } from "../packages/andon-core/src/index.ts";
import type { MissionControlResponse, MissionControlSession } from "../apps/andon-dashboard/src/api.ts";
import {
  buildMissionControlBoardViewModel,
  buildMissionSessionViewModels,
  getCategoryPresentation,
  MISSION_LANES,
} from "../apps/andon-dashboard/src/mission-control-view-model.ts";

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
    confidence: category === "unknown" ? "low" : "high",
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
    name: "Andon Mission Control orders needs_action before degraded, review, and live",
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
      assert.equal(viewModel.presentation.label, "Review");
      assert.doesNotMatch(viewModel.presentation.label, /flowing|running/i);
    },
  },
  {
    name: "Andon Mission Control presents degraded and unknown as non-healthy states",
    run: () => {
      assert.equal(getCategoryPresentation("degraded_active").tone, "warning");
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
      assert.equal(viewModel.rawRuntimeStatus, "running");
      assert.equal(viewModel.reason, "waiting for input");
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
];

export { tests };
