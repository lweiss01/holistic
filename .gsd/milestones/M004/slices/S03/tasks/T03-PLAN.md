---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T03: Add error handling to git.ts file operations

Wrap git operations in src/core/git.ts:
1. Update captureRepoSnapshot() to handle stat failures (skip unreadable files)
2. Update writePendingCommit() to return {success, error}
3. Update clearPendingCommit() to handle unlink failures gracefully
4. Update resolveGitDir() to handle missing .git
5. Call sites must check success

## Inputs

- `src/core/git.ts`

## Expected Output

- `Git operations return success/error`
- `Unreadable files skipped in snapshot`

## Verification

grep -q 'try.*catch' src/core/git.ts | wc -l

## Observability Impact

Git operation errors logged with context
