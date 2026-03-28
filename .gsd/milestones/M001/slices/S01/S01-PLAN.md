# S01: Automatic Startup Notifications

**Goal:** MCP clients auto-greet with recap when conversation starts; non-MCP clients respond to `/holistic` with same pattern; greeting includes last handoff summary + 3-question prompt
**Demo:** After this: MCP clients auto-greet with recap when conversation starts; non-MCP clients respond to `/holistic` with same pattern; greeting includes last handoff summary + 3-question prompt

## Tasks
- [x] **T01: Research MCP notification delivery mechanisms** — 
  - Files: src/mcp-server.ts, MCP SDK docs, Claude Desktop logs
  - Verify: S01-RESEARCH.md exists with clear recommendation for how to make notification actionable
- [x] **T02: Build shared startup greeting formatter** — 
  - Files: src/core/state.ts (add buildStartupGreeting()), src/mcp-server.ts
  - Verify: `npm test` passes, greeting format matches template exactly
- [x] **T03: Enhance MCP notification delivery** — 
  - Files: src/mcp-server.ts (sendResumeNotification()), src/core/state.ts
  - Verify: Start Claude Desktop, check logs show notification sent, manually verify agent sees content in first exchange
- [x] **T04: Add `/holistic` slash command handler** — 
  - Files: src/mcp-server.ts (add holistic_slash tool), listHolisticTools(), callHolisticTool()
  - Verify: `npm test`, manually call `holistic_slash` via MCP client, should return greeting text
- [x] **T05: Add unit test for startup greeting format** — 
  - Files: src/__tests__/mcp-notification.test.ts (new)
  - Verify: `npm test` passes
- [x] **T06: Update AGENTS.md with /holistic pattern** — 
  - Files: AGENTS.md, .holistic/context/adapters/*.md (review)
  - Verify: Read AGENTS.md, confirm pattern is clear
- [ ] **T07: Manual UAT - MCP auto-greeting** — 
  - Files: none (testing only)
  - Verify: Agent greets automatically with expected content
- [x] **T08: Manual UAT - /holistic command** — 
  - Files: none (testing only)
  - Verify: Command returns greeting text with expected content
