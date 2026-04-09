---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T05: Update CLI to handle I/O errors gracefully

Update CLI commands to handle I/O errors:
1. Update checkpoint command to check saveState success
2. Update handoff command to check session write success
3. Show clear error messages to user
4. Exit with code 1 on I/O failures
5. Manual test: chmod 000 .holistic/state.json && holistic checkpoint
6. Should show error, exit 1, no stack trace

## Inputs

- `src/cli.ts`
- `src/core/state.ts`

## Expected Output

- `CLI shows errors for I/O failures`
- `chmod 000 test shows error message`

## Verification

chmod 000 .holistic/state.json && holistic checkpoint 2>&1 | grep -q 'Permission denied\|EACCES' && echo 'Error handled' || echo 'Crashed'

## Observability Impact

CLI error messages guide user to fix permission issues
