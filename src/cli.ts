import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { captureRepoSnapshot, clearPendingCommit, getGitSnapshot, writePendingCommit } from "./core/git.ts";
import { writeDerivedDocs } from "./core/docs.ts";
import { initializeHolistic } from "./core/setup.ts";
import {
  applyHandoff,
  checkpointState,
  continueFromLatest,
  getResumePayload,
  loadState,
  saveState,
  startNewSession,
} from "./core/state.ts";
import type { AgentName, CheckpointInput, HandoffInput } from "./core/types.ts";

interface ParsedArgs {
  command: string;
  flags: Record<string, string[]>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string[]> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const flag = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[flag] = ["true"];
      continue;
    }

    flags[flag] ??= [];
    flags[flag].push(next);
    index += 1;
  }

  return { command, flags };
}

function firstFlag(flags: Record<string, string[]>, name: string, fallback = ""): string {
  return flags[name]?.[0] ?? fallback;
}

function listFlag(flags: Record<string, string[]>, name: string): string[] {
  return flags[name] ?? [];
}

function asAgent(value: string): AgentName {
  const validAgents: AgentName[] = [
    "codex",
    "claude",
    "antigravity",
    "gemini",
    "copilot",
    "cursor",
    "goose",
    "gsd",
  ];
  
  if (validAgents.includes(value as AgentName)) {
    return value as AgentName;
  }
  
  return "unknown";
}

function printJson(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
}

function printHelp(): void {
  process.stdout.write(`Holistic CLI

Usage:
  holistic init [--install-daemon] [--platform win32|darwin|linux] [--interval 30] [--remote origin] [--state-branch holistic/state]
  holistic resume [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--continue] [--json]
  holistic checkpoint --reason "<reason>" [--goal "<goal>"] [--status "<status>"] [--plan "<step>"]...
  holistic handoff [--summary "<summary>"] [--next "<step>"]...
  holistic start-new --goal "<goal>" [--title "<title>"] [--plan "<step>"]...
  holistic watch [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--interval 60]
`);
}

function persist(rootDir: string, state: ReturnType<typeof loadState>["state"], paths: ReturnType<typeof loadState>["paths"]): ReturnType<typeof loadState>["state"] {
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state);
  return state;
}

async function ask(question: string, fallback = ""): Promise<string> {
  const rl = createInterface({ input, output });
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  rl.close();
  return answer.trim() || fallback;
}

async function promptList(question: string, fallback: string[]): Promise<string[]> {
  const joined = fallback.join(" | ");
  const answer = await ask(`${question} (separate with |)`, joined);
  return answer
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function handleInit(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const platformFlag = firstFlag(parsed.flags, "platform", process.platform);
  const platform = platformFlag === "windows" ? "win32" : platformFlag === "macos" ? "darwin" : platformFlag === "linux" ? "linux" : platformFlag;
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const result = initializeHolistic(rootDir, {
    installDaemon: firstFlag(parsed.flags, "install-daemon") === "true",
    platform: platform as NodeJS.Platform,
    intervalSeconds,
    remote: firstFlag(parsed.flags, "remote", "origin"),
    stateBranch: firstFlag(parsed.flags, "state-branch", "holistic/state"),
  });

  process.stdout.write(`Holistic initialized.
System files: ${result.systemDir}
Config: ${result.configFile}
Platform: ${result.platform}
Daemon install: ${result.installed ? `enabled at ${result.startupTarget}` : "not installed"}
`);
  return 0;
}

async function handleResume(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state, paths } = loadState(rootDir);
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));

  let nextState = state;
  if (firstFlag(parsed.flags, "continue") === "true") {
    nextState = continueFromLatest(rootDir, state, agent);
  }

  persist(rootDir, nextState, paths);

  const payload = getResumePayload(nextState, agent);
  if (firstFlag(parsed.flags, "json") === "true") {
    printJson(payload);
    return 0;
  }

  process.stdout.write(`Holistic resume\n\n${payload.recap.map((line) => `- ${line}`).join("\n")}\n\nChoices: ${payload.choices.join(", ")}\nAdapter doc: ${payload.adapterDoc}\nRecommended command: ${payload.recommendedCommand}\nLong-term history: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\nZero-touch architecture: ${nextState.docIndex.zeroTouchDoc}\n`);
  return 0;
}

async function handleCheckpoint(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state, paths } = loadState(rootDir);
  const input: CheckpointInput = {
    agent: asAgent(firstFlag(parsed.flags, "agent", state.activeSession?.agent ?? "unknown")),
    reason: firstFlag(parsed.flags, "reason", "manual"),
    goal: firstFlag(parsed.flags, "goal"),
    title: firstFlag(parsed.flags, "title"),
    status: firstFlag(parsed.flags, "status"),
    plan: listFlag(parsed.flags, "plan"),
    done: listFlag(parsed.flags, "done"),
    tried: listFlag(parsed.flags, "tried"),
    next: listFlag(parsed.flags, "next"),
    assumptions: listFlag(parsed.flags, "assumption"),
    blockers: listFlag(parsed.flags, "blocker"),
    references: listFlag(parsed.flags, "ref"),
    impacts: listFlag(parsed.flags, "impact"),
    regressions: listFlag(parsed.flags, "regression"),
  };

  const nextState = checkpointState(rootDir, state, input);
  persist(rootDir, nextState, paths);

  process.stdout.write(`Checkpoint saved for ${nextState.activeSession?.id ?? "session"}.\nBranch: ${nextState.activeSession?.branch ?? "master"}\nChanged files: ${nextState.activeSession?.changedFiles.length ?? 0}\nHistory doc: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\n`);
  return 0;
}

