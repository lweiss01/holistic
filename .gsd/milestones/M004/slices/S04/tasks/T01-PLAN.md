---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T01: Audit persistObservedState call sites

Identify all persistObservedState() call sites in src/daemon.ts:
1. Buffering path (files changed, no checkpoint yet)
2. Quiet tick counting path
3. Time-based check path without checkpoint

Document which calls should remain (checkpoint/branch/hygiene) and which should be removed (buffering).

## Inputs

- `src/daemon.ts`

## Expected Output

- `List of call sites with keep/remove decisions`

## Verification

rg 'persistObservedState' src/daemon.ts | wc -l

## Observability Impact

none
