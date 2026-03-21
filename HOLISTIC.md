# HOLISTIC

## Start Here

This repo uses Holistic for cross-agent handoffs. The source of truth is the repo itself: handoff docs, history, and regression memory should be committed and synced so any device can continue. Read this file first, then review the long-term history docs and zero-touch architecture note, then use the adapter doc for your app. The Holistic daemon is optional and only improves passive capture on devices where it is installed.

## Current Objective

**Capture work and prepare a clean handoff.**

Capture work and prepare a clean handoff.

## Latest Work Status

Committed: fix(docs): correct .gitignore and README about .holistic/system/

## What Was Tried

- No tried items captured yet.

## What To Try Next

- User verification: T07 (MCP auto-greeting in Claude Desktop)
- User verification: T08 (/holistic command testing)
- Update M001 roadmap to mark S01 complete
- Consider adding ASCII splash screen slice
- Execute S01.5/T01: Create splash screen module
- Consider S02: Proactive Automatic Capture or other M001 slices
- Continue with M001/S02: Proactive Automatic Capture
- Or work on M001/S03: Automatic Memory Hygiene

## Active Plan

- Read HOLISTIC.md
- Confirm next step with the user

## Overall Impact So Far

- MCP protocol has no 'initial context push' - must rely on tool discovery + agent cooperation
- Both MCP and manual paths will use identical greeting format
- Agents will see prominent tool description signaling importance at startup
- Tool calls return human-readable greeting format
- Non-MCP tools can now use lightweight /holistic command pattern
- Manual trigger available for tools where auto-resume doesn't work
- Greeting format now has comprehensive test coverage
- Prevents regressions in greeting content and structure
- Agents now have clear documentation on how to load context at startup
- Tool comparison table explains which environments support automatic vs manual
- S01 implementation is code-complete and tested
- Ready for manual UAT to verify real-world behavior
- S01 Automatic Startup Notifications is complete and verified
- S01 Automatic Startup Notifications delivered and verified
- S01.5 ASCII Splash Screen planned and ready for execution
- Holistic now has visual brand identity in CLI and README
- Value proposition clearly visible: 'Your repo remembers, so your next agent doesn't have to guess'
- Holistic now has automatic startup notifications for MCP tools
- Holistic has visual brand identity with ASCII splash screen
- Value proposition clearly communicated in CLI and README
- Holistic has automatic startup notifications for MCP and manual tools
- Visual brand identity established with ASCII splash screen
- Documentation now accurately reflects what gets committed vs ignored

## Regression Watch

- Do not use sendLoggingMessage as primary delivery - it's for diagnostics only
- buildStartupGreeting must be exported from state.ts and imported in mcp-server.ts
- holistic_resume must return formatted text greeting, not JSON payload
- MCP tool list must include holistic_slash as 2nd tool
- Test module must be imported and merged into allTests array in run-tests.ts
- AGENTS.md must document both MCP and manual startup patterns

## Key Assumptions

- No explicit assumptions recorded yet.

## Blockers

- No blockers recorded.

## Changed Files In Current Session

- .beads/daemon.log
- .bg-shell/manifest.json
- .holistic/state.json
- .holistic/state.json.lock

## Pending Work Queue

- Remove first-class phase tracking from Holistic core state, docs, and commands: Review roadmap docs
- Remove first-class phase tracking from Holistic core state, docs, and commands: Review roadmap docs
- Capture work and prepare a clean handoff.: Remove first-class phase tracking from Holistic core state, docs, and commands
- Plan Phase 2 Team/Org Mode: Start Phase 2 Team/Org Mode planning
- Capture work and prepare a clean handoff.: This should be the active next step now

## Long-Term Memory

- Project history: [.holistic/context/project-history.md](.holistic/context/project-history.md)
- Regression watch: [.holistic/context/regression-watch.md](.holistic/context/regression-watch.md)
- Zero-touch architecture: [.holistic/context/zero-touch.md](.holistic/context/zero-touch.md)
- Portable sync model: handoffs are intended to be committed and synced so any device with repo access can continue.

## Supporting Documents

- State file: [.holistic/state.json](.holistic/state.json)
- Current plan: [.holistic/context/current-plan.md](.holistic/context/current-plan.md)
- Session protocol: [.holistic/context/session-protocol.md](.holistic/context/session-protocol.md)
- Session archive: [.holistic/sessions](.holistic/sessions)
- Adapter docs:
- codex: [.holistic/context/adapters/codex.md](.holistic/context/adapters/codex.md)
- claude: [.holistic/context/adapters/claude-cowork.md](.holistic/context/adapters/claude-cowork.md)
- antigravity: [.holistic/context/adapters/antigravity.md](.holistic/context/adapters/antigravity.md)
- gemini: [.holistic/context/adapters/gemini.md](.holistic/context/adapters/gemini.md)
- copilot: [.holistic/context/adapters/copilot.md](.holistic/context/adapters/copilot.md)
- cursor: [.holistic/context/adapters/cursor.md](.holistic/context/adapters/cursor.md)
- goose: [.holistic/context/adapters/goose.md](.holistic/context/adapters/goose.md)
- gsd: [.holistic/context/adapters/gsd.md](.holistic/context/adapters/gsd.md)

## Historical Memory

- Last updated: 2026-03-21T19:12:15.083Z
- Last handoff: S01 slice planning complete
- Pending sessions remembered: 12
