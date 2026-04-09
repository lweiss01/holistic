import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { commitPendingChanges } from "../src/core/git.ts";

function makeTestGitRepo(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-git-test-"));
  
  // Initialize git repo
  execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir, stdio: "ignore" });
  
  // Create initial commit so we have a valid repo
  fs.writeFileSync(path.join(rootDir, "README.md"), "# Test\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: rootDir, stdio: "ignore" });
  
  return rootDir;
}

test("commitPendingChanges - success case with new files", () => {
  const rootDir = makeTestGitRepo();
  
  // Create .holistic directory and files
  const holisticDir = path.join(rootDir, ".holistic");
  fs.mkdirSync(holisticDir, { recursive: true });
  fs.writeFileSync(path.join(holisticDir, "state.json"), "{}", "utf8");
  fs.writeFileSync(path.join(rootDir, "HOLISTIC.md"), "# Holistic\n", "utf8");
  
  const result = commitPendingChanges(
    rootDir,
    "docs(holistic): test commit",
    [".holistic/state.json", "HOLISTIC.md"],
  );
  
  assert.equal(result.success, true);
  assert.ok(result.sha, "Should return commit SHA");
  assert.equal(result.sha?.length, 7, "SHA should be 7 characters");
  
  // Verify commit exists in git log
  const log = execFileSync("git", ["-C", rootDir, "log", "-1", "--pretty=%s"], {
    encoding: "utf8",
  }).trim();
  assert.equal(log, "docs(holistic): test commit");
});

test("commitPendingChanges - no changes to commit", () => {
  const rootDir = makeTestGitRepo();
  
  // Try to commit with no changes
  const result = commitPendingChanges(
    rootDir,
    "docs(holistic): should have no changes",
    ["README.md"], // Already committed
  );
  
  assert.equal(result.success, true);
  assert.ok(result.error?.includes("No changes"), "Should indicate no changes");
});

test("commitPendingChanges - git not available", () => {
  const rootDir = makeTestGitRepo();
  
  // Mock git unavailable by using invalid command
  // Note: This test assumes git IS available in the test environment
  // Real git unavailability would require PATH manipulation
  
  // For now, test non-git directory
  const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-non-git-"));
  
  const result = commitPendingChanges(
    nonGitDir,
    "docs(holistic): test",
    ["file.txt"],
  );
  
  assert.equal(result.success, false);
  assert.ok(result.error?.includes("Not a git repository"), "Should indicate not a git repo");
  
  fs.rmSync(nonGitDir, { recursive: true, force: true });
});

test("commitPendingChanges - invalid file paths", () => {
  const rootDir = makeTestGitRepo();
  
  // Try to commit files that don't exist
  const result = commitPendingChanges(
    rootDir,
    "docs(holistic): invalid files",
    ["nonexistent/file.txt"],
  );
  
  // Git add will succeed even for non-existent files (they're not tracked)
  // But there will be no changes to commit
  assert.equal(result.success, true);
  assert.ok(result.error?.includes("No changes"), "Should indicate no changes");
});

test("commitPendingChanges - permission error simulation", () => {
  const rootDir = makeTestGitRepo();
  
  // Create a file
  fs.writeFileSync(path.join(rootDir, "test.txt"), "content\n", "utf8");
  
  // Make .git directory read-only (simulate permission issue)
  const gitDir = path.join(rootDir, ".git");
  if (process.platform !== "win32") {
    fs.chmodSync(gitDir, 0o444);
    
    const result = commitPendingChanges(
      rootDir,
      "docs(holistic): should fail",
      ["test.txt"],
    );
    
    // Restore permissions for cleanup
    fs.chmodSync(gitDir, 0o755);
    
    assert.equal(result.success, false);
    assert.ok(result.error, "Should have error message");
  } else {
    // Skip permission test on Windows (different permission model)
    assert.ok(true, "Skipped on Windows");
  }
});
