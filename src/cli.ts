import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { captureRepoSnapshot, clearPendingCommit, getGitSnapshot, writePendingCommit } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { initializeHolistic } from './core/setup.ts';
import {
  applyHandoff,
  checkpointState,
  completePhase,
  computeSessionDiff,
  continueFromLatest,
  getResumePayload,
  getRuntimePaths,
  loadSessionById,
  loadState,
  saveState,
  setActivePhase,
  startNewSession,
  withStateLock,
} from './core/state.ts';
import type { AgentName, CheckpointInput, HandoffInput, HolisticState, RuntimePaths, SessionDiff, SessionRecord } from './core/types.ts';

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
  holistic init [--install-daemon] [--install-hooks] [--platform win32|darwin|linux] [--interval 30] [--remote origin] [--state-branch holistic/state]
  holistic start [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--continue] [--json]
  holistic resume [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--continue] [--json]
  holistic checkpoint --reason "<reason>" [--goal "<goal>"] [--status "<status>"] [--plan "<step>"]...
  holistic checkpoint --fixed "<bug>" [--fix-files "<file>"] [--fix-risk "<what reintroduces it>"]
  holistic handoff [--summary "<summary>"] [--next "<step>"]...
  holistic start-new --goal "<goal>" [--title "<title>"] [--plan "<step>"]...
  holistic set-phase --phase "<id>" --name "<name>" --goal "<goal>" [--note "<note>"]... [--status "<status>"] [--title "<title>"] [--plan "<step>"]...
  holistic complete-phase [--phase "<id>"] [--name "<name>"] [--goal "<goal>"] [--note "<note>"]... [--next-phase "<id>"] [--next-name "<name>"] [--next-goal "<goal>"] [--next-note "<note>"]... [--status "<status>"] [--title "<title>"] [--plan "<step>"]...
  holistic status
  holistic diff --from "<session-id>" --to "<session-id>" [--format text|json]
  holistic serve
  holistic watch [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--interval 60]

  'holistic start' is an alias for 'holistic resume'.
