import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { repoLocalCliCommand } from './core/cli-fallback.ts';
import { captureRepoSnapshot, clearPendingCommit, writePendingCommit } from './core/git.ts';
import { writeDerivedDocs } from './core/docs.ts';
import { bootstrapHolistic, initializeHolistic, refreshHolisticHooks } from './core/setup.ts';
import { printSplash, printSplashError, renderSplash } from './core/splash.ts';
import { requestAutoSync } from './core/sync.ts';
import { runDaemonTick } from './daemon.ts';
import {
  applyHandoff,
  clearDraftHandoff,
  checkpointState,
  computeSessionDiff,
  continueFromLatest,
  draftHandoffFile,
  getResumePayload,
  getRuntimePaths,
  loadSessionById,
  loadState,
  readDraftHandoff,
  saveState,
  startNewSession,
  withStateLock,
} from './core/state.ts';
import type { AgentName, CheckpointInput, DraftHandoff, HandoffInput, HolisticState, RuntimePaths, SessionDiff, SessionRecord } from './core/types.ts';

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

function getVersion(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const packagePath = path.resolve(path.dirname(currentFile), "..", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function printHelp(): void {
  process.stdout.write(`Holistic CLI v${getVersion()}

Usage:
  holistic init [--install-daemon] [--install-hooks] [--platform win32|darwin|linux] [--interval 30] [--remote origin] [--state-ref refs/holistic/state] [--state-branch holistic/state]
  holistic bootstrap [--platform win32|darwin|linux] [--interval 30] [--remote origin] [--state-ref refs/holistic/state] [--state-branch holistic/state] [--install-daemon false] [--install-hooks false] [--configure-mcp false]
  holistic start [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--continue] [--json]
  holistic resume [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--continue] [--json]
  holistic checkpoint --reason "<reason>" [--goal "<goal>"] [--status "<status>"] [--plan "<step>"]...
  holistic checkpoint --fixed "<bug>" [--fix-files "<file>"] [--fix-risk "<what reintroduces it>"]
  holistic handoff [--draft] [--summary "<summary>"] [--next "<step>"]...
  holistic start-new --goal "<goal>" [--title "<title>"] [--plan "<step>"]...
  holistic status
  holistic diff --from "<session-id>" --to "<session-id>" [--format text|json]
  holistic serve
  holistic watch [--agent codex|claude|antigravity|gemini|copilot|cursor|goose|gsd] [--interval 60]

  'holistic start' is an alias for 'holistic resume'.
`);
}

export function renderResumeOutput(body: string): string {
  return `${renderSplash({ message: "loading project recap..." })}${body}`;
}

function reportHookWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    process.stderr.write(`${warning}\n`);
  }
}

