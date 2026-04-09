---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T01: Fix recentFirstMerge deduplication

Fix recentFirstMerge in src/core/state.ts:
1. After sanitizing incoming, dedupe against current before merging
2. Filter out any item in incoming that's already in current
3. Return [...incomingUnique.filter(item => !current.includes(item)), ...current]
4. Add unit test with duplicate inputs
5. Verify nextSteps don't have duplicates after checkpoint

## Inputs

- `src/core/state.ts`

## Expected Output

- `recentFirstMerge deduplicates correctly`
- `Unit test verifies fix`

## Verification

npm test -- state-dedup.test.ts

## Observability Impact

Checkpoint output shows deduplicated nextSteps
