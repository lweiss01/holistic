import fs from "node:fs";
import path from "node:path";

export interface HookCommand {
  nodePath: string;
  scriptPath: string;
  useStripTypes: boolean;
  stateFilePath: string;
  syncPowerShellPath: string;
  syncShellPath: string;
  syncLogPath: string;
  portableState: boolean;
}

export interface GitHookInstallResult {
  installed: boolean;
  hooks: string[];
  refreshed: string[];
  warnings: string[];
}

type HookName = "post-commit" | "post-checkout" | "pre-push";
type HookMode = "install" | "refresh";

const HOLISTIC_HOOK_MARKER = "HOLISTIC-MANAGED";
const SUPPORTED_HOOKS: HookName[] = ["post-commit", "post-checkout", "pre-push"];

function shellQuote(value: string): string {
  return value.replace(/'/g, `'\"'\"'`);
}

function commandLine(command: HookCommand, args: string[]): string {
  const parts = [
    `'${shellQuote(command.nodePath)}'`,
    command.useStripTypes ? "--experimental-strip-types" : "",
    `'${shellQuote(command.scriptPath)}'`,
    ...args.map((arg) => `'${shellQuote(arg)}'`),
  ].filter(Boolean);
  return parts.join(" ");
}

function normalizeHookContent(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function isHolisticManagedHook(content: string): boolean {
  return normalizeHookContent(content).includes(HOLISTIC_HOOK_MARKER);
}

function renderHookHeader(name: HookName): string {
  return `#!/usr/bin/env sh
# ${HOLISTIC_HOOK_MARKER} ${name}
`;
}

function renderGitHooks(rootDir: string, command: HookCommand): Record<HookName, string> {
  const branchSwitchCommand = commandLine(command, [
    "checkpoint",
    "--reason",
    "branch-switch",
    "--status",
    "Detected branch switch; review the new branch context.",
  ]);

  return {
    "post-commit": `${renderHookHeader("post-commit")}# Holistic hook placeholder after commit

cd '${shellQuote(rootDir)}' || exit 0

# Intentionally do not create a new checkpoint here.
# The user may have just committed Holistic state and expects the tree to stay clean.

exit 0
`,
    "post-checkout": `${renderHookHeader("post-checkout")}# Holistic continuity checkpoint after branch switch

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ] && [ "$3" = "1" ]; then
  ${branchSwitchCommand} >/dev/null 2>&1 || true
fi

exit 0
`,
    "pre-push": `${renderHookHeader("pre-push")}# Holistic portable state sync before push

cd '${shellQuote(rootDir)}' || exit 0

${command.portableState ? "" : "exit 0  # Portable state disabled (Privacy Mode)"}

if [ -f "$PWD/${shellQuote(command.stateFilePath)}" ]; then
  sh "$PWD/${shellQuote(command.syncShellPath)}" 2>>"$PWD/${shellQuote(command.syncLogPath)}" || true
fi

exit 0
`,
  };
}

function writeHookFile(hooksDir: string, hookName: HookName, content: string): void {
  fs.writeFileSync(path.join(hooksDir, hookName), content, { encoding: "utf8", mode: 0o755 });
}

export function getGitHooksStatus(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  if (!gitDir || !fs.existsSync(gitDir)) {
    return { installed: false, hooks: [], refreshed: [], warnings: [] };
  }

  const hooksDir = path.join(gitDir, "hooks");
  const rendered = renderGitHooks(rootDir, command);
  const warnings: string[] = [];
  const refreshed: string[] = [];
  const managedHooks = new Set<HookName>();
  const skippedCustomHooks: HookName[] = [];
  let hasManagedExistingHook = false;

  for (const hookName of SUPPORTED_HOOKS) {
    const hookPath = path.join(hooksDir, hookName);
    if (!fs.existsSync(hookPath)) {
      continue;
    }

    const content = fs.readFileSync(hookPath, "utf8");
    if (isHolisticManagedHook(content)) {
      hasManagedExistingHook = true;
      managedHooks.add(hookName);
      continue;
    }

    skippedCustomHooks.push(hookName);
  }

  if (skippedCustomHooks.length > 0) {
    warnings.push(
      `Skipped Holistic hook check for ${skippedCustomHooks.join(", ")}: existing hook(s) are user-managed.`,
    );
  }

  for (const hookName of SUPPORTED_HOOKS) {
    const hookPath = path.join(hooksDir, hookName);
    const expected = rendered[hookName];

    if (!fs.existsSync(hookPath)) {
      if (hasManagedExistingHook) {
        refreshed.push(hookName);
      }
      continue;
    }

    const current = fs.readFileSync(hookPath, "utf8");
    if (!isHolisticManagedHook(current)) {
      continue;
    }

    managedHooks.add(hookName);
    if (normalizeHookContent(current) !== normalizeHookContent(expected)) {
      refreshed.push(hookName);
    }
  }

  return {
    installed: managedHooks.size > 0,
    hooks: [...managedHooks],
    refreshed,
    warnings,
  };
}

function syncGitHooks(rootDir: string, gitDir: string | null, command: HookCommand, mode: HookMode): GitHookInstallResult {
  if (!gitDir || !fs.existsSync(gitDir)) {
    return { installed: false, hooks: [], refreshed: [], warnings: [] };
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const rendered = renderGitHooks(rootDir, command);
  const warnings: string[] = [];
  const refreshed: string[] = [];
  const managedHooks = new Set<HookName>();
  const skippedCustomHooks: HookName[] = [];
  let hasManagedExistingHook = false;

  for (const hookName of SUPPORTED_HOOKS) {
    const hookPath = path.join(hooksDir, hookName);
    if (!fs.existsSync(hookPath)) {
      continue;
    }

    const content = fs.readFileSync(hookPath, "utf8");
    if (isHolisticManagedHook(content)) {
      hasManagedExistingHook = true;
      managedHooks.add(hookName);
      continue;
    }

    skippedCustomHooks.push(hookName);
  }

  if (skippedCustomHooks.length > 0) {
    warnings.push(
      `Skipped Holistic hook refresh for ${skippedCustomHooks.join(", ")}: existing hook(s) are user-managed.`,
    );
  }

  for (const hookName of SUPPORTED_HOOKS) {
    const hookPath = path.join(hooksDir, hookName);
    const expected = rendered[hookName];

    if (!fs.existsSync(hookPath)) {
      if (mode === "install" || hasManagedExistingHook) {
        writeHookFile(hooksDir, hookName, expected);
        refreshed.push(hookName);
        managedHooks.add(hookName);
      }
      continue;
    }

    const current = fs.readFileSync(hookPath, "utf8");
    if (!isHolisticManagedHook(current)) {
      continue;
    }

    managedHooks.add(hookName);
    if (normalizeHookContent(current) !== normalizeHookContent(expected)) {
      writeHookFile(hooksDir, hookName, expected);
      refreshed.push(hookName);
    }
  }

  return {
    installed: managedHooks.size > 0,
    hooks: [...managedHooks],
    refreshed,
    warnings,
  };
}

export function installGitHooks(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  return syncGitHooks(rootDir, gitDir, command, "install");
}

export function refreshGitHooks(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  return syncGitHooks(rootDir, gitDir, command, "refresh");
}