function refreshHooksBeforeCommand(rootDir: string): void {
  const hookResult = refreshHolisticHooks(rootDir);
  reportHookWarnings(hookResult.warnings);
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

function pickList(primary: string[] | undefined, fallback: string[] | undefined): string[] {
  return primary && primary.length > 0 ? primary : (fallback ?? []);
}

function pickText(primary: string | undefined, fallback: string | undefined): string {
  return primary && primary.length > 0 ? primary : (fallback ?? "");
}

function draftMatchesSession(draft: DraftHandoff | null, sessionId: string): boolean {
  return Boolean(draft && draft.sourceSessionId === sessionId);
}

export function finalizeDraftHandoffInput(session: SessionRecord, input: HandoffInput): HandoffInput {
  return {
    ...input,
    summary: pickText(input.summary, session.latestStatus || session.currentGoal),
    done: pickList(input.done, session.workDone),
    tried: pickList(input.tried, session.triedItems),
    next: pickList(input.next, session.nextSteps),
    assumptions: pickList(input.assumptions, session.assumptions),
    blockers: pickList(input.blockers, session.blockers),
    references: pickList(input.references, session.references),
    impacts: pickList(input.impacts, session.impactNotes),
    regressions: pickList(input.regressions, session.regressionRisks),
    status: pickText(input.status, session.latestStatus),
  };
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
  // Show splash screen
  printSplash({
    message: "initializing shared memory layer...",
  });

  const platformFlag = firstFlag(parsed.flags, "platform", process.platform);
  const platform = platformFlag === "windows" ? "win32" : platformFlag === "macos" ? "darwin" : platformFlag === "linux" ? "linux" : platformFlag;
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const result = initializeHolistic(rootDir, {
    installDaemon: firstFlag(parsed.flags, "install-daemon") === "true",
    installGitHooks: firstFlag(parsed.flags, "install-hooks") === "true",
    platform: platform as NodeJS.Platform,
    intervalSeconds,
    remote: firstFlag(parsed.flags, "remote", "origin"),
    stateRef: firstFlag(parsed.flags, "state-ref"),
    stateBranch: firstFlag(parsed.flags, "state-branch"),
  });
  reportHookWarnings(result.gitHookWarnings);

  // Show status
  const statusItems: string[] = [];
  statusItems.push("session state restored");
  statusItems.push("project memory loaded");
  if (result.gitHooksInstalled) {
    statusItems.push("git hooks installed");
  }
  if (result.installed) {
    statusItems.push("daemon configured");
  }
  statusItems.push("handoff ready");

  printSplash({
    showStatus: true,
    statusItems,
  });

  const initFallback = repoLocalCliCommand(path.relative(rootDir, path.join(result.systemDir, "..", "context")).replaceAll("\\", "/"), "resume --agent codex");
  process.stdout.write(`System files: ${result.systemDir}
Config: ${result.configFile}
Platform: ${result.platform}
Daemon install: ${result.installed ? `enabled at ${result.startupTarget}` : "not installed"}
CLI fallback: ${result.platform === "win32" ? initFallback.windows : initFallback.posix}
`);

  if (result.gitHooksInstalled) {
    process.stdout.write(`Git hooks installed: ${result.gitHooks.join(", ")}\n`);
  }

  return 0;
}

async function handleBootstrap(rootDir: string, parsed: ParsedArgs): Promise<number> {
  // Show splash screen
  printSplash({
    message: "bootstrapping holistic on this machine...",
  });

  const platformFlag = firstFlag(parsed.flags, "platform", process.platform);
  const platform = platformFlag === "windows" ? "win32" : platformFlag === "macos" ? "darwin" : platformFlag === "linux" ? "linux" : platformFlag;
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "30"), 10);
  const result = bootstrapHolistic(rootDir, {
    installDaemon: firstFlag(parsed.flags, "install-daemon", "true") !== "false",
    installGitHooks: firstFlag(parsed.flags, "install-hooks", "true") !== "false",
    configureMcp: firstFlag(parsed.flags, "configure-mcp", "true") !== "false",
    platform: platform as NodeJS.Platform,
    intervalSeconds,
    remote: firstFlag(parsed.flags, "remote", "origin"),
    stateRef: firstFlag(parsed.flags, "state-ref"),
    stateBranch: firstFlag(parsed.flags, "state-branch"),
  });
  reportHookWarnings(result.gitHookWarnings);

  // Show status
  const statusItems: string[] = [];
  if (result.installed) {
    statusItems.push("daemon installed");
  }
  if (result.gitHooksInstalled) {
    statusItems.push("git hooks installed");
  }
  if (result.mcpConfigured) {
    statusItems.push("Claude Desktop MCP configured");
  }
  statusItems.push("bootstrap complete");

  printSplash({
    showStatus: true,
    statusItems,
  });

  const bootstrapFallback = repoLocalCliCommand(path.relative(rootDir, path.join(result.systemDir, "..", "context")).replaceAll("\\", "/"), "resume --agent codex");
  process.stdout.write(`System files: ${result.systemDir}
Config: ${result.configFile}
Platform: ${result.platform}
Daemon install: ${result.installed ? `enabled at ${result.startupTarget}` : "not installed"}
Git hooks: ${result.gitHooksInstalled ? result.gitHooks.join(", ") : "not installed"}
MCP config: ${result.mcpConfigured ? result.mcpConfigFile : "skipped"}
Checks: ${result.checks.join(", ")}
CLI fallback: ${result.platform === "win32" ? bootstrapFallback.windows : bootstrapFallback.posix}
`);
  return 0;
}

