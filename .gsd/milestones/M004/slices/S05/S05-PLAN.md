# S05: Fix Deduplication & Minor Bugs

**Goal:** Fix the remaining medium-priority bugs still open after the 2026-04-03 checkpoint carryover and fresh-repo lock fixes: dedupe in recentFirstMerge, detached HEAD branch name, and session hygiene throttling
**Demo:** After this: Detached HEAD shows commit SHA, hygiene runs once per day, no duplicate session IDs, and no newly discovered checkpoint/handoff regressions remain reproducible

## Planning Note
Already fixed and verified outside this slice's original wording:
- checkpoint created after handoff now inherits carryover context instead of using boilerplate fallback text
- fresh repos can run `holistic checkpoint` before `holistic init` without lock-file `ENOENT` failures

This slice now tracks the remaining bug-hunt scope after those fixes.

## Tasks
- [ ] **T01: Fix recentFirstMerge deduplication** — Fix recentFirstMerge in src/core/state.ts:
1. After sanitizing incoming, dedupe against current before merging
2. Filter out any item in incoming that's already in current
3. Return [...incomingUnique.filter(item => !current.includes(item)), ...current]
4. Add unit test with duplicate inputs
5. Verify nextSteps don't have duplicates after checkpoint
  - Estimate: 30m
  - Files: src/core/state.ts, tests/state-dedup.test.ts
  - Verify: npm test -- state-dedup.test.ts
- [ ] **T02: Fix detached HEAD branch name** — Fix getBranchName in src/core/git.ts for detached HEAD:
1. When HEAD is detached, run git rev-parse --short HEAD
2. Return 7-char SHA instead of "detached"
3. Handle error case (return "detached" if git fails)
4. Add unit test with detached HEAD scenario
5. Manual test: git checkout <sha> && holistic status
  - Estimate: 30m
  - Files: src/core/git.ts, tests/git-detached.test.ts
  - Verify: git checkout HEAD~1 && holistic status 2>&1 | grep -E '[0-9a-f]{7}'
- [ ] **T03: Throttle session hygiene to once per day** — Add hygiene throttling to src/daemon.ts:
1. Add state.lastHygieneAt: string to HolisticState type
2. In runDaemonTick, check if hygiene ran in last 24 hours
3. Only call runSessionHygiene if 24+ hours elapsed
4. Update state.lastHygieneAt after running hygiene
5. Add unit test verifying throttle logic
6. Manual test: daemon runs for 25 hours, hygiene runs ~1 time not 1500
  - Estimate: 45m
  - Files: src/daemon.ts, src/core/types.ts, tests/daemon-hygiene.test.ts
  - Verify: npm test -- daemon-hygiene.test.ts
