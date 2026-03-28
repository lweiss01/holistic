# S04: Edge-Case Health Diagnostics — UAT

**Milestone:** M001
**Written:** 2026-03-28T19:41:20.081Z

# S04 UAT — Edge-Case Health Diagnostics

## Scenario 1 — stale checkpoint warning
1. Simulate state where latest checkpoint timestamp is >= 3 days old.
2. Trigger startup greeting path (MCP notification or `/holistic resume`).
3. Confirm output includes `System health warnings:` and `daemon-stale-checkpoint`.

Expected: Warning appears with diagnostic tone and no user-blame language.

## Scenario 2 — unusual 50+ files without checkpoint evidence
1. Simulate active/passive state with >= 50 changed files and no checkpoint evidence.
2. Trigger startup greeting path.
3. Confirm output includes `unusual-files-without-checkpoint` warning.

Expected: Warning appears only at/above threshold.

## Scenario 3 — below-threshold and no-warning baseline
1. Simulate 49 changed files without checkpoint evidence, recent checkpoint timestamp.
2. Trigger startup greeting path.
3. Confirm no system health warning block appears and recap format remains unchanged.

Expected: No-warning path is unchanged from baseline.