`);
}

function persistLocked(rootDir: string, state: HolisticState, paths: RuntimePaths): HolisticState {
  writeDerivedDocs(paths, state);
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state, { locked: true });
  return state;
}

function mutateState(rootDir: string, mutator: (state: HolisticState, paths: RuntimePaths) => HolisticState): HolisticState {
  const paths = getRuntimePaths(rootDir);
  return withStateLock(paths, () => {
    const { state, paths: lockedPaths } = loadState(rootDir);
    const nextState = mutator(state, lockedPaths);
    return persistLocked(rootDir, nextState, lockedPaths);
  });
}

function runtimeScript(name: "mcp-server"): { scriptPath: string; useStripTypes: boolean } {
  const currentFile = fileURLToPath(import.meta.url);
  const extension = path.extname(currentFile);
  const runtimeDir = path.dirname(currentFile);
  const useStripTypes = extension === ".ts";

  return {
    scriptPath: path.resolve(runtimeDir, `${name}${useStripTypes ? ".ts" : ".js"}`),
    useStripTypes,
  };
}

async function ask(question: string, fallback = "", rl?: Interface): Promise<string> {
  const shouldClose = !rl;
  const readline = rl || createInterface({ input, output });
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = await readline.question(`${question}${suffix}: `);
  if (shouldClose) {
    readline.close();
  }
  return answer.trim() || fallback;
}

async function promptList(question: string, fallback: string[], rl?: Interface): Promise<string[]> {
  const joined = fallback.join(" | ");
  const answer = await ask(`${question} (separate with |)`, joined, rl);
  return answer
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDurationDays(durationMs: number): string {
  return (durationMs / (1000 * 60 * 60 * 24)).toFixed(1);
}

export function renderDiff(fromSession: SessionRecord, toSession: SessionRecord, diff: SessionDiff): string {
  const lines: string[] = [];
  lines.push("Holistic Session Diff");
  lines.push("");
  lines.push(`FROM: ${fromSession.title} (${fromSession.id})`);
  lines.push(`TO:   ${toSession.title} (${toSession.id})`);
  lines.push(`Time span: ${diff.timeSpan.from} -> ${diff.timeSpan.to} (${formatDurationDays(diff.timeSpan.durationMs)} days)`);

  if (diff.goalChanged) {
    lines.push("");
    lines.push("Goal Changed:");
    lines.push(`  FROM: ${diff.fromGoal}`);
    lines.push(`  TO:   ${diff.toGoal}`);
  }

  if (diff.newWork.length > 0) {
    lines.push("");
    lines.push("New Work:");
    for (const item of diff.newWork) {
      lines.push(`  + ${item}`);
    }
  }

  if (diff.newRegressions.length > 0) {
    lines.push("");
    lines.push("New Regression Risks:");
    for (const item of diff.newRegressions) {
      lines.push(`  + ${item}`);
    }
  }

  if (diff.clearedRegressions.length > 0) {
    lines.push("");
    lines.push("Cleared Regression Risks:");
    for (const item of diff.clearedRegressions) {
      lines.push(`  - ${item}`);
    }
  }

  if (diff.newBlockers.length > 0) {
    lines.push("");
    lines.push("New Blockers:");
    for (const item of diff.newBlockers) {
      lines.push(`  + ${item}`);
    }
  }

  if (diff.clearedBlockers.length > 0) {
    lines.push("");
    lines.push("Cleared Blockers:");
    for (const item of diff.clearedBlockers) {
      lines.push(`  - ${item}`);
    }
  }

  lines.push("");
  lines.push(`File changes: +${diff.fileChanges.new.length} new, -${diff.fileChanges.removed.length} removed`);
  if (diff.fileChanges.new.length > 0) {
    for (const file of diff.fileChanges.new) {
      lines.push(`  + ${file}`);
    }
  }
  if (diff.fileChanges.removed.length > 0) {
    for (const file of diff.fileChanges.removed) {
      lines.push(`  - ${file}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function renderStatus(state: HolisticState): string {
  const lines: string[] = [];
  lines.push("Holistic Status");
  lines.push("");

  if (state.phaseTracker.current) {
    lines.push(`Phase: ${state.phaseTracker.current.id} - ${state.phaseTracker.current.name} (active)`);
    lines.push(`Phase goal: ${state.phaseTracker.current.goal}`);
  } else {
    lines.push("Phase: No active phase recorded.");
  }

  if (state.phaseTracker.completed.length > 0) {
    const completed = state.phaseTracker.completed[0];
    lines.push(`Last completed phase: ${completed.id} - ${completed.name}`);
  }

  if (!state.activeSession) {
    lines.push("No active session.");

    if (state.lastHandoff) {
      lines.push("");
      lines.push(`Last handoff: ${state.lastHandoff.summary}`);
      lines.push(`Next action: ${state.lastHandoff.nextAction}`);
    }

    if (state.pendingWork.length > 0) {
      lines.push("");
      lines.push(`Pending work: ${state.pendingWork.length} item(s)`);
      for (const item of state.pendingWork.slice(0, 3)) {
        lines.push(`  - ${item.title}`);
      }
    }

    return lines.join("\n") + "\n";
  }

  const session = state.activeSession;
  lines.push(`Session: ${session.id}`);
  lines.push(`Title: ${session.title}`);
  lines.push(`Agent: ${session.agent}`);
  lines.push(`Branch: ${session.branch}`);
  lines.push(`Started: ${session.startedAt}`);
  lines.push(`Checkpoints: ${session.checkpointCount}`);
  lines.push("");
  lines.push(`Goal: ${session.currentGoal}`);
  lines.push(`Status: ${session.latestStatus}`);

  if (session.nextSteps.length > 0) {
    lines.push("");
    lines.push("Next steps:");
    for (const step of session.nextSteps) {
      lines.push(`  - ${step}`);
    }
  }

  if (session.blockers.length > 0) {
    lines.push("");
    lines.push("Blockers:");
    for (const blocker of session.blockers) {
      lines.push(`  - ${blocker}`);
    }
  }

  if (session.regressionRisks.length > 0) {
    lines.push("");
    lines.push(`Regression watch: ${session.regressionRisks.length} item(s)`);
  }

  lines.push("");
  lines.push(`Changed files: ${session.changedFiles.length}`);
  return lines.join("\n") + "\n";
}

