import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const cliBin = path.join(repoRoot, "bin", "holistic.js");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function fail(message, result) {
  const details = result
    ? `\nerror:\n${result.error ? String(result.error) : ""}\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`
    : "";
  throw new Error(`${message}${details}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed`, result);
  }

  return result;
}

function quoteCmdArg(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function runNpm(args, options = {}) {
  if (process.platform !== "win32") {
    return run(npmCmd, args, options);
  }

  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [npmCmd, ...args].map(quoteCmdArg).join(" ");
  return run(shell, ["/d", "/s", "/c", commandLine], options);
}

function ensureIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to include ${needle}`);
  }
}

function main() {
  const helpResult = run(process.execPath, [cliBin, "--help"]);
  ensureIncludes(helpResult.stdout, "holistic bootstrap", "CLI help output");

  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-pack-"));
  const packResult = runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", packDir]);
  const packPayload = JSON.parse(packResult.stdout.trim());
  const packageInfo = Array.isArray(packPayload) ? packPayload[0] : packPayload;

  if (!packageInfo?.filename) {
    throw new Error("npm pack did not return a tarball filename.");
  }

  const packagedFiles = Array.isArray(packageInfo.files)
    ? packageInfo.files.map((entry) => entry.path)
    : [];
  ensureIncludes(packagedFiles, "dist/cli.js", "packed files");
  ensureIncludes(packagedFiles, "bin/holistic.js", "packed files");
  ensureIncludes(packagedFiles, "README.md", "packed files");

  const tarballPath = path.join(packDir, packageInfo.filename);
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-install-"));
  fs.writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({
    name: "holistic-smoke-install",
    private: true,
  }, null, 2) + "\n", "utf8");

  runNpm(["install", "--ignore-scripts", tarballPath], { cwd: installRoot });

  const installedBin = path.join(installRoot, "node_modules", "holistic", "bin", "holistic.js");
  if (!fs.existsSync(installedBin)) {
    throw new Error("Installed package is missing bin/holistic.js.");
  }

  const installedHelp = run(process.execPath, [installedBin, "--help"], { cwd: installRoot });
  ensureIncludes(installedHelp.stdout, "holistic bootstrap", "installed CLI help output");

  const repoUnderTest = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-smoke-repo-"));
  run("git", ["init"], { cwd: repoUnderTest });
  run("git", ["config", "user.name", "Holistic Smoke"], { cwd: repoUnderTest });
  run("git", ["config", "user.email", "smoke@example.com"], { cwd: repoUnderTest });
  fs.writeFileSync(path.join(repoUnderTest, "README.md"), "# smoke repo\n", "utf8");
  run("git", ["add", "README.md"], { cwd: repoUnderTest });
  run("git", ["commit", "-m", "init"], { cwd: repoUnderTest });

  run(process.execPath, [
    installedBin,
    "bootstrap",
    "--install-daemon",
    "false",
    "--configure-mcp",
    "false",
  ], { cwd: repoUnderTest });

  const config = JSON.parse(fs.readFileSync(path.join(repoUnderTest, ".holistic", "config.json"), "utf8"));
  if (config.sync?.stateRef !== "refs/holistic/state") {
    throw new Error(`Expected bootstrap to default to refs/holistic/state, got ${config.sync?.stateRef ?? "missing"}.`);
  }

  const attributes = fs.readFileSync(path.join(repoUnderTest, ".gitattributes"), "utf8");
  ensureIncludes(attributes, "BEGIN HOLISTIC MANAGED ATTRIBUTES", ".gitattributes");
  ensureIncludes(attributes, ".holistic/**/*.ps1 text eol=crlf", ".gitattributes");

  const hookPath = path.join(repoUnderTest, ".git", "hooks", "post-commit");
  if (!fs.existsSync(hookPath)) {
    throw new Error("Bootstrap did not install the Holistic post-commit hook.");
  }

  const statusResult = run(process.execPath, [installedBin, "status"], { cwd: repoUnderTest });
  ensureIncludes(statusResult.stdout, "Holistic Status", "status output");

  console.log("PASS: packaged CLI installs and bootstraps a clean repo successfully");
}

main();
