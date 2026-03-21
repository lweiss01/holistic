import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getRuntimePaths } from './state.ts';

export type AutoSyncTrigger = "checkpoint" | "handoff";

interface SyncConfigShape {
  autoSync?: boolean;
  sync?: {
    strategy?: string;
    remote?: string;
    stateBranch?: string;
    syncOnCheckpoint?: boolean;
    syncOnHandoff?: boolean;
  };
}

export interface AutoSyncPlan {
  enabled: boolean;
  trigger: AutoSyncTrigger;
  command: string | null;
  args: string[];
  scriptPath: string | null;
  reason?: string;
}

function loadConfig(rootDir: string): SyncConfigShape {
  const configPath = path.join(getRuntimePaths(rootDir).holisticDir, "config.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as SyncConfigShape;
  } catch {
    return {};
  }
}

export function planAutoSync(rootDir: string, trigger: AutoSyncTrigger, platform: NodeJS.Platform = process.platform): AutoSyncPlan {
  const config = loadConfig(rootDir);
  if (config.autoSync === false) {
    return {
      enabled: false,
      trigger,
      command: null,
      args: [],
      scriptPath: null,
      reason: "Auto-sync disabled in .holistic/config.json.",
    };
  }

  if (config.sync?.strategy && config.sync.strategy !== "state-branch") {
    return {
      enabled: false,
      trigger,
      command: null,
      args: [],
      scriptPath: null,
      reason: `Unsupported sync strategy: ${config.sync.strategy}.`,
    };
  }

  if (trigger === "checkpoint" && config.sync?.syncOnCheckpoint === false) {
    return {
      enabled: false,
      trigger,
      command: null,
      args: [],
      scriptPath: null,
      reason: "Checkpoint auto-sync disabled in .holistic/config.json.",
    };
  }

  if (trigger === "handoff" && config.sync?.syncOnHandoff === false) {
    return {
      enabled: false,
      trigger,
      command: null,
      args: [],
      scriptPath: null,
      reason: "Handoff auto-sync disabled in .holistic/config.json.",
    };
  }

  const runtimePaths = getRuntimePaths(rootDir);
  const scriptFile = platform === "win32" ? "sync-state.ps1" : "sync-state.sh";
  const resolvedScriptPath = path.join(runtimePaths.holisticDir, "system", scriptFile);
  if (!fs.existsSync(resolvedScriptPath)) {
    return {
      enabled: false,
      trigger,
      command: null,
      args: [],
      scriptPath: null,
      reason: "Sync helper script not found. Run holistic init to generate it.",
    };
  }

  return {
    enabled: true,
    trigger,
    command: platform === "win32" ? "powershell" : "sh",
    args: platform === "win32"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolvedScriptPath]
      : [resolvedScriptPath],
    scriptPath: resolvedScriptPath,
  };
}

export function requestAutoSync(rootDir: string, trigger: AutoSyncTrigger, platform: NodeJS.Platform = process.platform): AutoSyncPlan {
  const plan = planAutoSync(rootDir, trigger, platform);
  if (!plan.enabled || !plan.command) {
    return plan;
  }

  try {
    const child = spawn(plan.command, plan.args, {
      cwd: rootDir,
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.unref();
    return plan;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...plan,
      enabled: false,
      reason: `Failed to start auto-sync: ${reason}`,
    };
  }
}