async function handleInit(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const platformFlag = firstFlag(parsed.flags, "platform", process.platform);
  const platform = platformFlag === "windows" ? "win32" : platformFlag === "macos" ? "darwin" : platformFlag === "linux" ? "linux" : platformFlag;
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const result = initializeHolistic(rootDir, {
    installDaemon: firstFlag(parsed.flags, "install-daemon") === "true",
    installGitHooks: firstFlag(parsed.flags, "install-hooks") === "true",
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

  if (result.gitHooksInstalled) {
    process.stdout.write(`Git hooks installed: ${result.gitHooks.join(", ")}\n`);
  }

  return 0;
}

async function handleResume(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));

  if (firstFlag(parsed.flags, "continue") === "true") {
    const nextState = mutateState(rootDir, (state) => continueFromLatest(rootDir, state, agent));
    const payload = getResumePayload(nextState, agent);
    if (firstFlag(parsed.flags, "json") === "true") {
      printJson(payload);
      return 0;
    }

    process.stdout.write(`Holistic resume\n\n${payload.recap.map((line) => `- ${line}`).join("\n")}\n\nChoices: ${payload.choices.join(", ")}\nAdapter doc: ${payload.adapterDoc}\nRecommended command: ${payload.recommendedCommand}\nLong-term history: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\nZero-touch architecture: ${nextState.docIndex.zeroTouchDoc}\n`);
    return 0;
  }

  const { state } = loadState(rootDir);
  const payload = getResumePayload(state, agent);
  if (firstFlag(parsed.flags, "json") === "true") {
    printJson(payload);
    return 0;
  }

  process.stdout.write(`Holistic resume\n\n${payload.recap.map((line) => `- ${line}`).join("\n")}\n\nChoices: ${payload.choices.join(", ")}\nAdapter doc: ${payload.adapterDoc}\nRecommended command: ${payload.recommendedCommand}\nLong-term history: ${state.docIndex.historyDoc}\nRegression watch: ${state.docIndex.regressionDoc}\nZero-touch architecture: ${state.docIndex.zeroTouchDoc}\n`);
  return 0;
}

async function handleCheckpoint(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const nextState = mutateState(rootDir, (state) => {
    const regressions = listFlag(parsed.flags, "regression");

    // --fixed / --fix-files / --fix-risk sugar: compose a structured known-fix entry
    const fixed = firstFlag(parsed.flags, "fixed");
    if (fixed) {
      const fixFiles = firstFlag(parsed.flags, "fix-files");
      const fixRisk = firstFlag(parsed.flags, "fix-risk");
      let fixEntry = `[FIX] ${fixed}`;
      if (fixFiles) {
        fixEntry += ` | files: ${fixFiles}`;
      }
      if (fixRisk) {
        fixEntry += ` | risk: ${fixRisk}`;
      }
      regressions.push(fixEntry);
    }

    const input: CheckpointInput = {
      agent: asAgent(firstFlag(parsed.flags, "agent", state.activeSession?.agent ?? "unknown")),
      reason: firstFlag(parsed.flags, "reason", fixed ? `fix: ${fixed}` : "manual"),
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
      regressions,
    };
    return checkpointState(rootDir, state, input);
  });

  process.stdout.write(`Checkpoint saved for ${nextState.activeSession?.id ?? "session"}.\nBranch: ${nextState.activeSession?.branch ?? "unknown"}\nChanged files: ${nextState.activeSession?.changedFiles.length ?? 0}\nHistory doc: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\n`);
  return 0;
}

async function handleStartNew(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));
  const rl = createInterface({ input, output });

  try {
    const goal = firstFlag(parsed.flags, "goal") || await ask("New session goal", "Capture the next task", rl);
    const title = firstFlag(parsed.flags, "title");
    const plan = listFlag(parsed.flags, "plan");
    const finalPlan = plan.length > 0 ? plan : await promptList("Initial plan steps", ["Read HOLISTIC.md", "Confirm the next concrete step"], rl);

    const nextState = mutateState(rootDir, (state) => startNewSession(rootDir, state, agent, goal, finalPlan, title));
    process.stdout.write(`Started ${nextState.activeSession?.id} for goal: ${nextState.activeSession?.currentGoal}\n`);
    return 0;
  } finally {
    rl.close();
  }
}

