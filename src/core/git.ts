import fs from "node:fs";
import path from "node:path";
import type { GitSnapshot, RuntimePaths } from './types.ts';

export function resolveGitDir(rootDir: string): string | null {
  const dotGitPath = path.join(rootDir, ".git");
  if (!fs.existsSync(dotGitPath)) {
    return null;
  }

  const stat = fs.statSync(dotGitPath);
  if (stat.isDirectory()) {
    return dotGitPath;
  }

  const content = fs.readFileSync(dotGitPath, "utf8").trim();
  const match = /^gitdir:\s+(.+)$/i.exec(content);
  if (!match) {
    return null;
  }

  return path.resolve(rootDir, match[1]);
}

function getBranchName(rootDir: string): string {
  const gitDir = resolveGitDir(rootDir);
  if (!gitDir) {
    return "unknown";  // Changed from "master" - makes failed reads visibly different
  }

  const headPath = path.join(gitDir, "HEAD");
  if (!fs.existsSync(headPath)) {
    return "unknown";  // Changed from "master" - failed read should not look like success
  }

  const head = fs.readFileSync(headPath, "utf8").trim();
  const refMatch = /^ref:\s+refs\/heads\/(.+)$/i.exec(head);
  return refMatch?.[1] ?? "detached";  // Changed from "DETACHED" for consistency
}

function walkRepoFiles(rootDir: string, currentDir: string, results: string[]): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      walkRepoFiles(rootDir, fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      results.push(relativePath);
    }
  }
}

export function captureRepoSnapshot(rootDir: string): Record<string, string> {
  const files: string[] = [];
  walkRepoFiles(rootDir, rootDir, files);

  const snapshot: Record<string, string> = {};
  for (const relativePath of files) {
    const stat = fs.statSync(path.join(rootDir, relativePath));
    snapshot[relativePath] = `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  }

  return snapshot;
}

function diffRepoSnapshots(previous: Record<string, string>, current: Record<string, string>): string[] {
  const changed = new Set<string>();

  for (const [file, signature] of Object.entries(current)) {
    if (previous[file] !== signature) {
      changed.add(file);
    }
  }

  for (const file of Object.keys(previous)) {
    if (!(file in current)) {
      changed.add(file);
    }
  }

  return [...changed].sort();
}

export function getGitSnapshot(rootDir: string, previousSnapshot: Record<string, string> = {}): GitSnapshot & { snapshot: Record<string, string> } {
  const snapshot = captureRepoSnapshot(rootDir);
  return {
    branch: getBranchName(rootDir),
    changedFiles: diffRepoSnapshots(previousSnapshot, snapshot),
    snapshot,
  };
}

export function pendingCommitFile(paths: RuntimePaths): string {
  return path.join(paths.contextDir, "pending-commit.txt");
}

export function writePendingCommit(paths: RuntimePaths, message: string): void {
  fs.writeFileSync(pendingCommitFile(paths), `${message}\n`, "utf8");
}

export function clearPendingCommit(paths: RuntimePaths): void {
  const filePath = pendingCommitFile(paths);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
