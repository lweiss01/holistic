---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T02: Remove persistObservedState from buffering paths

Remove persistObservedState() from buffering paths:
1. Remove call after "Buffered X changed files" (line ~185)
2. Keep calls in checkpoint/branch-switch/hygiene paths
3. Verify state.passiveCapture updates are still tracked in-memory
4. Add comment explaining why buffering doesn't persist

## Inputs

- `src/daemon.ts`

## Expected Output

- `Buffering path returns without persisting state`

## Verification

grep -A 5 'Buffered.*changed file' src/daemon.ts | grep -v 'persistObservedState'

## Observability Impact

Daemon logs show buffering without state writes