async function handleSetPhase(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const phase = firstFlag(parsed.flags, "phase");
  const name = firstFlag(parsed.flags, "name");
  const goal = firstFlag(parsed.flags, "goal");
  if (!phase || !name || !goal) {
    process.stderr.write("Error: --phase, --name, and --goal are required.\n");
    return 1;
  }

  const nextState = mutateState(rootDir, (state) => setActivePhase(state, {
    phase,
    name,
    goal,
    notes: listFlag(parsed.flags, "note"),
    status: firstFlag(parsed.flags, "status"),
    title: firstFlag(parsed.flags, "title"),
    plan: listFlag(parsed.flags, "plan"),
  }));

  process.stdout.write(`Active phase set to ${nextState.phaseTracker.current?.id} - ${nextState.phaseTracker.current?.name}\n`);
  return 0;
}

async function handleCompletePhase(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const nextState = mutateState(rootDir, (state) => completePhase(state, {
    phase: firstFlag(parsed.flags, "phase"),
    name: firstFlag(parsed.flags, "name"),
    goal: firstFlag(parsed.flags, "goal"),
    notes: listFlag(parsed.flags, "note"),
    nextPhase: firstFlag(parsed.flags, "next-phase"),
    nextName: firstFlag(parsed.flags, "next-name"),
    nextGoal: firstFlag(parsed.flags, "next-goal"),
    nextNotes: listFlag(parsed.flags, "next-note"),
    status: firstFlag(parsed.flags, "status"),
    title: firstFlag(parsed.flags, "title"),
    plan: listFlag(parsed.flags, "plan"),
  }));

  const completed = nextState.phaseTracker.completed[0];
  const current = nextState.phaseTracker.current;
  process.stdout.write(`Completed phase ${completed?.id ?? "unknown"}${current ? ` and activated phase ${current.id}` : ""}.\n`);
  return 0;
}

