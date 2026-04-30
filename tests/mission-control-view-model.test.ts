import assert from "node:assert/strict";

import type { FleetSessionItem } from "../packages/andon-core/src/index.ts";
import {
  buildAttentionQueue,
  buildMissionSessionViewModels,
  filterAndSortMissionSessionViewModels,
} from "../apps/andon-dashboard/src/mission-control-view-model.ts";

function makeFleetItem(overrides: Partial<FleetSessionItem> = {}): FleetSessionItem {
  const base: FleetSessionItem = {
    session: {
      id: "session-base",
      agentName: "codex",
      runtime: "codex",
      repoPath: "D:/Projects/active/holistic",
      worktreePath: "D:/Projects/active/holistic",
      objective: "Ship glance-first mission control",
      currentPhase: "execute",
      startedAt: "2026-04-29T12:00:00.000Z",
      endedAt: null,
      lastEventAt: "2026-04-29T12:10:00.000Z",
      lastSummary: "Working through card hierarchy updates.",
    },
    activeTask: null,
    status: {
      status: "running",
      phase: "execute",
      explanation: "Runtime heartbeat and status indicate healthy execution.",
      evidence: ["Active runtime heartbeat is flowing."],
    },
    recommendation: {
      urgency: "low",
      title: "Monitor active runtime",
      actionLabel: "Keep watching",
      description: "Runtime heartbeat and status indicate healthy execution.",
    },
    supervision: {
      lastMeaningfulEventAt: "2026-04-29T12:09:30.000Z",
      supervisionSeverity: "low",
    },
    attentionRank: 9,
    attentionBreakdown: {
      status: 3,
      urgency: 2,
      freshness: 4,
    },
    heartbeatFreshness: "fresh",
    blockedReason: null,
    recommendedAction: "Keep watching",
    availableActions: ["inspect", "pause"],
    repoName: "holistic",
    worktreeName: null,
  };

  return {
    ...base,
    ...overrides,
    session: {
      ...base.session,
      ...(overrides.session ?? {}),
    },
    activeTask: overrides.activeTask === undefined ? base.activeTask : overrides.activeTask,
    status: {
      ...base.status,
      ...(overrides.status ?? {}),
    },
    recommendation: {
      ...base.recommendation,
      ...(overrides.recommendation ?? {}),
    },
    supervision: {
      ...base.supervision,
      ...(overrides.supervision ?? {}),
    },
    attentionBreakdown: {
      ...base.attentionBreakdown,
      ...(overrides.attentionBreakdown ?? {}),
    },
    availableActions: overrides.availableActions ?? base.availableActions,
  };
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Andon Mission Control marks runtime-missing sessions as degraded with explicit why-now copy",
    run: () => {
      const item = makeFleetItem({
        session: { id: "runtime-missing-1", lastEventAt: "2026-04-29T12:11:00.000Z" },
        status: {
          status: "parked",
          explanation: "Session has no runtime heartbeat and is treated as non-flowing.",
          evidence: ["No runtime session signal is active for this session."],
        },
        heartbeatFreshness: "stale",
        availableActions: ["inspect", "resume"],
        recommendedAction: "Decide next action",
      });

      const [viewModel] = buildMissionSessionViewModels([item]);
      assert.ok(viewModel);
      assert.equal(viewModel.isDegraded, true);
      assert.equal(viewModel.degradedBadge, "Runtime signal missing");
      assert.match(viewModel.whyNow, /runtime signal missing/i);
    },
  },
  {
    name: "Andon Mission Control labels cold parked sessions as heartbeat-degraded",
    run: () => {
      const item = makeFleetItem({
        session: { id: "cold-running-1" },
        status: {
          status: "parked",
          explanation: "Runtime session is running.",
          evidence: ["No runtime events recorded yet."],
        },
        heartbeatFreshness: "cold",
      });

      const [viewModel] = buildMissionSessionViewModels([item]);
      assert.ok(viewModel);
      assert.equal(viewModel.isDegraded, true);
      assert.equal(viewModel.degradedBadge, "Heartbeat degraded");
      assert.match(viewModel.freshnessLabel, /degraded/i);
      assert.match(viewModel.whyNow, /no recent runtime heartbeat/i);
    },
  },
  {
    name: "Andon Mission Control prioritizes approve over resume and pause actions",
    run: () => {
      const item = makeFleetItem({
        session: { id: "action-precedence-1" },
        availableActions: ["inspect", "pause", "resume", "approve"],
      });

      const [viewModel] = buildMissionSessionViewModels([item]);
      assert.ok(viewModel);
      assert.equal(viewModel.primaryAction, "approve");
    },
  },
  {
    name: "Andon Mission Control attention sorting keeps intervention sessions ahead of non-intervention ties",
    run: () => {
      const running = makeFleetItem({
        session: { id: "running-tie", lastEventAt: "2026-04-29T12:10:00.000Z" },
        status: { status: "running" },
        attentionRank: 14,
      });
      const needsInput = makeFleetItem({
        session: { id: "needs-input-tie", lastEventAt: "2026-04-29T12:09:00.000Z" },
        status: {
          status: "needs_input",
          explanation: "Runtime is waiting for operator input.",
          evidence: ["Needs a human answer before continuing."],
        },
        recommendation: {
          urgency: "high",
          title: "Provide required input",
          actionLabel: "Answer agent prompt",
          description: "Runtime is waiting for operator input before work can continue.",
        },
        attentionRank: 14,
      });

      const viewModels = buildMissionSessionViewModels([running, needsInput]);
      const ordered = filterAndSortMissionSessionViewModels(viewModels, {
        statusFilter: "all",
        repoFilter: "all",
        sortBy: "attention",
      });
      assert.equal(ordered[0]?.id, "needs-input-tie");

      const queue = buildAttentionQueue(ordered, 4);
      assert.equal(queue[0]?.id, "needs-input-tie");
    },
  },
];

export { tests };
