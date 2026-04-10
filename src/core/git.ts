import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { GitSnapshot, RuntimePaths } from './types.ts';

const HOLISTIC_PORTABLE_PATHS = new Set([
  "HOLISTIC.md",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "HISTORY.md",
  "HOLISTIC.local.md",
  "AGENTS.local.md",
  "CLAUDE.local.md",
  "GEMINI.local.md",
  "HISTORY.local.md",
]);

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

export function getBranchName(rootDir: string): string {
  const gitDir = resolveGitDir(rootDir);
  if (!gitDir) {
    return "unknown";
  }

  const headPath = path.join(gitDir, "HEAD");
  if (!fs.existsSync(headPath)) {
    return "unknown";
  }

  const head = fs.readFileSync(headPath, "utf8").trim();
  const refMatch = /^ref:\s+refs\/heads\/(.+)$/i.exec(head);
  return refMatch?.[1] ?? "detached";
}

export function isPortableHolisticPath(file: string): boolean {
  return file.startsWith(".holistic/") || file.startsWith(".holistic-local/") || HOLISTIC_PORTABLE_PATHS.has(file);
}

// Directories that are always large, generated, and irrelevant to
// Holistic's change-detection. Skipping them avoids stat-ing tens of
// thousands of files on every checkpoint and daemon tick.
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  "vendor",
  "coverage",
  ".cache",
  ".tmp-tests",
]);

export function captureRepoSnapshot(rootDir: string): Record<string, string> {
  let output: string;
  try {
    output = execFileSync(
      "git",
      ["-C", rootDir, "ls-files", "--cached", "--others", "--exclude-standard"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    // Fallback if git fails or not a repo (though resolveGitDir should have caught this)
    return {};
  }

  const files = output.split(/\r?\n/).filter(Boolean);
  const snapshot: Record<string, string> = {};

  for (const relativePath of files) {
    try {
      const fullPath = path.join(rootDir, relativePath);
      const stat = fs.statSync(fullPath);
      snapshot[relativePath] = `${stat.size}:${Math.floor(stat.mtimeMs)}`;
    } catch {
      // File might have been deleted or inaccessible
    }
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

export function getRecentCommitSubjects(rootDir: string, limit = 5): string[] {
  try {
    const output = execFileSync(
      "git",
      ["-C", rootDir, "log", `-n${limit}`, "--pretty=%s"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
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

export function commitPendingChanges(
  rootDir: string,
  message: string,
  files: string[],
): { success: boolean; error?: string; sha?: string } {
  try {
    // Check if git is available
    try {
      execFileSync("git", ["--version"], { stdio: "ignore" });
    } catch {
      return {
        success: false,
        error: "Git is not available. Please install git and try again.",
      };
    }

    // Check if we're in a git repo
    const gitDir = resolveGitDir(rootDir);
    if (!gitDir) {
      return {
        success: false,
        error: "Not a git repository. Cannot commit changes.",
      };
    }

    // Stage files
    try {
      execFileSync("git", ["-C", rootDir, "add", "--", ...files], {
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to stage files: ${message}`,
      };
    }

    // Check if there's anything to commit
    let hasChanges = false;
    try {
      const statusOutput = execFileSync(
        "git",
        ["-C", rootDir, "diff", "--cached", "--name-only"],
        { encoding: "utf8", stdio: "pipe" },
      );
      hasChanges = statusOutput.trim().length > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to check git status: ${message}`,
      };
    }

    if (!hasChanges) {
      return {
        success: true,
        error: "No changes to commit (files may already be committed).",
      };
    }

    // Commit the changes
    try {
      execFileSync("git", ["-C", rootDir, "commit", "-m", message], {
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      const stderr = error instanceof Error && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr)
        : error instanceof Error
          ? error.message
          : String(error);
      
      return {
        success: false,
        error: `Git commit failed: ${stderr}`,
      };
    }

    // Get the commit SHA
    try {
      const sha = execFileSync(
        "git",
        ["-C", rootDir, "rev-parse", "--short", "HEAD"],
        { encoding: "utf8", stdio: "pipe" },
      ).trim();

      return {
        success: true,
        sha,
      };
    } catch {
      // Commit succeeded but couldn't get SHA - still success
      return {
        success: true,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Unexpected error during commit: ${message}`,
    };
  }
}
