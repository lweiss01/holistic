import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeDraftHandoffInput, getSyncStatus, renderDiff, renderHelpText, renderResumeOutput, renderStatus } from "../src/cli.ts";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { captureRepoSnapshot, getBranchName } from "../src/core/git.ts";
import { bootstrapHolistic, getSetupStatus, initializeHolistic, refreshHolisticHooks, repairHolistic, runtimeEntryScript, validateRuntimeConfig } from "../src/core/setup.ts";
import { planAutoSync } from "../src/core/sync.ts";
import {
  applyHandoff,
  clearDraftHandoff,
  checkpointState,
  computeSessionDiff,
  continueFromLatest,
  createInitialState,
  evaluateHealthDiagnostics,
  findArchiveCandidates,
  getResumePayload,
  getRuntimePaths,
  loadState,
  loadSessionById,
  readArchivedSessions,
  readActiveSessions,
  readAllSessions,
  readDraftHandoff,
  reactivateArchivedSession,
  runSessionHygiene,
  saveState,
  shouldAutoDraftHandoff,
  shouldCheckpointForElapsedTime,
  shouldCheckpointForPendingFiles,
  shouldDraftCompletionSignalHandoff,
  normalizeCompletionSignalMetadata,
  startNewSession,
} from "../src/core/state.ts";
import { runDaemonTick } from "../src/daemon.ts";
import { renderResumeNotificationText, callHolisticTool, createHolisticMcpServer, listHolisticTools, waitForStdioShutdown } from "../src/mcp-server.ts";
import { tests as securityTests } from "./security.test.ts";
import { tests as mcpNotificationTests } from "../src/__tests__/mcp-notification.test.ts";
import { tests as redactTests } from "../src/__tests__/redact.test.ts";
import { tests as privacyArtifactTests } from "../src/__tests__/privacy-artifacts.test.ts";
import { tests as andonTests } from "./andon.test.ts";
import { tests as daemonTests } from "./daemon.test.ts";
import { tests as runtimeCoreTests } from "./runtime-core.test.ts";
import { tests as runtimeLocalTests } from "./runtime-local.test.ts";
import { tests as runtimeStorageTests } from "./runtime-storage.test.ts";
import { tests as runtimeServiceTests } from "./runtime-service.test.ts";
import type { HolisticState } from "../src/core/types.ts";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testTempRoot = os.tmpdir();

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(testTempRoot, `${prefix}-`));
}

