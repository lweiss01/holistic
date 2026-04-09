---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T02: Fix detached HEAD branch name

Fix getBranchName in src/core/git.ts for detached HEAD:
1. When HEAD is detached, run git rev-parse --short HEAD
2. Return 7-char SHA instead of "detached"
3. Handle error case (return "detached" if git fails)
4. Add unit test with detached HEAD scenario
5. Manual test: git checkout <sha> && holistic status

## Inputs

- `src/core/git.ts`

## Expected Output

- `getBranchName returns short SHA for detached HEAD`
- `Unit test verifies fix`

## Verification

git checkout HEAD~1 && holistic status 2>&1 | grep -E '[0-9a-f]{7}'

## Observability Impact

Status output shows readable commit SHA instead of 'detached'
