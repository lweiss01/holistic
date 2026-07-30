import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoLocalCliPaths } from './cli-fallback.ts';
import { agentNameFromAdapterFileName, hasGeneratedMarker, restampGeneratedMarker, writeDerivedDocs } from './docs.ts';
import { captureRepoSnapshot, enumerateGitWorktrees, resolveGitDir } from './git.ts';
import { installGitHooks, refreshGitHooks, getGitHooksStatus, type GitHookInstallResult, type HookCommand } from './git-hooks.ts';
import { getRuntimePaths, isPathInsideDirectory, loadState, saveState } from './state.ts';
import type { AgentName, HolisticState, RuntimePaths } from './types.ts';

const DEFAULT_STATE_REF = "refs/holistic/state";
const DEFAULT_LEGACY_STATE_BRANCH = "holistic/state";
const TEMP_SYNC_BRANCH = "holistic-sync-tmp";
const HOLISTIC_GITATTRIBUTES_BEGIN = "# BEGIN HOLISTIC MANAGED ATTRIBUTES";
const HOLISTIC_GITATTRIBUTES_END = "# END HOLISTIC MANAGED ATTRIBUTES";

export interface InitOptions {
  installDaemon?: boolean;
  installGitHooks?: boolean;
  installGitAttributes?: boolean;
  platform?: NodeJS.Platform;
  homeDir?: string;
  intervalSeconds?: number;
  agent?: AgentName;
  remote?: string;
  stateRef?: string;
  stateBranch?: string;
  portableState?: boolean;
  mcpLogging?: "off" | "minimal" | "default";
  safeMode?: boolean;
}

export interface BootstrapOptions extends InitOptions {
  configureMcp?: boolean;
  installClaudeHooks?: boolean;
}

export interface InitResult {
  installed: boolean;
  gitHooksInstalled: boolean;
  gitHooks: string[];
  gitHookWarnings: string[];
  platform: string;
  startupTarget: string | null;
  systemDir: string;
  configFile: string;
}

export interface BootstrapResult extends InitResult {
  mcpConfigured: boolean;
  mcpConfigFile: string | null;
  checks: string[];
}

export interface SetupComponentStatus {
  component: "git-hooks" | "git-attributes" | "daemon" | "mcp-config" | "system-helpers" | "claude-code-hooks" | "andon-hooks" | "portable-state" | "config-validation" | "session-hygiene" | "state-integrity";
  status: "ok" | "missing" | "outdated" | "error" | "info";
  details: string;
  description: string;
  /** Present on the andon-hooks component: true when PostToolUse hook referencing andon-hook is installed */
  andonHooksInstalled?: boolean;
}

export interface RepairOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  refreshHooks?: boolean;
  installDaemon?: boolean;
  configureMcp?: boolean;
  /**
   * Re-stamp adapter docs that lost their generated marker so they are
   * refreshed from the built-in templates again. Opt-in: a missing marker is
   * indistinguishable from a deliberate customisation, so this must never
   * happen by default.
   */
  refreshAdapters?: boolean;
}

export interface RepairResult extends InitResult {
  mcpConfigured: boolean;
  mcpConfigFile: string | null;
  checks: string[];
  adaptersRefreshed: string[];
  turnHookWarnings: string[];
}

export type McpLoggingMode = "off" | "minimal" | "default";

export interface ConfigFinding {
  level: "info" | "warn" | "error";
  field: string;
  message: string;
  status: "missing" | "malformed" | "unsupported" | "safe-fallback";
  fix?: string;
}

export interface RuntimeConfig {
  remote: string;
  syncTarget: SyncTarget;
  intervalSeconds: number;
  portableState: boolean;
  mcpLogging: McpLoggingMode;
  safeMode: boolean;
}

interface RepoSetupConfigShape {
  syncDefaults?: {
    autoSync?: boolean;
    portableState?: boolean;
    syncOnCheckpoint?: boolean;
    syncOnHandoff?: boolean;
    postHandoffPush?: boolean;
    restoreOnStartup?: boolean;
  };
}

interface SyncTarget {
  ref: string;
  stateRef?: string;
  stateBranch?: string;
  legacySeedBranch?: string | null;
}

function persist(rootDir: string, state: HolisticState, paths: RuntimePaths): HolisticState {
  const config = readExistingRuntimeConfig(paths);
  writeDerivedDocs(paths, state, { safeMode: config.safeMode });
  state.repoSnapshot = captureRepoSnapshot(rootDir);
  saveState(paths, state);
  return state;
}

function projectSlug(rootDir: string): string {
  const base = path.basename(rootDir).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || "holistic-project";
}

function systemDir(paths: RuntimePaths): string {
  return path.join(paths.holisticDir, "system");
}

function configFile(paths: RuntimePaths): string {
  return path.join(paths.holisticDir, "config.json");
}

export function runtimeEntryScript(name: "cli" | "daemon", currentFile = fileURLToPath(import.meta.url)): { scriptPath: string; useStripTypes: boolean } {
  const extension = path.extname(currentFile);
  const runtimeDir = path.dirname(currentFile);
  const useStripTypes = extension === ".ts";
  return {
    scriptPath: path.resolve(runtimeDir, `../${name}${useStripTypes ? ".ts" : ".js"}`),
    useStripTypes,
  };
}

