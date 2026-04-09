---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T02: Add error handling to session I/O

Wrap session I/O in src/core/state.ts:
1. Update readSessionsFromDir() to skip unreadable files, log errors
2. Update writeSessionFile() to return {success, error}
3. Update archiveSession() to handle write failures
4. Call sites must check success and show errors to user

## Inputs

- `src/core/state.ts`

## Expected Output

- `Session I/O returns success/error`
- `Unreadable sessions logged but don't crash`

## Verification

grep -q 'try.*catch' src/core/state.ts | wc -l

## Observability Impact

Session I/O errors logged, corrupt sessions skipped with warning
