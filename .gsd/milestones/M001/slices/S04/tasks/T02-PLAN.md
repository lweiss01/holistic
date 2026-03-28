---
estimated_steps: 6
estimated_files: 4
skills_used: []
---

# T02: Integrate diagnostics into startup notification surfaces

Wire diagnostics into startup notification rendering so both MCP auto-start and `/holistic` manual-start surfaces include warnings when present while preserving existing recap/question flow.

Steps:
1. Extend startup greeting/notification builders to accept health warning payloads from the evaluator.
2. Inject warnings into MCP startup notification path and `/holistic` command path using one shared formatting helper.
3. Keep message tone diagnostic and actionable (e.g., "daemon may not be running") rather than blaming users.
4. Ensure no-warning path remains unchanged to avoid regressions in baseline startup UX.

## Inputs

- `src/core/docs.ts`
- `src/mcp-server.ts`
- `src/cli.ts`
- `src/core/state.ts`
- `tests/run-tests.ts`

## Expected Output

- `src/core/docs.ts`
- `src/mcp-server.ts`
- `src/cli.ts`
- `tests/run-tests.ts`

## Verification

npm test -- --grep "startup warning|holistic command|resume notification"
