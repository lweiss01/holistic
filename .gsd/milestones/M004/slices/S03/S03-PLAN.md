# S03: Add File I/O Error Handling

**Goal:** Wrap all fs.*Sync() calls in critical paths with try/catch and return {success, error} objects. Update call sites to handle errors gracefully
**Demo:** After this: chmod 000 .holistic/state.json, run checkpoint - shows error instead of crashing

## Tasks
- [x] **T01: Add error handling to state.ts file operations** — Wrap saveState() and loadState() in src/core/state.ts with try/catch:
1. Create safeWriteFile(path, content) helper that returns {success, error}
2. Create safeReadFile(path) helper that returns {success, data?, error?}
3. Update saveState() to use safeWriteFile() and return {success, error}
4. Update loadState() to use safeReadFile() and handle read failures gracefully
5. Update withStateLock() to handle saveState/loadState errors
6. All call sites must check success before proceeding
  - Estimate: 60m
  - Files: src/core/state.ts
  - Verify: grep -q 'safeWriteFile\|safeReadFile' src/core/state.ts && grep -q 'success.*error' src/core/state.ts
- [ ] **T02: Add error handling to session I/O** — Wrap session I/O in src/core/state.ts:
1. Update readSessionsFromDir() to skip unreadable files, log errors
2. Update writeSessionFile() to return {success, error}
3. Update archiveSession() to handle write failures
4. Call sites must check success and show errors to user
  - Estimate: 45m
  - Files: src/core/state.ts
  - Verify: grep -q 'try.*catch' src/core/state.ts | wc -l
- [ ] **T03: Add error handling to git.ts file operations** — Wrap git operations in src/core/git.ts:
1. Update captureRepoSnapshot() to handle stat failures (skip unreadable files)
2. Update writePendingCommit() to return {success, error}
3. Update clearPendingCommit() to handle unlink failures gracefully
4. Update resolveGitDir() to handle missing .git
5. Call sites must check success
  - Estimate: 45m
  - Files: src/core/git.ts
  - Verify: grep -q 'try.*catch' src/core/git.ts | wc -l
- [ ] **T04: Add error handling to docs.ts file operations** — Wrap doc generation in src/core/docs.ts:
1. Update writeDerivedDocs() to handle write failures
2. Return list of failed docs instead of crashing
3. Caller logs warnings but continues
  - Estimate: 30m
  - Files: src/core/docs.ts
  - Verify: grep -q 'try.*catch' src/core/docs.ts
- [ ] **T05: Update CLI to handle I/O errors gracefully** — Update CLI commands to handle I/O errors:
1. Update checkpoint command to check saveState success
2. Update handoff command to check session write success
3. Show clear error messages to user
4. Exit with code 1 on I/O failures
5. Manual test: chmod 000 .holistic/state.json && holistic checkpoint
6. Should show error, exit 1, no stack trace
  - Estimate: 30m
  - Files: src/cli.ts
  - Verify: chmod 000 .holistic/state.json && holistic checkpoint 2>&1 | grep -q 'Permission denied\|EACCES' && echo 'Error handled' || echo 'Crashed'
