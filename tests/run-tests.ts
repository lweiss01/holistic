import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { captureRepoSnapshot } from "../src/core/git.ts";
import { initializeHolistic } from "../src/core/setup.ts";
import {
  applyHandoff,
  checkpointState,
  continueFromLatest,
  createInitialState,
  getResumePayload,
  getRuntimePaths,
  saveState,
  startNewSession,
} from "../src/core/state.ts";
import { runDaemonTick } from "../src/daemon.ts";
import type { HolisticState } from "../src/core/types.ts";

function makeRepo(): { rootDir: string; state: HolisticState } {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-test-"));
  fs.mkdirSync(path.join(rootDir, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, ".git", "HEAD"), "ref: refs/heads/master\n", "utf8");
  fs.writeFileSync(path.join(rootDir, ".git", "refs", "heads", "master"), "0000000000000000000000000000000000000000\n", "utf8");
  return { rootDir, state: createInitialState(rootDir) };
}

function persist(rootDir: string, state: HolisticState): HolisticState {
  const paths = getRuntimePaths(rootDir);
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state);
  return state;
}

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "init generates zero-touch system artifacts and optional startup hook",
    run: () => {
      const { rootDir } = makeRepo();
      const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-home-"));
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
    name: "checkpoint and resume preserve current objective, next steps, and impact context",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Build the resume flow", ["Read HOLISTIC.md", "Capture checkpoint"]);
      state = persist(rootDir, state);
      state = checkpointState(rootDir, state, {
        agent: "codex",
        reason: "milestone",
        status: "Drafted the state model",
        tried: ["Sketched the session schema"],
        next: ["Implement the handoff command"],
        assumptions: ["One active session per repo"],
        impacts: ["Future agents can reconstruct the active goal quickly"],
        regressions: ["Do not lose the active goal when a new session starts"],
      });
      state = persist(rootDir, state);
      const payload = getResumePayload(state, "claude");
      assert.equal(payload.status, "ready");
      assert.deepEqual(payload.choices, ["continue", "tweak", "start-new"]);
      assert.match(payload.recap.join("\n"), /Build the resume flow/);
      assert.match(payload.recap.join("\n"), /Implement the handoff command/);
      assert.match(payload.recap.join("\n"), /Future agents can reconstruct the active goal quickly/);
      assert.equal(payload.adapterDoc, ".holistic/context/adapters/claude-cowork.md");
    },
  },
  {
    name: "start-new preserves the previous active session as pending work",
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
      state = startNewSession(rootDir, state, "antigravity", "Task two", ["Step two"]);
      state = persist(rootDir, state);
      assert.equal(state.activeSession?.currentGoal, "Task two");
      assert.equal(state.pendingWork.length, 1);
      assert.equal(state.pendingWork[0].title, "Task one");
      assert.equal(state.pendingWork[0].recommendedNextStep, "Finish task one");
    },
  },
  {
    name: "handoff archives the session, redacts secrets, and updates long-term history docs",
    run: () => {
      const { rootDir } = makeRepo();
      let state = createInitialState(rootDir);
      state = startNewSession(rootDir, state, "codex", "Secure the handoff", ["Write docs"]);
      state = persist(rootDir, state);
      state = checkpointState(rootDir, state, {
        reason: "milestone",
        status: "Captured token=supersecret",
        next: ["Use sk-1234567890SECRET"],
        impacts: ["Preserves handoff summaries across agents"],
        regressions: ["Do not expose secrets in committed history"],
      });
      state = persist(rootDir, state);
      state = applyHandoff(rootDir, state, {
        summary: "Stored token=supersecret for later",
        done: ["Created HOLISTIC.md"],
        tried: ["Tested with sk-1234567890SECRET"],
        next: ["Use sk-1234567890SECRET"],
        assumptions: ["api_key=abc12345"],
        impacts: ["Preserves handoff summaries across agents"],
        regressions: ["Do not expose secrets in committed history"],
      });
      state = persist(rootDir, state);
      assert.equal(state.activeSession, null);
      assert.match(state.lastHandoff?.summary ?? "", /\[REDACTED\]/);
      assert.match(state.lastHandoff?.nextAction ?? "", /\[REDACTED_SECRET\]/);
      assert.equal(state.pendingCommit?.message.includes("docs(holistic): handoff session"), true);
      const sessionFiles = fs.readdirSync(path.join(rootDir, ".holistic", "sessions"));
      assert.equal(sessionFiles.length, 1);
      const holisticDoc = fs.readFileSync(path.join(rootDir, "HOLISTIC.md"), "utf8");
      assert.doesNotMatch(holisticDoc, /supersecret/);
      assert.doesNotMatch(holisticDoc, /sk-1234567890SECRET/);
      const historyDoc = fs.readFileSync(path.join(rootDir, ".holistic", "context", "project-history.md"), "utf8");
      const regressionDoc = fs.readFileSync(path.join(rootDir, ".holistic", "context", "regression-watch.md"), "utf8");
      assert.match(historyDoc, /Preserves handoff summaries across agents/);
      assert.match(regressionDoc, /Do not expose secrets in committed history/);
      assert.doesNotMatch(historyDoc, /supersecret/);
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
      const stateFile = JSON.parse(fs.readFileSync(path.join(rootDir, ".holistic", "state.json"), "utf8")) as HolisticState;
      assert.equal(stateFile.activeSession?.title, "Passive session capture");
      assert.match(stateFile.activeSession?.latestStatus ?? "", /captured it automatically in the background/);
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
];

let failures = 0;
for (const testCase of tests) {
  try {
    testCase.run();
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

