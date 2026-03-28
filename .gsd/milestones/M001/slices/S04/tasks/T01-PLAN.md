---
estimated_steps: 6
estimated_files: 3
skills_used: []
---

# T01: Implement daemon-health diagnostics evaluator

Implement a dedicated health diagnostics evaluator that reads existing runtime/session metadata and emits structured warning objects for checkpoint staleness and unusual change-without-checkpoint conditions.

Steps:
1. Add a shared evaluator in the core state layer (or adjacent diagnostics helper) that computes: `staleCheckpointWarning` (>=3 days since last checkpoint) and `unusualPatternWarning` (>=50 changed files without checkpoint evidence).
2. Keep thresholds centralized constants so S04 behavior is explicit and testable.
3. Ensure evaluator output includes machine-readable fields (type/code/message/timestamp inputs used) to support future troubleshooting.
4. Preserve redaction boundaries: warnings must not include sensitive file contents or secret values.

## Inputs

- `src/core/state.ts`
- `src/core/types.ts`
- `tests/run-tests.ts`
- `.gsd/REQUIREMENTS.md`

## Expected Output

- `src/core/state.ts`
- `src/core/types.ts`
- `tests/run-tests.ts`

## Verification

npm test -- --grep "health diagnostics|stale checkpoint|unusual pattern"