async function handleResume(rootDir: string, parsed: ParsedArgs): Promise<number> {
  refreshHooksBeforeCommand(rootDir);
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));

  if (firstFlag(parsed.flags, "continue") === "true") {
    const nextState = mutateState(rootDir, (state) => continueFromLatest(rootDir, state, agent));
    const payload = getResumePayload(nextState, agent);
    if (firstFlag(parsed.flags, "json") === "true") {
      printJson(payload);
      return 0;
    }

    const fallback = repoLocalCliCommand(nextState.docIndex.contextDir, payload.recommendedCommand);
    process.stdout.write(renderResumeOutput(`Holistic resume\n\n${payload.recap.map((line) => `- ${line}`).join("\n")}\n\nChoices: ${payload.choices.join(", ")}\nAdapter doc: ${payload.adapterDoc}\nRecommended command: ${payload.recommendedCommand}\nCLI fallback if PATH is missing: Windows ${fallback.windows}; macOS/Linux ${fallback.posix}\nLong-term history: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\nZero-touch architecture: ${nextState.docIndex.zeroTouchDoc}\n`));
    return 0;
  }

  const { state } = loadState(rootDir);
  const payload = getResumePayload(state, agent);
  if (firstFlag(parsed.flags, "json") === "true") {
    printJson(payload);
    return 0;
  }

  const fallback = repoLocalCliCommand(state.docIndex.contextDir, payload.recommendedCommand);
  process.stdout.write(renderResumeOutput(`Holistic resume\n\n${payload.recap.map((line) => `- ${line}`).join("\n")}\n\nChoices: ${payload.choices.join(", ")}\nAdapter doc: ${payload.adapterDoc}\nRecommended command: ${payload.recommendedCommand}\nCLI fallback if PATH is missing: Windows ${fallback.windows}; macOS/Linux ${fallback.posix}\nLong-term history: ${state.docIndex.historyDoc}\nRegression watch: ${state.docIndex.regressionDoc}\nZero-touch architecture: ${state.docIndex.zeroTouchDoc}\n`));
  return 0;
}

async function handleCheckpoint(rootDir: string, parsed: ParsedArgs): Promise<number> {
  refreshHooksBeforeCommand(rootDir);
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
  requestAutoSync(rootDir, "checkpoint");
  return 0;
}

