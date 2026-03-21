import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDiff, renderStatus } from "../src/cli.ts";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { captureRepoSnapshot } from "../src/core/git.ts";
import { initializeHolistic } from "../src/core/setup.ts";
import {
  applyHandoff,
  checkpointState,
  completePhase,
  computeSessionDiff,
  continueFromLatest,
  createInitialState,
  getResumePayload,
  getRuntimePaths,
  loadSessionById,
  saveState,
  setActivePhase,
  startNewSession,
} from "../src/core/state.ts";
import { runDaemonTick } from "../src/daemon.ts";
import { callHolisticTool, listHolisticTools } from "../src/mcp-server.ts";
import type { HolisticState } from "../src/core/types.ts";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testTempRoot = path.join(workspaceRoot, ".tmp-tests");

fs.mkdirSync(testTempRoot, { recursive: true });

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(testTempRoot, `${prefix}-`));
}

function makeRepo(): { rootDir: string; state: HolisticState } {
  const rootDir = makeTempDir("holistic-test");
  fs.mkdirSync(path.join(rootDir, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(rootDir, ".git", "refs", "heads", "main"), "0000000000000000000000000000000000000000\n", "utf8");
  fs.writeFileSync(path.join(rootDir, "README.md"), "# test repo\n", "utf8");
  return { rootDir, state: createInitialState(rootDir) };
}

function persist(rootDir: string, state: HolisticState): HolisticState {
  const paths = getRuntimePaths(rootDir);
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state);
  return state;
}

