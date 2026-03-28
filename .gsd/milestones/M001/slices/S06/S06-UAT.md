# S06: Real-World Dogfooding — UAT

**Milestone:** M001
**Written:** 2026-03-28T20:40:06.322Z

# S06 UAT — Real-World Dogfooding

## Target repos exercised
- Holistic product repo
- Paydirt repo (`C:\Users\lweis\Documents\paydirt`)

## Scenario 1 — startup/resume continuity
1. Run repo startup path (`holistic resume --continue` or repo-local wrapper).
2. Confirm recap includes objective/status and actionable next-step context.

Expected: Startup continuity appears without reconstructing prior context manually.

## Scenario 2 — checkpoint capture
1. Run checkpoint command with explicit reason/status.
2. Confirm checkpoint count/history surfaces update successfully.

Expected: Progress snapshot records reliably during normal workflow.

## Scenario 3 — handoff path viability
1. Run handoff path (`--draft` where available, non-interactive fallback if needed).
2. Confirm handoff summary and pending commit metadata are emitted.

Expected: Session can be closed with transferable context; behavior differences by version are documented.

## Findings
- Core resume/checkpoint flow validated in both repos.
- Rough edges documented for S07: warning noise, stale recap drift, and version-skew handoff differences.

