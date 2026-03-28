# S07: Technical Polish & Cross-Platform — UAT

**Milestone:** M001
**Written:** 2026-03-28T20:50:31.226Z

# S07 UAT — Technical Polish & Cross-Platform

## Scenario 1 — line-ending policy is tracked and shared
1. Confirm `.gitattributes` is committed and no longer ignored.
2. Verify policy includes LF for code/docs/shell and CRLF for Windows script files.

Expected: Contributors receive a consistent, versioned line-ending policy.

## Scenario 2 — package/install smoke path
1. Run `npm run test:smoke`.
2. Confirm output indicates packaged CLI installs and bootstraps a clean repo successfully.

Expected: Packaging/install/bootstrap works on a clean temp workspace.

## Scenario 3 — warning noise reduction
1. Trigger hook refresh in an environment with user-managed hooks.
2. Observe warning output.

Expected: A single aggregated warning lists skipped hooks, rather than repeated per-hook lines.

