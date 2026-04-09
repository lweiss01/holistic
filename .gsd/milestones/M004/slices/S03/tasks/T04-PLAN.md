---
estimated_steps: 4
estimated_files: 1
skills_used: []
---

# T04: Add error handling to docs.ts file operations

Wrap doc generation in src/core/docs.ts:
1. Update writeDerivedDocs() to handle write failures
2. Return list of failed docs instead of crashing
3. Caller logs warnings but continues

## Inputs

- `src/core/docs.ts`

## Expected Output

- `writeDerivedDocs handles errors gracefully`

## Verification

grep -q 'try.*catch' src/core/docs.ts

## Observability Impact

Doc generation errors logged, CLI shows warnings
