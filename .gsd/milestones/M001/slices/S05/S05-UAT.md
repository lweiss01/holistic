# S05: Documentation & Tool Parity — UAT

**Milestone:** M001
**Written:** 2026-03-28T20:30:49.616Z

# S05 UAT — Documentation & Tool Parity

## Scenario 1 — startup expectations are unambiguous
1. Open README and locate startup/tool section.
2. Confirm matrix includes MCP auto-start capability and explicit startup action for each listed tool.

Expected: Reader can quickly determine whether `/holistic` (or `holistic_resume`) is required.

## Scenario 2 — /holistic behavior contract is explicit
1. Open AGENTS.md.
2. Confirm non-MCP startup section includes: run startup, recap in 1-3 lines, ask continue/tweak/start-new, wait for user choice.

Expected: Agent behavior is explicit and reproducible.

## Scenario 3 — slash helper visibility
1. Check README and AGENTS for slash helper labels.
2. Confirm `/holistic`, `/checkpoint`, `/handoff` each have plain-language helper text and CLI fallback equivalents.

Expected: Commands are discoverable even in tools without slash support.

