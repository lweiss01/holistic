import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const distDir = path.join(repoRoot, "dist");

rmSync(distDir, { recursive: true, force: true });
console.log("Cleaned dist/");
