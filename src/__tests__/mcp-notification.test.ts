import assert from "node:assert";
import { buildStartupGreeting } from '../core/state.ts';
import type { HolisticState } from '../core/types.ts';

/**
 * Unit tests for buildStartupGreeting() format.
 * Ensures greeting consistency for both MCP and manual /holistic paths.
 */

function makeTestState(overrides?: Partial<HolisticState>): HolisticState {
  return {
    version: 2,
    projectName: "test-project",
    createdAt: "2026-03-21T12:00:00.000Z",
    updatedAt: "2026-03-21T12:00:00.000Z",
    activeSession: null,
    pendingWork: [],
    lastHandoff: null,
    docIndex: {
      masterDoc: "HOLISTIC.md",
      stateFile: ".holistic/state.json",
      sessionsDir: ".holistic/sessions",
      contextDir: ".holistic/context",
      adapterDocs: {
        codex: ".holistic/context/adapters/codex.md",
        claude: ".holistic/context/adapters/claude-cowork.md",
        antigravity: ".holistic/context/adapters/antigravity.md",
        gemini: ".holistic/context/adapters/gemini.md",
        copilot: ".holistic/context/adapters/copilot.md",
        cursor: ".holistic/context/adapters/cursor.md",
        goose: ".holistic/context/adapters/goose.md",
        gsd: ".holistic/context/adapters/gsd.md",
        gsd2: ".holistic/context/adapters/gsd2.md",
      },
      currentPlanDoc: ".holistic/context/current-plan.md",
      protocolDoc: ".holistic/context/session-protocol.md",
      historyDoc: ".holistic/context/project-history.md",
      regressionDoc: ".holistic/context/regression-watch.md",
      zeroTouchDoc: ".holistic/context/zero-touch.md",
    },
    repoSnapshot: {},
    ...overrides,
  };
}

