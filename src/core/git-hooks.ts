import fs from "node:fs";
import path from "node:path";

export interface HookCommand {
  nodePath: string;
  scriptPath: string;
  useStripTypes: boolean;
}

export interface GitHookInstallResult {
  installed: boolean;
  hooks: string[];
}

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

export function installGitHooks(rootDir: string, gitDir: string | null, command: HookCommand): GitHookInstallResult {
  if (!gitDir || !fs.existsSync(gitDir)) {
    return { installed: false, hooks: [] };
  }

  const hooksDir = path.join(gitDir, "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });

  const checkpointCommand = commandLine(command, [
    "checkpoint",
    "--reason",
    "post-commit",
  ]);
  const statusCommand = commandLine(command, ["status"]);

  const postCommit = `#!/usr/bin/env sh
# Holistic auto-checkpoint after commit

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/.holistic/state.json" ]; then
  COMMIT_SUBJECT=$(git -C "$PWD" log -1 --pretty=%s 2>/dev/null || echo post-commit)
  ${checkpointCommand} --status "Committed: $COMMIT_SUBJECT" >/dev/null 2>&1 || true
fi

exit 0
`;

  const prePush = `#!/usr/bin/env sh
# Holistic status reminder before push

cd '${shellQuote(rootDir)}' || exit 0

if [ -f "$PWD/.holistic/state.json" ]; then
  echo ""
  echo "Holistic Status:"
  ${statusCommand} || true
  echo ""
  echo "Push to sync Holistic state:"
  echo "  git push origin holistic/state"
  echo ""
fi

exit 0
`;

  fs.writeFileSync(path.join(hooksDir, "post-commit"), postCommit, { encoding: "utf8", mode: 0o755 });
  fs.writeFileSync(path.join(hooksDir, "pre-push"), prePush, { encoding: "utf8", mode: 0o755 });

  return {
    installed: true,
    hooks: ["post-commit", "pre-push"],
  };
}