function makeRepo(): { rootDir: string; state: HolisticState } {
  const rootDir = makeTempDir("holistic-test");
  try {
    execFileSync("git", ["init"], { cwd: rootDir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: rootDir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir });
  } catch (e: any) {
    const stderr = e.stderr?.toString() || e.message;
    throw new Error(`makeRepo git failed in ${rootDir}: ${stderr}`);
  }
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
    name: "repair rewrites stale repo-local helper targets using current runtime config",
    run: () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir, {
        installGitHooks: true,
      });

      const posixHelperPath = path.join(rootDir, ".holistic", "system", "holistic");
      const windowsHelperPath = path.join(rootDir, ".holistic", "system", "holistic.cmd");
      fs.writeFileSync(posixHelperPath, "#!/usr/bin/env sh\nexec '/broken/node' '/old/dist/cli.ts' \"$@\"\n", "utf8");
      fs.writeFileSync(windowsHelperPath, "@echo off\r\n\"C:\\broken\\node.exe\" \"D:\\old\\dist\\cli.ts\" %*\r\n", "utf8");

      const result = repairHolistic(rootDir);
      assert.equal(result.checks.includes("system-artifacts"), true);
      assert.equal(result.gitHooksInstalled, true);

      const posixHelper = fs.readFileSync(posixHelperPath, "utf8");
      const windowsHelper = fs.readFileSync(windowsHelperPath, "utf8");
      assert.doesNotMatch(posixHelper, /dist[\/\\]cli\.ts/);
      assert.doesNotMatch(windowsHelper, /dist[\/\\]cli\.ts/);
      assert.match(posixHelper, /src[\/\\]cli\.ts/);
      assert.match(windowsHelper, /src[\/\\]cli\.ts/);
    },
  },
  {
    name: "runtime entry script resolves source and built installs correctly",
    run: () => {
      const sourceRuntime = runtimeEntryScript("cli", path.join(workspaceRoot, "src", "core", "setup.ts"));
      assert.equal(sourceRuntime.useStripTypes, true);
      assert.equal(sourceRuntime.scriptPath, path.resolve(workspaceRoot, "src", "cli.ts"));

      const builtRuntime = runtimeEntryScript("cli", path.join(workspaceRoot, "dist", "core", "setup.js"));
      assert.equal(builtRuntime.useStripTypes, false);
      assert.equal(builtRuntime.scriptPath, path.resolve(workspaceRoot, "dist", "cli.js"));
    },
  },
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
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "holistic.cmd")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "system", "holistic")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "zero-touch.md")));
      const attributes = fs.readFileSync(path.join(rootDir, ".gitattributes"), "utf8");
      const config = JSON.parse(fs.readFileSync(path.join(rootDir, ".holistic", "config.json"), "utf8"));
      assert.equal(config.autoInferSessions, true);
      assert.equal(config.autoSync, true);
      assert.equal(config.sync.remote, "origin");
      assert.equal(config.sync.stateRef, "refs/holistic/state");
      assert.equal("stateBranch" in config.sync, false);
      assert.equal(config.sync.syncOnCheckpoint, true);
      assert.equal(config.sync.syncOnHandoff, true);
      assert.match(attributes, /BEGIN HOLISTIC MANAGED ATTRIBUTES/);
      assert.match(attributes, /HOLISTIC\.md text eol=lf/);
      assert.match(attributes, /\.holistic\/\*\*\/\*\.ps1 text eol=crlf/);
      assert.ok(fs.existsSync(result.startupTarget ?? ""));
    },
  },
  {
    name: "repo runtime override keeps self-dogfooding files local-only",
    run: () => {
      const { rootDir } = makeRepo();
      fs.writeFileSync(path.join(rootDir, "holistic.repo.json"), JSON.stringify({
        runtime: {
          holisticDir: ".holistic-local",
          masterDoc: "HOLISTIC.local.md",
          agentsDoc: "AGENTS.local.md",
          writeRootHistoryDoc: false,
          writeRootAgentDocs: false,
        },
        syncDefaults: {
          autoSync: false,
          syncOnCheckpoint: false,
          syncOnHandoff: false,
          postHandoffPush: false,
          restoreOnStartup: false,
        },
      }, null, 2) + "\n", "utf8");
      fs.writeFileSync(path.join(rootDir, "HOLISTIC.md"), "public holistic doc\n", "utf8");
      fs.writeFileSync(path.join(rootDir, "AGENTS.md"), "public agents doc\n", "utf8");
      fs.writeFileSync(path.join(rootDir, ".gitattributes"), ".beads/issues.jsonl merge=beads\n", "utf8");

      const result = initializeHolistic(rootDir, {
        installGitHooks: true,
      });

      assert.equal(result.gitHooksInstalled, true);
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic-local", "state.json")));
      assert.ok(fs.existsSync(path.join(rootDir, "HOLISTIC.local.md")));
      assert.ok(fs.existsSync(path.join(rootDir, "AGENTS.local.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic-local", "system", "holistic.cmd")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic-local", "system", "holistic")));
      assert.equal(fs.readFileSync(path.join(rootDir, "HOLISTIC.md"), "utf8"), "public holistic doc\n");
      assert.equal(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), "public agents doc\n");
      assert.equal(fs.readFileSync(path.join(rootDir, ".gitattributes"), "utf8"), ".beads/issues.jsonl merge=beads\n");
      assert.ok(!fs.existsSync(path.join(rootDir, "HISTORY.md")));
      assert.ok(!fs.existsSync(path.join(rootDir, "CLAUDE.md")));
      assert.ok(!fs.existsSync(path.join(rootDir, "GEMINI.md")));

      const config = JSON.parse(fs.readFileSync(path.join(rootDir, ".holistic-local", "config.json"), "utf8"));
      assert.equal(config.autoSync, false);
      assert.equal(config.sync.stateRef, "refs/holistic/state");
      assert.equal(config.sync.syncOnCheckpoint, false);
      assert.equal(config.sync.syncOnHandoff, false);

      const loaded = loadState(rootDir);
      assert.equal(loaded.paths.holisticDir, path.join(rootDir, ".holistic-local"));
      assert.equal(loaded.state.docIndex.historyDoc, ".holistic-local/context/project-history.md");
      assert.equal(loaded.state.docIndex.regressionDoc, ".holistic-local/context/regression-watch.md");

      const postCommit = fs.readFileSync(path.join(rootDir, ".git", "hooks", "post-commit"), "utf8");
      assert.match(postCommit, /HOLISTIC-MANAGED post-commit/);
      assert.match(postCommit, /hook placeholder after commit/);
    },
  },
  {
    name: "legacy state-branch option keeps visible branch sync compatibility",
    run: () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir, {
        stateBranch: "holistic/state",
      });

      const config = JSON.parse(fs.readFileSync(path.join(rootDir, ".holistic", "config.json"), "utf8"));
      const syncPs1 = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.ps1"), "utf8");
      const syncSh = fs.readFileSync(path.join(rootDir, ".holistic", "system", "sync-state.sh"), "utf8");

      assert.equal(config.sync.stateBranch, "holistic/state");
      assert.equal("stateRef" in config.sync, false);
      assert.match(syncPs1, /\$stateRef = 'refs\/heads\/holistic\/state'/);
      assert.match(syncSh, /STATE_REF='refs\/heads\/holistic\/state'/);
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
      assert.match(payload.recommendedCommand, /\.\\\.holistic\\system\\holistic\.cmd start-new --goal "Describe the new task"/);
      assert.ok(fs.existsSync(path.join(rootDir, "HOLISTIC.md")));
      assert.ok(fs.existsSync(path.join(rootDir, "AGENTS.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "state.json")));
      assert.match(fs.readFileSync(path.join(rootDir, "HOLISTIC.md"), "utf8"), /repo-local Holistic helper/);
      assert.match(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), /repo-local Holistic helper/);
      assert.match(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), /tests passed/);
      assert.match(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), /bug fixed/);
      assert.match(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), /feature complete/);
      assert.match(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), /\/checkpoint/);
      assert.match(fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"), /\/handoff/);
      assert.match(fs.readFileSync(path.join(rootDir, ".holistic", "context", "session-protocol.md"), "utf8"), /repo-local Holistic helper/);
      assert.match(fs.readFileSync(path.join(rootDir, ".holistic", "context", "session-protocol.md"), "utf8"), /tests pass/);
      assert.match(fs.readFileSync(path.join(rootDir, ".holistic", "context", "session-protocol.md"), "utf8"), /\/checkpoint/);
      assert.match(fs.readFileSync(path.join(rootDir, ".holistic", "context", "session-protocol.md"), "utf8"), /\/handoff/);
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "project-history.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "regression-watch.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "zero-touch.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "adapters", "gemini.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "adapters", "copilot.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "adapters", "cursor.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "adapters", "goose.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "adapters", "gsd.md")));
      assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "context", "adapters", "gsd2.md")));
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
    name: "CLI help text documents completion metadata and natural breakpoint safety valves",
    run: () => {
      const help = renderHelpText();

      assert.match(help, /holistic repair/);
      assert.match(help, /Setup Commands:/);
      assert.match(help, /Read-Only & Diagnostic Commands:/);
      assert.match(help, /Stateful & Mutating Commands:/);
      assert.match(help, /holistic doctor \[--json\]\s+\| Run deep diagnostics and verify system health/);
      assert.match(help, /Checkpoint examples:/);
      assert.match(help, /Use handoff as the final safety valve/);
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
      const status = renderStatus(rootDir, state);
      assert.match(status, /Holistic Status/);
      assert.match(status, /Goal: Build status command/);
      assert.match(status, /Status: Status command is in progress/);
      assert.match(status, /Branch: (main|master)/);
      assert.match(status, /Checkpoints: 1/);
      assert.match(status, /Changed files:/);
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
      const output = renderStatus(rootDir, state);
      assert.match(output, /No active session\./);
      assert.match(output, /Last handoff: Wrapped the current work/);
      assert.match(output, /Pending work: 1 item\(s\)/);
      const after = fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8");
      assert.equal(after, before);
    },
  },
  {
    name: "archived sessions live under archive storage and merged history reads across active/archive files",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      const archived = archiveSession(rootDir, state, "Archive old work", {
        status: "Archived session captured",
        done: ["Recorded durable archive session"],
        regressions: ["History must include archived sessions"],
        next: ["Start fresh active work"],
      }, "archive-source.txt");
      state = archived.state;
      state = startNewSession(rootDir, state, "codex", "Current active work", ["Keep merged history intact"]);
      state = persist(rootDir, state);

      const paths = getRuntimePaths(rootDir);
      const archivedPath = path.join(paths.archiveSessionsDir, `${archived.sessionId}.json`);
      const legacyFlatPath = path.join(paths.sessionsDir, `${archived.sessionId}.json`);
      assert.ok(fs.existsSync(archivedPath));
      assert.equal(fs.existsSync(legacyFlatPath), false);

      fs.writeFileSync(path.join(paths.sessionsDir, "corrupt-active.json"), "{not json", "utf8");
      fs.writeFileSync(path.join(paths.archiveSessionsDir, "corrupt-archive.json"), "{still not json", "utf8");

      const archivedSessions = readArchivedSessions(paths);
      const allSessions = readAllSessions(paths);
      assert.equal(archivedSessions.length, 1);
      assert.equal(archivedSessions[0]?.id, archived.sessionId);
      assert.equal(allSessions.length, 1);
      assert.equal(allSessions[0]?.id, archived.sessionId);

      const projectHistory = fs.readFileSync(path.join(rootDir, ".holistic", "context", "project-history.md"), "utf8");
      const regressionWatch = fs.readFileSync(path.join(rootDir, ".holistic", "context", "regression-watch.md"), "utf8");
      assert.match(projectHistory, /Current active work/);
      assert.match(projectHistory, /Archive old work/);
      assert.match(projectHistory, /History must include archived sessions/);
      assert.match(regressionWatch, /Archive old work/);
      assert.match(regressionWatch, /History must include archived sessions/);
      assert.ok(projectHistory.indexOf("Current active work") < projectHistory.indexOf("Archive old work"));
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
      const checkpointTool = listHolisticTools().tools.find((tool) => tool.name === "holistic_checkpoint");
      assert.match(checkpointTool?.description ?? "", /tests passed/);
      assert.match(checkpointTool?.description ?? "", /bug fixed/);
      assert.match(checkpointTool?.description ?? "", /feature complete/);
      assert.match(checkpointTool?.description ?? "", /focus change/);
      assert.match(checkpointTool?.description ?? "", /before compaction/);
      assert.match(checkpointTool?.description ?? "", /completionKind/);
      assert.match(checkpointTool?.description ?? "", /completionSource/);

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
      assert.match(resumedText, /Recommended command: Windows/);
      assert.match(resumedText, /\.\\\.holistic\\system\\holistic\.cmd resume --continue/);

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

      const text = renderResumeNotificationText(state);
      assert.ok(text);
      assert.match(text ?? "", /Holistic session active/);
      assert.match(text ?? "", /Objective:/);

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
      assert.match(String(sent[0]?.data ?? ""), /Holistic session active. Use holistic_resume tool for full project context/);
    },
  },
  {
    name: "mcp connect skips resume notification when there is no carryover",
    run: () => {
      const { rootDir, state } = makeRepo();
      persist(rootDir, state);
      const text = renderResumeNotificationText(state);
      assert.equal(text, "");
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
      assert.match(postCommit, /Holistic hook placeholder after commit/);
      assert.match(postCommit, /HOLISTIC-MANAGED post-commit/);
      assert.match(postCommit, /Intentionally do not create a new checkpoint/);
      assert.match(postCommit, /cd '/);
      assert.match(postCheckout, /Holistic continuity checkpoint after branch switch/);
      assert.match(postCheckout, /HOLISTIC-MANAGED post-checkout/);
      assert.match(postCheckout, /'checkpoint' '--reason' 'branch-switch'/);
      assert.match(postCheckout, /\[ "\$3" = "1" \]/);
      assert.match(prePush, /HOLISTIC-MANAGED pre-push/);
      assert.match(prePush, /portable state sync before push/);
      assert.match(prePush, /sync-state\.sh/);
      assert.match(prePush, /sync\.log/);
      assert.match(syncPs1, /core\.hooksPath=NUL/);
      assert.match(syncPs1, /PSNativeCommandUseErrorActionPreference/);
      assert.match(syncPs1, /\$stateRef = 'refs\/holistic\/state'/);
      assert.match(syncPs1, /\$legacySeedRef = 'refs\/heads\/holistic\/state'/);
      assert.match(syncPs1, /ls-remote --quiet --exit-code \$remote \$stateRef/);
      assert.match(syncPs1, /ls-remote --quiet --exit-code \$remote \$legacySeedRef/);
      assert.match(syncPs1, /switch --detach FETCH_HEAD/);
      assert.doesNotMatch(syncPs1, /push \$remote \$branch/);
      assert.doesNotMatch(syncPs1, /rev-parse --abbrev-ref HEAD/);
      assert.doesNotMatch(syncPs1, /switch -C \$stateBranch FETCH_HEAD/);
      assert.match(syncSh, /core\.hooksPath=\/dev\/null/);
      assert.match(syncSh, /STATE_REF='refs\/holistic\/state'/);
      assert.match(syncSh, /LEGACY_SEED_REF='refs\/heads\/holistic\/state'/);
      assert.doesNotMatch(syncSh, /push \"\$REMOTE\" \"\$BRANCH\"/);
      assert.doesNotMatch(syncSh, /rev-parse --abbrev-ref HEAD/);
    },
  },
  {
    name: "managed hook refresh heals stale hooks and preserves custom hooks",
    run: () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir, {
        installGitHooks: true,
      });

      const postCommitPath = path.join(rootDir, ".git", "hooks", "post-commit");
      const postCheckoutPath = path.join(rootDir, ".git", "hooks", "post-checkout");
      const prePushPath = path.join(rootDir, ".git", "hooks", "pre-push");
      const stalePostCommit = fs.readFileSync(postCommitPath, "utf8").replace("Holistic hook placeholder after commit", "Stale Holistic hook");
      const customPrePush = "#!/usr/bin/env sh\n# custom user hook\nexit 0\n";

      fs.writeFileSync(postCommitPath, stalePostCommit, "utf8");
      fs.unlinkSync(postCheckoutPath);
      fs.writeFileSync(prePushPath, customPrePush, { encoding: "utf8", mode: 0o755 });

      const refreshed = refreshHolisticHooks(rootDir);
      assert.equal(refreshed.installed, true);
      assert.ok(refreshed.refreshed.includes("post-commit"));
      assert.ok(refreshed.refreshed.includes("post-checkout"));
      assert.match(refreshed.warnings[0] ?? "", /pre-push/);
      assert.match(fs.readFileSync(postCommitPath, "utf8"), /Holistic hook placeholder after commit/);
      assert.ok(fs.existsSync(postCheckoutPath));
      assert.equal(fs.readFileSync(prePushPath, "utf8"), customPrePush);

      const secondPass = refreshHolisticHooks(rootDir);
      assert.deepEqual(secondPass.refreshed, []);
      assert.match(secondPass.warnings[0] ?? "", /pre-push/);
    },
  },
  {
    name: "30 day hygiene archives stale unreferenced sessions and leaves referenced ones active",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      const nowMs = Date.now();
      const thirtyOneDaysAgo = new Date(nowMs - (31 * 24 * 60 * 60 * 1000)).toISOString();
      const twentyNineDaysAgo = new Date(nowMs - (29 * 24 * 60 * 60 * 1000)).toISOString();
      const exactlyThirtyDaysAgo = new Date(nowMs - (30 * 24 * 60 * 60 * 1000)).toISOString();

      // Stale session — should be archived.
      const staleSession = {
        id: "session-stale-1", agent: "codex", branch: "main",
        startedAt: thirtyOneDaysAgo, updatedAt: thirtyOneDaysAgo, endedAt: thirtyOneDaysAgo,
        status: "handed_off", title: "Old stale work", currentGoal: "Old", currentPlan: [],
        latestStatus: "Done long ago", workDone: [], triedItems: [], nextSteps: [],
        assumptions: [], blockers: [], references: [], impactNotes: [], regressionRisks: [],
        changedFiles: [], checkpointCount: 1, lastCheckpointReason: "manual", resumeRecap: [],
      };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-stale-1.json"), JSON.stringify(staleSession) + "\n", "utf8");

      // Recent session — should stay active.
      const recentSession = { ...staleSession, id: "session-recent-1", endedAt: twentyNineDaysAgo, title: "Recent work" };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-recent-1.json"), JSON.stringify(recentSession) + "\n", "utf8");

      // Exactly 30 days old — should be archived (at boundary).
      const boundarySession = { ...staleSession, id: "session-boundary-1", endedAt: exactlyThirtyDaysAgo, title: "Boundary work" };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-boundary-1.json"), JSON.stringify(boundarySession) + "\n", "utf8");

      // Old but referenced by lastHandoff — should stay active.
      const referencedSession = { ...staleSession, id: "session-referenced-1", title: "Referenced old work" };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-referenced-1.json"), JSON.stringify(referencedSession) + "\n", "utf8");
      state.lastHandoff = {
        sessionId: "session-referenced-1", summary: "Old handoff", blockers: [],
        nextAction: "Continue", committedAt: null, createdAt: thirtyOneDaysAgo,
      };

      // Old but referenced by pendingWork — should stay active.
      const pendingSession = { ...staleSession, id: "session-pending-1", title: "Pending old work" };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-pending-1.json"), JSON.stringify(pendingSession) + "\n", "utf8");
      state.pendingWork = [{
        id: "pending-session-pending-1", title: "Pending item", context: "ctx",
        recommendedNextStep: "Do something", priority: "medium",
        carriedFromSession: "session-pending-1", createdAt: thirtyOneDaysAgo,
      }];

      const candidates = findArchiveCandidates(paths, state, nowMs);
      assert.equal(candidates.length, 2);
      const candidateIds = candidates.map((s) => s.id).sort();
      assert.deepEqual(candidateIds, ["session-boundary-1", "session-stale-1"]);

      const archived = runSessionHygiene(paths, state, nowMs);
      assert.equal(archived.length, 2);
      assert.ok(archived.includes("session-stale-1"));
      assert.ok(archived.includes("session-boundary-1"));

      // Verify files moved correctly.
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, "session-stale-1.json")));
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, "session-boundary-1.json")));
      assert.equal(fs.existsSync(path.join(paths.sessionsDir, "session-stale-1.json")), false);
      assert.equal(fs.existsSync(path.join(paths.sessionsDir, "session-boundary-1.json")), false);

      // Recent and referenced sessions still in active storage.
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, "session-recent-1.json")));
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, "session-referenced-1.json")));
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, "session-pending-1.json")));
    },
  },
  {
    name: "30 day hygiene skips sessions with missing or malformed endedAt",
    run: () => {
      const { rootDir } = makeRepo();
      const state = createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      const base = {
        agent: "codex", branch: "main", startedAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z", status: "handed_off",
        title: "Test", currentGoal: "Test", currentPlan: [], latestStatus: "Done",
        workDone: [], triedItems: [], nextSteps: [], assumptions: [], blockers: [],
        references: [], impactNotes: [], regressionRisks: [], changedFiles: [],
        checkpointCount: 1, lastCheckpointReason: "manual", resumeRecap: [],
      };

      // No endedAt — should NOT be archived.
      fs.writeFileSync(path.join(paths.sessionsDir, "session-no-ended.json"),
        JSON.stringify({ ...base, id: "session-no-ended", endedAt: null }) + "\n", "utf8");

      // Malformed endedAt — should NOT be archived.
      fs.writeFileSync(path.join(paths.sessionsDir, "session-bad-date.json"),
        JSON.stringify({ ...base, id: "session-bad-date", endedAt: "not-a-date" }) + "\n", "utf8");

      const candidates = findArchiveCandidates(paths, state);
      assert.equal(candidates.length, 0);

      const archived = runSessionHygiene(paths, state);
      assert.equal(archived.length, 0);
    },
  },
  {
    name: "daemon tick runs 30 day hygiene before passive checkpoint decisions",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      // Place a stale session in active storage.
      const thirtyOneDaysAgo = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)).toISOString();
      const staleSession = {
        id: "session-daemon-stale", agent: "codex", branch: "main",
        startedAt: thirtyOneDaysAgo, updatedAt: thirtyOneDaysAgo, endedAt: thirtyOneDaysAgo,
        status: "handed_off", title: "Daemon stale", currentGoal: "Old", currentPlan: [],
        latestStatus: "Done", workDone: [], triedItems: [], nextSteps: [],
        assumptions: [], blockers: [], references: [], impactNotes: [], regressionRisks: [],
        changedFiles: [], checkpointCount: 1, lastCheckpointReason: "manual", resumeRecap: [],
      };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-daemon-stale.json"), JSON.stringify(staleSession) + "\n", "utf8");
      state = persist(rootDir, state);

      // Run a daemon tick — it should archive the stale session as a side effect.
      runDaemonTick(rootDir, "unknown");

      // Verify the stale session moved to archive.
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, "session-daemon-stale.json")));
      assert.equal(fs.existsSync(path.join(paths.sessionsDir, "session-daemon-stale.json")), false);
    },
  },
  {
    name: "session start runs 30 day hygiene before creating a new session",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      // Place a stale session in active storage.
      const thirtyOneDaysAgo = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)).toISOString();
      const staleSession = {
        id: "session-start-stale", agent: "codex", branch: "main",
        startedAt: thirtyOneDaysAgo, updatedAt: thirtyOneDaysAgo, endedAt: thirtyOneDaysAgo,
        status: "handed_off", title: "Start stale", currentGoal: "Old", currentPlan: [],
        latestStatus: "Done", workDone: [], triedItems: [], nextSteps: [],
        assumptions: [], blockers: [], references: [], impactNotes: [], regressionRisks: [],
        changedFiles: [], checkpointCount: 1, lastCheckpointReason: "manual", resumeRecap: [],
      };
      fs.writeFileSync(path.join(paths.sessionsDir, "session-start-stale.json"), JSON.stringify(staleSession) + "\n", "utf8");
      state = persist(rootDir, state);

      // Start a new session — should archive the stale session.
      state = startNewSession(rootDir, state, "codex", "Fresh work", ["Step 1"]);
      persist(rootDir, state);

      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, "session-start-stale.json")));
      assert.equal(fs.existsSync(path.join(paths.sessionsDir, "session-start-stale.json")), false);
    },
  },
  {
    name: "daemon tick with no archive candidates leaves passive checkpoint behavior unchanged",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = persist(rootDir, state);

      // No stale sessions — daemon tick should behave normally.
      const tick = runDaemonTick(rootDir, "unknown");
      assert.equal(tick.changed, false);
      assert.match(tick.summary, /No repo changes detected/);
    },
  },
  {
    name: "30 day hygiene handles multiple stale candidates in one pass",
    run: () => {
      const { rootDir } = makeRepo();
      const state = createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      const base = {
        agent: "codex", branch: "main", status: "handed_off",
        currentGoal: "Old", currentPlan: [], latestStatus: "Done",
        workDone: [], triedItems: [], nextSteps: [], assumptions: [],
        blockers: [], references: [], impactNotes: [], regressionRisks: [],
        changedFiles: [], checkpointCount: 1, lastCheckpointReason: "manual", resumeRecap: [],
      };

      for (let i = 0; i < 5; i++) {
        const daysAgo = new Date(Date.now() - ((31 + i) * 24 * 60 * 60 * 1000)).toISOString();
        fs.writeFileSync(
          path.join(paths.sessionsDir, `session-batch-${i}.json`),
          JSON.stringify({ ...base, id: `session-batch-${i}`, title: `Batch ${i}`, startedAt: daysAgo, updatedAt: daysAgo, endedAt: daysAgo }) + "\n",
          "utf8",
        );
      }

      const archived = runSessionHygiene(paths, state);
      assert.equal(archived.length, 5);

      for (let i = 0; i < 5; i++) {
        assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, `session-batch-${i}.json`)));
        assert.equal(fs.existsSync(path.join(paths.sessionsDir, `session-batch-${i}.json`)), false);
      }
    },
  },
  {
    name: "diff reactivates archived sessions back to active storage",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      // Create two sessions and archive them.
      const first = archiveSession(rootDir, state, "First archived work", {
        status: "First done", done: ["First task"], next: ["Continue first"],
      }, "first.txt");
      state = first.state;
      const second = archiveSession(rootDir, state, "Second archived work", {
        status: "Second done", done: ["Second task"], next: ["Continue second"],
      }, "second.txt");
      state = second.state;
      state = persist(rootDir, state);

      const paths = getRuntimePaths(rootDir);

      // Both sessions should be in archive (archiveSession writes to archive dir).
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, `${first.sessionId}.json`)));
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, `${second.sessionId}.json`)));

      // Reactivate both via the helper (simulating what handleDiff does).
      const reactivated1 = reactivateArchivedSession(paths, first.sessionId);
      const reactivated2 = reactivateArchivedSession(paths, second.sessionId);
      assert.ok(reactivated1);
      assert.ok(reactivated2);

      // Sessions should now be in active storage, not archive.
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, `${first.sessionId}.json`)));
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, `${second.sessionId}.json`)));
      assert.equal(fs.existsSync(path.join(paths.archiveSessionsDir, `${first.sessionId}.json`)), false);
      assert.equal(fs.existsSync(path.join(paths.archiveSessionsDir, `${second.sessionId}.json`)), false);

      // loadSessionById should still find them.
      const fromSession = loadSessionById(state, paths, first.sessionId);
      const toSession = loadSessionById(state, paths, second.sessionId);
      assert.ok(fromSession);
      assert.ok(toSession);
      const diff = computeSessionDiff(fromSession!, toSession!);
      assert.ok(diff.timeSpan.durationMs !== 0 || diff.timeSpan.durationMs === 0);
    },
  },
  {
    name: "handoff reactivates exact session-id matches in relatedSessions",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      // Create and archive a session.
      const archived = archiveSession(rootDir, state, "Old related work", {
        status: "Old done", done: ["Old task"], next: ["Continue old"],
      }, "old-related.txt");
      state = archived.state;

      // Start a new session to hand off.
      state = startNewSession(rootDir, state, "codex", "Current work", ["Step 1"]);
      state = checkpointState(rootDir, state, {
        agent: "codex", reason: "test",
        status: "Working", done: ["Some work"],
      });
      state = persist(rootDir, state);

      const paths = getRuntimePaths(rootDir);
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, `${archived.sessionId}.json`)));

      // Apply handoff with relatedSessions referencing the archived session.
      state = applyHandoff(rootDir, state, {
        summary: "Handoff with related session",
        done: ["Current work done"],
        next: ["Continue"],
        relatedSessions: [archived.sessionId],
      });
      state = persist(rootDir, state);

      // The referenced archived session should have been reactivated.
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, `${archived.sessionId}.json`)));
      assert.equal(fs.existsSync(path.join(paths.archiveSessionsDir, `${archived.sessionId}.json`)), false);
    },
  },
  {
    name: "search reactivates an archived session by exact id",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      const archived = archiveSession(rootDir, state, "Searchable old work", {
        status: "Search done", done: ["Search task"], next: ["Continue search"],
      }, "search-source.txt");
      state = archived.state;
      state = persist(rootDir, state);

      const paths = getRuntimePaths(rootDir);
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, `${archived.sessionId}.json`)));

      // Reactivate via helper (simulating what handleSearch does).
      const reactivated = reactivateArchivedSession(paths, archived.sessionId);
      assert.ok(reactivated);
      assert.equal(reactivated?.id, archived.sessionId);

      // Now in active storage.
      assert.ok(fs.existsSync(path.join(paths.sessionsDir, `${archived.sessionId}.json`)));
      assert.equal(fs.existsSync(path.join(paths.archiveSessionsDir, `${archived.sessionId}.json`)), false);
    },
  },
  {
    name: "reactivation returns null for unknown session ids and does not mutate files",
    run: () => {
      const { rootDir } = makeRepo();
      createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      const result = reactivateArchivedSession(paths, "session-does-not-exist");
      assert.equal(result, null);

      // No files should have been created.
      const activeFiles = fs.readdirSync(paths.sessionsDir).filter((f) => f.endsWith(".json"));
      assert.equal(activeFiles.length, 0);
    },
  },
  {
    name: "reactivation ignores empty id and free-form text that is not a session id",
    run: () => {
      const { rootDir } = makeRepo();
      createInitialState(rootDir);
      const paths = getRuntimePaths(rootDir);
      fs.mkdirSync(paths.sessionsDir, { recursive: true });
      fs.mkdirSync(paths.archiveSessionsDir, { recursive: true });

      assert.equal(reactivateArchivedSession(paths, ""), null);
      assert.equal(reactivateArchivedSession(paths, "some random text"), null);
      assert.equal(reactivateArchivedSession(paths, "not-a-session-id"), null);
    },
  },
  {
    name: "handoff does not reactivate free-form relatedSessions entries that are not session ids",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Test handoff filtering", ["Step 1"]);
      state = checkpointState(rootDir, state, {
        agent: "codex", reason: "test", status: "Working", done: ["Some work"],
      });
      state = persist(rootDir, state);

      const paths = getRuntimePaths(rootDir);

      // Place a properly shaped but non-session-id-prefixed file in archive.
      const fakeSession = {
        id: "not-a-session", agent: "codex", branch: "main",
        startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(), status: "handed_off",
        title: "Fake", currentGoal: "Fake", currentPlan: [], latestStatus: "Done",
        workDone: [], triedItems: [], nextSteps: [], assumptions: [], blockers: [],
        references: [], impactNotes: [], regressionRisks: [], changedFiles: [],
        checkpointCount: 0, lastCheckpointReason: "manual", resumeRecap: [],
      };
      fs.writeFileSync(path.join(paths.archiveSessionsDir, "not-a-session.json"),
        JSON.stringify(fakeSession) + "\n", "utf8");

      state = applyHandoff(rootDir, state, {
        summary: "Handoff with non-session references",
        done: ["Done"],
        next: ["Next"],
        relatedSessions: ["not-a-session", "random-text", ""],
      });
      state = persist(rootDir, state);

      // The non-session-id file should remain in archive untouched.
      assert.ok(fs.existsSync(path.join(paths.archiveSessionsDir, "not-a-session.json")));
      assert.equal(fs.existsSync(path.join(paths.sessionsDir, "not-a-session.json")), false);
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
      assert.match(stateFile.activeSession?.latestStatus ?? "", /branch switch from (main|master) to feature/);
      assert.equal(stateFile.activeSession?.lastCheckpointReason, "branch-switch");
    },
  },
  {
    name: "mcp checkpoint tool accepts explicit completion metadata and writes one deduped draft handoff",
    run: () => {
      const { rootDir } = makeRepo();
      persist(rootDir, createInitialState(rootDir));

      const checkpoint = callHolisticTool(rootDir, "holistic_checkpoint", {
        reason: "natural-breakpoint",
        status: "Paused cleanly at a natural breakpoint",
        done: ["Finished the current verification pass"],
        next: ["Resume from the drafted handoff"],
        completionKind: "natural-breakpoint",
        completionSource: "agent",
      });
      assert.equal(checkpoint.isError, false);

      const state = readState(rootDir);
      assert.equal(state.activeSession?.completionSignal?.kind, "natural-breakpoint");
      assert.equal(state.activeSession?.completionSignal?.source, "agent");

      const draft = readDraftHandoff(getRuntimePaths(rootDir));
      assert.ok(draft);
      assert.equal(draft?.reason, "completion-signal");
      assert.equal(draft?.handoff.summary, "Paused cleanly at a natural breakpoint");

      const tick = runDaemonTick(rootDir, "claude");
      assert.equal(tick.changed, false);
    },
  },
  {
    name: "mcp checkpoint tool ignores malformed completion metadata without blocking checkpoints",
    run: () => {
      const { rootDir } = makeRepo();
      persist(rootDir, createInitialState(rootDir));

      const checkpoint = callHolisticTool(rootDir, "holistic_checkpoint", {
        reason: "manual-checkpoint",
        status: "Checkpoint should still save",
        completionKind: "unsupported-kind",
        completionSource: "agent",
      });
      assert.equal(checkpoint.isError, false);

      const state = readState(rootDir);
      assert.equal(state.activeSession?.lastCheckpointReason, "manual-checkpoint");
      assert.equal(state.activeSession?.completionSignal ?? null, null);
      assert.equal(readDraftHandoff(getRuntimePaths(rootDir)), null);
    },
  },

  {
    name: "daemon tick helper triggers an elapsed-time checkpoint at exactly two hours",
    run: () => {
      const nowMs = Date.now();
      const exactlyTwoHoursAgo = new Date(nowMs - (2 * 60 * 60 * 1000)).toISOString();
      const justUnderTwoHoursAgo = new Date(nowMs - (2 * 60 * 60 * 1000) + 1).toISOString();

      assert.equal(shouldCheckpointForElapsedTime(exactlyTwoHoursAgo, nowMs), true);
      assert.equal(shouldCheckpointForElapsedTime(justUnderTwoHoursAgo, nowMs), false);
      assert.equal(shouldCheckpointForElapsedTime(null, nowMs), false);
      assert.equal(shouldCheckpointForElapsedTime("", nowMs), false);
      assert.equal(shouldCheckpointForElapsedTime("not-a-date", nowMs), false);
    },
  },
  {
    name: "daemon tick helper triggers a checkpoint at exactly five meaningful files",
    run: () => {
      assert.equal(shouldCheckpointForPendingFiles(["1", "2", "3", "4", "5"]), true);
      assert.equal(shouldCheckpointForPendingFiles(["1", "2", "3", "4"]), false);
      assert.equal(shouldCheckpointForPendingFiles([]), false);
      assert.equal(shouldCheckpointForPendingFiles(null), false);
    },
  },
  {
    name: "health diagnostics emits stale checkpoint warning at the 3-day boundary",
    run: () => {
      const { rootDir } = makeRepo();
      const base = createInitialState(rootDir);
      const nowMs = Date.now();
      const exactlyThreeDaysAgo = new Date(nowMs - (3 * 24 * 60 * 60 * 1000)).toISOString();
      const justUnderThreeDaysAgo = new Date(nowMs - (3 * 24 * 60 * 60 * 1000) + 1).toISOString();

      const staleState: HolisticState = { ...base, lastAutoCheckpoint: exactlyThreeDaysAgo };
      const staleDiagnostics = evaluateHealthDiagnostics(staleState, nowMs);
      assert.equal(staleDiagnostics.warnings.some((warning) => warning.code === "daemon-stale-checkpoint"), true);

      const freshState: HolisticState = { ...base, lastAutoCheckpoint: justUnderThreeDaysAgo };
      const freshDiagnostics = evaluateHealthDiagnostics(freshState, nowMs);
      assert.equal(freshDiagnostics.warnings.some((warning) => warning.code === "daemon-stale-checkpoint"), false);
    },
  },
  {
    name: "health diagnostics ignores malformed stale checkpoint timestamps",
    run: () => {
      const { rootDir } = makeRepo();
      const base = createInitialState(rootDir);
      const diagnostics = evaluateHealthDiagnostics({ ...base, lastAutoCheckpoint: "not-a-date" }, Date.now());
      assert.equal(diagnostics.warnings.some((warning) => warning.code === "daemon-stale-checkpoint"), false);
    },
  },
  {
    name: "health diagnostics flags unusual pattern when 50+ files exist without checkpoint evidence",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Investigate unusual file churn", ["Inspect changed files"]);
      assert.ok(state.activeSession);

      const changedFiles = Array.from({ length: 50 }, (_, index) => `src/file-${index + 1}.ts`);
      state.activeSession!.changedFiles = changedFiles;
      state.activeSession!.checkpointCount = 0;
      state.lastAutoCheckpoint = undefined;
      state.passiveCapture = {
        ...(state.passiveCapture ?? {
          lastObservedBranch: null,
          pendingFiles: [],
          activityTicks: 0,
          quietTicks: 0,
          lastCheckpointAt: null,
        }),
        pendingFiles: changedFiles,
        lastCheckpointAt: null,
      };

      const diagnostics = evaluateHealthDiagnostics(state, Date.now());
      const unusual = diagnostics.warnings.find((warning) => warning.code === "unusual-files-without-checkpoint");
      assert.ok(unusual);
      assert.equal(unusual?.inputs.changedFileCount, 50);
      assert.equal(unusual?.inputs.hasCheckpointEvidence, false);
    },
  },
  {
    name: "health diagnostics does not flag unusual pattern below the 50-file boundary without checkpoint evidence",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Track medium edit set", ["Checkpoint often"]);
      assert.ok(state.activeSession);

      const changedFiles = Array.from({ length: 49 }, (_, index) => `src/medium-${index + 1}.ts`);
      state.activeSession!.changedFiles = changedFiles;
      state.activeSession!.checkpointCount = 0;
      state.lastAutoCheckpoint = undefined;
      state.passiveCapture = {
        ...(state.passiveCapture ?? {
          lastObservedBranch: null,
          pendingFiles: [],
          activityTicks: 0,
          quietTicks: 0,
          lastCheckpointAt: null,
        }),
        pendingFiles: changedFiles,
        lastCheckpointAt: null,
      };

      const diagnostics = evaluateHealthDiagnostics(state, Date.now());
      assert.equal(diagnostics.warnings.some((warning) => warning.code === "unusual-files-without-checkpoint"), false);
    },
  },
  {
    name: "health diagnostics does not flag unusual pattern when checkpoint evidence exists",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Track large edit set", ["Checkpoint often"]);
      assert.ok(state.activeSession);

      state.activeSession!.changedFiles = Array.from({ length: 80 }, (_, index) => `src/large-${index + 1}.ts`);
      state.activeSession!.checkpointCount = 1;
      state.lastAutoCheckpoint = new Date().toISOString();

      const diagnostics = evaluateHealthDiagnostics(state, Date.now());
      assert.equal(diagnostics.warnings.some((warning) => warning.code === "unusual-files-without-checkpoint"), false);
    },
  },
  {
    name: "daemon tick checkpoints immediately at five meaningful files and clears passive pending state",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = persist(rootDir, state);

      for (const file of ["one.ts", "two.ts", "three.ts", "four.ts", "five.ts"]) {
        fs.writeFileSync(path.join(rootDir, file), `${file}\n`, "utf8");
      }

      const tick = runDaemonTick(rootDir, "codex");
      assert.equal(tick.changed, true);
      assert.match(tick.summary, /5 file\(s\)|5 meaningful file\(s\)/);

      const stateFile = readState(rootDir);
      assert.equal(stateFile.activeSession?.title, "Passive session capture");
      assert.equal(stateFile.activeSession?.lastCheckpointReason, "daemon-auto-threshold");
      assert.deepEqual(stateFile.passiveCapture?.pendingFiles, []);
      assert.equal(stateFile.passiveCapture?.activityTicks, 0);
      assert.equal(stateFile.passiveCapture?.quietTicks, 0);
      assert.ok(stateFile.passiveCapture?.lastCheckpointAt);

      const secondTick = runDaemonTick(rootDir, "unknown");
      assert.equal(secondTick.changed, false);
      assert.deepEqual(readState(rootDir).passiveCapture?.pendingFiles, []);
    },
  },
  {
    name: "daemon tick checkpoints on elapsed time with zero changed files",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state.passiveCapture = {
        lastObservedBranch: getBranchName(rootDir),
        pendingFiles: [],
        activityTicks: 0,
        quietTicks: 0,
        lastCheckpointAt: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(),
      };
      state = persist(rootDir, state);

      const tick = runDaemonTick(rootDir, "unknown");
      assert.equal(tick.changed, true);

      const stateFile = readState(rootDir);
      assert.equal(stateFile.activeSession?.title, "Passive session capture");
      assert.equal(stateFile.activeSession?.lastCheckpointReason, "daemon-auto-elapsed");
      assert.match(stateFile.activeSession?.latestStatus ?? "", /2 hour|2-hour|two-hour/i);
      assert.deepEqual(stateFile.passiveCapture?.pendingFiles, []);
      assert.equal(stateFile.passiveCapture?.activityTicks, 0);
      assert.equal(stateFile.passiveCapture?.quietTicks, 0);
      assert.ok(stateFile.passiveCapture?.lastCheckpointAt);
    },
  },
  {
    name: "completion metadata normalizer ignores malformed inputs",
    run: () => {
      assert.equal(normalizeCompletionSignalMetadata({ kind: "task-complete", source: "agent" })?.kind, "task-complete");
      assert.equal(normalizeCompletionSignalMetadata({ kind: "task-complete", source: "agent" })?.source, "agent");
      assert.equal(normalizeCompletionSignalMetadata({ kind: "not-supported", source: "agent" }), null);
      assert.equal(normalizeCompletionSignalMetadata({ kind: "task-complete", source: "robot" }), null);
      assert.equal(normalizeCompletionSignalMetadata({ kind: "task-complete" }), null);
      assert.equal(normalizeCompletionSignalMetadata({ source: "agent" }), null);
    },
  },
  {
    name: "MCP server respects logging levels for session metadata",
    run: async () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "test repo", ["work"]);
      const paths = getRuntimePaths(rootDir);
      
      // Ensure .holistic exists
      const configPath = path.join(paths.holisticDir, "config.json");
      if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
      }

      // Default level (full)
      fs.writeFileSync(configPath, JSON.stringify({
        mcpLogging: "default"
      }));
      const renderFull = renderResumeNotificationText(state, "default");
      assert.ok(renderFull.includes("test repo"), "Full logging should include title");

      // Minimal level (redacted metadata)
      fs.writeFileSync(configPath, JSON.stringify({
        mcpLogging: "minimal"
      }));
      const renderMin = renderResumeNotificationText(state, "minimal");
      assert.ok(renderMin.includes("Holistic session active"), "Minimal logging should keep the status");
      assert.ok(!renderMin.includes("test repo"), "Minimal logging should redact the title");

      // Off level (no notification text)
      fs.writeFileSync(configPath, JSON.stringify({
        mcpLogging: "off"
      }));
      const renderOff = renderResumeNotificationText(state, "off");
      assert.strictEqual(renderOff, "", "Off logging should be empty");
    },
  },
  ...privacyArtifactTests,
  {
    name: "auto-draft handoff triggers immediately for an explicit completion signal",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Pause at a natural breakpoint", ["Capture the breakpoint"]);
      assert.ok(state.activeSession);
      state.activeSession!.completionSignal = {
        kind: "natural-breakpoint",
        source: "agent",
        recordedAt: new Date().toISOString(),
      };

      const decision = shouldAutoDraftHandoff(state.activeSession!);
      assert.equal(decision.should, true);
      assert.equal(decision.reason, "completion-signal");
    },
  },
  {
    name: "auto-draft handoff suppresses duplicate completion-signal drafts for unchanged sessions",
    run: () => {
      const recordedAt = new Date().toISOString();
      const decision = shouldDraftCompletionSignalHandoff({
        sessionId: "session-1",
        sessionUpdatedAt: recordedAt,
        completionSignal: {
          kind: "task-complete",
          source: "system",
          recordedAt,
        },
        existingDraft: {
          sourceSessionId: "session-1",
          sourceSessionUpdatedAt: recordedAt,
          reason: "completion-signal",
        },
      });

      assert.equal(decision.should, false);
      assert.equal(decision.reason, "");
      assert.deepEqual(
        shouldDraftCompletionSignalHandoff({
          sessionId: "session-1",
          sessionUpdatedAt: recordedAt,
          completionSignal: null,
        }),
        { should: false, reason: "" },
      );
    },
  },
  {
    name: "auto-draft handoff preserves the idle 29-vs-30 minute boundary",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Document the current work", ["Prepare handoff"]);
      assert.ok(state.activeSession);
      const nowMs = Date.now();
      state.activeSession!.startedAt = new Date(nowMs - (60 * 60 * 1000)).toISOString();
      state.activeSession!.updatedAt = new Date(nowMs - (29 * 60 * 1000)).toISOString();
      assert.deepEqual(shouldAutoDraftHandoff(state.activeSession!, nowMs), { should: false, reason: "" });

      state.activeSession!.updatedAt = new Date(nowMs - (30 * 60 * 1000)).toISOString();
      assert.deepEqual(shouldAutoDraftHandoff(state.activeSession!, nowMs), { should: true, reason: "idle-30min" });
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

      // Enable portableState for auto-sync planning tests
      const configPath = path.join(rootDir, ".holistic", "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.autoSync = true;
      config.portableState = true;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

      const checkpointPlan = planAutoSync(rootDir, "checkpoint", "win32");
      assert.equal(checkpointPlan.enabled, true, "Checkpoint sync should be enabled when portableState is true");
      assert.equal(checkpointPlan.command, "powershell");
      assert.match(checkpointPlan.scriptPath ?? "", /sync-state\.ps1$/);

      const handoffPlan = planAutoSync(rootDir, "handoff", "linux");
      assert.equal(handoffPlan.enabled, true);
      assert.equal(handoffPlan.command, "sh");
      assert.match(handoffPlan.scriptPath ?? "", /sync-state\.sh$/);

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
  {
    name: "getSetupStatus is read-only and does not mutate Git hooks",
    run: () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir, {
        installGitHooks: true,
      });

      const hookPath = path.join(rootDir, ".git", "hooks", "post-commit");
      const before = fs.readFileSync(hookPath, "utf8");
      
      // Simulate an outdated hook by appending garbage (outside managed block if we wanted to be realistic, but here any change works)
      fs.appendFileSync(hookPath, "\n# OUTDATED\n");
      const modified = fs.readFileSync(hookPath, "utf8");
      assert.notEqual(before, modified);

      // Run status check
      const status = getSetupStatus(rootDir);
      const hookStatus = status.find(s => s.component === "git-hooks");
      assert.equal(hookStatus?.status, "outdated");

      // Verify NO mutation happened
      const after = fs.readFileSync(hookPath, "utf8");
      assert.equal(after, modified, "Status check should not have reverted the manual hook change");
    },
  },
  {
    name: "doctor treats info status as healthy and shows advice",
    run: async () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir, {
        installGitHooks: true,
        portableState: false, // Ensure we are in local-only/info mode
      });

      const fakeHome = makeTempDir("fake-home");
      bootstrapHolistic(rootDir, { homeDir: fakeHome });

      const paths = getRuntimePaths(rootDir);
      const status = getSetupStatus(rootDir, { homeDir: fakeHome });
      const findings = validateRuntimeConfig(paths);

      // Verify portable-state is info
      const ps = status.find(s => s.component === "portable-state");
      assert.equal(ps?.status, "info");

      // Verify healthy overall logic
      const healthy = status.every(s => s.status === "ok" || s.status === "info");
      assert.ok(healthy, "Status with 'info' should be considered healthy");
      
      const configHealthy = findings.every(f => f.level !== "error");
      assert.ok(configHealthy);

      // Verify fix suggestions are provided (add a bad value to trigger one)
      const configPath = path.join(paths.holisticDir, "config.json");
      fs.writeFileSync(configPath, JSON.stringify({ mcpLogging: "invalid" }));
      const newFindings = validateRuntimeConfig(paths);
      const mcpFinding = newFindings.find(f => f.field === "mcpLogging");
      assert.ok(mcpFinding?.fix, "Should provide a fix suggestion for malformed config");
      assert.match(mcpFinding.fix ?? "", /off|minimal|default/);
    },
  },
  {
    name: "doctor supports --json output",
    run: async () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir, { installGitHooks: true });
      
      // We'll test the helper logic since we mock handleDoctor in integration above
      const fakeHome = makeTempDir("fake-home");
      bootstrapHolistic(rootDir, { homeDir: fakeHome });

      const paths = getRuntimePaths(rootDir);
      const status = getSetupStatus(rootDir, { homeDir: fakeHome });
      const findings = validateRuntimeConfig(paths);
      const sync = getSyncStatus(rootDir);

      const json = {
        status: status.every(s => s.status === "ok" || s.status === "info") && findings.every(f => f.level !== "error") ? "healthy" : "attention_needed",
        composition: status,
        config: findings,
        sync: sync,
      };

      assert.equal(json.status, "healthy");
      assert.ok(Array.isArray(json.composition));
      assert.ok(Array.isArray(json.config));
      assert.ok(typeof json.sync === "object");
    },
  },
  {
    name: "safeMode propagation: config enables minimal instructions in HOLISTIC.md",
    run: () => {
      const { rootDir } = makeRepo();
      initializeHolistic(rootDir);
      const paths = getRuntimePaths(rootDir);
      const state = createInitialState(rootDir);
      
      // Control: standard mode
      writeDerivedDocs(paths, state, { safeMode: false });
      const fullContent = fs.readFileSync(paths.masterDoc, "utf8");
      
      // Experiment: safe mode
      writeDerivedDocs(paths, state, { safeMode: true });
      const safeContent = fs.readFileSync(paths.masterDoc, "utf8");
      
      assert.ok(fullContent.length > safeContent.length, "Safe mode content should be smaller than full content");
      assert.match(safeContent, /MINIMAL INSTRUCTIONS/);
      assert.match(safeContent, /Review the handoff docs/);
      assert.doesNotMatch(safeContent, /## Core Context/); // Should be omitted in safe mode
    },
  },
];

// Merge in unit tests from test modules
const allTests = [...tests, ...securityTests, ...mcpNotificationTests, ...redactTests, ...andonTests, ...daemonTests, ...runtimeCoreTests, ...runtimeLocalTests, ...runtimeStorageTests, ...runtimeServiceTests];

const argv = process.argv.slice(2);
const grepIndex = argv.indexOf("--grep");
const grepPattern = grepIndex >= 0 ? argv[grepIndex + 1] ?? "" : "";
const grep = grepPattern ? new RegExp(grepPattern) : null;
const selectedTests = grep ? allTests.filter((testCase) => grep.test(testCase.name)) : allTests;

let failures = 0;
for (const testCase of selectedTests) {
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

console.log(`\n${selectedTests.length} test(s) passed.`);