async function handleHandoff(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const { state } = loadState(rootDir);
  if (!state.activeSession) {
    process.stderr.write("No active session to hand off.\n");
    return 1;
  }

  const rl = createInterface({ input, output });

  try {
    const handoffInput: HandoffInput = {
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

    if (!handoffInput.summary) {
      handoffInput.summary = await ask("Handoff summary", state.activeSession.latestStatus || state.activeSession.currentGoal, rl);
    }
    if (handoffInput.done?.length === 0) {
      handoffInput.done = await promptList("Work completed", state.activeSession.workDone, rl);
    }
    if (handoffInput.tried?.length === 0) {
      handoffInput.tried = await promptList("What was tried", state.activeSession.triedItems, rl);
    }
    if (handoffInput.next?.length === 0) {
      handoffInput.next = await promptList("What should happen next", state.activeSession.nextSteps, rl);
    }
    if (handoffInput.impacts?.length === 0) {
      handoffInput.impacts = await promptList("Overall impact on the project", state.activeSession.impactNotes, rl);
    }
    if (handoffInput.regressions?.length === 0) {
      handoffInput.regressions = await promptList("Regression risks to guard", state.activeSession.regressionRisks, rl);
    }
    if (handoffInput.assumptions?.length === 0) {
      handoffInput.assumptions = await promptList("Important assumptions", state.activeSession.assumptions, rl);
    }
    if (handoffInput.blockers?.length === 0) {
      handoffInput.blockers = await promptList("Known blockers", state.activeSession.blockers, rl);
    }
    if (handoffInput.references?.length === 0) {
      handoffInput.references = await promptList("References and docs", state.activeSession.references, rl);
    }

    const nextState = mutateState(rootDir, (latestState, paths) => {
      const result = applyHandoff(rootDir, latestState, handoffInput);
      if (result.pendingCommit) {
        writePendingCommit(paths, result.pendingCommit.message);
      }
      return result;
    });

    process.stdout.write(`Handoff complete.\nSummary: ${nextState.lastHandoff?.summary ?? "n/a"}\nPending git commit: ${nextState.pendingCommit?.message ?? "none"}\nHistory doc: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\n`);
    return 0;
  } finally {
    rl.close();
  }
}

async function handleStatus(rootDir: string): Promise<number> {
  const { state } = loadState(rootDir);
  process.stdout.write(renderStatus(state));
  return 0;
}

async function handleDiff(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const from = firstFlag(parsed.flags, "from");
  const to = firstFlag(parsed.flags, "to");
  const format = firstFlag(parsed.flags, "format", "text");

  if (!from || !to) {
    process.stderr.write("Error: --from and --to session IDs are required.\n");
    return 1;
  }

  const { state, paths } = loadState(rootDir);
  const fromSession = loadSessionById(state, paths, from);
  const toSession = loadSessionById(state, paths, to);
  if (!fromSession || !toSession) {
    process.stderr.write("Error: One or both sessions could not be found.\n");
    return 1;
  }

  const diff = computeSessionDiff(fromSession, toSession);
  if (format === "json") {
    printJson({
      from: fromSession,
      to: toSession,
      diff,
    });
    return 0;
  }

  process.stdout.write(renderDiff(fromSession, toSession, diff));
  return 0;
}

async function handleServe(rootDir: string): Promise<number> {
  const runtime = runtimeScript("mcp-server");
  const moduleUrl = pathToFileURL(runtime.scriptPath).href;
  const mcpModule = await import(moduleUrl) as { runMcpServer?: (repoRoot: string) => Promise<void> };
  if (typeof mcpModule.runMcpServer !== "function") {
    process.stderr.write("Unable to start Holistic MCP server.\n");
    return 1;
  }

  await mcpModule.runMcpServer(process.env.HOLISTIC_REPO ?? rootDir);
  return 0;
}

async function handleMarkCommit(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const message = firstFlag(parsed.flags, "message", "docs(holistic): handoff");
  const nextState = mutateState(rootDir, (state, paths) => {
    if (state.lastHandoff) {
      state.lastHandoff.committedAt = new Date().toISOString();
    }
    state.pendingCommit = null;
    clearPendingCommit(paths);
    return state;
  });
  process.stdout.write(`Marked handoff commit complete: ${message || nextState.lastHandoff?.summary || "docs(holistic): handoff"}\n`);
  return 0;
}

async function handleWatch(rootDir: string, parsed: ParsedArgs): Promise<number> {
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "60"), 10);
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));
  const { state } = loadState(rootDir);

  let lastFingerprint = JSON.stringify(getGitSnapshot(rootDir, state.repoSnapshot ?? {}).snapshot);
  process.stdout.write(`Watching repo every ${intervalSeconds}s for checkpoint-worthy changes.\n`);

  const timer = setInterval(() => {
    const current = loadState(rootDir).state;
    const snapshot = getGitSnapshot(rootDir, current.repoSnapshot ?? {});
    const fingerprint = JSON.stringify(snapshot.snapshot);
    if (fingerprint === lastFingerprint) {
      return;
    }

    lastFingerprint = fingerprint;
    mutateState(rootDir, (latestState) => {
      const baseState = latestState.activeSession ? latestState : continueFromLatest(rootDir, latestState, agent);
      return checkpointState(rootDir, baseState, {
        agent,
        reason: "watch",
        status: `Auto-checkpoint after repo changes on ${snapshot.branch}.`,
        next: baseState.activeSession?.nextSteps ?? [],
      });
    });
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
    case "start":   // user-friendly alias for resume
    case "resume":
      return handleResume(rootDir, parsed);
    case "checkpoint":
      return handleCheckpoint(rootDir, parsed);
    case "handoff":
      return handleHandoff(rootDir, parsed);
    case "start-new":
      return handleStartNew(rootDir, parsed);
    case "set-phase":
      return handleSetPhase(rootDir, parsed);
    case "complete-phase":
      return handleCompletePhase(rootDir, parsed);
    case "status":
      return handleStatus(rootDir);
    case "diff":
      return handleDiff(rootDir, parsed);
    case "serve":
      return handleServe(rootDir);
    case "watch":
      return handleWatch(rootDir, parsed);
    case "internal-mark-commit":
      return handleMarkCommit(rootDir, parsed);
    default:
      printHelp();
      return 0;
  }
}

const isEntrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isEntrypoint) {
  main().then((code) => {
    process.exit(code);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
