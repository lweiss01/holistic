# S06: Use Git LS-Files for Snapshot

**Goal:** Replace walkRepoFiles() with execFileSync('git', ['ls-files', '-z']) and handle errors gracefully
**Demo:** After this: Snapshot capture on 1000+ file repo completes 10x faster than before

## Tasks
- [ ] **T01: Implement git ls-files snapshot capture** — Create captureRepoSnapshotGit() in src/core/git.ts that runs `git ls-files -z`, splits on null bytes, stats each file, and returns Record<string, string>. Handle errors gracefully and return null to signal fallback needed.
  - Estimate: 45m
  - Files: src/core/git.ts
  - Verify: grep -q 'ls-files.*-z' src/core/git.ts
- [ ] **T02: Add fallback logic to captureRepoSnapshot** — Update captureRepoSnapshot to try captureRepoSnapshotGit() first, fall back to walkRepoFiles() if git unavailable. Log which method used. Add unit tests for both paths.
  - Estimate: 30m
  - Files: src/core/git.ts, tests/git-snapshot.test.ts
  - Verify: npm test -- git-snapshot.test.ts
- [ ] **T03: Benchmark and verify performance improvement** — Create test repo with 1000+ files. Benchmark old vs new approach. Verify 10x speedup. Document results.
  - Estimate: 45m
  - Files: tests/benchmark-snapshot.test.ts
  - Verify: npm test -- benchmark-snapshot.test.ts 2>&1 | grep -q '10x\|faster'

## Goal
Replace walkRepoFiles() with git ls-files for 10x faster snapshot capture on large repos, with graceful fallback.

## Success Criteria
- captureRepoSnapshot uses git ls-files -z when git available
- Falls back to walkRepoFiles if git unavailable or non-git repo
- Snapshot on 1000+ file repo completes 10x faster than before
- Handles null bytes in git ls-files output correctly
- Error handling for git failures (permission denied, not a repo)

## Proof Level
operational — benchmark on 1000+ file repo shows 10x faster snapshot vs walkRepoFiles

## Integration Closure
After this slice, snapshot capture uses git ls-files instead of recursive directory walk. On repos with 1000+ files, snapshot is 10x faster. Falls back to walkRepoFiles if git unavailable or repo not initialized.

## Observability Impact
Snapshot capture logs which method used (git ls-files or fallback). Performance difference visible in daemon tick timing.
