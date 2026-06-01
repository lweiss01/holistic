import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { enumerateGitWorktrees } from "../src/core/git.ts";
import { installAndonHooks } from "../src/core/setup.ts";
import { getRuntimePaths } from "../src/core/state.ts";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "holistic-wt-hook-test-"));
}

function makeGitRepo(dir: string): void {
  execFileSync("git", ["init"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "README.md"), "# test\n", "utf8");
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
}

function hasAndonHookCommand(settingsPath: string): boolean {
  if (!fs.existsSync(settingsPath)) return false;
  const content = fs.readFileSync(settingsPath, "utf8");
  return content.includes("andon-hook");
}

export const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "enumerateGitWorktrees returns empty list when no worktrees exist",
    run: () => {
      const dir = makeTempDir();
      try {
        makeGitRepo(dir);
        const worktrees = enumerateGitWorktrees(dir);
        assert.deepEqual(worktrees, []);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "enumerateGitWorktrees returns additional worktree paths, excluding main",
    run: () => {
      const dir = makeTempDir();
      const wtDir = makeTempDir();
      try {
        makeGitRepo(dir);
        execFileSync("git", ["worktree", "add", wtDir, "HEAD"], { cwd: dir });
        const worktrees = enumerateGitWorktrees(dir);
        assert.equal(worktrees.length, 1);
        assert.ok(
          path.resolve(worktrees[0]) === path.resolve(wtDir),
          `expected worktree path ${wtDir} but got ${worktrees[0]}`
        );
      } finally {
        // Remove worktree before deleting dirs to avoid git errors
        try { execFileSync("git", ["worktree", "remove", "--force", wtDir], { cwd: dir }); } catch { /* ignore */ }
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(wtDir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "enumerateGitWorktrees returns empty list for non-git directory",
    run: () => {
      const dir = makeTempDir();
      try {
        const worktrees = enumerateGitWorktrees(dir);
        assert.deepEqual(worktrees, []);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAndonHooks propagates hooks into active git worktrees",
    run: () => {
      const dir = makeTempDir();
      const wtDir = makeTempDir();
      try {
        makeGitRepo(dir);

        // Set up the main repo .claude dir so installAndonHooks runs
        const claudeDir = path.join(dir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });

        // Create the system dir with a fake hook script so andonHookCommand resolves
        const paths = getRuntimePaths(dir);
        const sysDir = path.join(dir, ".holistic", "system");
        fs.mkdirSync(sysDir, { recursive: true });
        const hookScriptPath = path.join(sysDir, "andon-hook.ps1");
        fs.writeFileSync(hookScriptPath, "# fake hook\n", "utf8");
        fs.writeFileSync(path.join(sysDir, "andon-hook.sh"), "# fake hook\n", "utf8");

        // Create a git worktree
        execFileSync("git", ["worktree", "add", wtDir, "HEAD"], { cwd: dir });

        // Run the installer
        installAndonHooks(dir, paths, "win32");

        // The main .claude/settings.json should have hooks
        assert.ok(hasAndonHookCommand(path.join(claudeDir, "settings.json")),
          "main .claude/settings.json should contain andon-hook command");

        // The worktree .claude/settings.json should also have hooks
        assert.ok(hasAndonHookCommand(path.join(wtDir, ".claude", "settings.json")),
          "worktree .claude/settings.json should contain andon-hook command");
      } finally {
        try { execFileSync("git", ["worktree", "remove", "--force", wtDir], { cwd: dir }); } catch { /* ignore */ }
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(wtDir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "installAndonHooks propagation is idempotent across repeated calls",
    run: () => {
      const dir = makeTempDir();
      const wtDir = makeTempDir();
      try {
        makeGitRepo(dir);
        const claudeDir = path.join(dir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });
        const paths = getRuntimePaths(dir);
        const sysDir = path.join(dir, ".holistic", "system");
        fs.mkdirSync(sysDir, { recursive: true });
        fs.writeFileSync(path.join(sysDir, "andon-hook.ps1"), "# fake hook\n", "utf8");
        fs.writeFileSync(path.join(sysDir, "andon-hook.sh"), "# fake hook\n", "utf8");
        execFileSync("git", ["worktree", "add", wtDir, "HEAD"], { cwd: dir });

        installAndonHooks(dir, paths, "win32");
        installAndonHooks(dir, paths, "win32");

        const wtSettings = path.join(wtDir, ".claude", "settings.json");
        const parsed = JSON.parse(fs.readFileSync(wtSettings, "utf8"));
        // Idempotent: exactly one Stop entry with andon-hook, not two
        const stopHooks = parsed.hooks?.Stop ?? [];
        const andonStopCount = stopHooks.flatMap((g: { hooks?: Array<{ command?: string }> }) => g.hooks ?? [])
          .filter((h: { command?: string }) => typeof h.command === "string" && h.command.includes("andon-hook")).length;
        assert.equal(andonStopCount, 1, "should have exactly one andon Stop hook after two installs");
      } finally {
        try { execFileSync("git", ["worktree", "remove", "--force", wtDir], { cwd: dir }); } catch { /* ignore */ }
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(wtDir, { recursive: true, force: true });
      }
    }
  },
];
