---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T03: Add error handling and edge cases

Handle edge cases in commitPendingChanges:
1. No files to commit (git status clean) — return success with message
2. Git not available — return error with actionable message
3. Commit hook failure (e.g. linter fails) — return error with hook output
4. Permission errors — return error with permission message
5. Add unit test for success and failure paths

## Inputs

- `src/core/git.ts`

## Expected Output

- `tests/git-commit.test.ts with success and error cases`

## Verification

test -f tests/git-commit.test.ts && npm test -- git-commit.test.ts

## Observability Impact

Error messages guide user to fix issues (install git, fix permissions, resolve hook failures)
