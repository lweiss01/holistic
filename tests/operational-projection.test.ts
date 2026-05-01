import assert from "node:assert/strict";

import type { HolisticRuntimeEvent, RuntimeSession } from "../packages/runtime-core/src/index.ts";
import { projectOperationalSession } from "../services/andon-api/src/operational-projection.ts";

const NOW = "2026-04-30T23:30:00.000Z";
const FRESH = "2026-04-30T23:29:00.000Z";
const STALE = "2026-04-30T23:10:00.000Z";
const COLD = "2026-04-30T22:00:00.000Z";

function runtimeSession(overrides: Partial<RuntimeSession> = {}): RuntimeSession {
  return {
    id: "session-runtime",
    runtimeId: "local",
    agentName: "codex",
    repoName: "holistic",
    repoPath: "D:\\Projects\\active\\holistic",
    status: "running",
    activity: "editing",
    startedAt: "2026-04-30T23:00:00.000Z",
    updatedAt: FRESH,
    lastHeartbeatAt: FRESH,
    ...overrides
  };
}

function event(overrides: Partial<HolisticRuntimeEvent>): HolisticRuntimeEvent {
  return {
    id: "event-1",
    sessionId: "session-runtime",
    type: "session.heartbeat",
    timestamp: FRESH,
    ...overrides
  };
}

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "operational projection keeps one active runtime session operational and fifty terminated sessions historical",
    run: () => {
      const active = projectOperationalSession({
        sessionId: "session-active",
        runtimeSession: runtimeSession({ id: "session-active" }),
        runtimeProcessAlive: true,
        now: NOW
      });
      const terminated = Array.from({ length: 50 }, (_, index) =>
        projectOperationalSession({
          sessionId: `session-terminated-${index}`,
          runtimeSession: runtimeSession({
            id: `session-terminated-${index}`,
            status: "terminated",
            terminatedAt: COLD,
            updatedAt: COLD,
            lastHeartbeatAt: undefined
          }),
          runtimeProcessAlive: false,
          now: NOW
        })
      );

      assert.equal(active.category, "live");
      assert.equal(active.belongsOnMissionControl, true);
      assert.equal(active.belongsInHistory, false);
      assert.equal(terminated.every((item) => item.category === "historical"), true);
      assert.equal(terminated.every((item) => item.belongsOnMissionControl === false), true);
      assert.equal(terminated.every((item) => item.belongsInHistory === true), true);
    }
  },
  {
    name: "operational projection parked session is historical not live",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-parked",
        runtimeSession: runtimeSession({ id: "session-parked", status: "parked" }),
        runtimeProcessAlive: false,
        now: NOW
      });

      assert.equal(projected.category, "historical");
      assert.equal(projected.reason, "parked");
      assert.notEqual(projected.category, "live");
    }
  },
  {
    name: "operational projection awaiting review is review not live",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-review",
        runtimeSession: runtimeSession({ id: "session-review", status: "awaiting_review" }),
        runtimeProcessAlive: true,
        now: NOW
      });

      assert.equal(projected.category, "review");
      assert.equal(projected.derivedOperationalStatus, "awaiting_review");
      assert.notEqual(projected.category, "live");
    }
  },
  {
    name: "operational projection waiting for input is needs_action not live",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-input",
        runtimeSession: runtimeSession({ id: "session-input", status: "waiting_for_input" }),
        runtimeProcessAlive: true,
        now: NOW
      });

      assert.equal(projected.category, "needs_action");
      assert.equal(projected.derivedOperationalStatus, "needs_input");
      assert.notEqual(projected.category, "live");
    }
  },
  {
    name: "operational projection active blocked and failed sessions are degraded_active not live",
    run: () => {
      for (const status of ["blocked", "failed"] as const) {
        const projected = projectOperationalSession({
          sessionId: `session-${status}`,
          runtimeSession: runtimeSession({ id: `session-${status}`, status }),
          runtimeProcessAlive: true,
          now: NOW
        });

        assert.equal(projected.category, "degraded_active");
        assert.equal(projected.reason, "blocked_or_failed");
        assert.notEqual(projected.category, "live");
      }
    }
  },
  {
    name: "operational projection old terminated session with missing telemetry is historical not degraded_active",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-old-terminated",
        runtimeSession: runtimeSession({
          id: "session-old-terminated",
          status: "terminated",
          updatedAt: COLD,
          terminatedAt: COLD,
          lastHeartbeatAt: undefined,
          lastMeaningfulActivityAt: undefined
        }),
        runtimeProcessAlive: false,
        now: NOW
      });

      assert.equal(projected.category, "historical");
      assert.equal(projected.belongsInHistory, true);
      assert.notEqual(projected.category, "degraded_active");
    }
  },
  {
    name: "operational projection stale active runtime is degraded_active not live",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-stale-active",
        runtimeSession: runtimeSession({
          id: "session-stale-active",
          updatedAt: STALE,
          lastHeartbeatAt: STALE
        }),
        runtimeProcessAlive: true,
        now: NOW
      });

      assert.equal(projected.category, "degraded_active");
      assert.equal(projected.reason, "stale_runtime");
      assert.equal(projected.freshness, "stale");
      assert.notEqual(projected.category, "live");
    }
  },
  {
    name: "operational projection apparently active legacy session without runtime truth is unknown not live",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-legacy-active",
        legacySession: {
          id: "session-legacy-active",
          status: "running",
          lastEventAt: FRESH,
          appearsActive: true
        },
        now: NOW
      });

      assert.equal(projected.category, "unknown");
      assert.equal(projected.reason, "legacy_active_without_runtime");
      assert.equal(projected.rawRuntimeStatus, "missing");
      assert.notEqual(projected.category, "live");
    }
  },
  {
    name: "operational projection heartbeat-only session can be live without implying meaningful progress",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-heartbeat-only",
        runtimeSession: runtimeSession({
          id: "session-heartbeat-only",
          lastMeaningfulActivityAt: undefined
        }),
        runtimeEvents: Array.from({ length: 10 }, (_, index) =>
          event({
            id: `heartbeat-${index}`,
            sessionId: "session-heartbeat-only",
            type: "session.heartbeat",
            timestamp: `2026-04-30T23:29:${String(index).padStart(2, "0")}.000Z`
          })
        ),
        runtimeProcessAlive: true,
        now: NOW
      });

      assert.equal(projected.category, "live");
      assert.equal(projected.reason, "runtime_active");
      assert.equal(projected.hasMeaningfulActivity, false);
      assert.equal(projected.lastMeaningfulActivityAt, null);
    }
  },
  {
    name: "operational projection branch context-only activity is not progress and cannot keep a session live",
    run: () => {
      const projected = projectOperationalSession({
        sessionId: "session-branch-only",
        runtimeSession: runtimeSession({
          id: "session-branch-only",
          updatedAt: FRESH,
          lastHeartbeatAt: undefined,
          lastMeaningfulActivityAt: undefined
        }),
        runtimeEvents: [
          event({
            id: "branch-change",
            sessionId: "session-branch-only",
            type: "context.branch_changed",
            timestamp: FRESH,
            message: "Detected branch switch; review the new branch context."
          })
        ],
        runtimeProcessAlive: true,
        now: NOW
      });

      assert.equal(projected.category, "degraded_active");
      assert.equal(projected.reason, "missing_runtime_signal");
      assert.equal(projected.hasMeaningfulActivity, false);
      assert.equal(projected.freshness, "unknown");
      assert.notEqual(projected.category, "live");
    }
  },
  {
    name: "operational projection policy keeps completed but unacknowledged sessions in review until acknowledged",
    run: () => {
      const unacknowledged = projectOperationalSession({
        sessionId: "session-completed-unacknowledged",
        runtimeSession: runtimeSession({
          id: "session-completed-unacknowledged",
          status: "completed",
          completedAt: FRESH
        }),
        completedAcknowledged: false,
        now: NOW
      });
      const acknowledged = projectOperationalSession({
        sessionId: "session-completed-acknowledged",
        runtimeSession: runtimeSession({
          id: "session-completed-acknowledged",
          status: "completed",
          completedAt: FRESH
        }),
        completedAcknowledged: true,
        now: NOW
      });

      assert.equal(unacknowledged.category, "review");
      assert.equal(unacknowledged.reason, "unacknowledged_completion");
      assert.equal(acknowledged.category, "historical");
      assert.notEqual(unacknowledged.category, "live");
    }
  }
];

export { tests };
