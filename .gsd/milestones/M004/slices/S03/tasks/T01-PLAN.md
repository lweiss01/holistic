---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T01: Add error handling to state.ts file operations

Wrap saveState() and loadState() in src/core/state.ts with try/catch:
1. Create safeWriteFile(path, content) helper that returns {success, error}
2. Create safeReadFile(path) helper that returns {success, data?, error?}
3. Update saveState() to use safeWriteFile() and return {success, error}
4. Update loadState() to use safeReadFile() and handle read failures gracefully
5. Update withStateLock() to handle saveState/loadState errors
6. All call sites must check success before proceeding

## Inputs

- `src/core/state.ts`

## Expected Output

- `safeWriteFile and safeReadFile helpers in state.ts`
- `saveState and loadState return success/error`

## Verification

grep -q 'safeWriteFile\|safeReadFile' src/core/state.ts && grep -q 'success.*error' src/core/state.ts

## Observability Impact

File I/O errors logged with operation, path, and error reason