function mcpConfigFile(platform: NodeJS.Platform, homeDir: string): string {
  switch (platform) {
    case "win32":
      return path.join(homeDir, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
    case "darwin":
      return path.join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "linux":
    default:
      return path.join(homeDir, ".config", "Claude", "claude_desktop_config.json");
  }
}

function quotePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

function shellQuote(value: string): string {
  return value.replace(/'/g, `'"'"'`);
}

function readRepoSetupConfig(rootDir: string): RepoSetupConfigShape {
  const configPath = path.join(rootDir, "holistic.repo.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as RepoSetupConfigShape;
  } catch {
    return {};
  }
}

function relativePath(rootDir: string, targetPath: string | null): string | null {
  if (!targetPath) {
    return null;
  }

  return path.relative(rootDir, targetPath).replaceAll("\\", "/");
}

function shouldManageGitAttributes(paths: RuntimePaths): boolean {
  return path.basename(paths.holisticDir) === ".holistic"
    && path.basename(paths.masterDoc) === "HOLISTIC.md"
    && path.basename(paths.agentsDoc) === "AGENTS.md";
}

function renderHolisticGitAttributes(paths: RuntimePaths): string {
  const lines = [
    HOLISTIC_GITATTRIBUTES_BEGIN,
    `${relativePath(paths.rootDir, paths.masterDoc)} text eol=lf`,
    `${relativePath(paths.rootDir, paths.agentsDoc)} text eol=lf`,
  ];

  const rootHistory = relativePath(paths.rootDir, paths.rootHistoryDoc);
  const rootClaude = relativePath(paths.rootDir, paths.rootClaudeDoc);
  const rootGemini = relativePath(paths.rootDir, paths.rootGeminiDoc);
  const holisticDir = relativePath(paths.rootDir, paths.holisticDir);

  if (rootHistory) {
    lines.push(`${rootHistory} text eol=lf`);
  }
  if (rootClaude) {
    lines.push(`${rootClaude} text eol=lf`);
  }
  if (rootGemini) {
    lines.push(`${rootGemini} text eol=lf`);
  }
  const cursorRules = relativePath(paths.rootDir, paths.rootCursorRulesDoc);
  if (cursorRules) {
    lines.push(`${cursorRules} text eol=lf`);
  }
  const windsurfRules = relativePath(paths.rootDir, paths.rootWindsurfRulesDoc);
  if (windsurfRules) {
    lines.push(`${windsurfRules} text eol=lf`);
  }
  const copilotInstructions = relativePath(paths.rootDir, paths.rootCopilotInstructionsDoc);
  if (copilotInstructions) {
    lines.push(`${copilotInstructions} text eol=lf`);
  }
  if (holisticDir) {
    lines.push(`${holisticDir}/**/*.md text eol=lf`);
    lines.push(`${holisticDir}/**/*.json text eol=lf`);
    lines.push(`${holisticDir}/**/*.sh text eol=lf`);
    lines.push(`${holisticDir}/**/*.ps1 text eol=crlf`);
    lines.push(`${holisticDir}/**/*.cmd text eol=crlf`);
  }

  lines.push(HOLISTIC_GITATTRIBUTES_END);
  return lines.join("\n");
}

function writeManagedGitAttributes(rootDir: string, paths: RuntimePaths): void {
  if (!shouldManageGitAttributes(paths)) {
    return;
  }

  const attributesPath = path.join(rootDir, ".gitattributes");
  const managedBlock = renderHolisticGitAttributes(paths);
  const current = fs.existsSync(attributesPath) ? fs.readFileSync(attributesPath, "utf8") : "";
  const pattern = new RegExp(`${HOLISTIC_GITATTRIBUTES_BEGIN}[\\s\\S]*?${HOLISTIC_GITATTRIBUTES_END}\\n?`, "m");

  let next: string;
  if (pattern.test(current)) {
    next = current.replace(pattern, `${managedBlock}\n`);
  } else if (current.trim().length === 0) {
    next = `${managedBlock}\n`;
  } else {
    next = `${current.replace(/\s*$/, "\n\n")}${managedBlock}\n`;
  }

  fs.writeFileSync(attributesPath, next, "utf8");
}

function powerShellStringArray(values: string[]): string {
  return values.map((value) => `'${quotePowerShell(value)}'`).join(", ");
}

function shellPathList(values: string[]): string {
  return values.map((value) => `"${value}"`).join(" ");
}

function isDirectoryTrackedPath(trackedPath: string): boolean {
  return !path.extname(trackedPath);
}

function normalizeStateBranch(value: string): string {
  return value.startsWith("refs/heads/") ? value.slice("refs/heads/".length) : value;
}

function branchToRef(branch: string): string {
  return branch.startsWith("refs/") ? branch : `refs/heads/${branch}`;
}

function resolveSyncTarget(options: Pick<InitOptions, "stateRef" | "stateBranch">): SyncTarget {
  if (options.stateRef) {
    return {
      ref: options.stateRef,
      stateRef: options.stateRef,
      legacySeedBranch: options.stateRef === DEFAULT_STATE_REF ? DEFAULT_LEGACY_STATE_BRANCH : null,
    };
  }

  if (options.stateBranch) {
    const stateBranch = normalizeStateBranch(options.stateBranch);
    return {
      ref: branchToRef(stateBranch),
      stateBranch,
    };
  }

  return {
    ref: DEFAULT_STATE_REF,
    stateRef: DEFAULT_STATE_REF,
    legacySeedBranch: DEFAULT_LEGACY_STATE_BRANCH,
  };
}

function buildPowerShellCopyCommands(rootDir: string, trackedPaths: string[]): string[] {
  return trackedPaths.map((trackedPath) => {
    const source = `Join-Path $root '${quotePowerShell(trackedPath.replaceAll("/", "\\"))}'`;
    const destination = `Join-Path $tmp '${quotePowerShell(trackedPath.replaceAll("/", "\\"))}'`;
    const destinationDir = path.dirname(trackedPath).replaceAll("/", "\\");
    const ensureParent = destinationDir === "."
      ? []
      : [`  New-Item -ItemType Directory -Path (Join-Path $tmp '${quotePowerShell(destinationDir)}') -Force | Out-Null`];

    if (isDirectoryTrackedPath(trackedPath)) {
      return [
        ...ensureParent,
        `  Copy-Item -Path (${source}) -Destination (${destination}) -Recurse -Force`,
      ].join("\n");
    }

    return [
      ...ensureParent,
      `  Copy-Item -Path (${source}) -Destination (${destination}) -Force`,
    ].join("\n");
  });
}

function buildShellCopyCommands(trackedPaths: string[]): string[] {
  const lines: string[] = [];
  for (const trackedPath of trackedPaths) {
    const dirName = path.posix.dirname(trackedPath.replaceAll("\\", "/"));
    if (dirName !== ".") {
      lines.push(`mkdir -p "$TMPDIR/${dirName}"`);
    }
    if (isDirectoryTrackedPath(trackedPath)) {
      lines.push(`cp -R "$ROOT/${trackedPath}" "$TMPDIR/${trackedPath}"`);
    } else {
      lines.push(`cp "$ROOT/${trackedPath}" "$TMPDIR/${trackedPath}"`);
    }
  }
  return lines;
}

function writeConfig(paths: RuntimePaths, options: InitOptions, remote: string, syncTarget: SyncTarget, intervalSeconds: number): void {
  const repoConfig = readRepoSetupConfig(paths.rootDir);
  const syncDefaults = repoConfig.syncDefaults ?? {};
  const syncConfig = {
    strategy: "state-branch",
    remote,
    syncOnCheckpoint: syncDefaults.syncOnCheckpoint ?? true,
    syncOnHandoff: syncDefaults.syncOnHandoff ?? true,
    postHandoffPush: syncDefaults.postHandoffPush ?? true,
    restoreOnStartup: syncDefaults.restoreOnStartup ?? true,
    trackedPaths: paths.trackedPaths,
    ...(syncTarget.stateRef ? { stateRef: syncTarget.stateRef } : {}),
    ...(syncTarget.stateBranch ? { stateBranch: syncTarget.stateBranch } : {}),
  };

  const config = {
    version: 1,
    autoInferSessions: true,
    autoSync: syncDefaults.autoSync ?? true,
    portableState: options.portableState ?? (syncDefaults.portableState ?? false),
    safeMode: options.safeMode ?? false,
    sync: syncConfig,
    mcpLogging: options.mcpLogging ?? "minimal",
    daemon: {
      intervalSeconds,
      agent: "unknown",
    },
  };

  fs.writeFileSync(configFile(paths), JSON.stringify(config, null, 2) + "\n", "utf8");
}

function writeSystemArtifacts(rootDir: string, paths: RuntimePaths, intervalSeconds: number, remote: string, syncTarget: SyncTarget, portableState: boolean): void {
  const sysDir = systemDir(paths);
  fs.mkdirSync(sysDir, { recursive: true });
  const trackedPaths = paths.trackedPaths;
  const nodePath = process.execPath;
  const cliRuntime = runtimeEntryScript("cli");
  const cliPath = cliRuntime.scriptPath;
  const daemonRuntime = runtimeEntryScript("daemon");
  const daemonPath = daemonRuntime.scriptPath;
  const restorePs1Path = path.join(sysDir, "restore-state.ps1");
  const syncPs1Path = path.join(sysDir, "sync-state.ps1");
  const restoreShPath = path.join(sysDir, "restore-state.sh");
  const syncShPath = path.join(sysDir, "sync-state.sh");
  const localCliCmdPath = path.join(sysDir, "holistic.cmd");
  const localCliShPath = path.join(sysDir, "holistic");
  const legacySeedRef = syncTarget.legacySeedBranch ? branchToRef(syncTarget.legacySeedBranch) : "";

  const restorePs1 = [
    "$ErrorActionPreference = 'Stop'",
    "if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) { $PSNativeCommandUseErrorActionPreference = $false }",
    `$root = '${quotePowerShell(rootDir)}'`,
    `$remote = '${quotePowerShell(remote)}'`,
    `$stateRef = '${quotePowerShell(syncTarget.ref)}'`,
    `$legacySeedRef = '${quotePowerShell(legacySeedRef)}'`,
    `$tracked = @(${powerShellStringArray(trackedPaths)})`,
    "$log = Join-Path $PSScriptRoot 'sync.log'",
    "function Log($msg) { \"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [RESTORE] $msg\" | Out-File -FilePath $log -Append }",
    "",
    ...(portableState ? [] : [
      "Write-Host 'Holistic restore skipped: portableState is disabled (Privacy Mode).'",
      "exit 0",
      ""
    ]),
    "$status = git -C $root status --porcelain -- $tracked 2>$null",
    "if ($LASTEXITCODE -ne 0) { exit 0 }",
    "if ($status) { Write-Host 'Holistic restore skipped because local Holistic files are dirty.'; exit 0 }",
    "$restored = $false",
    "try {",
    "  git -C $root fetch --quiet $remote $stateRef 2>> $log",
    "  if ($LASTEXITCODE -eq 0) {",
    "    git -C $root checkout FETCH_HEAD -- $tracked 2>> $log | Out-Null",
    "    $restored = $true",
    "    Log \"Successfully restored state from $stateRef\"",
    "  }",
    "} catch {",
    "  $restored = $false",
    "  Log \"Failed to restore from $stateRef: $_\"",
    "}",
    "if (-not $restored -and $legacySeedRef) {",
    "  try {",
    "    git -C $root fetch --quiet $remote $legacySeedRef *> $null",
    "    if ($LASTEXITCODE -eq 0) {",
    "      git -C $root checkout FETCH_HEAD -- $tracked 2>$null | Out-Null",
    "      $restored = $true",
    "    }",
    "  } catch {",
    "    $restored = $false",
    "  }",
    "}",
    "if (-not $restored) { Write-Host 'Holistic restore skipped because remote portable state is unavailable.'; exit 0 }",
  ].join("\n");

  const syncPs1 = [
    "$ErrorActionPreference = 'Stop'",
    "if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) { $PSNativeCommandUseErrorActionPreference = $false }",
    "$log = Join-Path $PSScriptRoot 'sync.log'",
    "function Log($msg) { \"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SYNC] $msg\" | Out-File -FilePath $log -Append }",
    "$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)",
    "",
    ...(portableState ? [] : [
      "Write-Host 'Holistic sync skipped: portableState is disabled (Privacy Mode).'",
      "exit 0",
      ""
    ]),
    "if (-not (Test-Path \"$root\\.git\")) {",
    "  Write-Error \"holistic sync-state: ERROR: Could not find .git directory in resolved ROOT: $root\"",
    "  exit 1",
    "}",
    `$remote = '${quotePowerShell(remote)}'`,
    `$stateRef = '${quotePowerShell(syncTarget.ref)}'`,
    `$legacySeedRef = '${quotePowerShell(legacySeedRef)}'`,
    "if (-not $remote) { Write-Error 'holistic sync-state: ERROR: no remote configured. Re-run holistic init --remote <remote>.'; exit 1 }",
    "$tmp = Join-Path $env:TEMP ('holistic-state-' + [guid]::NewGuid().ToString())",
    "git -c core.hooksPath=NUL -C $root worktree add --force $tmp | Out-Null",
    "try {",
    "  Push-Location $tmp",
    "  $remoteStateExists = $false",
    "  $remoteLegacyExists = $false",
    "  try {",
    "    git -c core.hooksPath=NUL ls-remote --quiet --exit-code $remote $stateRef *> $null",
    "    $remoteStateExists = ($LASTEXITCODE -eq 0)",
    "  } catch {",
    "    $remoteStateExists = $false",
    "  }",
    "  if (-not $remoteStateExists -and $legacySeedRef) {",
    "    try {",
    "      git -c core.hooksPath=NUL ls-remote --quiet --exit-code $remote $legacySeedRef *> $null",
    "      $remoteLegacyExists = ($LASTEXITCODE -eq 0)",
    "    } catch {",
    "      $remoteLegacyExists = $false",
    "    }",
    "  }",
    "  if ($remoteStateExists) {",
    "    git -c core.hooksPath=NUL fetch --quiet $remote $stateRef *> $null",
    "    git -c core.hooksPath=NUL switch --detach FETCH_HEAD | Out-Null",
    "  } elseif ($remoteLegacyExists) {",
    "    git -c core.hooksPath=NUL fetch --quiet $remote $legacySeedRef *> $null",
    "    git -c core.hooksPath=NUL switch --detach FETCH_HEAD | Out-Null",
    "  } else {",
    `    git -c core.hooksPath=NUL switch --orphan ${TEMP_SYNC_BRANCH} | Out-Null`,
    "  }",
    "  Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue",
    ...buildPowerShellCopyCommands(rootDir, trackedPaths),
    `  git -c core.hooksPath=NUL add ${trackedPaths.map((trackedPath) => `'${quotePowerShell(trackedPath)}'`).join(" ")}`,
    "  git -c core.hooksPath=NUL diff --cached --quiet",
    "  if ($LASTEXITCODE -ne 0) {",
    "    git -c core.hooksPath=NUL commit -m 'chore(holistic): sync portable state' 2>> $log | Out-Null",
    "    Log 'Created new sync commit'",
    "  }",
    "  git -c core.hooksPath=NUL push $remote HEAD:$stateRef 2>> $log",
    "  Log \"Successfully pushed state to $remote ($stateRef)\"",
    "} catch {",
    "  Log \"Sync failed: $_\"",
    "  throw $_",
    "} finally {",
    "  Pop-Location",
    "  git -c core.hooksPath=NUL -C $root worktree remove --force $tmp | Out-Null",
    "}",
  ].join("\n");

  const restoreSh = [
    "#!/usr/bin/env sh",
    `ROOT='${shellQuote(rootDir)}'`,
    `REMOTE='${shellQuote(remote)}'`,
    `STATE_REF='${shellQuote(syncTarget.ref)}'`,
    `LEGACY_SEED_REF='${shellQuote(legacySeedRef)}'`,
    `LOG_FILE="$(dirname "$0")/sync.log"`,
    "log_msg() { echo \"$(date '+%Y-%m-%d %H:%M:%S') [RESTORE] $1\" >> \"$LOG_FILE\"; }",
    "",
    ...(portableState ? [] : [
      "echo 'Holistic restore skipped: portableState is disabled (Privacy Mode).'",
      "exit 0",
      ""
    ]),
    `if ! git -C "$ROOT" diff --quiet -- ${shellPathList(trackedPaths)} 2>/dev/null; then`,
    "  echo 'Holistic restore skipped because local Holistic files are dirty.'",
    "  exit 0",
    "fi",
    "RESTORED=false",
    "if git -C \"$ROOT\" fetch \"$REMOTE\" \"$STATE_REF\" >> \"$LOG_FILE\" 2>&1; then",
    "  if git -C \"$ROOT\" checkout FETCH_HEAD -- ${shellPathList(trackedPaths)} >> \"$LOG_FILE\" 2>&1; then",
    "    RESTORED=true",
    "    log_msg \"Successfully restored state from $STATE_REF\"",
    "  fi",
    "fi",
    "if [ \"$RESTORED\" != \"true\" ] && [ -n \"$LEGACY_SEED_REF\" ]; then",
    "  if git -C \"$ROOT\" fetch \"$REMOTE\" \"$LEGACY_SEED_REF\" >/dev/null 2>&1; then",
    `    git -C "$ROOT" checkout FETCH_HEAD -- ${shellPathList(trackedPaths)} >/dev/null 2>&1 || true`,
    "    RESTORED=true",
    "  fi",
    "fi",
    "if [ \"$RESTORED\" != \"true\" ]; then",
    "  echo 'Holistic restore skipped because remote portable state is unavailable.'",
    "  exit 0",
    "fi",
  ].join("\n");

  const syncSh = [
    "#!/usr/bin/env sh",
    "SCRIPT_DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"",
    "ROOT=\"$(cd \"$SCRIPT_DIR/../..\" && pwd)\"",
    "",
    ...(portableState ? [] : [
      "echo 'Holistic sync skipped: portableState is disabled (Privacy Mode).'",
      "exit 0",
      ""
    ]),
    "if [ ! -d \"$ROOT/.git\" ]; then",
    "  echo 'holistic sync-state: ERROR: Could not find .git directory in resolved ROOT.' >&2",
    "  echo \"Resolved ROOT: $ROOT\" >&2",
    "  exit 1",
    "fi",
    `REMOTE='${shellQuote(remote)}'`,
    `STATE_REF='${shellQuote(syncTarget.ref)}'`,
    `LEGACY_SEED_REF='${shellQuote(legacySeedRef)}'`,
    `LOG_FILE=\"$SCRIPT_DIR/sync.log\"`,
    "log_msg() { echo \"$(date '+%Y-%m-%d %H:%M:%S') [SYNC] $1\" >> \"$LOG_FILE\"; }",
    "if [ -z \"$REMOTE\" ]; then echo 'holistic sync-state: ERROR: no remote configured. Re-run holistic init --remote <remote>.' >&2; exit 1; fi",
    "TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t holistic-state)",
    "git -c core.hooksPath=/dev/null -C \"$ROOT\" worktree add --force \"$TMPDIR\" >/dev/null 2>&1 || exit 1",
    "cleanup() { git -c core.hooksPath=/dev/null -C \"$ROOT\" worktree remove --force \"$TMPDIR\" >/dev/null 2>&1; }",
    "trap cleanup EXIT",
    "cd \"$TMPDIR\" || exit 1",
    "REMOTE_STATE_EXISTS=false",
    "REMOTE_LEGACY_EXISTS=false",
    "if git -c core.hooksPath=/dev/null ls-remote --quiet --exit-code \"$REMOTE\" \"$STATE_REF\" >/dev/null 2>&1; then",
    "  REMOTE_STATE_EXISTS=true",
    "fi",
    "if [ \"$REMOTE_STATE_EXISTS\" != \"true\" ] && [ -n \"$LEGACY_SEED_REF\" ]; then",
    "  if git -c core.hooksPath=/dev/null ls-remote --quiet --exit-code \"$REMOTE\" \"$LEGACY_SEED_REF\" >/dev/null 2>&1; then",
    "    REMOTE_LEGACY_EXISTS=true",
    "  fi",
    "fi",
    "if [ \"$REMOTE_STATE_EXISTS\" = \"true\" ]; then",
    "  git -c core.hooksPath=/dev/null fetch --quiet \"$REMOTE\" \"$STATE_REF\" >> \"$LOG_FILE\" 2>&1 || exit 1",
    "  git -c core.hooksPath=/dev/null switch --detach FETCH_HEAD >> \"$LOG_FILE\" 2>&1 || exit 1",
    "elif [ \"$REMOTE_LEGACY_EXISTS\" = \"true\" ]; then",
    "  git -c core.hooksPath=/dev/null fetch --quiet \"$REMOTE\" \"$LEGACY_SEED_REF\" >> \"$LOG_FILE\" 2>&1 || exit 1",
    "  git -c core.hooksPath=/dev/null switch --detach FETCH_HEAD >> \"$LOG_FILE\" 2>&1 || exit 1",
    "else",
    `  git -c core.hooksPath=/dev/null switch --orphan "${TEMP_SYNC_BRANCH}" >> "$LOG_FILE" 2>&1 || exit 1`,
    "fi",
    "find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +",
    ...buildShellCopyCommands(trackedPaths),
    `git -c core.hooksPath=/dev/null add ${trackedPaths.map((trackedPath) => `"${trackedPath}"`).join(" ")}`,
    "if ! git -c core.hooksPath=/dev/null diff --cached --quiet; then",
    "  git -c core.hooksPath=/dev/null commit -m 'chore(holistic): sync portable state' >> \"$LOG_FILE\" 2>&1",
    "  log_msg \"Created new sync commit\"",
    "fi",
    "git -c core.hooksPath=/dev/null push \"$REMOTE\" HEAD:\"$STATE_REF\" >> \"$LOG_FILE\" 2>&1",
    "log_msg \"Successfully pushed state to $REMOTE ($STATE_REF)\"",
  ].join("\n");

  const runPs1 = [
    "$ErrorActionPreference = 'Stop'",
    `$node = '${quotePowerShell(nodePath)}'`,
    `$daemon = '${quotePowerShell(daemonPath)}'`,
    `$working = '${quotePowerShell(rootDir)}'`,
    `& '${quotePowerShell(restorePs1Path)}'`,
    `& $node ${daemonRuntime.useStripTypes ? "--experimental-strip-types " : ""}$daemon --interval ${intervalSeconds}`,
  ].join("\n");

  const runSh = [
    "#!/usr/bin/env sh",
    `cd '${shellQuote(rootDir)}' || exit 1`,
    `'${shellQuote(restoreShPath)}' || true`,
    `'${shellQuote(nodePath)}' ${daemonRuntime.useStripTypes ? "--experimental-strip-types " : ""}'${shellQuote(daemonPath)}' --interval ${intervalSeconds}`,
  ].join("\n");

  const localCliCmd = [
    "@echo off",
    `\"${nodePath}\" ${cliRuntime.useStripTypes ? "--experimental-strip-types " : ""}\"${cliPath}\" %*`,
  ].join("\r\n");

  const localCliSh = [
    "#!/usr/bin/env sh",
    `exec '${shellQuote(nodePath)}' ${cliRuntime.useStripTypes ? "--experimental-strip-types " : ""}'${shellQuote(cliPath)}' "$@"`,
  ].join("\n");

  const cliFallback = repoLocalCliPaths(relativePath(rootDir, paths.contextDir) ?? ".holistic/context");

  const readme = `# Holistic System Setup

This directory contains generated startup and sync helpers for Holistic.

Files:
- holistic / holistic.cmd: repo-local CLI fallback when \`holistic\` is not on PATH
- run-daemon.ps1 / run-daemon.sh: restore the portable state, then start the background daemon
- restore-state.ps1 / restore-state.sh: pull the portable Holistic state ref into the current worktree when safe
- sync-state.ps1 / sync-state.sh: mirror Holistic files into the portable state ref without pushing the working branch
- config in ../config.json defines the remote and portable state target

If the global \`holistic\` command is unavailable in this shell:
- Windows: \`${cliFallback.windows}\`
- macOS/Linux: \`${cliFallback.posix}\`
`;

  const autoCheckpointShPath = path.join(sysDir, "auto-checkpoint.sh");
  const autoCheckpointPs1Path = path.join(sysDir, "auto-checkpoint.ps1");
  // The generated scripts run with the repo as cwd, so they need the runtime
  // directory NAME rather than an absolute path.
  const runtimeDirName = path.basename(paths.holisticDir);

  const autoCheckpointSh = [
    "#!/bin/sh",
    "# HOLISTIC-MANAGED auto-checkpoint debounce script",
    // Embed the repo's configured runtime directory. Assuming ".holistic"
    // silently disabled auto-checkpoint in repos using ".holistic-local".
    `STATE_FILE="$PWD/${runtimeDirName}/state.json"`,
    `HOLISTIC_CMD="$PWD/${runtimeDirName}/system/holistic"`,
    "THRESHOLD=900  # 15 minutes in seconds",
    "",
    `if [ ! -f "$STATE_FILE" ]; then exit 0; fi`,
    "",
    `LAST=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('$STATE_FILE','utf8'));process.stdout.write(s.lastAutoCheckpoint||'')}catch(e){}")`,
    `if [ -z "$LAST" ]; then`,
    `  "$HOLISTIC_CMD" checkpoint --reason "auto periodic snapshot" 2>/dev/null || true`,
    "  exit 0",
    "fi",
    "",
    "NOW=$(date +%s)",
    `LAST_S=$(node -e "process.stdout.write(String(Math.floor(new Date('$LAST').getTime()/1000)))")`,
    "DIFF=$((NOW - LAST_S))",
    `if [ "$DIFF" -ge "$THRESHOLD" ]; then`,
    `  "$HOLISTIC_CMD" checkpoint --reason "auto periodic snapshot" 2>/dev/null || true`,
    "fi",
  ].join("\n");

  const autoCheckpointPs1 = [
    "# HOLISTIC-MANAGED auto-checkpoint debounce script",
    `$stateFile = Join-Path $PWD "${runtimeDirName}\\state.json"`,
    `$holisticCmd = Join-Path $PWD "${runtimeDirName}\\system\\holistic.cmd"`,
    "$threshold = 900",
    "",
    "if (-not (Test-Path $stateFile)) { exit 0 }",
    "",
    "$state = Get-Content $stateFile -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue",
    "$last = $state.lastAutoCheckpoint",
    "if (-not $last) {",
    `    & $holisticCmd checkpoint --reason "auto periodic snapshot" 2>$null`,
    "    exit 0",
    "}",
    "",
    "$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()",
    "$lastS = [DateTimeOffset]::Parse($last).ToUnixTimeSeconds()",
    "$diff = $now - $lastS",
    "if ($diff -ge $threshold) {",
    `    & $holisticCmd checkpoint --reason "auto periodic snapshot" 2>$null`,
    "}",
  ].join("\n");

  fs.writeFileSync(localCliCmdPath, localCliCmd + "\r\n", "utf8");
  fs.writeFileSync(localCliShPath, localCliSh + "\n", "utf8");
  fs.chmodSync(localCliShPath, 0o755);
  fs.writeFileSync(path.join(sysDir, "run-daemon.ps1"), runPs1 + "\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "run-daemon.sh"), runSh + "\n", "utf8");
  fs.writeFileSync(restorePs1Path, restorePs1 + "\n", "utf8");
  fs.writeFileSync(syncPs1Path, syncPs1 + "\n", "utf8");
  fs.writeFileSync(restoreShPath, restoreSh + "\n", "utf8");
  fs.writeFileSync(syncShPath, syncSh + "\n", "utf8");
  fs.writeFileSync(autoCheckpointShPath, autoCheckpointSh + "\n", "utf8");
  fs.chmodSync(autoCheckpointShPath, 0o755);
  fs.writeFileSync(autoCheckpointPs1Path, autoCheckpointPs1 + "\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "README.md"), readme, "utf8");
  writeAndonHookScripts(paths);
}

function installWindowsStartup(rootDir: string, paths: RuntimePaths, homeDir: string): string {
  const startupDir = path.join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  fs.mkdirSync(startupDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(startupDir, `holistic-${slug}.cmd`);
  const psScript = path.join(systemDir(paths), "run-daemon.ps1");
  const content = [
    "@echo off",
    `powershell -NoProfile -ExecutionPolicy RemoteSigned -File \"${psScript}\"`,
  ].join("\r\n");
  fs.writeFileSync(target, content + "\r\n", "utf8");
  return target;
}

function installMacosLaunchAgent(rootDir: string, paths: RuntimePaths, homeDir: string): string {
  const launchAgentsDir = path.join(homeDir, "Library", "LaunchAgents");
  fs.mkdirSync(launchAgentsDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(launchAgentsDir, `com.holistic.${slug}.plist`);
  const runScript = path.join(systemDir(paths), "run-daemon.sh");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.holistic.${slug}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/sh</string>
      <string>${runScript}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>${rootDir}</string>
  </dict>
</plist>
`;
  fs.writeFileSync(target, plist, "utf8");
  return target;
}

function installLinuxUserService(rootDir: string, paths: RuntimePaths, homeDir: string): string {
  const userSystemdDir = path.join(homeDir, ".config", "systemd", "user");
  const wantsDir = path.join(userSystemdDir, "default.target.wants");
  fs.mkdirSync(userSystemdDir, { recursive: true });
  fs.mkdirSync(wantsDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(userSystemdDir, `holistic-${slug}.service`);
  const runScript = path.join(systemDir(paths), "run-daemon.sh");
  const service = `[Unit]
Description=Holistic daemon for ${slug}
After=default.target

[Service]
Type=simple
WorkingDirectory=${rootDir}
ExecStart=/bin/sh ${runScript}
Restart=always
RestartSec=15

[Install]
WantedBy=default.target
`;
  fs.writeFileSync(target, service, "utf8");
  const linkTarget = path.join(wantsDir, path.basename(target));
  try {
    if (fs.existsSync(linkTarget)) {
      fs.unlinkSync(linkTarget);
    }
    fs.symlinkSync(target, linkTarget);
  } catch {
    fs.copyFileSync(target, linkTarget);
  }
  return target;
}

/**
 * Path to the repo-local CLI wrapper, resolved from the repo's configured
 * runtime directory rather than assuming ".holistic".
 *
 * Hardcoding the directory here installed a SessionStart hook pointing at
 * ".holistic/system" in repos that actually use ".holistic-local", so the hook
 * ran a stale copy that repair no longer regenerates, or nothing at all.
 */
function holisticCmdForPlatform(repoRoot: string, platform: NodeJS.Platform): string {
  const sysDir = systemDir(getRuntimePaths(repoRoot));
  if (platform === "win32") {
    return path.join(sysDir, "holistic.cmd");
  }
  return path.join(sysDir, "holistic");
}

interface ClaudeSessionStartHook {
  type: string;
  command: string;
}

interface ClaudeHookGroup {
  hooks: ClaudeSessionStartHook[];
}

interface ClaudeHooksBlock {
  SessionStart?: ClaudeHookGroup[];
  UserPromptSubmit?: ClaudeHookGroup[];
  PostToolUse?: ClaudeHookGroup[];
  Stop?: ClaudeHookGroup[];
  [key: string]: unknown;
}

function isHolisticCommand(command: string): boolean {
  return /\bholistic(?:\.cmd)?\b/.test(command);
}

function isAutoCheckpointCommand(command: string): boolean {
  return /\bauto-checkpoint\b/.test(command);
}

function autoCheckpointCommand(repoRoot: string, platform: NodeJS.Platform): string {
  // Same reasoning as holisticCmdForPlatform: resolve the configured runtime
  // directory instead of assuming ".holistic".
  const sysDir = systemDir(getRuntimePaths(repoRoot));
  if (platform === "win32") {
    const scriptPath = path.join(sysDir, "auto-checkpoint.ps1");
    return `powershell -NoProfile -ExecutionPolicy RemoteSigned -File "${scriptPath}"`;
  }
  const scriptPath = path.join(sysDir, "auto-checkpoint.sh");
  return `sh "${scriptPath}"`;
}

function isAndonHookCommand(command: string): boolean {
  return command.includes("andon-hook") && !command.includes("andon-turn-hook");
}

function isAndonTurnHookCommand(command: string): boolean {
  return command.includes("andon-turn-hook");
}

function andonHookCommand(paths: RuntimePaths, platform: NodeJS.Platform): string {
  const sysDir = systemDir(paths);
  if (platform === "win32") {
    const scriptPath = path.join(sysDir, "andon-hook.ps1");
    return `powershell -NoProfile -ExecutionPolicy RemoteSigned -File "${scriptPath}"`;
  }
  const scriptPath = path.join(sysDir, "andon-hook.sh");
  return `sh "${scriptPath}"`;
}

/**
 * The agent argument is what makes a turn signal attributable. It is resolved
 * from the adapter file name at install time, so nothing in the hook script or
 * the writer branches on agent name -- the identity travels as data.
 */
function andonTurnHookCommand(paths: RuntimePaths, platform: NodeJS.Platform, agent?: string): string {
  const sysDir = systemDir(paths);
  const slug = (agent ?? "").replace(/[^A-Za-z0-9._-]/g, "").toLowerCase();
  if (platform === "win32") {
    const scriptPath = path.join(sysDir, "andon-turn-hook.ps1");
    const base = `powershell -NoProfile -ExecutionPolicy RemoteSigned -File "${scriptPath}"`;
    return slug ? `${base} -Agent ${slug}` : base;
  }
  const scriptPath = path.join(sysDir, "andon-turn-hook.sh");
  const base = `sh "${scriptPath}"`;
  return slug ? `${base} ${slug}` : base;
}

function renderAndonHookPs1(): string {
  return [
    "# andon-hook.ps1 — fired on PostToolUse and Stop Claude Code hook events",
    "# Forwards events to the Andon API at http://127.0.0.1:4318/events",
    "# Must exit 0 always and be silent on failure.",
    "param()",
    "$ErrorActionPreference = 'SilentlyContinue'",
    "",
    "# 1. Read JSON from stdin",
    "$inputJson = $input | Out-String",
    "if (-not $inputJson.Trim()) { exit 0 }",
    "$hookData = $inputJson | ConvertFrom-Json",
    "",
    "# 2. Resolve Holistic session ID via walk-up from hookData.cwd",
    "# IMPORTANT: Never use $PWD here — in worktrees $PWD is the worktree directory,",
    "# not the repo root. Always use $hookData.cwd from the stdin JSON.",
    "$dir = $hookData.cwd",
    "$stateFile = $null",
    "$level = 0",
    "while ($dir -and $level -lt 5) {",
    "    $candidate = Join-Path $dir '.holistic-local\\state.json'",
    "    if (Test-Path $candidate) { $stateFile = $candidate; break }",
    "    $candidate = Join-Path $dir '.holistic\\state.json'",
    "    if (Test-Path $candidate) { $stateFile = $candidate; break }",
    "    $parent = Split-Path $dir -Parent",
    "    if ($parent -eq $dir) { break }   # filesystem root reached",
    "    $dir = $parent",
    "    $level++",
    "}",
    "if (-not $stateFile) { exit 0 }",
    "",
    "$state = Get-Content $stateFile -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue",
    "$sessionId = $state.activeSession.id",
    "if (-not $sessionId) { exit 0 }",
    "",
    "# Derive sourceType from the Holistic agent name so Andon Mission Control",
    "# can identify the real agent regardless of which tool is running.",
    "$agentName = \"$($state.activeSession.agent)\".ToLower()",
    "$agentSourceTypeMap = @{",
    "    'claude'   = 'claude_code'",
    "    'codex'    = 'codex'",
    "    'cursor'   = 'cursor'",
    "    'copilot'  = 'github_copilot'",
    "    'gsd'      = 'gsd'",
    "    'gsd2'     = 'gsd'",
    "}",
    "$sourceType = if ($agentSourceTypeMap.ContainsKey($agentName)) { $agentSourceTypeMap[$agentName] } else { 'http_event_source' }",
    "",
    "# 3. Map hook event to AgentEvent type",
    "$eventType = $null",
    "$summary = \"\"",
    "$payload = @{}",
    "$source = \"collector\"",
    "",
    "$hookName = $hookData.hook_event_name",
    "",
    "if ($hookName -eq \"PostToolUse\") {",
    "    $toolName = $hookData.tool_name",
    "",
    "    if ($toolName -eq \"Bash\") {",
    "        # tool_response field name may be exit_code OR exitCode — check both",
    "        $exitCode = if ($null -ne $hookData.tool_response.exit_code) {",
    "            $hookData.tool_response.exit_code",
    "        } else {",
    "            $hookData.tool_response.exitCode",
    "        }",
    "        $cmd = $hookData.tool_input.command",
    "        $isTest = ($cmd -match \"npm test|jest|vitest|pytest|mocha\")",
    "",
    "        if ($isTest) {",
    "            $eventType = if ($exitCode -eq 0) { \"test.finished\" } else { \"test.failed\" }",
    "            $summary = if ($exitCode -eq 0) { \"Tests passed: $cmd\" } else { \"Tests failed: $cmd\" }",
    "        } else {",
    "            $eventType = if ($exitCode -eq 0) { \"command.finished\" } else { \"command.failed\" }",
    "            $summary = if ($exitCode -eq 0) { \"Ran: $cmd\" } else { \"Failed: $cmd (exit $exitCode)\" }",
    "        }",
    "        $payload = @{ command = $cmd; exitCode = $exitCode; durationMs = $hookData.duration_ms; sourceType = $sourceType; sourceId = \"andon-hook\"; transport = \"http_events\" }",
    "",
    "    } elseif ($toolName -in @(\"Edit\", \"Write\")) {",
    "        $eventType = \"file.changed\"",
    "        # payload.path is required by the status engine's out-of-scope detection",
    "        $filePath = $hookData.tool_input.file_path",
    "        $summary = \"Edited: $filePath\"",
    "        $payload = @{ path = $filePath; tool = $toolName; sourceType = $sourceType; sourceId = \"andon-hook\"; transport = \"http_events\" }",
    "    }",
    "",
    "} elseif ($hookName -eq \"Stop\") {",
    "    $eventType = \"session.needs_input\"",
    "    $summary = \"Waiting for user input\"",
    "    $source = \"collector\"",
    "    $payload = @{ stopReason = $hookData.stop_reason; inputNeeded = $true; sourceType = $sourceType; sourceId = \"andon-hook\"; transport = \"http_events\" }",
    "}",
    "",
    "if (-not $eventType) { exit 0 }",
    "",
    "# 4. Build and POST the event — fire-and-forget with 1s timeout",
    "$event = @{",
    "    id        = \"hook-$(Get-Date -Format 'yyyyMMddHHmmssfff')-$([System.Guid]::NewGuid().ToString('N').Substring(0,6))\"",
    "    sessionId = $sessionId",
    "    type      = $eventType",
    "    source    = $source",
    "    timestamp = (Get-Date -Format 'o')",
    "    summary   = $summary",
    "    payload   = $payload",
    "}",
    "$body = @{ events = @($event) } | ConvertTo-Json -Depth 5 -Compress",
    "",
    "# The Andon API requires a loopback bearer token on mutating routes.",
    "$headers = @{}",
    "$tokenFile = if ($env:ANDON_TOKEN_FILE) { $env:ANDON_TOKEN_FILE } else { Join-Path $HOME '.holistic\\andon-token' }",
    "if (Test-Path $tokenFile) {",
    "    $token = (Get-Content $tokenFile -Raw).Trim()",
    "    if ($token) { $headers['Authorization'] = \"Bearer $token\" }",
    "}",
    "try {",
    "    Invoke-RestMethod -Uri \"http://127.0.0.1:4318/events\" -Method POST -Body $body -ContentType \"application/json\" -Headers $headers -TimeoutSec 1 | Out-Null",
    "} catch { }",
    "exit 0",
  ].join("\n");
}

function renderAndonHookSh(): string {
  return [
    "#!/usr/bin/env sh",
    "# andon-hook.sh — fired on PostToolUse and Stop Claude Code hook events (POSIX parity)",
    "# Forwards events to the Andon API at http://127.0.0.1:4318/events",
    "# Must exit 0 always and be silent on failure.",
    "",
    "# 1. Read JSON from stdin",
    "input=$(cat)",
    "if [ -z \"$(echo \"$input\" | tr -d '[:space:]')\" ]; then exit 0; fi",
    "",
    "# 2. Resolve Holistic session ID via walk-up from hookData.cwd",
    "# IMPORTANT: Never use $PWD or $(pwd) — in worktrees $PWD is the worktree directory,",
    "# not the repo root. Always use the cwd field from the stdin JSON.",
    "cwd=$(echo \"$input\" | jq -r '.cwd // empty' 2>/dev/null)",
    "if [ -z \"$cwd\" ]; then exit 0; fi",
    "",
    "state_file=\"\"",
    "dir=\"$cwd\"",
    "level=0",
    "while [ -n \"$dir\" ] && [ \"$level\" -lt 5 ]; do",
    "    candidate=\"$dir/.holistic-local/state.json\"",
    "    if [ -f \"$candidate\" ]; then",
    "        state_file=\"$candidate\"",
    "        break",
    "    fi",
    "    candidate=\"$dir/.holistic/state.json\"",
    "    if [ -f \"$candidate\" ]; then",
    "        state_file=\"$candidate\"",
    "        break",
    "    fi",
    "    parent=$(dirname \"$dir\")",
    "    if [ \"$parent\" = \"$dir\" ]; then break; fi  # filesystem root reached",
    "    dir=\"$parent\"",
    "    level=$((level + 1))",
    "done",
    "",
    "if [ -z \"$state_file\" ]; then exit 0; fi",
    "",
    "session_id=$(jq -r '.activeSession.id // empty' \"$state_file\" 2>/dev/null)",
    "if [ -z \"$session_id\" ]; then exit 0; fi",
    "",
    "# Derive sourceType from the Holistic agent name so Andon Mission Control",
    "# can identify the real agent regardless of which tool is running.",
    "agent_name=$(jq -r '.activeSession.agent // empty' \"$state_file\" 2>/dev/null | tr '[:upper:]' '[:lower:]')",
    "case \"$agent_name\" in",
    "    claude)   source_type=\"claude_code\" ;;",
    "    codex)    source_type=\"codex\" ;;",
    "    cursor)   source_type=\"cursor\" ;;",
    "    copilot)  source_type=\"github_copilot\" ;;",
    "    gsd|gsd2) source_type=\"gsd\" ;;",
    "    *)        source_type=\"http_event_source\" ;;",
    "esac",
    "",
    "# 3. Map hook event to AgentEvent type",
    "hook_event_name=$(echo \"$input\" | jq -r '.hook_event_name // empty' 2>/dev/null)",
    "tool_name=$(echo \"$input\" | jq -r '.tool_name // empty' 2>/dev/null)",
    "",
    "event_type=\"\"",
    "summary=\"\"",
    "source_field=\"collector\"",
    "payload=\"{}\"",
    "",
    "if [ \"$hook_event_name\" = \"PostToolUse\" ]; then",
    "    if [ \"$tool_name\" = \"Bash\" ]; then",
    "        # exit_code may be exit_code OR exitCode depending on Claude Code version — check both",
    "        exit_code=$(echo \"$input\" | jq -r '.tool_response.exit_code // .tool_response.exitCode // 0' 2>/dev/null)",
    "        cmd=$(echo \"$input\" | jq -r '.tool_input.command // empty' 2>/dev/null)",
    "        duration_ms=$(echo \"$input\" | jq -r '.duration_ms // 0' 2>/dev/null)",
    "",
    "        # Test detection: check command against test runner patterns",
    "        is_test=0",
    "        case \"$cmd\" in",
    "            *\"npm test\"*|*jest*|*vitest*|*pytest*|*mocha*) is_test=1 ;;",
    "        esac",
    "",
    "        if [ \"$is_test\" = \"1\" ]; then",
    "            if [ \"$exit_code\" = \"0\" ]; then",
    "                event_type=\"test.finished\"",
    "                summary=\"Tests passed: $cmd\"",
    "            else",
    "                event_type=\"test.failed\"",
    "                summary=\"Tests failed: $cmd\"",
    "            fi",
    "        else",
    "            if [ \"$exit_code\" = \"0\" ]; then",
    "                event_type=\"command.finished\"",
    "                summary=\"Ran: $cmd\"",
    "            else",
    "                event_type=\"command.failed\"",
    "                summary=\"Failed: $cmd (exit $exit_code)\"",
    "            fi",
    "        fi",
    "",
    "        cmd_escaped=$(printf '%s' \"$cmd\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$cmd\"'\"')",
    "        payload=\"{\\\"command\\\":$cmd_escaped,\\\"exitCode\\\":$exit_code,\\\"durationMs\\\":$duration_ms,\\\"sourceType\\\":\\\"$source_type\\\",\\\"sourceId\\\":\\\"andon-hook\\\",\\\"transport\\\":\\\"http_events\\\"}\"",
    "",
    "    elif [ \"$tool_name\" = \"Edit\" ] || [ \"$tool_name\" = \"Write\" ]; then",
    "        event_type=\"file.changed\"",
    "        # payload.path is required by the status engine's out-of-scope detection",
    "        file_path=$(echo \"$input\" | jq -r '.tool_input.file_path // empty' 2>/dev/null)",
    "        summary=\"Edited: $file_path\"",
    "        file_path_escaped=$(printf '%s' \"$file_path\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$file_path\"'\"')",
    "        tool_escaped=$(printf '%s' \"$tool_name\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$tool_name\"'\"')",
    "        payload=\"{\\\"path\\\":$file_path_escaped,\\\"tool\\\":$tool_escaped,\\\"sourceType\\\":\\\"$source_type\\\",\\\"sourceId\\\":\\\"andon-hook\\\",\\\"transport\\\":\\\"http_events\\\"}\"",
    "    fi",
    "",
    "elif [ \"$hook_event_name\" = \"Stop\" ]; then",
    "    event_type=\"session.needs_input\"",
    "    summary=\"Waiting for user input\"",
    "    stop_reason=$(echo \"$input\" | jq -r '.stop_reason // empty' 2>/dev/null)",
    "    stop_reason_escaped=$(printf '%s' \"$stop_reason\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$stop_reason\"'\"')",
    "    payload=\"{\\\"stopReason\\\":$stop_reason_escaped,\\\"inputNeeded\\\":true,\\\"sourceType\\\":\\\"$source_type\\\",\\\"sourceId\\\":\\\"andon-hook\\\",\\\"transport\\\":\\\"http_events\\\"}\"",
    "fi",
    "",
    "if [ -z \"$event_type\" ]; then exit 0; fi",
    "",
    "# 4. Build and POST the event — fire-and-forget with 1s max-time",
    "timestamp=$(date -u +\"%Y-%m-%dT%H:%M:%S.000Z\" 2>/dev/null || date -u +\"%Y-%m-%dT%H:%M:%SZ\")",
    "random_suffix=$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' | cut -c1-6 || od -An -N3 -tx1 /dev/urandom 2>/dev/null | tr -d ' \\n' || echo \"000000\")",
    "event_id=\"hook-$(date -u +\"%Y%m%d%H%M%S%3N\" 2>/dev/null || date -u +\"%Y%m%d%H%M%S000\")-${random_suffix}\"",
    "",
    "session_id_escaped=$(printf '%s' \"$session_id\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$session_id\"'\"')",
    "event_type_escaped=$(printf '%s' \"$event_type\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$event_type\"'\"')",
    "source_escaped=$(printf '%s' \"$source_field\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$source_field\"'\"')",
    "summary_escaped=$(printf '%s' \"$summary\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$summary\"'\"')",
    "timestamp_escaped=$(printf '%s' \"$timestamp\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$timestamp\"'\"')",
    "event_id_escaped=$(printf '%s' \"$event_id\" | jq -Rs '.' 2>/dev/null || echo '\"'\"$event_id\"'\"')",
    "",
    "body=\"{\\\"events\\\":[{\\\"id\\\":$event_id_escaped,\\\"sessionId\\\":$session_id_escaped,\\\"type\\\":$event_type_escaped,\\\"source\\\":$source_escaped,\\\"timestamp\\\":$timestamp_escaped,\\\"summary\\\":$summary_escaped,\\\"payload\\\":$payload}]}\"",
    "",
    "# The Andon API requires a loopback bearer token on mutating routes.",
    "token_file=\"${ANDON_TOKEN_FILE:-$HOME/.holistic/andon-token}\"",
    "auth_header=\"\"",
    "if [ -f \"$token_file\" ]; then",
    "    token=$(tr -d '\\r\\n' < \"$token_file\")",
    "    if [ -n \"$token\" ]; then auth_header=\"Authorization: Bearer $token\"; fi",
    "fi",
    "",
    "if [ -n \"$auth_header\" ]; then",
    "    curl -s --max-time 1 -X POST \\",
    "        -H \"Content-Type: application/json\" \\",
    "        -H \"$auth_header\" \\",
    "        -d \"$body\" \\",
    "        \"http://127.0.0.1:4318/events\" >/dev/null 2>&1 || true",
    "else",
    "    curl -s --max-time 1 -X POST \\",
    "        -H \"Content-Type: application/json\" \\",
    "        -d \"$body\" \\",
    "        \"http://127.0.0.1:4318/events\" >/dev/null 2>&1 || true",
    "fi",
    "",
    "exit 0",
  ].join("\n");
}

function renderAndonTurnHookPs1(): string {
  return [
    "# andon-turn-hook.ps1 -- records the agent turn boundary for Andon",
    "# Stop -> waiting; everything else (UserPromptSubmit/PostToolUse,",
    "# Gemini AfterTool/SessionStart) -> running.",
    "# Must exit 0 always and be silent on failure.",
    "#",
    "# This hook writes a dedicated sidecar and MUST NOT edit state.json. It fires",
    "# on every tool call, cannot take the state lock that every TypeScript writer",
    "# holds, and a read-modify-write there loses concurrent updates. Rewriting the",
    "# whole file through ConvertFrom-Json/ConvertTo-Json was also lossy, and the",
    "# in-place write could be observed half-finished and quarantined as corrupt.",
    "#",
    "# -Agent is filled in by the installer from the adapter file name, so the",
    "# sidecar records WHICH agent ended its turn. Without it every agent wrote",
    "# one shared file: signals were attributed to whichever agent owned the",
    "# active session, and two agents in one repo clobbered each other.",
    "param([string]$Agent = '')",
    "$ErrorActionPreference = 'SilentlyContinue'",
    "",
    "# 1. Read JSON from stdin",
    "$inputJson = $input | Out-String",
    "if (-not $inputJson.Trim()) { exit 0 }",
    "$hookData = $inputJson | ConvertFrom-Json",
    "",
    "# 2. Map hook event to turnState value",
    "$hookName = $hookData.hook_event_name",
    "$turnStateValue = if ($hookName -eq 'Stop') { 'waiting' } else { 'running' }",
    "",
    "# 2b. Normalize the agent so it is safe as a file name segment.",
    "$agentSlug = ($Agent -replace '[^A-Za-z0-9._-]', '').ToLowerInvariant()",
    "",
    "# 3. Find the Holistic runtime directory via walk-up from hookData.cwd.",
    "# Prefer the hook-provided cwd: in worktrees $PWD can be the wrong tree.",
    "# Some agents (Gemini) omit cwd from the stdin payload entirely; for them",
    "# $PWD is the only signal available, so fall back to it.",
    "$dir = $hookData.cwd",
    "if (-not $dir) { $dir = (Get-Location).Path }",
    "$runtimeDir = $null",
    "$level = 0",
    "while ($dir -and $level -lt 5) {",
    "    $candidate = Join-Path $dir '.holistic-local'",
    "    if (Test-Path (Join-Path $candidate 'state.json')) { $runtimeDir = $candidate; break }",
    "    $candidate = Join-Path $dir '.holistic'",
    "    if (Test-Path (Join-Path $candidate 'state.json')) { $runtimeDir = $candidate; break }",
    "    $parent = Split-Path $dir -Parent",
    "    if ($parent -eq $dir) { break }",
    "    $dir = $parent",
    "    $level++",
    "}",
    "if (-not $runtimeDir) { exit 0 }",
    "",
    "# 4. Write the sidecar with an atomic replace so a concurrent reader never",
    "# observes a partial write. Per-agent file name: concurrent agents must not",
    "# overwrite each other's turn state. Unknown agent falls back to the shared",
    "# legacy file, which the writer still reads as unattributed.",
    "$turnFileName = if ($agentSlug) { \"turn-state.$agentSlug.json\" } else { 'turn-state.json' }",
    "$turnFile = Join-Path $runtimeDir $turnFileName",
    "$tmpFile = \"$turnFile.tmp\"",
    "$recordedAt = (Get-Date).ToUniversalTime().ToString('o')",
    "$payload = if ($agentSlug) {",
    "    \"{`\"turnState`\":`\"$turnStateValue`\",`\"recordedAt`\":`\"$recordedAt`\",`\"agent`\":`\"$agentSlug`\"}\"",
    "} else {",
    "    \"{`\"turnState`\":`\"$turnStateValue`\",`\"recordedAt`\":`\"$recordedAt`\"}\"",
    "}",
    "[System.IO.File]::WriteAllText($tmpFile, $payload, [System.Text.UTF8Encoding]::new($false))",
    "Move-Item -Force -Path $tmpFile -Destination $turnFile",
    "exit 0",
  ].join("\n");
}

function renderAndonTurnHookSh(): string {
  return [
    "#!/usr/bin/env sh",
    "# andon-turn-hook.sh -- records the agent turn boundary for Andon (POSIX parity)",
    "# Stop -> waiting; everything else (UserPromptSubmit/PostToolUse,",
    "# Gemini AfterTool/SessionStart) -> running.",
    "# Must exit 0 always and be silent on failure.",
    "#",
    "# This hook writes a dedicated sidecar and MUST NOT edit state.json. It fires",
    "# on every tool call and cannot take the state lock that every TypeScript",
    "# writer holds, so a read-modify-write there loses concurrent updates.",
    "#",
    "# $1 is the agent, filled in by the installer from the adapter file name, so",
    "# the sidecar records WHICH agent ended its turn. Without it every agent",
    "# wrote one shared file and signals were mis-attributed to whichever agent",
    "# owned the active session.",
    "",
    "if ! command -v jq >/dev/null 2>&1; then exit 0; fi",
    "",
    "# 1. Read JSON from stdin",
    "input=$(cat)",
    "if [ -z \"$(echo \"$input\" | tr -d '[:space:]')\" ]; then exit 0; fi",
    "",
    "# 2. Map hook event to turnState value",
    "hook_event_name=$(echo \"$input\" | jq -r '.hook_event_name // empty' 2>/dev/null)",
    "if [ \"$hook_event_name\" = 'Stop' ]; then",
    "    turn_state_value='waiting'",
    "else",
    "    turn_state_value='running'",
    "fi",
    "",
    "# 2b. Normalize the agent so it is safe as a file name segment.",
    "agent_slug=$(printf '%s' \"${1:-}\" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9._-')",
    "",
    "# 3. Find the Holistic runtime directory via walk-up from hookData.cwd.",
    "# Prefer the hook-provided cwd: in worktrees $PWD can be the wrong tree.",
    "# Some agents (Gemini) omit cwd from the stdin payload entirely; for them",
    "# $PWD is the only signal available, so fall back to it.",
    "cwd=$(echo \"$input\" | jq -r '.cwd // empty' 2>/dev/null)",
    "if [ -z \"$cwd\" ]; then cwd=\"$PWD\"; fi",
    "",
    "runtime_dir=''",
    "dir=\"$cwd\"",
    "level=0",
    "while [ -n \"$dir\" ] && [ \"$level\" -lt 5 ]; do",
    "    if [ -f \"$dir/.holistic-local/state.json\" ]; then runtime_dir=\"$dir/.holistic-local\"; break; fi",
    "    if [ -f \"$dir/.holistic/state.json\" ]; then runtime_dir=\"$dir/.holistic\"; break; fi",
    "    parent=$(dirname \"$dir\")",
    "    if [ \"$parent\" = \"$dir\" ]; then break; fi",
    "    dir=\"$parent\"",
    "    level=$((level + 1))",
    "done",
    "if [ -z \"$runtime_dir\" ]; then exit 0; fi",
    "",
    "# 4. Write the sidecar with an atomic replace so a concurrent reader never",
    "# observes a partial write.",
    "# Per-agent file name: concurrent agents must not overwrite each other's turn",
    "# state. Unknown agent falls back to the shared legacy file, which the writer",
    "# still reads as unattributed.",
    "if [ -n \"$agent_slug\" ]; then",
    "    turn_file=\"$runtime_dir/turn-state.$agent_slug.json\"",
    "else",
    "    turn_file=\"$runtime_dir/turn-state.json\"",
    "fi",
    "recorded_at=$(date -u +\"%Y-%m-%dT%H:%M:%SZ\" 2>/dev/null || echo \"\")",
    "if [ -n \"$agent_slug\" ]; then",
    "    printf '{\"turnState\":\"%s\",\"recordedAt\":\"%s\",\"agent\":\"%s\"}' \"$turn_state_value\" \"$recorded_at\" \"$agent_slug\" > \"${turn_file}.tmp\" 2>/dev/null \\",
    "        && mv \"${turn_file}.tmp\" \"$turn_file\" 2>/dev/null || true",
    "else",
    "    printf '{\"turnState\":\"%s\",\"recordedAt\":\"%s\"}' \"$turn_state_value\" \"$recorded_at\" > \"${turn_file}.tmp\" 2>/dev/null \\",
    "        && mv \"${turn_file}.tmp\" \"$turn_file\" 2>/dev/null || true",
    "fi",
    "exit 0",
  ].join("\n");
}

export function writeAndonHookScripts(paths: RuntimePaths): void {
  const sysDir = systemDir(paths);
  fs.mkdirSync(sysDir, { recursive: true });

  fs.writeFileSync(path.join(sysDir, "andon-hook.ps1"), renderAndonHookPs1() + "\n", "utf8");
  const shPath = path.join(sysDir, "andon-hook.sh");
  fs.writeFileSync(shPath, renderAndonHookSh() + "\n", "utf8");
  fs.chmodSync(shPath, 0o755);

  fs.writeFileSync(path.join(sysDir, "andon-turn-hook.ps1"), renderAndonTurnHookPs1() + "\n", "utf8");
  const turnShPath = path.join(sysDir, "andon-turn-hook.sh");
  fs.writeFileSync(turnShPath, renderAndonTurnHookSh() + "\n", "utf8");
  fs.chmodSync(turnShPath, 0o755);
}

// ---- Turn Hook Config: data-driven installer (reads adapter docs) ----

interface HookConfigTarget {
  path: string;
  format: "json_merge";
  hookKey: string;
}

interface TurnHookConfig {
  hookEvents: string[];
  installTargets: string[];
  hookConfigWindows: HookConfigTarget | null;
  hookConfigPosix: HookConfigTarget | null;
}

function parseTurnHookConfigYaml(yaml: string): TurnHookConfig {
  const lines = yaml.split("\n");
  const hookEvents: string[] = [];
  const installTargets: string[] = [];
  let section = "";
  let platform = "";
  const windowsCfg: { path?: string; format?: string; hookKey?: string } = {};
  const posixCfg: { path?: string; format?: string; hookKey?: string } = {};

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed === "turn_hooks:") { section = "turn_hooks"; platform = ""; continue; }
    if (trimmed === "install_targets:") { section = "install_targets"; platform = ""; continue; }
    if (trimmed === "hook_config:") { section = "hook_config"; platform = ""; continue; }
    if (section === "turn_hooks") {
      const m = trimmed.match(/^-\s+agent_hook:\s+(.+)/);
      if (m) hookEvents.push(m[1].trim());
    }
    if (section === "install_targets") {
      const m = trimmed.match(/^-\s+(.+)/);
      if (m) installTargets.push(m[1].trim());
    }
    if (section === "hook_config") {
      if (trimmed === "windows:") { platform = "windows"; continue; }
      if (trimmed === "posix:") { platform = "posix"; continue; }
      if (platform) {
        const cfg = platform === "windows" ? windowsCfg : posixCfg;
        const pm = trimmed.match(/^path:\s+(.+)/);
        const fm = trimmed.match(/^format:\s+(.+)/);
        const km = trimmed.match(/^hook_key:\s+(.+)/);
        if (pm) cfg.path = pm[1].trim();
        if (fm) cfg.format = fm[1].trim();
        if (km) cfg.hookKey = km[1].trim();
      }
    }
  }

  const toTarget = (cfg: { path?: string; format?: string; hookKey?: string }): HookConfigTarget | null => {
    if (!cfg.path || !cfg.format || !cfg.hookKey) return null;
    return { path: cfg.path, format: cfg.format as "json_merge", hookKey: cfg.hookKey };
  };

  return { hookEvents, installTargets, hookConfigWindows: toTarget(windowsCfg), hookConfigPosix: toTarget(posixCfg) };
}

/**
 * Global agent configs (for example Gemini's ~/.gemini/settings.json) live in
 * the user's home directory rather than the repo. Only a leading "~/" (or
 * "~\\") is treated as home-relative; "~user" forms are not supported.
 */
function isHomeTargetPath(rawPath: string): boolean {
  return rawPath.startsWith("~/") || rawPath.startsWith("~\\");
}

function expandHomeTargetPath(rawPath: string, homeDir: string): string | null {
  const expanded = path.resolve(homeDir, rawPath.slice(2));
  return isPathInsideDirectory(expanded, homeDir) ? expanded : null;
}

function parseTurnHookConfigFromDoc(docContent: string): TurnHookConfig | null {
  const m = docContent.match(/## Turn Hook Config[\s\S]*?```yaml\n([\s\S]*?)```/);
  if (!m) return null;
  const cfg = parseTurnHookConfigYaml(m[1]);
  return cfg.hookEvents.length > 0 ? cfg : null;
}

/**
 * The capability an on-disk adapter declares. renderAdapter enforces the
 * capability/turn-hook invariant at GENERATION time, but an adapter on disk may
 * be hand-authored or predate the template, so the same invariant has to be
 * re-checked here against whatever is actually installed.
 */
function parseCapabilityFromDoc(docContent: string): string | null {
  const m = docContent.match(/## Capability[\s\S]*?```yaml\n\s*capability:\s*([a-z_]+)/);
  return m ? m[1] : null;
}

export interface TurnHookInstallResult {
  installedAgents: string[];
  warnings: string[];
}

function applyTurnHookToConfig(configPath: string, turnHookCmd: string, hookEvents: string[], hookKey: string): void {
  // Only install if the agent's config directory already exists. Never create it proactively:
  // creating .claude/ or .codex/ would make getSetupStatus report hooks as missing for
  // agents that have not been initialized in this repo.
  if (!fs.existsSync(path.dirname(configPath))) return;
  const existing = readJsonObject(configPath);

  // An existing turn hook is REWRITTEN in place when the desired command has
  // changed, not left alone. Hooks installed before the command carried an
  // -Agent argument would otherwise keep writing unattributed turn signals
  // forever, because the only marker we match on ("andon-turn-hook") is present
  // in both the old and the new form.
  if (hookKey === "(root)") {
    // Codex style: event keys at root, entries are [{command: "..."}]
    const next: Record<string, unknown> = { ...existing };
    for (const event of hookEvents) {
      const existingEvent = Array.isArray(next[event]) ? [...(next[event] as unknown[])] : [];
      let foundTurnHook = false;
      for (let i = 0; i < existingEvent.length; i++) {
        const entry = existingEvent[i] as Record<string, unknown> | null;
        const command = entry && typeof entry.command === "string" ? entry.command : null;
        if (command && isAndonTurnHookCommand(command)) {
          foundTurnHook = true;
          if (command !== turnHookCmd) {
            existingEvent[i] = { ...entry, command: turnHookCmd };
          }
        }
      }
      if (!foundTurnHook) {
        existingEvent.push({ command: turnHookCmd });
      }
      next[event] = existingEvent;
    }
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + "\n", "utf8");
  } else {
    // Claude style: event keys under hookKey, entries are [{hooks: [{type, command}]}]
    const hooksBlock: Record<string, unknown> = existing[hookKey] && typeof existing[hookKey] === "object"
      ? { ...(existing[hookKey] as Record<string, unknown>) }
      : {};
    for (const event of hookEvents) {
      const existingEvent = Array.isArray(hooksBlock[event]) ? [...(hooksBlock[event] as unknown[])] : [];
      let foundTurnHook = false;
      const nextEvent = existingEvent.map((group) => {
        const g = group as Record<string, unknown>;
        if (!g || !Array.isArray(g.hooks)) return group;
        let groupChanged = false;
        const nextHooks = (g.hooks as unknown[]).map((hook) => {
          const h = hook as Record<string, unknown>;
          if (h && typeof h.command === "string" && isAndonTurnHookCommand(h.command)) {
            foundTurnHook = true;
            if (h.command !== turnHookCmd) {
              groupChanged = true;
              return { ...h, command: turnHookCmd };
            }
          }
          return hook;
        });
        return groupChanged ? { ...g, hooks: nextHooks } : group;
      });
      if (!foundTurnHook) {
        nextEvent.push({ hooks: [{ type: "command", command: turnHookCmd }] });
      }
      hooksBlock[event] = nextEvent;
    }
    fs.writeFileSync(configPath, JSON.stringify({ ...existing, [hookKey]: hooksBlock }, null, 2) + "\n", "utf8");
  }
}

export function installAllTurnHooks(repoRoot: string, paths: RuntimePaths, platform: NodeJS.Platform = process.platform, homeDir: string = os.homedir()): TurnHookInstallResult {
  const result: TurnHookInstallResult = { installedAgents: [], warnings: [] };
  const adaptersDir = paths.adaptersDir;
  if (!fs.existsSync(adaptersDir)) return result;

  let adapterFiles: string[];
  try {
    adapterFiles = fs.readdirSync(adaptersDir).filter((f) => f.endsWith(".md"));
  } catch { return result; }

  for (const fileName of adapterFiles) {
    try {
      const adapterPath = path.join(adaptersDir, fileName);
      const content = fs.readFileSync(adapterPath, "utf8");
      const config = parseTurnHookConfigFromDoc(content);
      const agent = agentNameFromAdapterFileName(fileName);

      if (!config) {
        // Silence here is what made this whole subsystem fail invisibly: an
        // adapter that lost its generated marker is never refreshed, so it
        // never gains a Turn Hook Config, so no turn hooks install at all and
        // Andon can never flip running/waiting for that agent.
        const capability = parseCapabilityFromDoc(content);
        if (capability === "realtime_hooks") {
          result.warnings.push(
            `${fileName} declares capability realtime_hooks but has no Turn Hook Config section; `
            + `no turn signals will be installed for ${agent}.`
          );
        } else if (!capability && !hasGeneratedMarker(adapterPath)) {
          result.warnings.push(
            `${fileName} predates the capability/turn-hook template and has no generated marker, `
            + `so it is treated as user-authored and never refreshed. `
            + `Run 'holistic repair --refresh-adapters true' if it was not customised.`
          );
        }
        continue;
      }

      // The adapter file name is the agent identity; it travels into the hook
      // command so the sidecar this agent writes is attributable to it.
      const turnHookCmd = andonTurnHookCommand(paths, platform, agent);

      const target = platform === "win32" ? config.hookConfigWindows : config.hookConfigPosix;
      if (!target) continue;

      // The path comes from an adapter doc, which is data anyone with repo
      // write access can author, so it must not be able to direct a config
      // write anywhere on disk. Each write is confined to the tree it targets:
      // repo-relative paths stay inside the repo, and ~/ paths (global agent
      // configs such as ~/.gemini/settings.json) stay inside the home directory.
      let configPath: string;
      if (isHomeTargetPath(target.path)) {
        const expanded = expandHomeTargetPath(target.path, homeDir);
        if (!expanded) continue;
        configPath = expanded;
      } else {
        configPath = path.resolve(repoRoot, target.path);
        if (!isPathInsideDirectory(configPath, repoRoot)) {
          continue;
        }
      }
      applyTurnHookToConfig(configPath, turnHookCmd, config.hookEvents, target.hookKey);
      result.installedAgents.push(agent);

      // A home-based config is global: one write covers every worktree, and
      // resolving "~/..." against a worktree would create a literal "~" dir.
      if (config.installTargets.includes("worktrees") && !isHomeTargetPath(target.path)) {
        for (const worktreePath of enumerateGitWorktrees(repoRoot)) {
          if (!fs.existsSync(worktreePath)) continue;
          const worktreeConfigPath = path.resolve(worktreePath, target.path);
          if (!isPathInsideDirectory(worktreeConfigPath, worktreePath)) continue;
          applyTurnHookToConfig(
            worktreeConfigPath,
            turnHookCmd,
            config.hookEvents,
            target.hookKey,
          );
        }
      }
    } catch { /* skip malformed adapter docs */ }
  }

  if (result.installedAgents.length === 0 && adapterFiles.length > 0) {
    result.warnings.push(
      `No turn hooks were installed from ${adapterFiles.length} adapter doc(s); `
      + `Andon cannot flip running/waiting for any agent in this repo.`
    );
  }

  return result;
}

// ---- End turn hook installer ----

function applyAndonHooksToSettings(settingsPath: string, hookCmd: string): void {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  const existing = readJsonObject(settingsPath);
  const existingHooks = existing.hooks && typeof existing.hooks === "object"
    ? existing.hooks as ClaudeHooksBlock
    : {} as ClaudeHooksBlock;

  // PostToolUse hook
  const existingPostToolUse: ClaudeHookGroup[] = Array.isArray(existingHooks.PostToolUse)
    ? existingHooks.PostToolUse as ClaudeHookGroup[]
    : [];

  const hasAndonPostToolUse = existingPostToolUse.some(
    (group) =>
      group &&
      Array.isArray(group.hooks) &&
      group.hooks.some((h) => h && typeof h.command === "string" && isAndonHookCommand(h.command)),
  );

  const updatedPostToolUse: ClaudeHookGroup[] = hasAndonPostToolUse
    ? existingPostToolUse.map((group) => {
        if (!group || !Array.isArray(group.hooks)) return group;
        const hasAndon = group.hooks.some(
          (h) => h && typeof h.command === "string" && isAndonHookCommand(h.command),
        );
        if (!hasAndon) return group;
        return {
          ...group,
          hooks: group.hooks.map((h) => {
            if (h && typeof h.command === "string" && isAndonHookCommand(h.command)) {
              return { ...h, type: "command", command: hookCmd };
            }
            return h;
          }),
        };
      })
    : [...existingPostToolUse, { hooks: [{ type: "command", command: hookCmd }] }];

  // Stop hook
  const existingStop: ClaudeHookGroup[] = Array.isArray(existingHooks.Stop)
    ? existingHooks.Stop as ClaudeHookGroup[]
    : [];

  const hasAndonStop = existingStop.some(
    (group) =>
      group &&
      Array.isArray(group.hooks) &&
      group.hooks.some((h) => h && typeof h.command === "string" && isAndonHookCommand(h.command)),
  );

  const updatedStop: ClaudeHookGroup[] = hasAndonStop
    ? existingStop.map((group) => {
        if (!group || !Array.isArray(group.hooks)) return group;
        const hasAndon = group.hooks.some(
          (h) => h && typeof h.command === "string" && isAndonHookCommand(h.command),
        );
        if (!hasAndon) return group;
        return {
          ...group,
          hooks: group.hooks.map((h) => {
            if (h && typeof h.command === "string" && isAndonHookCommand(h.command)) {
              return { ...h, type: "command", command: hookCmd };
            }
            return h;
          }),
        };
      })
    : [...existingStop, { hooks: [{ type: "command", command: hookCmd }] }];

  const next = {
    ...existing,
    hooks: {
      ...existingHooks,
      PostToolUse: updatedPostToolUse,
      Stop: updatedStop,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function installAndonHooks(repoRoot: string, paths: RuntimePaths, platform: NodeJS.Platform = process.platform): void {
  const claudeDir = path.join(repoRoot, ".claude");
  if (!fs.existsSync(claudeDir)) {
    return;
  }

  const hookCmd = andonHookCommand(paths, platform);
  applyAndonHooksToSettings(path.join(claudeDir, "settings.json"), hookCmd);

  // Propagate to all active git worktrees so hooks fire in worktree sessions.
  // Hooks bind at session startup; without this they never fire in worktrees that
  // have no .claude/settings.json of their own.
  for (const worktreePath of enumerateGitWorktrees(repoRoot)) {
    if (fs.existsSync(worktreePath)) {
      applyAndonHooksToSettings(path.join(worktreePath, ".claude", "settings.json"), hookCmd);
    }
  }
}

export function refreshAndonHooks(repoRoot: string, paths: RuntimePaths, platform: NodeJS.Platform = process.platform): boolean {
  const settingsPath = path.join(repoRoot, ".claude", "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return false;
  }

  const existing = readJsonObject(settingsPath);
  const existingHooks = existing.hooks && typeof existing.hooks === "object"
    ? existing.hooks as ClaudeHooksBlock
    : {} as ClaudeHooksBlock;

  const postToolUse = existingHooks.PostToolUse;
  const hasAndon = Array.isArray(postToolUse) &&
    (postToolUse as ClaudeHookGroup[]).some(
      (group) =>
        group &&
        Array.isArray(group.hooks) &&
        group.hooks.some((h) => h && typeof h.command === "string" && isAndonHookCommand(h.command)),
    );

  if (!hasAndon) {
    return false;
  }

  installAndonHooks(repoRoot, paths, platform);
  return true;
}

export function installClaudeCodeHooks(repoRoot: string, holisticCmd: string, platform: NodeJS.Platform = process.platform): void {
  const claudeDir = path.join(repoRoot, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  fs.mkdirSync(claudeDir, { recursive: true });

  const existing = readJsonObject(settingsPath);
  const existingHooks = existing.hooks && typeof existing.hooks === "object"
    ? existing.hooks as ClaudeHooksBlock
    : {} as ClaudeHooksBlock;

  const newCommand = `${holisticCmd} resume --agent claude`;

  const existingSessionStart: ClaudeHookGroup[] = Array.isArray(existingHooks.SessionStart)
    ? existingHooks.SessionStart as ClaudeHookGroup[]
    : [];

  // Check if any existing SessionStart hook group has a holistic command
  let replaced = false;
  const updatedSessionStart: ClaudeHookGroup[] = existingSessionStart.map((group) => {
    if (!group || !Array.isArray(group.hooks)) {
      return group;
    }
    const hasHolistic = group.hooks.some(
      (h) => h && typeof h.command === "string" && isHolisticCommand(h.command),
    );
    if (!hasHolistic) {
      return group;
    }
    replaced = true;
    return {
      ...group,
      hooks: group.hooks.map((h) => {
        if (h && typeof h.command === "string" && isHolisticCommand(h.command)) {
          return { ...h, type: "command", command: newCommand };
        }
        return h;
      }),
    };
  });

  if (!replaced) {
    updatedSessionStart.push({
      hooks: [{ type: "command", command: newCommand }],
    });
  }

  // Build the UserPromptSubmit hook command for this platform
  const autoCheckpointCmd = autoCheckpointCommand(repoRoot, platform);

  const existingUserPromptSubmit: ClaudeHookGroup[] = Array.isArray(existingHooks.UserPromptSubmit)
    ? existingHooks.UserPromptSubmit as ClaudeHookGroup[]
    : [];

  // Check if any existing UserPromptSubmit hook group has an auto-checkpoint command
  let replacedAutoCheckpoint = false;
  const updatedUserPromptSubmit: ClaudeHookGroup[] = existingUserPromptSubmit.map((group) => {
    if (!group || !Array.isArray(group.hooks)) {
      return group;
    }
    const hasAutoCheckpoint = group.hooks.some(
      (h) => h && typeof h.command === "string" && isAutoCheckpointCommand(h.command),
    );
    if (!hasAutoCheckpoint) {
      return group;
    }
    replacedAutoCheckpoint = true;
    return {
      ...group,
      hooks: group.hooks.map((h) => {
        if (h && typeof h.command === "string" && isAutoCheckpointCommand(h.command)) {
          return { ...h, type: "command", command: autoCheckpointCmd };
        }
        return h;
      }),
    };
  });

  if (!replacedAutoCheckpoint) {
    updatedUserPromptSubmit.push({
      hooks: [{ type: "command", command: autoCheckpointCmd }],
    });
  }

  const next = {
    ...existing,
    hooks: {
      ...existingHooks,
      SessionStart: updatedSessionStart,
      UserPromptSubmit: updatedUserPromptSubmit,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function refreshClaudeCodeHooks(repoRoot: string, platform: NodeJS.Platform): boolean {
  const settingsPath = path.join(repoRoot, ".claude", "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return false;
  }

  const existing = readJsonObject(settingsPath);
  const existingHooks = existing.hooks && typeof existing.hooks === "object"
    ? existing.hooks as ClaudeHooksBlock
    : {} as ClaudeHooksBlock;

  const sessionStart = existingHooks.SessionStart;
  if (!Array.isArray(sessionStart)) {
    return false;
  }

  const hasHolistic = (sessionStart as ClaudeHookGroup[]).some(
    (group) =>
      group &&
      Array.isArray(group.hooks) &&
      group.hooks.some((h) => h && typeof h.command === "string" && isHolisticCommand(h.command)),
  );

  if (!hasHolistic) {
    return false;
  }

  const holisticCmd = holisticCmdForPlatform(repoRoot, platform);
  installClaudeCodeHooks(repoRoot, holisticCmd, platform);
  return true;
}

function installDaemon(rootDir: string, paths: RuntimePaths, platform: NodeJS.Platform, homeDir: string): string | null {
  switch (platform) {
    case "win32":
      return installWindowsStartup(rootDir, paths, homeDir);
    case "darwin":
      return installMacosLaunchAgent(rootDir, paths, homeDir);
    case "linux":
      return installLinuxUserService(rootDir, paths, homeDir);
    default:
      return null;
  }
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readExistingRuntimeConfig(paths: RuntimePaths): RuntimeConfig {
  const config = readJsonObject(configFile(paths));
  const sync = config.sync && typeof config.sync === "object"
    ? config.sync as Record<string, unknown>
    : {};
  const daemon = config.daemon && typeof config.daemon === "object"
    ? config.daemon as Record<string, unknown>
    : {};

  const remote = typeof sync.remote === "string" && sync.remote.trim().length > 0
    ? sync.remote
    : "origin";
  const intervalSeconds = typeof daemon.intervalSeconds === "number" && Number.isFinite(daemon.intervalSeconds)
    ? daemon.intervalSeconds
    : 30;
  const portableState = config.portableState === true;
  const mcpLogging = (typeof config.mcpLogging === "string" && ["off", "minimal", "default"].includes(config.mcpLogging))
    ? config.mcpLogging as "off" | "minimal" | "default"
    : "minimal";

  if (typeof sync.stateRef === "string" && sync.stateRef.trim().length > 0) {
    return {
      remote,
      syncTarget: resolveSyncTarget({ stateRef: sync.stateRef }),
      intervalSeconds,
      portableState,
      mcpLogging,
      safeMode: config.safeMode === true,
    };
  }

  return {
    remote,
    syncTarget: resolveSyncTarget({}),
    intervalSeconds,
    portableState,
    mcpLogging,
    safeMode: config.safeMode === true,
  };
}

export function validateRuntimeConfig(paths: RuntimePaths): ConfigFinding[] {
  const filePath = configFile(paths);
  const findings: ConfigFinding[] = [];

  // 1. Repository Containment Validation
  const containmentDiagnostics: string[] = [];
  getRuntimePaths(paths.rootDir, containmentDiagnostics);
  for (const diag of containmentDiagnostics) {
    findings.push({
      level: "error",
      field: "runtime",
      message: diag,
      status: "malformed",
      fix: "Use relative paths that stay inside the repository root in holistic.repo.json."
    });
  }

  // 2. Config File Existence
  if (!fs.existsSync(filePath)) {
    findings.push({
      level: "warn",
      field: "config.json",
      message: "Configuration file is missing; using system defaults.",
      status: "missing",
      fix: "Run 'holistic init' to generate a default configuration."
    });
    return findings; // No more fields to check if file is missing
  }

  const raw = readJsonObject(filePath);

  // mcpLogging validation
  if (!("mcpLogging" in raw)) {
    findings.push({ 
      level: "info", 
      field: "mcpLogging", 
      message: "mcpLogging not specified; defaulting to 'minimal'.", 
      status: "missing",
      fix: `Set 'mcpLogging' to off|minimal|default in ${relativePath(paths.rootDir, configFile(paths))}`
    });
  } else if (typeof raw.mcpLogging !== "string" || !["off", "minimal", "default"].includes(raw.mcpLogging)) {
    findings.push({ 
      level: "warn", 
      field: "mcpLogging", 
      message: `Invalid value '${raw.mcpLogging}'; using 'minimal'.`, 
      status: "malformed",
      fix: "Use one of: off, minimal, default"
    });
  }

  // portableState validation
  if (!("portableState" in raw)) {
    findings.push({ 
      level: "info", 
      field: "portableState", 
      message: "portableState not specified; defaulting to false.", 
      status: "missing",
      fix: "Set 'portableState': true to enable remote sync"
    });
  } else if (typeof raw.portableState !== "boolean") {
    findings.push({ 
      level: "warn", 
      field: "portableState", 
      message: "portableState must be a boolean; using false.", 
      status: "malformed",
      fix: "Set 'portableState' to true or false"
    });
  }

  const daemon = (raw.daemon && typeof raw.daemon === "object") ? raw.daemon as Record<string, unknown> : null;
  if (!daemon) {
    findings.push({ level: "info", field: "daemon", message: "daemon section missing; using defaults.", status: "missing" });
  } else {
    if (!("intervalSeconds" in daemon)) {
      findings.push({ 
        level: "info", 
        field: "daemon.intervalSeconds", 
        message: "intervalSeconds missing; using 30s.", 
        status: "missing",
        fix: "Define 'daemon.intervalSeconds' as a positive integer"
      });
    } else if (typeof daemon.intervalSeconds !== "number" || daemon.intervalSeconds <= 0) {
      findings.push({ 
        level: "warn", 
        field: "daemon.intervalSeconds", 
        message: "intervalSeconds must be a positive number; using 30s.", 
        status: "malformed",
        fix: "Ensure intervalSeconds is a positive integer (e.g. 30, 60)"
      });
    }
  }

  const sync = (raw.sync && typeof raw.sync === "object") ? raw.sync as Record<string, unknown> : null;
  if (!sync) {
    findings.push({ level: "info", field: "sync", message: "sync section missing; using 'origin' and default state branch.", status: "missing" });
  } else {
    if (typeof sync.remote !== "string" || sync.remote.trim() === "") {
      findings.push({ 
        level: "warn", 
        field: "sync.remote", 
        message: "Invalid or missing remote; using 'origin'.", 
        status: "malformed",
        fix: "Specify a valid Git remote name (e.g. origin, upstream)"
      });
    }
    const hasStrategy = (sync.strategy === "state-ref" || sync.strategy === "state-branch");
    if (sync.strategy && !hasStrategy) {
      findings.push({ 
        level: "warn", 
        field: "sync.strategy", 
        message: "Invalid sync strategy; defaulting to state-ref behavior.", 
        status: "unsupported",
        fix: "Use 'state-ref' (recommended) or 'state-branch'"
      });
    }
  }

  return findings;
}

function writeClaudeDesktopMcpConfig(rootDir: string, platform: NodeJS.Platform, homeDir: string): string {
  const configPath = mcpConfigFile(platform, homeDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  const runtime = runtimeEntryScript("cli");
  const existing = readJsonObject(configPath);
  const existingServers = existing.mcpServers && typeof existing.mcpServers === "object"
    ? existing.mcpServers as Record<string, unknown>
    : {};

  const next = {
    ...existing,
    mcpServers: {
      ...existingServers,
      holistic: {
        command: process.execPath,
        args: [
          ...(runtime.useStripTypes ? ["--experimental-strip-types"] : []),
          runtime.scriptPath,
          "serve",
        ],
        env: {
          HOLISTIC_REPO: rootDir,
        },
      },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + "\n", "utf8");
  return configPath;
}

function buildHookCommand(rootDir: string, paths: RuntimePaths): HookCommand {
  const cliRuntime = runtimeEntryScript("cli");
  const config = readExistingRuntimeConfig(paths);
  return {
    nodePath: process.execPath,
    scriptPath: cliRuntime.scriptPath,
    useStripTypes: cliRuntime.useStripTypes,
    stateFilePath: path.relative(rootDir, paths.stateFile).replaceAll("\\", "/"),
    syncPowerShellPath: path.relative(rootDir, path.join(systemDir(paths), "sync-state.ps1")).replaceAll("\\", "/"),
    syncShellPath: path.relative(rootDir, path.join(systemDir(paths), "sync-state.sh")).replaceAll("\\", "/"),
    syncLogPath: path.relative(rootDir, path.join(systemDir(paths), "sync.log")).replaceAll("\\", "/"),
    portableState: config.portableState,
  };
}

function verifyBootstrapSetup(rootDir: string, result: InitResult, platform: NodeJS.Platform, homeDir: string, configureMcp: boolean): { checks: string[]; mcpConfigFile: string | null } {
  const checks: string[] = [];

  for (const hook of result.gitHooks) {
    const hookPath = path.join(rootDir, ".git", "hooks", hook);
    if (!fs.existsSync(hookPath)) {
      throw new Error(`Expected git hook was not installed: ${hook}`);
    }
  }
  checks.push("git-hooks");

  let configuredMcpPath: string | null = null;
  if (configureMcp) {
    configuredMcpPath = mcpConfigFile(platform, homeDir);
    const config = readJsonObject(configuredMcpPath);
    const mcpServers = config.mcpServers && typeof config.mcpServers === "object"
      ? config.mcpServers as Record<string, unknown>
      : {};
    if (!("holistic" in mcpServers)) {
      throw new Error("Expected Claude Desktop MCP configuration for Holistic.");
    }
    checks.push("mcp-config");
  }

  if (result.installed) {
    if (!result.startupTarget || !fs.existsSync(result.startupTarget)) {
      throw new Error("Expected daemon startup target to exist after bootstrap.");
    }
    checks.push("daemon");
  }

  return {
    checks,
    mcpConfigFile: configuredMcpPath,
  };
}

export function checkHolisticHooksStatus(rootDir: string): GitHookInstallResult {
  const paths = getRuntimePaths(rootDir);
  return getGitHooksStatus(rootDir, resolveGitDir(rootDir), buildHookCommand(rootDir, paths));
}

export function refreshHolisticHooks(rootDir: string): GitHookInstallResult {
  const paths = getRuntimePaths(rootDir);
  return refreshGitHooks(rootDir, resolveGitDir(rootDir), buildHookCommand(rootDir, paths));
}

/**
 * Re-stamp adapter docs that lost the generated marker, then refresh them from
 * the built-in templates. Returns the file names that were re-stamped.
 *
 * This exists because a marker-less adapter is silently frozen: it is treated as
 * user-authored, so it never receives new template sections (capability, turn
 * hook config), which in turn disables the whole data-driven turn-hook
 * installer for that agent. Docs carrying HOLISTIC-USER-EDITED are never
 * touched -- that marker is the documented permanent opt-out.
 */
export function refreshStaleAdapterDocs(rootDir: string, paths: RuntimePaths): string[] {
  if (!fs.existsSync(paths.adaptersDir)) return [];
  let adapterFiles: string[];
  try {
    adapterFiles = fs.readdirSync(paths.adaptersDir).filter((f) => f.endsWith(".md"));
  } catch { return []; }

  const restamped: string[] = [];
  for (const fileName of adapterFiles) {
    if (restampGeneratedMarker(path.join(paths.adaptersDir, fileName))) {
      restamped.push(fileName);
    }
  }
  if (restamped.length > 0) {
    const { state } = loadState(rootDir);
    writeDerivedDocs(paths, state);
  }
  return restamped;
}

export function repairHolistic(rootDir: string, options: RepairOptions = {}): RepairResult {
  const { paths } = loadState(rootDir);
  writeManagedGitAttributes(rootDir, paths);

  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const config = readExistingRuntimeConfig(paths);

  const adaptersRefreshed = options.refreshAdapters ? refreshStaleAdapterDocs(rootDir, paths) : [];

  writeSystemArtifacts(rootDir, paths, config.intervalSeconds, config.remote, config.syncTarget, config.portableState);

  let startupTarget: string | null = null;
  if (options.installDaemon) {
    startupTarget = installDaemon(rootDir, paths, platform, homeDir);
  }

  let gitHooksInstalled = false;
  let gitHooks: string[] = [];
  let gitHookWarnings: string[] = [];
  if (options.refreshHooks !== false) {
    const hookResult = refreshGitHooks(rootDir, resolveGitDir(rootDir), buildHookCommand(rootDir, paths));
    gitHooksInstalled = hookResult.installed;
    gitHooks = hookResult.hooks;
    gitHookWarnings = hookResult.warnings;
  }

  if (fs.existsSync(path.join(rootDir, ".claude"))) {
    const holisticCmd = holisticCmdForPlatform(rootDir, platform);
    installClaudeCodeHooks(rootDir, holisticCmd, platform);
    installAndonHooks(rootDir, paths, platform);
  }
  const turnHookResult = installAllTurnHooks(rootDir, paths, platform, homeDir);

  const configuredMcpPath = options.configureMcp
    ? writeClaudeDesktopMcpConfig(rootDir, platform, homeDir)
    : null;

  const checks = ["system-artifacts"];
  if (gitHooksInstalled) {
    checks.push("git-hooks");
  }
  if (configuredMcpPath) {
    checks.push("mcp-config");
  }
  if (startupTarget) {
    checks.push("daemon");
  }
  if (turnHookResult.installedAgents.length > 0) {
    checks.push("turn-hooks");
  }

  return {
    installed: Boolean(startupTarget),
    gitHooksInstalled,
    gitHooks,
    gitHookWarnings,
    platform,
    startupTarget,
    systemDir: systemDir(paths),
    configFile: configFile(paths),
    mcpConfigured: Boolean(configuredMcpPath),
    mcpConfigFile: configuredMcpPath,
    checks,
    adaptersRefreshed,
    turnHookWarnings: turnHookResult.warnings,
  };
}

export function initializeHolistic(rootDir: string, options: InitOptions = {}): InitResult {
  const { state, paths } = loadState(rootDir);
  persist(rootDir, state, paths);

  if (options.installGitAttributes !== false) {
    writeManagedGitAttributes(rootDir, paths);
  }

  const intervalSeconds = options.intervalSeconds ?? 30;
  const remote = options.remote ?? "origin";
  const syncTarget = resolveSyncTarget(options);
  writeConfig(paths, options, remote, syncTarget, intervalSeconds);
  writeSystemArtifacts(rootDir, paths, intervalSeconds, remote, syncTarget, options.portableState ?? false);

  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  let startupTarget: string | null = null;
  let gitHooksInstalled = false;
  let gitHooks: string[] = [];
  let gitHookWarnings: string[] = [];

  if (options.installDaemon) {
    startupTarget = installDaemon(rootDir, paths, platform, homeDir);
  }

  if (options.installGitHooks) {
    const hookResult = installGitHooks(rootDir, resolveGitDir(rootDir), buildHookCommand(rootDir, paths));
    gitHooksInstalled = hookResult.installed;
    gitHooks = hookResult.hooks;
    gitHookWarnings = hookResult.warnings;
  }

  return {
    installed: Boolean(startupTarget),
    gitHooksInstalled,
    gitHooks,
    gitHookWarnings,
    platform,
    startupTarget,
    systemDir: systemDir(paths),
    configFile: configFile(paths),
  };
}

export function bootstrapHolistic(rootDir: string, options: BootstrapOptions = {}): BootstrapResult {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const configureMcp = options.configureMcp !== false;

  const initResult = initializeHolistic(rootDir, {
    ...options,
    platform,
    homeDir,
    installDaemon: options.installDaemon !== false,
    installGitHooks: options.installGitHooks !== false,
  });

  // Slice 1: detect Claude Code environment
  const claudeCodePresent = fs.existsSync(path.join(rootDir, ".claude"));

  // Slice 3 & 4: install or refresh Claude Code SessionStart hook
  if (claudeCodePresent && options.installClaudeHooks !== false) {
    const holisticCmd = holisticCmdForPlatform(rootDir, platform);
    installClaudeCodeHooks(rootDir, holisticCmd, platform);
    console.log("\u2713 Claude Code SessionStart hook installed");
    installAndonHooks(rootDir, getRuntimePaths(rootDir), platform);
    console.log("\u2713 Andon PostToolUse and Stop hooks installed");
  }
  installAllTurnHooks(rootDir, getRuntimePaths(rootDir), platform, homeDir);

  const configuredMcpPath = configureMcp
    ? writeClaudeDesktopMcpConfig(rootDir, platform, homeDir)
    : null;
  const verification = verifyBootstrapSetup(rootDir, initResult, platform, homeDir, configureMcp);

  return {
    ...initResult,
    mcpConfigured: configureMcp,
    mcpConfigFile: configuredMcpPath ?? verification.mcpConfigFile,
    checks: verification.checks,
  };
}

export interface BootstrapPlanEntry {
  /** Absolute path this action would write to or remove. */
  target: string;
  action: "write" | "merge" | "remove";
  description: string;
  /** True when the path is outside the repository. */
  outsideRepo: boolean;
}

export interface BootstrapPlan {
  entries: BootstrapPlanEntry[];
}

function daemonStartupTarget(rootDir: string, platform: NodeJS.Platform, homeDir: string): string | null {
  const slug = projectSlug(rootDir);
  switch (platform) {
    case "win32":
      return path.join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup", `holistic-${slug}.cmd`);
    case "darwin":
      return path.join(homeDir, "Library", "LaunchAgents", `com.holistic.${slug}.plist`);
    case "linux":
      return path.join(homeDir, ".config", "systemd", "user", `holistic-${slug}.service`);
    default:
      return null;
  }
}

/**
 * Enumerate everything bootstrap would touch, without touching any of it.
 *
 * bootstrap installs OS-level persistence and edits a config file belonging to
 * another application. A confirmation gate that does not say which paths are
 * involved asks the user to consent to something they cannot see.
 */
export function planBootstrap(rootDir: string, options: BootstrapOptions = {}): BootstrapPlan {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const paths = getRuntimePaths(rootDir);
  const entries: BootstrapPlanEntry[] = [];

  const inRepo = (target: string): boolean => isPathInsideDirectory(target, rootDir) || path.resolve(target) === path.resolve(rootDir);
  const add = (target: string, action: BootstrapPlanEntry["action"], description: string): void => {
    entries.push({ target, action, description, outsideRepo: !inRepo(target) });
  };

  add(configFile(paths), "write", "Holistic runtime configuration");
  add(systemDir(paths), "write", "Repo-local CLI wrappers, sync and hook scripts");

  if (options.installGitAttributes !== false) {
    add(path.join(rootDir, ".gitattributes"), "merge", "Holistic-managed line-ending block");
  }

  if (options.installGitHooks !== false) {
    const gitDir = resolveGitDir(rootDir);
    for (const hook of ["post-commit", "post-checkout", "pre-push"]) {
      add(path.join(gitDir ?? path.join(rootDir, ".git"), "hooks", hook), "write", "Holistic-managed git hook");
    }
  }

  if (options.installDaemon !== false) {
    const target = daemonStartupTarget(rootDir, platform, homeDir);
    if (target) {
      add(target, "write", "Background daemon autostart entry");
    }
  }

  if (options.configureMcp !== false) {
    add(mcpConfigFile(platform, homeDir), "merge", "Claude Desktop MCP server entry");
  }

  if (fs.existsSync(path.join(rootDir, ".claude")) && options.installClaudeHooks !== false) {
    add(path.join(rootDir, ".claude", "settings.json"), "merge", "Claude Code session and Andon hooks");
  }

  return { entries };
}

export interface UninstallOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  /** Also remove the Holistic runtime directory, including session memory. */
  purge?: boolean;
  dryRun?: boolean;
}

export interface UninstallResult {
  removed: string[];
  skipped: string[];
  warnings: string[];
}

/**
 * Remove what bootstrap installed.
 *
 * Session memory is left in place unless `purge` is set, because the memory is
 * the point of the tool and uninstalling the machine helpers should not throw
 * away months of project history. Only hooks carrying the HOLISTIC-MANAGED
 * marker are removed, so a user-authored hook is never deleted.
 */
export function uninstallHolistic(rootDir: string, options: UninstallOptions = {}): UninstallResult {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const dryRun = options.dryRun === true;
  const paths = getRuntimePaths(rootDir);
  const removed: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  const removeFile = (target: string, label: string): void => {
    if (!fs.existsSync(target)) {
      skipped.push(`${label} (not present): ${target}`);
      return;
    }
    if (dryRun) {
      removed.push(`${label}: ${target}`);
      return;
    }
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(`${label}: ${target}`);
    } catch (error) {
      warnings.push(`Could not remove ${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 1. Daemon autostart entry.
  const startupTarget = daemonStartupTarget(rootDir, platform, homeDir);
  if (startupTarget) {
    removeFile(startupTarget, "Daemon autostart entry");
    if (platform === "linux") {
      removeFile(
        path.join(homeDir, ".config", "systemd", "user", "default.target.wants", path.basename(startupTarget)),
        "Daemon autostart link",
      );
    }
  }

  // 2. Holistic entry in the Claude Desktop MCP config, preserving other servers.
  const mcpPath = mcpConfigFile(platform, homeDir);
  if (fs.existsSync(mcpPath)) {
    const config = readJsonObject(mcpPath);
    const servers = config.mcpServers && typeof config.mcpServers === "object"
      ? { ...(config.mcpServers as Record<string, unknown>) }
      : {};
    if ("holistic" in servers) {
      delete servers.holistic;
      if (!dryRun) {
        fs.writeFileSync(mcpPath, JSON.stringify({ ...config, mcpServers: servers }, null, 2) + "\n", "utf8");
      }
      removed.push(`MCP server entry: ${mcpPath}`);
    } else {
      skipped.push(`MCP server entry (not present): ${mcpPath}`);
    }
  } else {
    skipped.push(`MCP config (not present): ${mcpPath}`);
  }

  // 3. Managed git hooks only. A user-authored hook must never be deleted.
  const gitDir = resolveGitDir(rootDir);
  if (gitDir) {
    for (const hookName of SUPPORTED_UNINSTALL_HOOKS) {
      const hookPath = path.join(gitDir, "hooks", hookName);
      if (!fs.existsSync(hookPath)) {
        continue;
      }
      const content = fs.readFileSync(hookPath, "utf8");
      if (!content.includes("HOLISTIC-MANAGED")) {
        skipped.push(`Git hook (user-managed, left alone): ${hookPath}`);
        continue;
      }
      removeFile(hookPath, "Git hook");
    }
  }

  // 4. Generated machine-local helpers. These are regenerable from config.
  removeFile(systemDir(paths), "System helpers");

  // 5. Session memory, only on explicit request.
  if (options.purge) {
    removeFile(paths.holisticDir, "Holistic runtime directory (including session memory)");
  } else {
    skipped.push(`Session memory kept: ${paths.holisticDir} (use --purge to remove)`);
  }

  return { removed, skipped, warnings };
}

const SUPPORTED_UNINSTALL_HOOKS = ["post-commit", "post-checkout", "pre-push"];

export function getSetupStatus(rootDir: string, options: BootstrapOptions = {}): SetupComponentStatus[] {
  const { state, paths } = loadState(rootDir);
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const gitDir = resolveGitDir(rootDir);
  const status: SetupComponentStatus[] = [];

  // 1. Git Attributes
  // A repo whose runtime directory is not ".holistic" is deliberately excluded
  // from gitattributes management, so report that as informational. Calling it
  // "missing" implied a broken install and pointed users at bootstrap, which
  // would skip it again.
  const attrPath = path.join(rootDir, ".gitattributes");
  if (!shouldManageGitAttributes(paths)) {
    status.push({
      component: "git-attributes",
      status: "info",
      details: "Not managed: this repo uses a custom runtime directory or doc names.",
      description: "Registers Holistic files for correct line-ending handling in Git.",
    });
  } else if (!fs.existsSync(attrPath)) {
    status.push({
      component: "git-attributes",
      status: "missing",
      details: "No .gitattributes file found.",
      description: "Registers Holistic files for correct line-ending handling in Git.",
    });
  } else {
    const content = fs.readFileSync(attrPath, "utf8");
    const hasManaged = content.includes(HOLISTIC_GITATTRIBUTES_BEGIN);
    status.push({
      component: "git-attributes",
      status: hasManaged ? "ok" : "missing",
      details: hasManaged ? "Managed block detected" : "Managed block missing",
      description: "Registers Holistic files for correct line-ending handling in Git.",
    });
  }

  // 2. Git Hooks
  if (!gitDir) {
    status.push({
      component: "git-hooks",
      status: "error",
      details: "Not a git repository",
      description: "Automates checkpoint creation and state syncing.",
    });
  } else {
    const hookResult = getGitHooksStatus(rootDir, gitDir, buildHookCommand(rootDir, paths));
    const missing = hookResult.hooks.length === 0;
    const outdated = hookResult.refreshed.length > 0;
    // Hooks Holistic declined to touch are a deliberate choice, not a defect:
    // refusing to overwrite a user-authored hook is the documented behaviour.
    const userManaged = hookResult.warnings.some((warning) => warning.includes("user-managed"));
    status.push({
      component: "git-hooks",
      status: missing && userManaged ? "info" : missing ? "missing" : outdated ? "outdated" : "ok",
      details: missing && userManaged
        ? "Existing hooks are user-managed and were left untouched."
        : missing
          ? "No Holistic hooks installed"
          : outdated ? "Hooks need refresh" : "Hooks are up-to-date",
      description: "Automates checkpoint creation and state syncing.",
    });
  }

  // 3. System Helpers
  const sysDir = systemDir(paths);
  const helpersExist = fs.existsSync(localCliCmdPath(sysDir, platform));
  status.push({
    component: "system-helpers",
    status: helpersExist ? "ok" : "missing",
    details: helpersExist ? `Scripts present in ${relativePath(rootDir, sysDir)}` : "Missing scripts",
    description: "Repo-local CLI wrappers and sync scripts.",
  });

  // 4. MCP Config
  const mcpPath = mcpConfigFile(platform, homeDir);
  if (!fs.existsSync(mcpPath)) {
    status.push({
      component: "mcp-config",
      status: "missing",
      details: "Claude Desktop config not found",
      description: "Integrates Holistic with Claude Desktop.",
    });
  } else {
    const config = readJsonObject(mcpPath);
    const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
    const hasHolistic = "holistic" in mcpServers;
    status.push({
      component: "mcp-config",
      status: hasHolistic ? "ok" : "missing",
      details: hasHolistic ? "Claude Desktop configured" : "Holistic entry missing in Claude config",
      description: "Integrates Holistic with Claude Desktop.",
    });
  }

  // 5. Daemon
  const slug = projectSlug(rootDir);
  const daemonTarget = platform === "win32"
    ? path.join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup", `holistic-${slug}.cmd`)
    : platform === "darwin"
      ? path.join(homeDir, "Library", "LaunchAgents", `com.holistic.${slug}.plist`)
      : null;

  if (daemonTarget) {
    const installed = fs.existsSync(daemonTarget);
    status.push({
      component: "daemon",
      status: installed ? "ok" : "missing",
      details: installed ? "Startup entry detected" : "No auto-start entry found",
      description: "Background worker for periodic checkpoints.",
    });
  }

  // 6. Claude Code Hooks
  const claudePresent = fs.existsSync(path.join(rootDir, ".claude"));
  if (claudePresent) {
    const settingsPath = path.join(rootDir, ".claude", "settings.json");
    let installed = false;
    let andonHooksInstalled = false;
    if (fs.existsSync(settingsPath)) {
      const settings = readJsonObject(settingsPath);
      const hooks = (settings.hooks || {}) as Record<string, unknown>;
      const sessionStart = hooks.SessionStart;
      if (Array.isArray(sessionStart)) {
        installed = (sessionStart as ClaudeHookGroup[]).some(
          (group) =>
            group &&
            Array.isArray(group.hooks) &&
            group.hooks.some((h) => h && typeof h.command === "string" && isHolisticCommand(h.command)),
        );
      }
      const postToolUse = hooks.PostToolUse;
      if (Array.isArray(postToolUse)) {
        andonHooksInstalled = (postToolUse as ClaudeHookGroup[]).some(
          (group) =>
            group &&
            Array.isArray(group.hooks) &&
            group.hooks.some((h) => h && typeof h.command === "string" && isAndonHookCommand(h.command)),
        );
      }
    }
    status.push({
      component: "claude-code-hooks",
      status: installed ? "ok" : "missing",
      details: installed ? "SessionStart hook present in settings.json" : "Missing Claude Code hook",
      description: "Syncs Holistic automatically when starting a Claude Code session.",
    });
    status.push({
      component: "andon-hooks",
      status: andonHooksInstalled ? "ok" : "missing",
      details: andonHooksInstalled ? "PostToolUse and Stop hooks present in settings.json" : "Missing Andon event forwarding hooks",
      description: "Forwards Claude Code tool events to the Andon API for real-time session monitoring.",
      andonHooksInstalled,
    });
  }

  // 7. Portable State (Privacy)
  const config = readExistingRuntimeConfig(paths);
  const rawConfig = readJsonObject(configFile(paths));
  const isEnabled = rawConfig.portableState === true;
  status.push({
    component: "portable-state",
    status: isEnabled ? "ok" : "info",
    details: isEnabled ? "Remote-sync enabled" : "Local-only (Privacy Mode)",
    description: "Syncs session state to a portable Git branch (refs/holistic/state).",
  });

  // 8. Configuration Validation
  const configFindings = validateRuntimeConfig(paths);
  const configErrors = configFindings.filter(f => f.level === "error").length;
  const configWarns = configFindings.filter(f => f.level === "warn").length;
  status.push({
    component: "config-validation",
    status: configErrors > 0 ? "error" : configWarns > 0 ? "outdated" : "ok",
    details: configErrors > 0 ? `${configErrors} errors found` : configWarns > 0 ? `${configWarns} warnings (safe fallbacks applied)` : "Configuration is valid",
    description: `Checks ${relativePath(rootDir, configFile(paths))} for schema compliance and safe fallbacks.`,
  });

  // 9. Session Health (All files)
  const sessionsDir = paths.sessionsDir;
  let sessionErrors = 0;
  if (fs.existsSync(sessionsDir)) {
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(sessionsDir, file), "utf8");
        JSON.parse(content);
      } catch {
        sessionErrors++;
      }
    }
  }
  status.push({
    component: "session-hygiene",
    status: sessionErrors > 0 ? "error" : "ok",
    details: sessionErrors > 0 ? `${sessionErrors} malformed session files detected` : "All session files are well-formed JSON",
    description: `Scans ${relativePath(rootDir, paths.sessionsDir)}/ to ensure all state files are readable.`,
  });

  // 10. State Integrity
  const stateDegraded = state.degraded === true;
  const stateDiagnostics = (state.diagnostics || []).filter(d => !d.startsWith("Security Warning")).length;
  status.push({
    component: "state-integrity",
    status: stateDegraded ? "error" : stateDiagnostics > 0 ? "info" : "ok",
    details: stateDegraded ? "State is degraded (corruption detected)" : stateDiagnostics > 0 ? `${stateDiagnostics} internal diagnostics reported` : "State is healthy",
    description: "Checks the integrity of the core state.json file.",
  });

  return status;
}

function localCliCmdPath(sysDir: string, platform: NodeJS.Platform): string {
  return platform === "win32" ? path.join(sysDir, "holistic.cmd") : path.join(sysDir, "holistic");
}
