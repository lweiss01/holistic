---
id: T03
parent: S02
milestone: M001
provides: []
requires: []
affects: []
key_files: ["src/core/docs.ts", "src/cli.ts", "src/mcp-server.ts", "tests/run-tests.ts", ".gsd/DECISIONS.md", ".gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md"]
key_decisions: ["Document natural breakpoints with explicit supported examples and safety valves instead of implying transcript parsing or unsupported automation.", "Keep CLI help and MCP descriptions aligned with the same bounded completion metadata exposed by the runtime."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Verified the slice-required command npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint" to a clean pass after the wording changes. Verified the new wording-regression assertions with npm test -- --grep "resume payload starts empty|mcp tool list stays intentionally thin|CLI help text documents". Verified the slice plan and all task-plan artifacts remain present on disk with a direct Node existsSync check."
completed_at: 2026-03-28T03:04:12.909Z
blocker_discovered: false
---

# T03: Aligned proactive-capture docs, CLI help, and MCP checkpoint guidance with supported natural-breakpoint behavior and verified S02.

> Aligned proactive-capture docs, CLI help, and MCP checkpoint guidance with supported natural-breakpoint behavior and verified S02.

## What Happened
---
id: T03
parent: S02
milestone: M001
key_files:
  - src/core/docs.ts
  - src/cli.ts
  - src/mcp-server.ts
  - tests/run-tests.ts
  - .gsd/DECISIONS.md
  - .gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md
key_decisions:
  - Document natural breakpoints with explicit supported examples and safety valves instead of implying transcript parsing or unsupported automation.
  - Keep CLI help and MCP descriptions aligned with the same bounded completion metadata exposed by the runtime.
duration: ""
verification_result: passed
completed_at: 2026-03-28T03:04:12.911Z
blocker_discovered: false
---

# T03: Aligned proactive-capture docs, CLI help, and MCP checkpoint guidance with supported natural-breakpoint behavior and verified S02.

**Aligned proactive-capture docs, CLI help, and MCP checkpoint guidance with supported natural-breakpoint behavior and verified S02.**

## What Happened

Updated src/core/docs.ts so generated agent-facing guidance teaches concrete natural-breakpoint checkpoint moments that the runtime actually supports, including tests passed, bug fixed, feature complete, focus change, before compaction, and before handoff. Added safety-valve wording for /checkpoint and /handoff only when a client exposes those wrappers, while preserving the explicit repo-local command fallback so the docs do not promise unsupported automation. Updated src/cli.ts help output to document the already-supported completion metadata flags and concrete checkpoint examples, and updated src/mcp-server.ts so holistic_checkpoint describes when to use structured completion metadata instead of free-form inference. Added focused wording-regression assertions in tests/run-tests.ts to keep generated docs, CLI help, and MCP descriptions aligned with runtime behavior. During verification, the first build failed because raw /checkpoint and /handoff text inside a template literal was parsed incorrectly; I isolated that cause, escaped the literals, reran the required build/test command, and finished with clean verification.

## Verification

Verified the slice-required command npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint" to a clean pass after the wording changes. Verified the new wording-regression assertions with npm test -- --grep "resume payload starts empty|mcp tool list stays intentionally thin|CLI help text documents". Verified the slice plan and all task-plan artifacts remain present on disk with a direct Node existsSync check.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run build && npm test -- --grep "daemon tick|auto-draft handoff|holistic_checkpoint"` | 0 | ✅ pass | 3300ms |
| 2 | `npm test -- --grep "resume payload starts empty|mcp tool list stays intentionally thin|CLI help text documents"` | 0 | ✅ pass | 2400ms |
| 3 | `node -e "const fs=require('node:fs'); const paths=['.gsd/milestones/M001/slices/S02/S02-PLAN.md','.gsd/milestones/M001/slices/S02/tasks/T01-PLAN.md','.gsd/milestones/M001/slices/S02/tasks/T02-PLAN.md','.gsd/milestones/M001/slices/S02/tasks/T03-PLAN.md']; const missing=paths.filter((p)=>!fs.existsSync(p)); if(missing.length){ console.error('Missing: '+missing.join(', ')); process.exit(1);} "` | 0 | ✅ pass | 0ms |


## Deviations

Added a small wording-regression test subset beyond the slice’s required grep command so doc/help alignment is executable rather than purely manual.

## Known Issues

None.

## Files Created/Modified

- `src/core/docs.ts`
- `src/cli.ts`
- `src/mcp-server.ts`
- `tests/run-tests.ts`
- `.gsd/DECISIONS.md`
- `.gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md`


## Deviations
Added a small wording-regression test subset beyond the slice’s required grep command so doc/help alignment is executable rather than purely manual.

## Known Issues
None.
