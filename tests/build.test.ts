import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { test, expect } from "vitest";
import crypto from "node:crypto";

const rootDir = path.resolve(__dirname, "..");

function hashDirectory(dir: string): string {
  const hash = crypto.createHash("sha256");
  const files = fs.readdirSync(dir, { recursive: true })
    .filter(f => typeof f === "string" && fs.statSync(path.join(dir, f)).isFile())
    .sort() as string[];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    hash.update(file);
    hash.update(fs.readFileSync(fullPath));
  }
  return hash.digest("hex");
}

test("non-mutating build: src/ remains unchanged", () => {
  const srcDir = path.join(rootDir, "src");
  const beforeHash = hashDirectory(srcDir);
  
  // Run build
  execSync("npm run build", { cwd: rootDir, stdio: "pipe" });
  
  const afterHash = hashDirectory(srcDir);
  
  expect(afterHash).toBe(beforeHash);
});

test("build creates dist/ with correct structure", () => {
  const distDir = path.join(rootDir, "dist");
  expect(fs.existsSync(distDir)).toBe(true);
  
  const cliJs = path.join(distDir, "cli.js");
  expect(fs.existsSync(cliJs)).toBe(true);
});
