# S04: Edge-Case Health Diagnostics

**Goal:** Detect and surface daemon-health edge cases at startup so users and agents can immediately see when automatic capture may be unhealthy without introducing nags or manual checklist behavior.
**Demo:** After this: startup notification includes warning if daemon hasn't checkpointed in 3+ days or unusual patterns detected (50+ files, no checkpoint); warnings are diagnostic (system health) not nags (user blame)

## Tasks
- [ ] **T01: Implement daemon-health diagnostics evaluator** — Implement a dedicated health diagnostics evaluator that reads existing runtime/session metadata and emits structured warning objects for checkpoint staleness and unusual change-without-checkpoint conditions.

Steps:
1. Add a shared evaluator in the core state layer (or adjacent diagnostics helper) that computes: `staleCheckpointWarning` (>=3 days since last checkpoint) and `unusualPatternWarning` (>=50 changed files without checkpoint evidence).
2. Keep thresholds centralized constants so S04 behavior is explicit and testable.
3. Ensure evaluator output includes machine-readable fields (type/code/message/timestamp inputs used) to support future troubleshooting.
4. Preserve redaction boundaries: warnings must not include sensitive file contents or secret values.
  - Estimate: 1.5h
  - Files: src/core/state.ts, src/core/types.ts, tests/run-tests.ts
  - Verify: npm test -- --grep "health diagnostics|stale checkpoint|unusual pattern"
- [ ] **T02: Integrate diagnostics into startup notification surfaces** — Wire diagnostics into startup notification rendering so both MCP auto-start and `/holistic` manual-start surfaces include warnings when present while preserving existing recap/question flow.

Steps:
1. Extend startup greeting/notification builders to accept health warning payloads from the evaluator.
2. Inject warnings into MCP startup notification path and `/holistic` command path using one shared formatting helper.
3. Keep message tone diagnostic and actionable (e.g., "daemon may not be running") rather than blaming users.
4. Ensure no-warning path remains unchanged to avoid regressions in baseline startup UX.
  - Estimate: 1.5h
  - Files: src/core/docs.ts, src/mcp-server.ts, src/cli.ts, tests/run-tests.ts
  - Verify: npm test -- --grep "startup warning|holistic command|resume notification"
- [ ] **T03: Lock boundary behavior with diagnostics-focused tests** — Add regression and negative-case coverage for S04 boundaries so warning emission is predictable and existing startup behavior remains stable.

Steps:
1. Add tests for warning-trigger boundaries: exactly 3 days, just under 3 days, exactly 50 files, and below-threshold cases.
2. Add tests proving no-warning startup output remains unchanged when diagnostics are clear.
3. Add tests asserting warning phrasing is system-health diagnostic and does not instruct or blame users.
4. Run slice-level verification including targeted tests and build.

  - Estimate: 1h
  - Files: tests/run-tests.ts, .gsd/milestones/M001/slices/S04/tasks/T03-PLAN.md
  - Verify: npm test -- --grep "stale checkpoint|unusual pattern|startup warning" && npm run build
