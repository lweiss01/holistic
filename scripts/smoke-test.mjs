import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const cliBin = path.join(repoRoot, "bin", "holistic.js");

const helpResult = spawnSync(process.execPath, [cliBin, "--help"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (helpResult.status !== 0) {
  process.stderr.write("Smoke test failed: --help returned a non-zero exit code.\n");
  process.exit(helpResult.status ?? 1);
}

console.log("PASS: CLI loads successfully");
