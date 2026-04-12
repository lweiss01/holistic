import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { getRuntimePaths, loadState, createInitialState, saveState } from "../src/core/state.ts";
import { getSetupStatus, validateRuntimeConfig } from "../src/core/setup.ts";
import { writeDerivedDocs } from "../src/core/docs.ts";
import type { HolisticState } from "../src/core/types.ts";

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function makeRepo(): { rootDir: string } {
  const rootDir = makeTempDir("holistic-security-test");
  execFileSync("git", ["init"], { cwd: rootDir });
  fs.writeFileSync(path.join(rootDir, "README.md"), "# test\n", "utf8");
  return { rootDir };
}

export const tests = [
  {
    name: "getRuntimePaths enforces repository containment for all configurable paths",
    run: () => {
      const { rootDir } = makeRepo();
      
      // Malicious config attempting directory traversal
      const config = {
        runtime: {
          holisticDir: "../outside-holistic",
          masterDoc: "../../outside-master.md",
          agentsDoc: "/absolute/path/agents.md"
        }
      };
      fs.writeFileSync(path.join(rootDir, "holistic.repo.json"), JSON.stringify(config), "utf8");
      
      const diagnostics: string[] = [];
      const paths = getRuntimePaths(rootDir, diagnostics);
      
      // Should fall back to safe defaults inside root
      assert.equal(paths.holisticDir, path.join(path.normalize(rootDir), ".holistic"));
      assert.equal(paths.masterDoc, path.join(path.normalize(rootDir), "HOLISTIC.md"));
      assert.equal(paths.agentsDoc, path.join(path.normalize(rootDir), "AGENTS.md"));
      
      // Should report diagnostics
      assert.ok(diagnostics.length >= 3);
      assert.ok(diagnostics.some(d => d.includes("attempted to escape repository root")));
    }
  },
  {
    name: "loadState handles corrupt state file by backing it up and reporting degraded status",
    run: () => {
      const { rootDir } = makeRepo();
      const holisticDir = path.join(rootDir, ".holistic");
      fs.mkdirSync(holisticDir, { recursive: true });
      
      const stateFile = path.join(holisticDir, "state.json");
      fs.writeFileSync(stateFile, "{ invalid json ...", "utf8");
      
      const { state, created } = loadState(rootDir);
      
      assert.equal(created, true);
      assert.equal(state.degraded, true);
      assert.ok(state.diagnostics?.some(d => d.includes("Local state file was corrupted")));
      
      // Check that backup exists
      const files = fs.readdirSync(holisticDir);
      assert.ok(files.some(f => f.startsWith("state.json.corrupt-")));
    }
  },
  {
    name: "doctor surfaces repository containment and state integrity findings",
    run: () => {
      const { rootDir } = makeRepo();
      const holisticDir = path.join(rootDir, ".holistic");
      fs.mkdirSync(holisticDir, { recursive: true });
      
      // 1. Create a containment violation
      fs.writeFileSync(path.join(rootDir, "holistic.repo.json"), JSON.stringify({
        runtime: { masterDoc: "../evil.md" }
      }), "utf8");
      
      // 2. Create a corrupt state
      fs.writeFileSync(path.join(holisticDir, "state.json"), "!!!", "utf8");
      
      const status = getSetupStatus(rootDir);
      
      const configDiag = status.find(s => s.component === "config-validation");
      if (configDiag?.status !== "error") {
        console.log("Config findings:", JSON.stringify(validateRuntimeConfig(getRuntimePaths(rootDir)), null, 2));
      }
      assert.equal(configDiag?.status, "error");
      assert.ok(configDiag?.details.includes("errors found"));
      
      const integrityDiag = status.find(s => s.component === "state-integrity");
      assert.equal(integrityDiag?.status, "error");
      assert.ok(integrityDiag?.details.includes("State is degraded"));
    }
  },
  {
    name: "safeMode produces minimal instructions in master doc",
    run: () => {
      const { rootDir } = makeRepo();
      const { state, paths } = loadState(rootDir);
      
      // Enable safe mode in config
      fs.writeFileSync(path.join(paths.holisticDir, "config.json"), JSON.stringify({
        safeMode: true
      }), "utf8");
      
      // This should trigger safeMode if getSetupStatus or similar is used, 
      // but writeDerivedDocs takes it directly.
      writeDerivedDocs(paths, state, { safeMode: true });
      
      const masterDoc = fs.readFileSync(paths.masterDoc, "utf8");
      assert.match(masterDoc, /# HOLISTIC \(Safe Mode\)/);
      assert.match(masterDoc, /MINIMAL INSTRUCTIONS/);
      assert.doesNotMatch(masterDoc, /AGENT INSTRUCTIONS - READ THIS ENTIRE FILE/);
      assert.match(masterDoc, /<!-- Holistic version: 0.6.4 -->/);
    }
  }
];
