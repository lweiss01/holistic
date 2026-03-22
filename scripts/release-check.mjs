import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const packageName = packageJson.name;

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

function installedPackagePath(rootDir, scopedName) {
  return path.join(rootDir, "node_modules", ...scopedName.split("/"));
}

function globalBinaryPath(prefixDir) {
  if (process.platform === "win32") {
    return path.join(prefixDir, "holistic.cmd");
  }

  return path.join(prefixDir, "bin", "holistic");
}

function runInstalledBinary(binaryPath, args, options = {}) {
  if (process.platform === "win32") {
    const shell = process.env.ComSpec ?? "cmd.exe";
    const commandLine = [binaryPath, ...args].map(quoteCmdArg).join(" ");
    return run(shell, ["/d", "/s", "/c", commandLine], options);
  }

  return run(binaryPath, args, options);
}

function main() {
  runNpm(["run", "clean"]);
  runNpm(["run", "build"]);
  runNpm(["test"]);
  runNpm(["run", "test:smoke"]);

  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-release-pack-"));
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
  ensureIncludes(packagedFiles, "LICENSE", "packed files");
  ensureIncludes(packagedFiles, "CHANGELOG.md", "packed files");

  const tarballPath = path.join(packDir, packageInfo.filename);
  const prefixDir = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-global-prefix-"));
  runNpm(["install", "-g", "--ignore-scripts", "--prefix", prefixDir, tarballPath]);

  const binaryPath = globalBinaryPath(prefixDir);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Global binary was not installed at ${binaryPath}.`);
  }

  const helpResult = runInstalledBinary(binaryPath, ["--help"]);
  ensureIncludes(helpResult.stdout, "holistic bootstrap", "global help output");

  const installedBin = path.join(installedPackagePath(prefixDir, packageName), "bin", "holistic.js");
  if (!fs.existsSync(installedBin)) {
    throw new Error("Installed global package is missing bin/holistic.js.");
  }

  const repoUnderTest = fs.mkdtempSync(path.join(os.tmpdir(), "holistic-release-repo-"));
  run("git", ["init"], { cwd: repoUnderTest });
  run("git", ["config", "user.name", "Holistic Release"], { cwd: repoUnderTest });
  run("git", ["config", "user.email", "release@example.com"], { cwd: repoUnderTest });
  fs.writeFileSync(path.join(repoUnderTest, "README.md"), "# release repo\n", "utf8");
  run("git", ["add", "README.md"], { cwd: repoUnderTest });
  run("git", ["commit", "-m", "init"], { cwd: repoUnderTest });

  runInstalledBinary(binaryPath, [
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

  console.log("PASS: release preflight completed successfully");
}

main();
