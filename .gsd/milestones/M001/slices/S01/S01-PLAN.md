# S01: Automatic Startup Notifications

**Goal:** MCP clients auto-greet with recap when conversation starts; non-MCP clients respond to `/holistic` with same pattern; greeting includes last handoff summary + 3-question prompt

**Demo:** Start Claude Desktop (MCP), see immediate greeting with recap. Type `/holistic` in web Claude, see same greeting. Both include "continue/tweak/start new?" question.

## Must-Haves

- MCP notification delivers actionable content to agent's working context (not just logs)
- `/holistic` slash command handler registered and documented
- `buildStartupGreeting()` formats recap consistently for both MCP and slash command paths
- Greeting includes: last handoff summary, "continue/tweak/start new?" question, pointer to long-term docs

## Proof Level

- This slice proves: **integration** — MCP notification works end-to-end in real Claude Desktop
- Real runtime required: **yes** — must test with actual MCP client connection
- Human/UAT required: **yes** — verify agent sees and acts on notification automatically

## Verification

- Start fresh Claude Desktop conversation (MCP connected)
- Agent should greet with recap within first message without user prompting
- Greeting should include last handoff summary + 3-question prompt
- Web-based agent: type `/holistic`, should see same greeting format
- `npm test -- src/__tests__/mcp-notification.test.ts` (unit test for notification content)

## Observability / Diagnostics

- Runtime signals: `sendLoggingMessage` logs notification sent, notification content visible in logs
- Inspection surfaces: MCP server logs (stderr), `holistic resume` CLI for comparison
- Failure visibility: Log message if notification fails to send, agent-visible warning if session empty
- Redaction constraints: none (session metadata is not sensitive)

## Integration Closure

- Upstream surfaces consumed: `getResumePayload()` (existing), `ensureMcpResumeState()` (existing)
- New wiring introduced in this slice: `buildStartupGreeting()` shared formatter, `/holistic` slash command registered
- What remains before the milestone is truly usable end-to-end: S02 (proactive capture), S03 (archiving), S04 (health warnings), S05 (docs)

## Tasks

- [x] **T01: Research MCP notification delivery mechanisms** `est:1h`
  - Why: Current `sendLoggingMessage` may not be visible to agent's working context - need to find the right MCP primitive
  - Files: `src/mcp-server.ts`, MCP SDK docs, Claude Desktop logs
  - Do: Test current notification behavior in Claude Desktop. Check if `sendLoggingMessage` appears in agent context or only logs. Research alternative MCP primitives (notifications, system messages, tool results). Document findings in S01-RESEARCH.md.
  - Verify: S01-RESEARCH.md exists with clear recommendation for how to make notification actionable
  - Done when: We know which MCP primitive delivers content to agent's working context, or have confirmed current approach works and needs content enhancement only

- [x] **T02: Build shared startup greeting formatter** `est:30m`
  - Why: Both MCP notification and `/holistic` command need identical greeting format
  - Files: `src/core/state.ts` (add `buildStartupGreeting()`), `src/mcp-server.ts`
  - Do: Extract greeting logic from `buildResumeNotificationText()` into new `buildStartupGreeting(state, agent)` function. Format: "Holistic resume\n\n- objective\n- status\n- try next\n\nChoices: continue, tweak, start-new\nAdapter doc: <path>\nLong-term history: <path>". Keep `getResumePayload()` for structured data, use `buildStartupGreeting()` for text rendering.
  - Verify: `npm test` passes, greeting format matches template exactly
  - Done when: `buildStartupGreeting()` exists and is used by `buildResumeNotificationText()`

- [x] **T03: Enhance MCP notification delivery** `est:1h`
  - Why: Make notification actionable by agent, not just logged
  - Files: `src/mcp-server.ts` (`sendResumeNotification()`), `src/core/state.ts`
  - Do: Implement findings from T01 research. If `sendLoggingMessage` works, enhance content with clearer agent instructions ("Read and act on this context"). If different primitive needed (system message, tool result), implement that. Ensure `buildStartupGreeting()` output is used. Add fallback: if notification fails, document in logs.
  - Verify: Start Claude Desktop, check logs show notification sent, manually verify agent sees content in first exchange
  - Done when: MCP notification delivers greeting text and agent receives it (confirmed via manual test, UAT in verification phase)

- [x] **T04: Add `/holistic` slash command handler** `est:45m`
  - Why: Non-MCP tools need lightweight manual trigger with same greeting
  - Files: `src/mcp-server.ts` (add `holistic_slash` tool), `listHolisticTools()`, `callHolisticTool()`
  - Do: Add new tool `holistic_slash` with description "Load Holistic context and get startup greeting (use this at session start)". Handler calls `ensureMcpResumeState()` and `buildStartupGreeting()`, returns text result. Update `listHolisticTools()` to include it. Tool takes optional `agent` parameter.
  - Verify: `npm test`, manually call `holistic_slash` via MCP client, should return greeting text
  - Done when: `/holistic` tool registered, returns same greeting as MCP notification

- [x] **T05: Add unit test for startup greeting format** `est:30m`
  - Why: Prevent greeting format regressions
  - Files: `src/__tests__/mcp-notification.test.ts` (new)
  - Do: Create test file. Test cases: (1) greeting includes objective, status, try-next from payload, (2) greeting includes "continue, tweak, start-new" choices, (3) greeting includes adapter doc path, (4) empty session returns null or minimal message. Use mock state objects.
  - Verify: `npm test` passes
  - Done when: Test file exists with 4+ test cases, all passing

- [x] **T06: Update AGENTS.md with /holistic pattern** `est:30m`
  - Why: Agents need explicit instructions to use `/holistic` in non-MCP tools
  - Files: `AGENTS.md`, `.holistic/context/adapters/*.md` (review)
  - Do: Add section to AGENTS.md: "For non-MCP tools (web-based agents), start your session with `/holistic` to load context. You should see the same startup greeting as MCP tools." Update adapter docs to mention `/holistic` command where relevant. Keep it brief, no ceremony.
  - Verify: Read AGENTS.md, confirm pattern is clear
  - Done when: AGENTS.md documents `/holistic`, adapter docs reference it

- [ ] **T07: Manual UAT - MCP auto-greeting** `est:15m`
  - Why: Verify MCP notification works end-to-end in real tool
  - Files: none (testing only)
  - Do: Open Claude Desktop with MCP connected. Start fresh conversation. Agent should greet with recap within first message without user prompting. Greeting should include: last handoff summary, "continue/tweak/start new?" question, pointer to docs.
  - Verify: Agent greets automatically with expected content
  - Done when: UAT passes, agent behavior matches demo goal
  - **STATUS: READY FOR USER VERIFICATION**

- [x] **T08: Manual UAT - /holistic command** `est:15m`
  - Why: Verify slash command works in non-MCP tools
  - Files: none (testing only)
  - Do: Use MCP test client or web-based agent with Holistic MCP. Type `/holistic` (or call `holistic_slash` tool). Should return greeting with same format as MCP auto-greeting.
  - Verify: Command returns greeting text with expected content
  - Done when: UAT passes, slash command behavior matches demo goal
  - **STATUS: READY FOR USER VERIFICATION**

## Files Likely Touched

- `src/mcp-server.ts` (notification delivery, slash command handler)
- `src/core/state.ts` (`buildStartupGreeting()` formatter)
- `src/__tests__/mcp-notification.test.ts` (new test file)
- `AGENTS.md` (document `/holistic` pattern)
- `.holistic/context/adapters/*.md` (update adapter docs)
- `.gsd/milestones/M001/slices/S01/S01-RESEARCH.md` (research findings)
