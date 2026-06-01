import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findNearestHolisticRoot } from "../src/core/state.ts";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "holistic-worktree-test-"));
}

export const tests: Array<{ name: string; run: () => void }> = [
  {
    name: "findNearestHolisticRoot returns the dir itself when it contains holistic.repo.json",
    run: () => {
      const dir = makeTempDir();
      try {
        fs.writeFileSync(path.join(dir, "holistic.repo.json"), "{}", "utf8");
        assert.equal(findNearestHolisticRoot(dir), dir);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "findNearestHolisticRoot returns the dir itself when it contains .holistic-local/",
    run: () => {
      const dir = makeTempDir();
      try {
        fs.mkdirSync(path.join(dir, ".holistic-local"));
        assert.equal(findNearestHolisticRoot(dir), dir);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "findNearestHolisticRoot returns the dir itself when it contains .holistic/",
    run: () => {
      const dir = makeTempDir();
      try {
        fs.mkdirSync(path.join(dir, ".holistic"));
        assert.equal(findNearestHolisticRoot(dir), dir);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  {
    name: "findNearestHolisticRoot walks up from a worktree subdir to the main repo root",
    run: () => {
      const mainRepo = makeTempDir();
      try {
        fs.writeFileSync(path.join(mainRepo, "holistic.repo.json"), JSON.stringify({ runtime: { holisticDir: ".holistic-local" } }), "utf8");
        fs.mkdirSync(path.join(mainRepo, ".holistic-local"));

        const worktreeDir = path.join(mainRepo, ".claude", "worktrees", "my-feature-branch");
        fs.mkdirSync(worktreeDir, { recursive: true });

        assert.equal(findNearestHolisticRoot(worktreeDir), mainRepo);
      } finally {
        fs.rmSync(mainRepo, { recursive: true, force: true });
      }
    }
  },
  {
    name: "findNearestHolisticRoot prefers a closer ancestor over a more distant one",
    run: () => {
      const outer = makeTempDir();
      try {
        fs.mkdirSync(path.join(outer, ".holistic"));
        const inner = path.join(outer, "nested", "repo");
        fs.mkdirSync(inner, { recursive: true });
        fs.writeFileSync(path.join(inner, "holistic.repo.json"), "{}", "utf8");

        const subdir = path.join(inner, "src", "components");
        fs.mkdirSync(subdir, { recursive: true });

        assert.equal(findNearestHolisticRoot(subdir), inner);
      } finally {
        fs.rmSync(outer, { recursive: true, force: true });
      }
    }
  },
  {
    name: "findNearestHolisticRoot falls back to startDir when no Holistic root is found",
    run: () => {
      const isolated = makeTempDir();
      try {
        const subdir = path.join(isolated, "deep", "path");
        fs.mkdirSync(subdir, { recursive: true });
        assert.equal(findNearestHolisticRoot(subdir), subdir);
      } finally {
        fs.rmSync(isolated, { recursive: true, force: true });
      }
    }
  },
];