async function handleStartNew(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state, paths } = loadState(rootDir);
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));
  const goal = firstFlag(parsed.flags, "goal") || await ask("New session goal", "Capture the next task");
  const title = firstFlag(parsed.flags, "title");
  const plan = listFlag(parsed.flags, "plan");
  const finalPlan = plan.length > 0 ? plan : await promptList("Initial plan steps", ["Read HOLISTIC.md", "Confirm the next concrete step"]);

  const nextState = startNewSession(rootDir, state, agent, goal, finalPlan, title);
  persist(rootDir, nextState, paths);

  process.stdout.write(`Started ${nextState.activeSession?.id} for goal: ${nextState.activeSession?.currentGoal}\n`);
  return 0;
}

async function handleHandoff(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state, paths } = loadState(rootDir);
  if (!state.activeSession) {
    process.stderr.write("No active session to hand off.\n");
    return 1;
  }

  const input: HandoffInput = {
    summary: firstFlag(parsed.flags, "summary"),
    done: listFlag(parsed.flags, "done"),
    tried: listFlag(parsed.flags, "tried"),
    next: listFlag(parsed.flags, "next"),
    assumptions: listFlag(parsed.flags, "assumption"),
    blockers: listFlag(parsed.flags, "blocker"),
    references: listFlag(parsed.flags, "ref"),
    impacts: listFlag(parsed.flags, "impact"),
    regressions: listFlag(parsed.flags, "regression"),
    status: firstFlag(parsed.flags, "status"),
  };

  if (!input.summary) {
    input.summary = await ask("Handoff summary", state.activeSession.latestStatus || state.activeSession.currentGoal);
  }
  if (input.done?.length === 0) {
    input.done = await promptList("Work completed", state.activeSession.workDone);
  }
  if (input.tried?.length === 0) {
    input.tried = await promptList("What was tried", state.activeSession.triedItems);
  }
  if (input.next?.length === 0) {
    input.next = await promptList("What should happen next", state.activeSession.nextSteps);
  }
  if (input.impacts?.length === 0) {
    input.impacts = await promptList("Overall impact on the project", state.activeSession.impactNotes);
  }
  if (input.regressions?.length === 0) {
    input.regressions = await promptList("Regression risks to guard", state.activeSession.regressionRisks);
  }
  if (input.assumptions?.length === 0) {
    input.assumptions = await promptList("Important assumptions", state.activeSession.assumptions);
  }
  if (input.blockers?.length === 0) {
    input.blockers = await promptList("Known blockers", state.activeSession.blockers);
  }
  if (input.references?.length === 0) {
    input.references = await promptList("References and docs", state.activeSession.references);
  }

  const nextState = applyHandoff(rootDir, state, input);
  persist(rootDir, nextState, paths);

  if (nextState.pendingCommit) {
    writePendingCommit(paths, nextState.pendingCommit.message);
  }

  process.stdout.write(`Handoff complete.\nSummary: ${nextState.lastHandoff?.summary ?? "n/a"}\nPending git commit: ${nextState.pendingCommit?.message ?? "none"}\nHistory doc: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\n`);
  return 0;
}

async function handleMarkCommit(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state, paths } = loadState(rootDir);
  if (state.lastHandoff) {
    state.lastHandoff.committedAt = new Date().toISOString();
  }
  state.pendingCommit = null;
  clearPendingCommit(paths);
  persist(rootDir, state, paths);
  process.stdout.write(`Marked handoff commit complete: ${firstFlag(parsed.flags, "message", "docs(holistic): handoff")}\n`);
  return 0;
}

async function handleWatch(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "60"), 10);
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));
  const { state, paths } = loadState(rootDir);

  let currentState = state.activeSession ? state : continueFromLatest(rootDir, state, agent);
  persist(rootDir, currentState, paths);

  let lastFingerprint = JSON.stringify(getGitSnapshot(rootDir, currentState.repoSnapshot ?? {}).snapshot);
  process.stdout.write(`Watching repo every ${intervalSeconds}s for checkpoint-worthy changes.\n`);

  const timer = setInterval(() => {
    const snapshot = getGitSnapshot(rootDir, currentState.repoSnapshot ?? {});
    const fingerprint = JSON.stringify(snapshot.snapshot);
    if (fingerprint === lastFingerprint) {
      return;
    }

    lastFingerprint = fingerprint;
    currentState = checkpointState(rootDir, currentState, {
      agent,
      reason: "watch",
      status: `Auto-checkpoint after repo changes on ${snapshot.branch}.`,
      next: currentState.activeSession?.nextSteps ?? [],
    });
    persist(rootDir, currentState, paths);
    process.stdout.write(`Auto-checkpoint saved at ${new Date().toISOString()}.\n`);
  }, intervalSeconds * 1000);

  const stop = () => {
    clearInterval(timer);
    process.stdout.write("Stopped watch mode.\n");
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return await new Promise<number>(() => undefined);
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();

  switch (parsed.command) {
    case "init":
      return handleInit(rootDir, parsed);
    case "resume":
      return handleResume(rootDir, parsed);
    case "checkpoint":
      return handleCheckpoint(rootDir, parsed);
    case "handoff":
      return handleHandoff(rootDir, parsed);
    case "start-new":
      return handleStartNew(rootDir, parsed);
    case "watch":
      return handleWatch(rootDir, parsed);
    case "internal-mark-commit":
      return handleMarkCommit(rootDir, parsed);
    default:
      printHelp();
      return 0;
  }
}

main().then((code) => {
  process.exit(code);
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});