export const tests = [
  {
    name: "buildStartupGreeting returns null for empty state",
    run: () => {
      const state = makeTestState();
      const greeting = buildStartupGreeting(state, "claude");
      assert.equal(greeting, null);
    },
  },
  {
    name: "buildStartupGreeting includes system health warnings for stale daemon checkpoints",
    run: () => {
      const nowMs = Date.now();
      const staleCheckpoint = new Date(nowMs - (4 * 24 * 60 * 60 * 1000)).toISOString();
      const state = makeTestState({
        activeSession: {
          id: "session-test",
          agent: "claude",
          branch: "main",
          startedAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
          endedAt: null,
          status: "active",
          title: "Test",
          currentGoal: "Test",
          currentPlan: [],
          latestStatus: "Test",
          workDone: [],
          triedItems: [],
          nextSteps: [],
          assumptions: [],
          blockers: [],
          references: [],
          impactNotes: [],
          regressionRisks: [],
          changedFiles: [],
          checkpointCount: 1,
          lastCheckpointReason: "test",
          resumeRecap: [],
        },
        lastAutoCheckpoint: staleCheckpoint,
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /System health warnings:/);
      assert.match(greeting, /Daemon may not be checkpointing/);
      assert.match(greeting, /daemon-stale-checkpoint/);
    },
  },
  {
    name: "buildStartupGreeting emits warning-only startup output when carryover is empty but diagnostics exist",
    run: () => {
      const nowMs = Date.now();
      const staleCheckpoint = new Date(nowMs - (4 * 24 * 60 * 60 * 1000)).toISOString();
      const state = makeTestState({
        lastAutoCheckpoint: staleCheckpoint,
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /^Holistic resume/m);
      assert.match(greeting, /System health warnings:/);
      assert.doesNotMatch(greeting, /Current objective:/);
      assert.match(greeting, /daemon-stale-checkpoint/);
    },
  },
  {
    name: "buildStartupGreeting emits warning text that is diagnostic (not user-blaming instructions)",
    run: () => {
      const nowMs = Date.now();
      const staleCheckpoint = new Date(nowMs - (4 * 24 * 60 * 60 * 1000)).toISOString();
      const state = makeTestState({
        lastAutoCheckpoint: staleCheckpoint,
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /System health warnings:/);
      assert.doesNotMatch(greeting, /\byou\b/i);
      assert.doesNotMatch(greeting, /\byour\b/i);
      assert.doesNotMatch(greeting, /\bmust\b/i);
      assert.doesNotMatch(greeting, /\bshould\b/i);
    },
  },
  {
    name: "buildStartupGreeting keeps no-warning startup output unchanged when diagnostics are clear",
    run: () => {
      const state = makeTestState({
        activeSession: {
          id: "session-clear",
          agent: "claude",
          branch: "main",
          startedAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
          endedAt: null,
          status: "active",
          title: "Clear session",
          currentGoal: "Ship baseline",
          currentPlan: ["Step 1"],
          latestStatus: "Working baseline",
          workDone: [],
          triedItems: [],
          nextSteps: ["Finish baseline"],
          assumptions: [],
          blockers: [],
          references: [],
          impactNotes: [],
          regressionRisks: [],
          changedFiles: [],
          checkpointCount: 1,
          lastCheckpointReason: "manual",
          resumeRecap: [],
        },
        lastAutoCheckpoint: new Date(Date.now() - (60 * 60 * 1000)).toISOString(),
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Current objective: Ship baseline/);
      assert.match(greeting, /Choices: continue, tweak, start-new/);
      assert.doesNotMatch(greeting, /System health warnings:/);
    },
  },
  {
    name: "buildStartupGreeting includes objective, status, and next steps from active session",
    run: () => {
      const state = makeTestState({
        activeSession: {
          id: "session-test",
          agent: "claude",
          branch: "main",
          startedAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
          endedAt: null,
          status: "active",
          title: "Test session",
          currentGoal: "Build feature X",
          currentPlan: ["Step 1", "Step 2"],
          latestStatus: "Making progress on X",
          workDone: ["Completed Y"],
          triedItems: [],
          nextSteps: ["Continue with Z", "Test feature X"],
          assumptions: [],
          blockers: [],
          references: [],
          impactNotes: ["Feature X improves performance"],
          regressionRisks: ["Watch for edge case A"],
          changedFiles: ["src/feature.ts"],
          checkpointCount: 3,
          lastCheckpointReason: "checkpoint",
          resumeRecap: [],
        },
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Holistic resume/);
      assert.match(greeting, /Current objective: Build feature X/);
      assert.match(greeting, /Latest status: Making progress on X/);
      assert.match(greeting, /Try next: Continue with Z; Test feature X/);
      assert.match(greeting, /Overall impact so far: Feature X improves performance/);
      assert.match(greeting, /Regression watch: Watch for edge case A/);
    },
  },
  {
    name: "buildStartupGreeting includes 'continue, tweak, start-new' choices for active session",
    run: () => {
      const state = makeTestState({
        activeSession: {
          id: "session-test",
          agent: "claude",
          branch: "main",
          startedAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
          endedAt: null,
          status: "active",
          title: "Test session",
          currentGoal: "Test goal",
          currentPlan: ["Step 1"],
          latestStatus: "Test status",
          workDone: [],
          triedItems: [],
          nextSteps: [],
          assumptions: [],
          blockers: [],
          references: [],
          impactNotes: [],
          regressionRisks: [],
          changedFiles: [],
          checkpointCount: 1,
          lastCheckpointReason: "test",
          resumeRecap: [],
        },
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Choices: continue, tweak, start-new/);
    },
  },
  {
    name: "buildStartupGreeting includes adapter doc path",
    run: () => {
      const state = makeTestState({
        activeSession: {
          id: "session-test",
          agent: "gsd2",
          branch: "main",
          startedAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
          endedAt: null,
          status: "active",
          title: "Test session",
          currentGoal: "Test goal",
          currentPlan: [],
          latestStatus: "Test status",
          workDone: [],
          triedItems: [],
          nextSteps: [],
          assumptions: [],
          blockers: [],
          references: [],
          impactNotes: [],
          regressionRisks: [],
          changedFiles: [],
          checkpointCount: 1,
          lastCheckpointReason: "test",
          resumeRecap: [],
        },
      });

      const greeting = buildStartupGreeting(state, "gsd2");
      assert.ok(greeting);
      assert.match(greeting, /Adapter doc: \.holistic\/context\/adapters\/gsd2\.md/);
    },
  },
  {
    name: "buildStartupGreeting includes long-term history and regression watch paths",
    run: () => {
      const state = makeTestState({
        lastHandoff: {
          sessionId: "session-old",
          summary: "Previous work complete",
          blockers: [],
          nextAction: "Start new feature",
          committedAt: null,
          createdAt: "2026-03-21T11:00:00.000Z",
        },
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Long-term history: \.holistic\/context\/project-history\.md/);
      assert.match(greeting, /Regression watch: \.holistic\/context\/regression-watch\.md/);
      assert.match(greeting, /Zero-touch architecture: \.holistic\/context\/zero-touch\.md/);
    },
  },
  {
    name: "buildStartupGreeting shows last handoff when no active session",
    run: () => {
      const state = makeTestState({
        lastHandoff: {
          sessionId: "session-old",
          summary: "Completed feature Y successfully",
          blockers: ["Waiting for API access"],
          nextAction: "Continue with feature Z",
          committedAt: null,
          createdAt: "2026-03-21T11:00:00.000Z",
        },
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Last handoff summary: Completed feature Y successfully/);
      assert.match(greeting, /Recommended next action: Continue with feature Z/);
      assert.match(greeting, /Known blockers: Waiting for API access/);
    },
  },
  {
    name: "buildStartupGreeting shows pending work when no active session or handoff",
    run: () => {
      const state = makeTestState({
        pendingWork: [
          {
            id: "pending-1",
            title: "Fix authentication bug",
            context: "Users cannot log in with OAuth",
            recommendedNextStep: "Debug OAuth flow",
            priority: "high",
            carriedFromSession: "session-old",
            createdAt: "2026-03-21T11:00:00.000Z",
          },
        ],
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Top pending work: Fix authentication bug/);
      assert.match(greeting, /Pending context: Users cannot log in with OAuth/);
      assert.match(greeting, /Suggested next step: Debug OAuth flow/);
    },
  },
  {
    name: "buildStartupGreeting includes recommended command",
    run: () => {
      const state = makeTestState({
        activeSession: {
          id: "session-test",
          agent: "claude",
          branch: "main",
          startedAt: "2026-03-21T12:00:00.000Z",
          updatedAt: "2026-03-21T12:00:00.000Z",
          endedAt: null,
          status: "active",
          title: "Test",
          currentGoal: "Test",
          currentPlan: [],
          latestStatus: "Test",
          workDone: [],
          triedItems: [],
          nextSteps: [],
          assumptions: [],
          blockers: [],
          references: [],
          impactNotes: [],
          regressionRisks: [],
          changedFiles: [],
          checkpointCount: 1,
          lastCheckpointReason: "test",
          resumeRecap: [],
        },
      });

      const greeting = buildStartupGreeting(state, "claude");
      assert.ok(greeting);
      assert.match(greeting, /Recommended command: Windows `?\.\\\.holistic\\system\\holistic\.cmd resume --continue`?; macOS\/Linux `?\.\/\.holistic\/system\/holistic resume --continue`?/);
    },
  },
];
