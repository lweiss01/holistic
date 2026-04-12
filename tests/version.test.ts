import fs from "node:fs";
import path from "node:path";
import { test, expect } from "vitest";

const rootDir = path.resolve(__dirname, "..");

test("version consistency: package.json vs docs.ts", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const docsTs = fs.readFileSync(path.join(rootDir, "src", "core", "docs.ts"), "utf8");
  
  const packageVersion = packageJson.version;
  const docsVersionMatch = docsTs.match(/export const VERSION = "([^"]+)";/);
  
  expect(docsVersionMatch).not.toBeNull();
  expect(docsVersionMatch![1]).toBe(packageVersion);
});

test("version consistency: README.md", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const readme = fs.readFileSync(path.join(rootDir, "README.md"), "utf8");
  
  const packageVersion = packageJson.version;
  // Look for "Current Version: vX.Y.Z" or similar patterns
  expect(readme).toContain(`v${packageVersion}`);
});

test("version consistency: SECURITY.md", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const security = fs.readFileSync(path.join(rootDir, "SECURITY.md"), "utf8");
  
  const packageVersion = packageJson.version;
  expect(security).toContain(`v${packageVersion}`);
});
