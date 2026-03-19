import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeDerivedDocs } from "../src/core/docs.ts";
import { captureRepoSnapshot } from "../src/core/git.ts";
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

test("resume payload starts empty and writes visible docs", () => {
  const { rootDir, state } = makeRepo();
  persist(rootDir, state);

  const payload = getResumePayload(state, "codex");
  assert.equal(payload.status, "empty");
  assert.deepEqual(payload.choices, ["start-new"]);
  assert.ok(fs.existsSync(path.join(rootDir, "HOLISTIC.md")));
  assert.ok(fs.existsSync(path.join(rootDir, "AGENTS.md")));
  assert.ok(fs.existsSync(path.join(rootDir, ".holistic", "state.json")));
});

test("checkpoint and resume preserve current objective and next steps", () => {
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
  });
  state = persist(rootDir, state);

  const payload = getResumePayload(state, "claude");
  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.choices, ["continue", "tweak", "start-new"]);
  assert.match(payload.recap.join("\n"), /Build the resume flow/);
  assert.match(payload.recap.join("\n"), /Implement the handoff command/);
  assert.equal(payload.adapterDoc, ".holistic/context/adapters/claude-cowork.md");
});

test("start-new preserves the previous active session as pending work", () => {
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
});

test("handoff archives the session, redacts secrets, and prepares a commit request", () => {
  const { rootDir } = makeRepo();
  let state = createInitialState(rootDir);
  state = startNewSession(rootDir, state, "codex", "Secure the handoff", ["Write docs"]);
  state = persist(rootDir, state);
  state = checkpointState(rootDir, state, {
    reason: "milestone",
    status: "Captured token=supersecret",
    next: ["Use sk-1234567890SECRET"],
  });
  state = persist(rootDir, state);
  state = applyHandoff(rootDir, state, {
    summary: "Stored token=supersecret for later",
    done: ["Created HOLISTIC.md"],
    tried: ["Tested with sk-1234567890SECRET"],
    next: ["Use sk-1234567890SECRET"],
    assumptions: ["api_key=abc12345"],
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
});

test("continueFromLatest restores pending work as the new active session", () => {
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

  assert.equal(state.activeSession?.currentGoal, "Finish task one");
  assert.match(state.activeSession?.latestStatus ?? "", /Half done/);
  assert.equal(state.pendingWork.length, 0);
});
