import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeDraftHandoffInput, renderDiff, renderResumeOutput, renderStatus } from "../src/cli.ts";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { captureRepoSnapshot } from "../src/core/git.ts";
import { bootstrapHolistic, initializeHolistic } from "../src/core/setup.ts";
import { planAutoSync } from "../src/core/sync.ts";
import {
  applyHandoff,
  clearDraftHandoff,
  checkpointState,
  computeSessionDiff,
  continueFromLatest,
  createInitialState,
  getResumePayload,
  getRuntimePaths,
  loadSessionById,
  readDraftHandoff,
  saveState,
  shouldAutoDraftHandoff,
  startNewSession,
} from "../src/core/state.ts";
import { runDaemonTick } from "../src/daemon.ts";
import { buildResumeNotificationText, callHolisticTool, createHolisticMcpServer, listHolisticTools, waitForStdioShutdown } from "../src/mcp-server.ts";
import { tests as mcpNotificationTests } from "../src/__tests__/mcp-notification.test.ts";
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
      assert.equal(config.autoInferSessions, true);
      assert.equal(config.autoSync, true);
      assert.equal(config.sync.remote, "origin");
      assert.equal(config.sync.stateBranch, "holistic/state");
      assert.equal(config.sync.syncOnCheckpoint, true);
      assert.equal(config.sync.syncOnHandoff, true);
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
    name: "resume CLI output includes the ASCII splash banner",
    run: () => {
      const output = renderResumeOutput("Holistic resume\n\n- Current objective: Test banner rendering\n");

      assert.match(output, /██╗  ██╗/);
      assert.match(output, /loading project recap/);
      assert.match(output, /Your repo remembers, so your next agent doesn't have to guess\./);
      assert.match(output, /Holistic resume/);
      assert.match(output, /Current objective: Test banner rendering/);
    },
  },
  {
    name: "bootstrap installs hooks, daemon, and Claude Desktop MCP config in one step",
    run: () => {
      const { rootDir } = makeRepo();
      const fakeHome = makeTempDir("holistic-bootstrap-home");
      const result = bootstrapHolistic(rootDir, {
        platform: "win32",
        homeDir: fakeHome,
        intervalSeconds: 45,
      });

      assert.equal(result.gitHooksInstalled, true);
      assert.equal(result.installed, true);
      assert.equal(result.mcpConfigured, true);
      assert.ok(result.startupTarget?.endsWith(".cmd"));
      assert.ok(fs.existsSync(result.startupTarget ?? ""));
      assert.deepEqual(result.checks, ["git-hooks", "mcp-config", "daemon"]);

      const mcpConfig = JSON.parse(fs.readFileSync(result.mcpConfigFile ?? "", "utf8"));
      const holisticServer = mcpConfig.mcpServers?.holistic;
      assert.equal(holisticServer?.command, process.execPath);
      assert.deepEqual(holisticServer?.env, { HOLISTIC_REPO: rootDir });
      assert.ok(Array.isArray(holisticServer?.args));
      assert.equal(holisticServer.args.includes("serve"), true);
    },
  },
  {
    name: "bootstrap is idempotent and preserves existing MCP servers",
    run: () => {
      const { rootDir } = makeRepo();
      const fakeHome = makeTempDir("holistic-bootstrap-home");
      const configPath = path.join(fakeHome, "Library", "Application Support", "Claude", "claude_desktop_config.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({
        mcpServers: {
          existing: {
            command: "existing-cmd",
            args: ["serve"],
          },
        },
      }, null, 2) + "\n", "utf8");

      bootstrapHolistic(rootDir, {
        platform: "darwin",
        homeDir: fakeHome,
      });
      const second = bootstrapHolistic(rootDir, {
        platform: "darwin",
        homeDir: fakeHome,
      });

      const mcpConfig = JSON.parse(fs.readFileSync(second.mcpConfigFile ?? "", "utf8"));
      assert.equal(mcpConfig.mcpServers.existing.command, "existing-cmd");
      assert.equal(mcpConfig.mcpServers.holistic.command, process.execPath);
      assert.deepEqual(second.checks, ["git-hooks", "mcp-config", "daemon"]);
    },
  },
  /* Phase tracking was removed - test commented out for reference
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
  */
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
    name: "continueFromLatest infers a session from recent repo changes when no carryover exists",
    run: () => {
      const { rootDir, state } = makeRepo();
      let nextState = persist(rootDir, state);
      fs.mkdirSync(path.join(rootDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(rootDir, "src", "feature.ts"), "export const feature = true;\n", "utf8");

      nextState = continueFromLatest(rootDir, nextState, "codex");
      nextState = persist(rootDir, nextState);

      assert.equal(nextState.activeSession?.title, "Continue recent repo work");
      assert.match(nextState.activeSession?.currentGoal ?? "", /Continue work around src\/feature\.ts/);
      assert.match(nextState.activeSession?.latestStatus ?? "", /Inferred a session from recent repo changes/);
    },
  },
  {
    name: "mcp tool list stays intentionally thin and tool calls persist state",
    run: () => {
      const { rootDir, state } = makeRepo();
      persist(rootDir, state);

      const tools = listHolisticTools().tools.map((tool) => tool.name);
      assert.deepEqual(tools, ["holistic_resume", "holistic_slash", "holistic_checkpoint", "holistic_handoff"]);

      const resumeBefore = callHolisticTool(rootDir, "holistic_resume", { agent: "codex" });
      const initialText = resumeBefore.content[0]?.type === "text" ? resumeBefore.content[0].text : "";
      assert.match(initialText, /No active Holistic session or pending work found/);

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
      let nextState = readState(rootDir);
      assert.equal(nextState.activeSession?.agent, "claude");

      const resumed = callHolisticTool(rootDir, "holistic_resume", { agent: "codex", continue: true });
      const resumedText = resumed.content[0]?.type === "text" ? resumed.content[0].text : "";
      assert.match(resumedText, /Holistic resume/);
      assert.match(resumedText, /Latest status: Created from MCP/);
      assert.match(resumedText, /Choices: continue, tweak, start-new/);

      nextState = readState(rootDir);
      assert.equal(nextState.activeSession?.agent, "codex");

      const handoff = callHolisticTool(rootDir, "holistic_handoff", {
        summary: "MCP handoff ready",
        done: ["Saved MCP checkpoint"],
        next: ["Resume from MCP"],
        regressions: ["Do not widen the Phase 1 MCP surface"],
      });
      assert.equal(handoff.isError, false);
      assert.match(handoff.content[0]?.type === "text" ? handoff.content[0].text : "", /Handoff complete/);

      nextState = readState(rootDir);
      assert.equal(nextState.activeSession, null);
      assert.equal(nextState.lastHandoff?.summary, "MCP handoff ready");
      assert.ok(fs.existsSync(path.join(rootDir, "HOLISTIC.md")));
    },
  },
  {
    name: "new next steps take precedence in handoffs and current plan rendering",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Polish handoff behavior", ["Review current behavior"]);
      state = checkpointState(rootDir, state, {
        agent: "codex",
        reason: "milestone",
        status: "Earlier next step captured",
        next: ["Old next step"],
      });
      state = persist(rootDir, state);
      state = applyHandoff(rootDir, state, {
        summary: "Fresh handoff",
        next: ["Newest next step"],
      });
      state = persist(rootDir, state);

      assert.equal(state.lastHandoff?.nextAction, "Newest next step");
      const currentPlan = fs.readFileSync(path.join(rootDir, ".holistic", "context", "current-plan.md"), "utf8");
      assert.match(currentPlan, /## Goal\r?\n\r?\nNewest next step/);
      assert.match(currentPlan, /## Planned Next Steps\r?\n\r?\n- Newest next step/);
    },
  },
  /* Phase tracking was removed - test commented out for reference
  {
    name: "mcp connect sends visible resume notification when carryover exists",
    run: async () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Implement implicit resume", ["Wire MCP notification", "Keep tool surface thin"]);
      state = setActivePhase(state, {
        phase: "1.5",
        name: "Workflow Disappearance",
        goal: "Reduce startup ceremony for MCP clients",
        status: "Phase 1.5 kickoff",
      });
      state = checkpointState(rootDir, state, {
        reason: "milestone",
        status: "Working on MCP connect resume notifications",
        next: ["Send a visible resume message when MCP initialization completes"],
      });
      state = persist(rootDir, state);

      const text = buildResumeNotificationText(state, "codex");
      assert.ok(text);
      assert.match(text ?? "", /Holistic resume/);
      assert.match(text ?? "", /Phase: 1\.5 - Workflow Disappearance/);
      assert.match(text ?? "", /Current objective: Reduce startup ceremony for MCP clients/);

      const server = createHolisticMcpServer(rootDir);
      const sent: Array<{ level: string; logger?: string; data: unknown }> = [];
      (server as unknown as {
        sendLoggingMessage: (params: { level: string; logger?: string; data: unknown }) => Promise<void>;
      }).sendLoggingMessage = async (params) => {
        sent.push(params);
      };

      server.oninitialized?.();
      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(sent.length, 1);
      assert.equal(sent[0]?.level, "info");
      assert.equal(sent[0]?.logger, "holistic");
      assert.match(String(sent[0]?.data ?? ""), /Holistic resume/);
    },
  },
  */
  {
    name: "mcp connect auto-starts an inferred session before sending resume notification",
    run: async () => {
      const { rootDir, state } = makeRepo();
      let nextState = persist(rootDir, state);
      fs.mkdirSync(path.join(rootDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(rootDir, "src", "mcp.ts"), "export const mcp = true;\n", "utf8");

      const server = createHolisticMcpServer(rootDir);
      const sent: Array<{ level: string; logger?: string; data: unknown }> = [];
      (server as unknown as {
        sendLoggingMessage: (params: { level: string; logger?: string; data: unknown }) => Promise<void>;
      }).sendLoggingMessage = async (params) => {
        sent.push(params);
      };

      server.oninitialized?.();
      await new Promise((resolve) => setTimeout(resolve, 0));

      nextState = readState(rootDir);
      assert.equal(nextState.activeSession?.title, "Continue recent repo work");
      assert.equal(nextState.activeSession?.agent, "claude");
      assert.equal(sent.length, 1);
      assert.match(String(sent[0]?.data ?? ""), /Continue work around src\/mcp\.ts/);
    },
  },
  {
    name: "mcp connect skips resume notification when there is no carryover",
    run: () => {
      const { rootDir, state } = makeRepo();
      persist(rootDir, state);
      const text = buildResumeNotificationText(state, "codex");
      assert.equal(text, null);
    },
  },
  {
    name: "mcp server waits for stdio shutdown instead of exiting immediately",
    run: async () => {
      class FakeStdin extends EventEmitter {
        resumeCalled = false;

        resume(): void {
          this.resumeCalled = true;
        }
      }

      const stdin = new FakeStdin();
      const waiting = waitForStdioShutdown(stdin);
      assert.equal(stdin.resumeCalled, true);

      let resolved = false;
      waiting.then(() => {
        resolved = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(resolved, false);

      stdin.emit("close");
      await waiting;
      assert.equal(resolved, true);
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
      assert.deepEqual(result.gitHooks, ["post-commit", "post-checkout", "pre-push"]);

      const postCommitPath = path.join(rootDir, ".git", "hooks", "post-commit");
      const postCheckoutPath = path.join(rootDir, ".git", "hooks", "post-checkout");
      const prePushPath = path.join(rootDir, ".git", "hooks", "pre-push");
      assert.ok(fs.existsSync(postCommitPath));
      assert.ok(fs.existsSync(postCheckoutPath));
      assert.ok(fs.existsSync(prePushPath));
      const postCommit = fs.readFileSync(postCommitPath, "utf8");
      const postCheckout = fs.readFileSync(postCheckoutPath, "utf8");
      const prePush = fs.readFileSync(prePushPath, "utf8");
      const syncPs1 = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.ps1"), "utf8");
      const syncSh = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.sh"), "utf8");
      assert.match(postCommit, /Holistic auto-checkpoint after commit/);
      assert.match(postCommit, /'checkpoint' '--reason' 'post-commit'/);
      assert.match(postCommit, /Committed: \$COMMIT_SUBJECT/);
      assert.match(postCommit, /cd '/);
      assert.match(postCheckout, /Holistic continuity checkpoint after branch switch/);
      assert.match(postCheckout, /'checkpoint' '--reason' 'branch-switch'/);
      assert.match(postCheckout, /\[ "\$3" = "1" \]/);
      assert.match(prePush, /Holistic Status:/);
      assert.match(prePush, /git push origin holistic\/state/);
      assert.match(syncPs1, /core\.hooksPath=NUL/);
      assert.match(syncPs1, /ls-remote --exit-code --heads \$remote \$stateBranch/);
      assert.match(syncPs1, /if \(-not \$remoteStateExists\)/);
      assert.match(syncPs1, /switch --orphan \$stateBranch/);
      assert.match(syncPs1, /switch -C \$stateBranch FETCH_HEAD/);
      assert.match(syncSh, /core\.hooksPath=\/dev\/null/);
    },
  },
  {
    name: "daemon tick clusters repo activity until a quiet point before checkpointing",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = persist(rootDir, state);
      fs.writeFileSync(path.join(rootDir, "notes.txt"), "background change\n", "utf8");

      const firstTick = runDaemonTick(rootDir, "unknown");
      assert.equal(firstTick.changed, false);
      let stateFile = readState(rootDir);
      assert.equal(stateFile.activeSession, null);
      assert.deepEqual(stateFile.passiveCapture?.pendingFiles, ["notes.txt"]);

      const secondTick = runDaemonTick(rootDir, "unknown");
      assert.equal(secondTick.changed, true);
      stateFile = readState(rootDir);
      assert.equal(stateFile.activeSession?.title, "Passive session capture");
      assert.match(stateFile.activeSession?.latestStatus ?? "", /Detected a quiet point after repo activity/);
      assert.deepEqual(stateFile.passiveCapture?.pendingFiles, []);
    },
  },
  {
    name: "daemon tick checkpoints branch switches immediately",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = persist(rootDir, state);

      let baseline = runDaemonTick(rootDir, "unknown");
      assert.equal(baseline.changed, false);

      fs.writeFileSync(path.join(rootDir, ".git", "HEAD"), "ref: refs/heads/feature\n", "utf8");
      fs.writeFileSync(path.join(rootDir, ".git", "refs", "heads", "feature"), "1111111111111111111111111111111111111111\n", "utf8");

      const branchTick = runDaemonTick(rootDir, "unknown");
      assert.equal(branchTick.changed, true);

      const stateFile = readState(rootDir);
      assert.equal(stateFile.activeSession?.title, "Passive session capture");
      assert.match(stateFile.activeSession?.latestStatus ?? "", /branch switch from main to feature/);
      assert.equal(stateFile.activeSession?.lastCheckpointReason, "branch-switch");
    },
  },
  {
    name: "auto-draft handoff triggers for significant work milestones",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Prepare a durable handoff", ["Keep continuity alive"]);
      assert.ok(state.activeSession);
      state.activeSession!.startedAt = new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString();
      state.activeSession!.updatedAt = new Date().toISOString();
      state.activeSession!.checkpointCount = 5;

      const decision = shouldAutoDraftHandoff(state.activeSession!);
      assert.equal(decision.should, true);
      assert.equal(decision.reason, "work-milestone");
    },
  },
  {
    name: "auto-sync planning respects config toggles and platform-specific scripts",
    run: () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir);

      const checkpointPlan = planAutoSync(rootDir, "checkpoint", "win32");
      assert.equal(checkpointPlan.enabled, true);
      assert.equal(checkpointPlan.command, "powershell");
      assert.match(checkpointPlan.scriptPath ?? "", /sync-state\.ps1$/);

      const handoffPlan = planAutoSync(rootDir, "handoff", "linux");
      assert.equal(handoffPlan.enabled, true);
      assert.equal(handoffPlan.command, "sh");
      assert.match(handoffPlan.scriptPath ?? "", /sync-state\.sh$/);

      const configPath = path.join(rootDir, ".holistic", "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.sync.syncOnCheckpoint = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

      const disabledPlan = planAutoSync(rootDir, "checkpoint", "linux");
      assert.equal(disabledPlan.enabled, false);
      assert.match(disabledPlan.reason ?? "", /Checkpoint auto-sync disabled/);
    },
  },
  {
    name: "daemon tick saves an idle auto-drafted handoff and handoff --draft consumes it",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Document the current work", ["Review the current task", "Prepare handoff"]);
      state = checkpointState(rootDir, state, {
        agent: "codex",
        reason: "milestone",
        status: "Ready for an auto-drafted handoff",
        done: ["Captured the main implementation status"],
        next: ["Review the draft and continue if needed"],
      });
      assert.ok(state.activeSession);
      state.activeSession!.updatedAt = new Date(Date.now() - (31 * 60 * 1000)).toISOString();
      state = persist(rootDir, state);

      const firstTick = runDaemonTick(rootDir, "codex");
      assert.equal(firstTick.changed, true);
      assert.match(firstTick.summary, /auto-drafted handoff/);

      const paths = getRuntimePaths(rootDir);
      const draft = readDraftHandoff(paths);
      assert.ok(draft);
      assert.equal(draft?.sourceSessionId, state.activeSession?.id);
      assert.equal(draft?.reason, "idle-30min");
      assert.equal(draft?.handoff.summary, "Ready for an auto-drafted handoff");

      const secondTick = runDaemonTick(rootDir, "codex");
      assert.equal(secondTick.changed, false);

      const finalized = finalizeDraftHandoffInput(readState(rootDir).activeSession!, draft?.handoff ?? {});
      let finalState = applyHandoff(rootDir, readState(rootDir), finalized);
      clearDraftHandoff(paths);
      finalState = persist(rootDir, finalState);

      assert.equal(finalState.activeSession, null);
      assert.equal(finalState.lastHandoff?.summary, "Ready for an auto-drafted handoff");
      assert.equal(fs.existsSync(path.join(rootDir, ".holistic", "draft-handoff.json")), false);
    },
  },
];

// Merge in unit tests from test modules
const allTests = [...tests, ...mcpNotificationTests];

let failures = 0;
for (const testCase of allTests) {
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

console.log(`\n${allTests.length} test(s) passed.`);
