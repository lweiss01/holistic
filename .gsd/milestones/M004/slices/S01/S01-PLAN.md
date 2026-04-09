# S01: Implement Git Commit Execution

**Goal:** Add commitPendingChanges() function to git.ts and integrate it into the handoff flow so auto-commits actually execute
**Demo:** After this: After handoff, git log shows actual commit with correct message and staged Holistic files

## Tasks
- [x] **T01: Add commitPendingChanges function to git.ts** — Create commitPendingChanges(rootDir: string, paths: RuntimePaths): {success: boolean, error?: string} that:
1. Reads pending commit message and files from state.pendingCommit
2. Stages files using git add
3. Commits with message using git commit -m
4. Returns {success: true} on success or {success: false, error: string} on failure
5. Handles edge cases: nothing to commit, git not available, commit hook failures
  - Estimate: 45m
  - Files: src/core/git.ts
  - Verify: node --experimental-strip-types -e "import {commitPendingChanges} from './src/core/git.ts'; console.log(typeof commitPendingChanges === 'function')"
- [x] **T02: Integrate commitPendingChanges into handoff flow** — Update src/cli.ts handoff command to:
1. After writePendingCommit(), call commitPendingChanges()
2. If commit succeeds, call clearPendingCommit() and update state.pendingCommit = null
3. If commit fails, keep pending state and show error to user
4. Update console output to show commit SHA on success or error message on failure
  - Estimate: 30m
  - Files: src/cli.ts
  - Verify: grep -q 'commitPendingChanges' src/cli.ts
- [x] **T03: Add error handling and edge cases** — Handle edge cases in commitPendingChanges:
1. No files to commit (git status clean) — return success with message
2. Git not available — return error with actionable message
3. Commit hook failure (e.g. linter fails) — return error with hook output
4. Permission errors — return error with permission message
5. Add unit test for success and failure paths
  - Estimate: 45m
  - Files: src/core/git.ts, tests/git-commit.test.ts
  - Verify: test -f tests/git-commit.test.ts && npm test -- git-commit.test.ts
- [x] **T04: End-to-end verification** — Manual UAT:
1. Run holistic handoff in test repo
2. Verify git log shows new commit with correct message
3. Verify Holistic files are in commit
4. Verify pending-commit.txt is removed
5. Test failure case: make git unavailable, verify error message
6. Test clean repo case: run handoff with no changes, verify graceful handling
  - Estimate: 30m
  - Verify: Manual verification: git log -1 shows Holistic commit after handoff