function readState(rootDir: string): HolisticState {
  return JSON.parse(fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8")) as HolisticState;
}

function archiveSession(
  rootDir: string,
  state: HolisticState,
  goal: string,
  checkpoint: {
    status: string;
    done: string[];
    blockers?: string[];
    regressions?: string[];
    next?: string[];
  },
  fileToTouch: string,
): { state: HolisticState; sessionId: string } {
  let nextState = startNewSession(rootDir, state, "codex", goal, ["Read HOLISTIC.md", checkpoint.status]);
  fs.writeFileSync(path.join(rootDir, fileToTouch), `${goal}\n`, "utf8");
  nextState = persist(rootDir, nextState);
  nextState = checkpointState(rootDir, nextState, {
    agent: "codex",
    reason: "milestone",
    status: checkpoint.status,
    done: checkpoint.done,
    blockers: checkpoint.blockers,
    regressions: checkpoint.regressions,
    next: checkpoint.next ?? [`Continue ${goal}`],
  });
  const sessionId = nextState.activeSession?.id ?? "";
  nextState = persist(rootDir, nextState);
  nextState = applyHandoff(rootDir, nextState, {
    summary: checkpoint.status,
    done: checkpoint.done,
    next: checkpoint.next ?? [`Continue ${goal}`],
    blockers: checkpoint.blockers,
    regressions: checkpoint.regressions,
  });
  nextState = persist(rootDir, nextState);
  return { state: nextState, sessionId };
}

const tests: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "init generates zero-touch system artifacts and optional startup hook",
    run: () => {
      const { rootDir } = makeRepo();
      const fakeHome = makeTempDir("holistic-home");
      const result = initializeHolistic(rootDir, {
        installDaemon: true,
        platform: "win32",
        homeDir: fakeHome,
        intervalSeconds: 45,
      });

      assert.equal(result.installed, true);
      assert.ok(result.startupTarget?.endsWith(".cmd"));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "run-daemon.ps1")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "run-daemon.sh")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "restore-state.ps1")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "restore-state.sh")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "sync-state.ps1")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "sync-state.sh")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "zero-touch.md")));
      const config = JSON.parse(fs.readFileSync(path.join(rootDir, ".holistic", "config.json"), "utf8"));
      assert.equal(config.sync.remote, "origin");
      assert.equal(config.sync.stateBranch, "holistic/state");
      assert.ok(fs.existsSync(result.startupTarget ?? ""));
    },
  },
  {
    name: "resume payload starts empty and writes visible docs",
    run: () => {
      const { rootDir, state } = makeRepo();
      persist(rootDir, state);
      const payload = getResumePayload(state, "codex");

      assert.equal(payload.status, "empty");
      assert.deepEqual(payload.choices, ["start-new"]);
      assert.ok(fs.existsSync(path.join(rootDir, "HOLISTIC.md")));
      assert.ok(fs.existsSync(path.join(rootDir, "AGENTS.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "state.json")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "project-history.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "regression-watch.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "zero-touch.md")));
    },
  },
  {
    name: "phase tracking persists explicit transitions and appears in docs",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Phase work", ["Read HOLISTIC.md", "Start phase work"]);
      state = setActivePhase(state, {
        phase: "1",
        name: "Feature Expansion",
        goal: "Finish the Phase 1 feature set",
        status: "Phase 1 is underway",
        title: "Implement Phase 1 feature expansion",
        plan: ["Ship MCP mode", "Ship status and diff"],
      });
      state = persist(rootDir, state);
      state = completePhase(state, {
        phase: "1",
        nextPhase: "1.5",
        nextName: "Workflow Disappearance",
        nextGoal: "Make Holistic fade into the background during normal work",
        status: "Phase 1 complete; Phase 1.5 is now active",
        title: "Implement Phase 1.5 workflow disappearance",
        plan: ["Implement implicit resume", "Implement auto-session inference"],
      });
      state = persist(rootDir, state);

      assert.equal(state.phaseTracker.completed[0]?.id, "1");
      assert.equal(state.phaseTracker.current?.id, "1.5");
      assert.equal(state.phaseTracker.current?.name, "Workflow Disappearance");
      assert.equal(state.activeSession?.currentGoal, "Make Holistic fade into the background during normal work");
      assert.match(state.activeSession?.latestStatus ?? "", /Phase 1 complete/);

      const holisticDoc = fs.readFileSync(path.join(rootDir, "HOLISTIC.md"), "utf8");
      const statusOutput = renderStatus(state);
      assert.match(holisticDoc, /## Phase Tracking/);
      assert.match(holisticDoc, /Current phase: Phase 1\.5 - Workflow Disappearance/);
      assert.match(holisticDoc, /Most recently completed phase: Phase 1 - Feature Expansion/);
      assert.match(statusOutput, /Phase: 1\.5 - Workflow Disappearance \(active\)/);
      assert.match(statusOutput, /Last completed phase: 1 - Feature Expansion/);
    },
  },
  {
    name: "status shows active session details without mutating state",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Build status command", ["Read HOLISTIC.md", "Capture checkpoint"]);
      fs.writeFileSync(path.join(rootDir, "notes.txt"), "status test\n", "utf8");
      state = persist(rootDir, state);
      state = checkpointState(rootDir, state, {
        agent: "codex",
        reason: "milestone",
        status: "Status command is in progress",
        next: ["Finish rendering the status view"],
        blockers: ["Need a stable read-only command"],
        regressions: ["Status must not mutate session state"],
      });
      state = persist(rootDir, state);
      const before = fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8");
      const output = renderStatus(state);
      assert.match(output, /Holistic Status/);
      assert.match(output, /Goal: Build status command/);
      assert.match(output, /Status: Status command is in progress/);
      assert.match(output, /Branch: main/);
      assert.match(output, /Checkpoints: 1/);
      assert.match(output, /Changed files:/);
      const after = fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8");
      assert.equal(after, before);
    },
  },
  {
    name: "status shows last handoff and pending work with no active session",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Prepare a handoff", ["Document the work"]);
      state = persist(rootDir, state);
      state = checkpointState(rootDir, state, {
        reason: "milestone",
        status: "Wrapped the current work",
        next: ["Pick up the follow-up task"],
      });
      state = persist(rootDir, state);
      state = applyHandoff(rootDir, state, {
        summary: "Wrapped the current work",
        done: ["Saved the durable handoff"],
        next: ["Pick up the follow-up task"],
      });
      state = persist(rootDir, state);
      const before = fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8");
      const output = renderStatus(state);
      assert.match(output, /No active session\./);
      assert.match(output, /Last handoff: Wrapped the current work/);
      assert.match(output, /Pending work: 1 item\(s\)/);
      const after = fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8");
      assert.equal(after, before);
    },
  },
  {
    name: "diff helpers compare archived sessions in text and json formats",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      const first = archiveSession(rootDir, state, "Stabilize checkpoint output", {
        status: "Checkpoint output is stable",
        done: ["Added checkpoint summary"],
        blockers: ["Need better diff tooling"],
        regressions: ["Do not drop checkpoint metadata"],
        next: ["Start diff work"],
      }, "alpha.txt");
      state = first.state;
      const second = archiveSession(rootDir, state, "Add session diff", {
        status: "Session diff is ready",
        done: ["Added diff renderer"],
        blockers: ["Need JSON output"],
        regressions: ["Do not break archived session loading"],
        next: ["Ship diff output"],
      }, "beta.txt");
      const latestState = readState(rootDir);
      const paths = getRuntimePaths(rootDir);
      const firstSession = loadSessionById(latestState, paths, first.sessionId);
      const secondSession = loadSessionById(latestState, paths, second.sessionId);
      assert.ok(firstSession);
      assert.ok(secondSession);
      const diffPayload = {
        from: firstSession,
        to: secondSession,
        diff: computeSessionDiff(firstSession, secondSession),
      };
      const output = renderDiff(firstSession, secondSession, diffPayload.diff);

      assert.match(output, /Holistic Session Diff/);
      assert.match(output, /New Work:/);
      assert.match(output, /Added diff renderer/);
      assert.match(output, /New Regression Risks:/);
      assert.match(output, /Do not break archived session loading/);
      assert.match(output, /File changes:/);
      assert.match(JSON.stringify(diffPayload), /Added diff renderer/);
      assert.match(JSON.stringify(diffPayload), /Do not break archived session loading/);
    },
  },
  {
    name: "continueFromLatest keeps the active session and preserves queued work",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Task one", ["Step one"]);
      state = persist(rootDir, state);
      state = checkpointState(rootDir, state, {
        reason: "milestone",
        status: "Half done",
        next: ["Finish task one"],
      });
      state = persist(rootDir, state);
      state = startNewSession(rootDir, state, "codex", "Task two", ["Step two"]);
      state = persist(rootDir, state);
      state = continueFromLatest(rootDir, state, "claude");
      state = persist(rootDir, state);

      assert.equal(state.activeSession?.currentGoal, "Task two");
      assert.match(state.pendingWork[0]?.recommendedNextStep ?? "", /Finish task one/);
      assert.equal(state.pendingWork.length, 1);
    },
  },
  {
    name: "mcp tool list stays intentionally thin and tool calls persist state",
    run: () => {
      const { rootDir, state } = makeRepo();
      persist(rootDir, state);

      const tools = listHolisticTools().tools.map((tool) => tool.name);
      assert.deepEqual(tools, ["holistic_resume", "holistic_checkpoint", "holistic_handoff"]);

      const resumeBefore = callHolisticTool(rootDir, "holistic_resume", { agent: "codex" });
      const initialPayload = JSON.parse(resumeBefore.content[0]?.type === "text" ? resumeBefore.content[0].text : "{}") as {
        status: string;
      };
      assert.equal(initialPayload.status, "empty");

      const checkpoint = callHolisticTool(rootDir, "holistic_checkpoint", {
        reason: "mcp-test",
        status: "Created from MCP",
        done: ["Saved MCP checkpoint"],
        next: ["Test handoff"],
        impacts: ["MCP can persist state without the CLI"],
        regressions: ["Do not widen the Phase 1 MCP surface"],
      });
      assert.equal(checkpoint.isError, false);
      assert.match(checkpoint.content[0]?.type === "text" ? checkpoint.content[0].text : "", /Checkpoint created/);

      const resumed = callHolisticTool(rootDir, "holistic_resume", { agent: "codex", continue: true });
      const resumedPayload = JSON.parse(resumed.content[0]?.type === "text" ? resumed.content[0].text : "{}") as {
        activeSession: { latestStatus: string } | null;
      };
      assert.equal(resumedPayload.activeSession?.latestStatus, "Created from MCP");

      const handoff = callHolisticTool(rootDir, "holistic_handoff", {
        summary: "MCP handoff ready",
        done: ["Saved MCP checkpoint"],
        next: ["Resume from MCP"],
        regressions: ["Do not widen the Phase 1 MCP surface"],
      });
      assert.equal(handoff.isError, false);
      assert.match(handoff.content[0]?.type === "text" ? handoff.content[0].text : "", /Handoff complete/);

      const nextState = readState(rootDir);
      assert.equal(nextState.activeSession, null);
      assert.equal(nextState.lastHandoff?.summary, "MCP handoff ready");
      assert.ok(fs.existsSync(path.join(rootDir, "HOLISTIC.md")));
    },
  },
  {
    name: "init can install git hooks and generate portable hook scripts",
    run: () => {
      const { rootDir } = makeRepo();
      const result = initializeHolistic(rootDir, {
        installGitHooks: true,
      });
      assert.equal(result.gitHooksInstalled, true);
      assert.deepEqual(result.gitHooks, ["post-commit", "pre-push"]);

      const postCommitPath = path.join(rootDir, ".git", "hooks", "post-commit");
      const prePushPath = path.join(rootDir, ".git", "hooks", "pre-push");
      assert.ok(fs.existsSync(postCommitPath));
      assert.ok(fs.existsSync(prePushPath));
      const postCommit = fs.readFileSync(postCommitPath, "utf8");
      const prePush = fs.readFileSync(prePushPath, "utf8");
      assert.match(postCommit, /Holistic auto-checkpoint after commit/);
      assert.match(postCommit, /'checkpoint' '--reason' 'post-commit'/);
      assert.match(postCommit, /Committed: \$COMMIT_SUBJECT/);
      assert.match(postCommit, /cd '/);
      assert.match(prePush, /Holistic Status:/);
      assert.match(prePush, /git push origin holistic\/state/);
    },
  },
  {
    name: "daemon tick creates passive capture without a manual session start",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = persist(rootDir, state);
      fs.writeFileSync(path.join(rootDir, "notes.txt"), "background change\n", "utf8");

      const result = runDaemonTick(rootDir, "unknown");
      assert.equal(result.changed, true);
      const stateFile = readState(rootDir);
      assert.equal(stateFile.activeSession?.title, "Passive session capture");
      assert.match(stateFile.activeSession?.latestStatus ?? "", /captured it automatically in the background/);
    },
  },
];

let failures = 0;
for (const testCase of tests) {
  try {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${testCase.name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} test(s) passed.`);
