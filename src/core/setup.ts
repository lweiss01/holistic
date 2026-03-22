import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeDerivedDocs } from './docs.ts';
import { captureRepoSnapshot, resolveGitDir } from './git.ts';
import { installGitHooks, refreshGitHooks, type GitHookInstallResult, type HookCommand } from './git-hooks.ts';
import { getRuntimePaths, loadState, saveState } from './state.ts';
import type { AgentName, HolisticState, RuntimePaths } from './types.ts';

const DEFAULT_STATE_REF = "refs/holistic/state";
const DEFAULT_LEGACY_STATE_BRANCH = "holistic/state";
const TEMP_SYNC_BRANCH = "holistic-sync-tmp";

export interface InitOptions {
  installDaemon?: boolean;
  installGitHooks?: boolean;
  platform?: NodeJS.Platform;
  homeDir?: string;
  intervalSeconds?: number;
  agent?: AgentName;
  remote?: string;
  stateRef?: string;
  stateBranch?: string;
}

export interface BootstrapOptions extends InitOptions {
  configureMcp?: boolean;
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

interface RepoSetupConfigShape {
  syncDefaults?: {
    autoSync?: boolean;
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
  writeDerivedDocs(paths, state);
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

function runtimeEntryScript(name: "cli" | "daemon"): { scriptPath: string; useStripTypes: boolean } {
  const currentFile = fileURLToPath(import.meta.url);
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

function writeConfig(paths: RuntimePaths, remote: string, syncTarget: SyncTarget, intervalSeconds: number): void {
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
    sync: syncConfig,
    daemon: {
      intervalSeconds,
      agent: "unknown",
    },
  };

  fs.writeFileSync(configFile(paths), JSON.stringify(config, null, 2) + "\n", "utf8");
}

function writeSystemArtifacts(rootDir: string, paths: RuntimePaths, intervalSeconds: number, remote: string, syncTarget: SyncTarget): void {
  const sysDir = systemDir(paths);
  fs.mkdirSync(sysDir, { recursive: true });
  const trackedPaths = paths.trackedPaths;
  const nodePath = process.execPath;
  const daemonRuntime = runtimeEntryScript("daemon");
  const daemonPath = daemonRuntime.scriptPath;
  const restorePs1Path = path.join(sysDir, "restore-state.ps1");
  const syncPs1Path = path.join(sysDir, "sync-state.ps1");
  const restoreShPath = path.join(sysDir, "restore-state.sh");
  const syncShPath = path.join(sysDir, "sync-state.sh");
  const legacySeedRef = syncTarget.legacySeedBranch ? branchToRef(syncTarget.legacySeedBranch) : "";

  const restorePs1 = [
    "$ErrorActionPreference = 'Stop'",
    "if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) { $PSNativeCommandUseErrorActionPreference = $false }",
    `$root = '${quotePowerShell(rootDir)}'`,
    `$remote = '${quotePowerShell(remote)}'`,
    `$stateRef = '${quotePowerShell(syncTarget.ref)}'`,
    `$legacySeedRef = '${quotePowerShell(legacySeedRef)}'`,
    `$tracked = @(${powerShellStringArray(trackedPaths)})`,
    "$status = git -C $root status --porcelain -- $tracked 2>$null",
    "if ($LASTEXITCODE -ne 0) { exit 0 }",
    "if ($status) { Write-Host 'Holistic restore skipped because local Holistic files are dirty.'; exit 0 }",
    "$restored = $false",
    "try {",
    "  git -C $root fetch --quiet $remote $stateRef *> $null",
    "  if ($LASTEXITCODE -eq 0) {",
    "    git -C $root checkout FETCH_HEAD -- $tracked 2>$null | Out-Null",
    "    $restored = $true",
    "  }",
    "} catch {",
    "  $restored = $false",
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
    `$root = '${quotePowerShell(rootDir)}'`,
    `$remote = '${quotePowerShell(remote)}'`,
    `$stateRef = '${quotePowerShell(syncTarget.ref)}'`,
    `$legacySeedRef = '${quotePowerShell(legacySeedRef)}'`,
    "$branch = git -c core.hooksPath=NUL -C $root rev-parse --abbrev-ref HEAD",
    "if ($LASTEXITCODE -ne 0) { throw 'Unable to determine current branch.' }",
    "git -c core.hooksPath=NUL -C $root push $remote $branch",
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
    "    git -c core.hooksPath=NUL commit -m 'chore(holistic): sync portable state' | Out-Null",
    "  }",
    "  git -c core.hooksPath=NUL push $remote HEAD:$stateRef",
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
    `if ! git -C "$ROOT" diff --quiet -- ${shellPathList(trackedPaths)} 2>/dev/null; then`,
    "  echo 'Holistic restore skipped because local Holistic files are dirty.'",
    "  exit 0",
    "fi",
    "RESTORED=false",
    "if git -C \"$ROOT\" fetch \"$REMOTE\" \"$STATE_REF\" >/dev/null 2>&1; then",
    `  git -C "$ROOT" checkout FETCH_HEAD -- ${shellPathList(trackedPaths)} >/dev/null 2>&1 || true`,
    "  RESTORED=true",
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
    `ROOT='${shellQuote(rootDir)}'`,
    `REMOTE='${shellQuote(remote)}'`,
    `STATE_REF='${shellQuote(syncTarget.ref)}'`,
    `LEGACY_SEED_REF='${shellQuote(legacySeedRef)}'`,
    "BRANCH=$(git -c core.hooksPath=/dev/null -C \"$ROOT\" rev-parse --abbrev-ref HEAD) || exit 1",
    "git -c core.hooksPath=/dev/null -C \"$ROOT\" push \"$REMOTE\" \"$BRANCH\" || exit 1",
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
    "  git -c core.hooksPath=/dev/null fetch --quiet \"$REMOTE\" \"$STATE_REF\" >/dev/null 2>&1 || exit 1",
    "  git -c core.hooksPath=/dev/null switch --detach FETCH_HEAD >/dev/null 2>&1 || exit 1",
    "elif [ \"$REMOTE_LEGACY_EXISTS\" = \"true\" ]; then",
    "  git -c core.hooksPath=/dev/null fetch --quiet \"$REMOTE\" \"$LEGACY_SEED_REF\" >/dev/null 2>&1 || exit 1",
    "  git -c core.hooksPath=/dev/null switch --detach FETCH_HEAD >/dev/null 2>&1 || exit 1",
    "else",
    `  git -c core.hooksPath=/dev/null switch --orphan "${TEMP_SYNC_BRANCH}" >/dev/null 2>&1 || exit 1`,
    "fi",
    "find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +",
    ...buildShellCopyCommands(trackedPaths),
    `git -c core.hooksPath=/dev/null add ${trackedPaths.map((trackedPath) => `"${trackedPath}"`).join(" ")}`,
    "git -c core.hooksPath=/dev/null diff --cached --quiet || git -c core.hooksPath=/dev/null commit -m 'chore(holistic): sync portable state' >/dev/null 2>&1",
    "git -c core.hooksPath=/dev/null push \"$REMOTE\" HEAD:\"$STATE_REF\"",
  ].join("\n");

  const runPs1 = [
    "$ErrorActionPreference = 'Stop'",
    `$node = '${quotePowerShell(nodePath)}'`,
    `$daemon = '${quotePowerShell(daemonPath)}'`,
    `$working = '${quotePowerShell(rootDir)}'`,
    `& '${quotePowerShell(restorePs1Path)}'`,
    `& $node ${daemonRuntime.useStripTypes ? "--experimental-strip-types " : ""}$daemon --interval ${intervalSeconds} --agent unknown`,
  ].join("\n");

  const runSh = [
    "#!/usr/bin/env sh",
    `cd '${shellQuote(rootDir)}' || exit 1`,
    `'${shellQuote(restoreShPath)}' || true`,
    `'${shellQuote(nodePath)}' ${daemonRuntime.useStripTypes ? "--experimental-strip-types " : ""}'${shellQuote(daemonPath)}' --interval ${intervalSeconds} --agent unknown`,
  ].join("\n");

  const readme = `# Holistic System Setup

This directory contains generated startup and sync helpers for Holistic.

Files:
- run-daemon.ps1 / run-daemon.sh: restore the portable state, then start the background daemon
- restore-state.ps1 / restore-state.sh: pull the portable Holistic state ref into the current worktree when safe
- sync-state.ps1 / sync-state.sh: push the current branch and mirror Holistic files into the portable state ref
- config in ../config.json defines the remote and portable state target
`;

  fs.writeFileSync(path.join(sysDir, "run-daemon.ps1"), runPs1 + "\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "run-daemon.sh"), runSh + "\n", "utf8");
  fs.writeFileSync(restorePs1Path, restorePs1 + "\n", "utf8");
  fs.writeFileSync(syncPs1Path, syncPs1 + "\n", "utf8");
  fs.writeFileSync(restoreShPath, restoreSh + "\n", "utf8");
  fs.writeFileSync(syncShPath, syncSh + "\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "README.md"), readme, "utf8");
}

function installWindowsStartup(rootDir: string, paths: RuntimePaths, homeDir: string): string {
  const startupDir = path.join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  fs.mkdirSync(startupDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(startupDir, `holistic-${slug}.cmd`);
  const psScript = path.join(systemDir(paths), "run-daemon.ps1");
  const content = [
    "@echo off",
    `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"${psScript}\"`,
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
  return {
    nodePath: process.execPath,
    scriptPath: cliRuntime.scriptPath,
    useStripTypes: cliRuntime.useStripTypes,
    stateFilePath: path.relative(rootDir, paths.stateFile).replaceAll("\\", "/"),
    syncPowerShellPath: path.relative(rootDir, path.join(systemDir(paths), "sync-state.ps1")).replaceAll("\\", "/"),
    syncShellPath: path.relative(rootDir, path.join(systemDir(paths), "sync-state.sh")).replaceAll("\\", "/"),
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

export function refreshHolisticHooks(rootDir: string): GitHookInstallResult {
  const paths = getRuntimePaths(rootDir);
  return refreshGitHooks(rootDir, resolveGitDir(rootDir), buildHookCommand(rootDir, paths));
}

export function initializeHolistic(rootDir: string, options: InitOptions = {}): InitResult {
  const { state, paths } = loadState(rootDir);
  persist(rootDir, state, paths);

  const intervalSeconds = options.intervalSeconds ?? 30;
  const remote = options.remote ?? "origin";
  const syncTarget = resolveSyncTarget(options);
  writeConfig(paths, remote, syncTarget, intervalSeconds);
  writeSystemArtifacts(rootDir, paths, intervalSeconds, remote, syncTarget);

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
