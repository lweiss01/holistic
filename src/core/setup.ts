import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeDerivedDocs } from "./docs.js";
import { captureRepoSnapshot } from "./git.js";
import { loadState, saveState } from "./state.js";
import type { AgentName, HolisticState, RuntimePaths } from "./types.js";

export interface InitOptions {
  installDaemon?: boolean;
  platform?: NodeJS.Platform;
  homeDir?: string;
  intervalSeconds?: number;
  agent?: AgentName;
  remote?: string;
  stateBranch?: string;
}

export interface InitResult {
  installed: boolean;
  platform: string;
  startupTarget: string | null;
  systemDir: string;
  configFile: string;
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

function quotePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}

function shellQuote(value: string): string {
  return value.replace(/'/g, `'"'"'`);
}

function writeConfig(paths: RuntimePaths, remote: string, stateBranch: string, intervalSeconds: number): void {
  const config = {
    version: 1,
    sync: {
      strategy: "state-branch",
      remote,
      stateBranch,
      postHandoffPush: true,
      restoreOnStartup: true,
      trackedPaths: ["HOLISTIC.md", "AGENTS.md", ".holistic"],
    },
    daemon: {
      intervalSeconds,
      agent: "unknown",
    },
  };

  fs.writeFileSync(configFile(paths), JSON.stringify(config, null, 2) + "\n", "utf8");
}

function writeSystemArtifacts(rootDir: string, paths: RuntimePaths, intervalSeconds: number, remote: string, stateBranch: string): void {
  const sysDir = systemDir(paths);
  fs.mkdirSync(sysDir, { recursive: true });
  const nodePath = process.execPath;
  const daemonPath = path.join(rootDir, "src", "daemon.ts");
  const restorePs1Path = path.join(sysDir, "restore-state.ps1");
  const syncPs1Path = path.join(sysDir, "sync-state.ps1");
  const restoreShPath = path.join(sysDir, "restore-state.sh");
  const syncShPath = path.join(sysDir, "sync-state.sh");

  const restorePs1 = [
    "$ErrorActionPreference = 'Stop'",
    `$root = '${quotePowerShell(rootDir)}'`,
    `$remote = '${quotePowerShell(remote)}'`,
    `$stateBranch = '${quotePowerShell(stateBranch)}'`,
    "$tracked = @('HOLISTIC.md','AGENTS.md','.holistic')",
    "$status = git -C $root status --porcelain -- HOLISTIC.md AGENTS.md .holistic 2>$null",
    "if ($LASTEXITCODE -ne 0) { exit 0 }",
    "if ($status) { Write-Host 'Holistic restore skipped because local Holistic files are dirty.'; exit 0 }",
    "git -C $root fetch $remote $stateBranch 2>$null",
    "if ($LASTEXITCODE -ne 0) { Write-Host 'Holistic restore skipped because remote state branch is unavailable.'; exit 0 }",
    "git -C $root checkout FETCH_HEAD -- HOLISTIC.md AGENTS.md .holistic 2>$null | Out-Null",
  ].join("\n");

  const syncPs1 = [
    "$ErrorActionPreference = 'Stop'",
    `$root = '${quotePowerShell(rootDir)}'`,
    `$remote = '${quotePowerShell(remote)}'`,
    `$stateBranch = '${quotePowerShell(stateBranch)}'`,
    "$branch = git -C $root rev-parse --abbrev-ref HEAD",
    "if ($LASTEXITCODE -ne 0) { throw 'Unable to determine current branch.' }",
    "git -C $root push $remote $branch",
    "$tmp = Join-Path $env:TEMP ('holistic-state-' + [guid]::NewGuid().ToString())",
    "git -C $root worktree add --force $tmp | Out-Null",
    "try {",
    "  Push-Location $tmp",
    "  git switch $stateBranch 2>$null | Out-Null",
    "  if ($LASTEXITCODE -ne 0) {",
    "    git switch --orphan $stateBranch | Out-Null",
    "  }",
    "  Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue",
    `  Copy-Item -Path (Join-Path $root 'HOLISTIC.md') -Destination (Join-Path $tmp 'HOLISTIC.md') -Force`,
    `  Copy-Item -Path (Join-Path $root 'AGENTS.md') -Destination (Join-Path $tmp 'AGENTS.md') -Force`,
    `  Copy-Item -Path (Join-Path $root '.holistic') -Destination (Join-Path $tmp '.holistic') -Recurse -Force`,
    "  git add HOLISTIC.md AGENTS.md .holistic",
    "  git diff --cached --quiet",
    "  if ($LASTEXITCODE -ne 0) {",
    "    git commit -m 'chore(holistic): sync portable state' | Out-Null",
    "  }",
    "  git push $remote HEAD:$stateBranch",
    "} finally {",
    "  Pop-Location",
    "  git -C $root worktree remove --force $tmp | Out-Null",
    "}",
  ].join("\n");

  const restoreSh = [
    "#!/usr/bin/env sh",
    `ROOT='${shellQuote(rootDir)}'`,
    `REMOTE='${shellQuote(remote)}'`,
    `STATE_BRANCH='${shellQuote(stateBranch)}'`,
    "if ! git -C \"$ROOT\" diff --quiet -- HOLISTIC.md AGENTS.md .holistic 2>/dev/null; then",
    "  echo 'Holistic restore skipped because local Holistic files are dirty.'",
    "  exit 0",
    "fi",
    "if ! git -C \"$ROOT\" fetch \"$REMOTE\" \"$STATE_BRANCH\" 2>/dev/null; then",
    "  echo 'Holistic restore skipped because remote state branch is unavailable.'",
    "  exit 0",
    "fi",
    "git -C \"$ROOT\" checkout FETCH_HEAD -- HOLISTIC.md AGENTS.md .holistic 2>/dev/null || true",
  ].join("\n");

  const syncSh = [
    "#!/usr/bin/env sh",
    `ROOT='${shellQuote(rootDir)}'`,
    `REMOTE='${shellQuote(remote)}'`,
    `STATE_BRANCH='${shellQuote(stateBranch)}'`,
    "BRANCH=$(git -C \"$ROOT\" rev-parse --abbrev-ref HEAD) || exit 1",
    "git -C \"$ROOT\" push \"$REMOTE\" \"$BRANCH\" || exit 1",
    "TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t holistic-state)",
    "git -C \"$ROOT\" worktree add --force \"$TMPDIR\" >/dev/null 2>&1 || exit 1",
    "cleanup() { git -C \"$ROOT\" worktree remove --force \"$TMPDIR\" >/dev/null 2>&1; }",
    "trap cleanup EXIT",
    "cd \"$TMPDIR\" || exit 1",
    "git switch \"$STATE_BRANCH\" >/dev/null 2>&1 || git switch --orphan \"$STATE_BRANCH\" >/dev/null 2>&1 || exit 1",
    "find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +",
    "cp \"$ROOT/HOLISTIC.md\" ./HOLISTIC.md",
    "cp \"$ROOT/AGENTS.md\" ./AGENTS.md",
    "cp -R \"$ROOT/.holistic\" ./.holistic",
    "git add HOLISTIC.md AGENTS.md .holistic",
    "git diff --cached --quiet || git commit -m 'chore(holistic): sync portable state' >/dev/null 2>&1",
    "git push \"$REMOTE\" HEAD:\"$STATE_BRANCH\"",
  ].join("\n");

  const runPs1 = [
    "$ErrorActionPreference = 'Stop'",
    `$node = '${quotePowerShell(nodePath)}'`,
    `$daemon = '${quotePowerShell(daemonPath)}'`,
    `$working = '${quotePowerShell(rootDir)}'`,
    `& '${quotePowerShell(restorePs1Path)}'`,
    `& $node --experimental-strip-types $daemon --interval ${intervalSeconds} --agent unknown`,
  ].join("\n");

  const runSh = [
    "#!/usr/bin/env sh",
    `cd '${shellQuote(rootDir)}' || exit 1`,
    `'${shellQuote(restoreShPath)}' || true`,
    `'${shellQuote(nodePath)}' --experimental-strip-types '${shellQuote(daemonPath)}' --interval ${intervalSeconds} --agent unknown`,
  ].join("\n");

  const readme = `# Holistic System Setup

This directory contains generated startup and sync helpers for Holistic.

Files:
- run-daemon.ps1 / run-daemon.sh: restore the portable state, then start the background daemon
- restore-state.ps1 / restore-state.sh: pull the portable Holistic state branch into the current worktree when safe
- sync-state.ps1 / sync-state.sh: push the current branch and mirror Holistic files into the dedicated state branch
- config in ../config.json defines the remote and portable state branch
`;

  fs.writeFileSync(path.join(sysDir, "run-daemon.ps1"), runPs1 + "\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "run-daemon.sh"), runSh + "\n", "utf8");
  fs.writeFileSync(restorePs1Path, restorePs1 + "\n", "utf8");
  fs.writeFileSync(syncPs1Path, syncPs1 + "\n", "utf8");
  fs.writeFileSync(restoreShPath, restoreSh + "\n", "utf8");
  fs.writeFileSync(syncShPath, syncSh + "\n", "utf8");
  fs.writeFileSync(path.join(sysDir, "README.md"), readme, "utf8");
}

function installWindowsStartup(rootDir: string, homeDir: string): string {
  const startupDir = path.join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
  fs.mkdirSync(startupDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(startupDir, `holistic-${slug}.cmd`);
  const psScript = path.join(rootDir, ".holistic", "system", "run-daemon.ps1");
  const content = [
    "@echo off",
    `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"${psScript}\"`,
  ].join("\r\n");
  fs.writeFileSync(target, content + "\r\n", "utf8");
  return target;
}

function installMacosLaunchAgent(rootDir: string, homeDir: string): string {
  const launchAgentsDir = path.join(homeDir, "Library", "LaunchAgents");
  fs.mkdirSync(launchAgentsDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(launchAgentsDir, `com.holistic.${slug}.plist`);
  const runScript = path.join(rootDir, ".holistic", "system", "run-daemon.sh");
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

function installLinuxUserService(rootDir: string, homeDir: string): string {
  const userSystemdDir = path.join(homeDir, ".config", "systemd", "user");
  const wantsDir = path.join(userSystemdDir, "default.target.wants");
  fs.mkdirSync(userSystemdDir, { recursive: true });
  fs.mkdirSync(wantsDir, { recursive: true });
  const slug = projectSlug(rootDir);
  const target = path.join(userSystemdDir, `holistic-${slug}.service`);
  const runScript = path.join(rootDir, ".holistic", "system", "run-daemon.sh");
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

function installDaemon(rootDir: string, platform: NodeJS.Platform, homeDir: string): string | null {
  switch (platform) {
    case "win32":
      return installWindowsStartup(rootDir, homeDir);
    case "darwin":
      return installMacosLaunchAgent(rootDir, homeDir);
    case "linux":
      return installLinuxUserService(rootDir, homeDir);
    default:
      return null;
  }
}

export function initializeHolistic(rootDir: string, options: InitOptions = {}): InitResult {
  const { state, paths } = loadState(rootDir);
  persist(rootDir, state, paths);

  const intervalSeconds = options.intervalSeconds ?? 30;
  const remote = options.remote ?? "origin";
  const stateBranch = options.stateBranch ?? "holistic/state";
  writeConfig(paths, remote, stateBranch, intervalSeconds);
  writeSystemArtifacts(rootDir, paths, intervalSeconds, remote, stateBranch);

  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  let startupTarget: string | null = null;

  if (options.installDaemon) {
    startupTarget = installDaemon(rootDir, platform, homeDir);
  }

  return {
    installed: Boolean(startupTarget),
    platform,
    startupTarget,
    systemDir: systemDir(paths),
    configFile: configFile(paths),
  };
}