async function handleStartNew(rootDir: string, parsed: ParsedArgs): Promise<number> {
  refreshHooksBeforeCommand(rootDir);
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

async function handleHandoff(rootDir: string, parsed: ParsedArgs): Promise<number> {
  refreshHooksBeforeCommand(rootDir);
  const { state, paths } = loadState(rootDir);
  if (!state.activeSession) {
    process.stderr.write("No active session to hand off.\n");
    return 1;
  }

  const requestedDraft = firstFlag(parsed.flags, "draft") === "true";
  const storedDraft = readDraftHandoff(paths);
  const matchingDraft = draftMatchesSession(storedDraft, state.activeSession.id) ? storedDraft : null;
  if (requestedDraft && !matchingDraft) {
    process.stderr.write(`No matching auto-drafted handoff found for ${state.activeSession.id}.\n`);
    return 1;
  }

  const draftInput = matchingDraft?.handoff;
  if (matchingDraft && !requestedDraft) {
    process.stdout.write(`Found auto-drafted handoff (${matchingDraft.reason}) at ${draftHandoffFile(paths)}. Using it as the review baseline.\n`);
  }

  const rl = createInterface({ input, output });

  try {
    const handoffInput: HandoffInput = {
      summary: pickText(firstFlag(parsed.flags, "summary"), draftInput?.summary),
      done: pickList(listFlag(parsed.flags, "done"), draftInput?.done),
      tried: pickList(listFlag(parsed.flags, "tried"), draftInput?.tried),
      next: pickList(listFlag(parsed.flags, "next"), draftInput?.next),
      assumptions: pickList(listFlag(parsed.flags, "assumption"), draftInput?.assumptions),
      blockers: pickList(listFlag(parsed.flags, "blocker"), draftInput?.blockers),
      references: pickList(listFlag(parsed.flags, "ref"), draftInput?.references),
      impacts: pickList(listFlag(parsed.flags, "impact"), draftInput?.impacts),
      regressions: pickList(listFlag(parsed.flags, "regression"), draftInput?.regressions),
      status: pickText(firstFlag(parsed.flags, "status"), draftInput?.status),
    };

    if (requestedDraft) {
      Object.assign(handoffInput, finalizeDraftHandoffInput(state.activeSession, handoffInput));
    } else {
      if (!handoffInput.summary) {
        handoffInput.summary = await ask("Handoff summary", state.activeSession.latestStatus || state.activeSession.currentGoal, rl);
      }
      if (handoffInput.done?.length === 0) {
        handoffInput.done = await promptList("Work completed", draftInput?.done ?? state.activeSession.workDone, rl);
      }
      if (handoffInput.tried?.length === 0) {
        handoffInput.tried = await promptList("What was tried", draftInput?.tried ?? state.activeSession.triedItems, rl);
      }
      if (handoffInput.next?.length === 0) {
        handoffInput.next = await promptList("What should happen next", draftInput?.next ?? state.activeSession.nextSteps, rl);
      }
      if (handoffInput.impacts?.length === 0) {
        handoffInput.impacts = await promptList("Overall impact on the project", draftInput?.impacts ?? state.activeSession.impactNotes, rl);
      }
      if (handoffInput.regressions?.length === 0) {
        handoffInput.regressions = await promptList("Regression risks to guard", draftInput?.regressions ?? state.activeSession.regressionRisks, rl);
      }
      if (handoffInput.assumptions?.length === 0) {
        handoffInput.assumptions = await promptList("Important assumptions", draftInput?.assumptions ?? state.activeSession.assumptions, rl);
      }
      if (handoffInput.blockers?.length === 0) {
        handoffInput.blockers = await promptList("Known blockers", draftInput?.blockers ?? state.activeSession.blockers, rl);
      }
      if (handoffInput.references?.length === 0) {
        handoffInput.references = await promptList("References and docs", draftInput?.references ?? state.activeSession.references, rl);
      }
    }

    const nextState = mutateState(rootDir, (latestState, paths) => {
      const result = applyHandoff(rootDir, latestState, handoffInput);
      if (result.pendingCommit) {
        writePendingCommit(paths, result.pendingCommit.message);
      }
      clearDraftHandoff(paths);
      return result;
    });

    process.stdout.write(`Handoff complete.\nSummary: ${nextState.lastHandoff?.summary ?? "n/a"}\nPending git commit: ${nextState.pendingCommit?.message ?? "none"}\nHistory doc: ${nextState.docIndex.historyDoc}\nRegression watch: ${nextState.docIndex.regressionDoc}\n`);
    requestAutoSync(rootDir, "handoff");
    return 0;
  } finally {
    rl.close();
  }
}

async function handleStatus(rootDir: string): Promise<number> {
  refreshHooksBeforeCommand(rootDir);
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
  refreshHooksBeforeCommand(rootDir);
  printSplashError({
    message: "starting MCP server on stdio...",
  });

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
  refreshHooksBeforeCommand(rootDir);
  const intervalSeconds = Number.parseInt(firstFlag(parsed.flags, "interval", "60"), 10);
  const agent = asAgent(firstFlag(parsed.flags, "agent", "unknown"));
  process.stdout.write(`Watching repo every ${intervalSeconds}s for checkpoint-worthy changes.\n`);

  const timer = setInterval(() => {
    const result = runDaemonTick(rootDir, agent);
    if (result.changed) {
      process.stdout.write(`${new Date().toISOString()} ${result.summary}\n`);
    }
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
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`${getVersion()}\n`);
      return 0;
    case "init":
      return handleInit(rootDir, parsed);
    case "bootstrap":
      return handleBootstrap(rootDir, parsed);
    case "start":   // user-friendly alias for resume
    case "resume":
      return handleResume(rootDir, parsed);
    case "checkpoint":
      return handleCheckpoint(rootDir, parsed);
    case "handoff":
      return handleHandoff(rootDir, parsed);
    case "start-new":
      return handleStartNew(rootDir, parsed);
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
