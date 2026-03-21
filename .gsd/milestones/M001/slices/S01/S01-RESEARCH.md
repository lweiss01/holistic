# S01: Automatic Startup Notifications — Research

**Researched:** 2026-03-21  
**Task:** T01  
**Confidence:** HIGH

## Summary

Current implementation uses `server.sendLoggingMessage()` which sends a notification through the MCP protocol, but **logging notifications are designed for diagnostic messages, not actionable agent context**.

**Key finding:** MCP has limited mechanisms for "pushing" context to agents on connection. The protocol is fundamentally request/response based. Available notification types from server to client:

1. **`notifications/message`** (logging) — diagnostic logs, low priority
2. **`notifications/resources/updated`** — signals resource changes
3. **`notifications/resources/list_changed`** — signals resource list changed  
4. **`notifications/prompts/list_changed`** — signals prompt list changed
5. **`notifications/tools/list_changed`** — signals tool list changed

None of these are designed for "here's context you should act on immediately."

**The MCP model:** Agents discover tools at startup, then the agent decides when to call them. There's no "system message" or "initial context" primitive in MCP.

**What actually works:** Claude Desktop and other MCP clients read the tool descriptions when they connect. The agent sees tool names and descriptions but doesn't automatically call them unless it has a reason to.

## Options Evaluated

### Option 1: Keep sendLoggingMessage (current approach)
**Verdict:** ❌ Wrong primitive  
**Why:** Logging messages go to diagnostic logs, not agent working context. In testing, the notification appears in server logs but doesn't surface in the agent's conversation context or trigger any agent action.

### Option 2: Enhance tool descriptions  
**Verdict:** ⚠️ Partial solution  
**Why:** Tool descriptions are visible to agents at startup. We could make `holistic_resume` description more compelling (e.g., "🚀 START HERE: Call this first to get project context"). But this relies on the agent choosing to call it — not guaranteed.

**Pro:** Works within MCP protocol limits  
**Con:** Agent may ignore it, especially in web-based clients where tool discovery UI varies

### Option 3: sendResourceListChanged + resources capability
**Verdict:** ❌ Doesn't fit semantics  
**Why:** Resource notifications signal file/data changes, not "please read this context now." Agents may ignore these signals if they're not actively working with resources.

### Option 4: Create a `/holistic` command agent adapters can teach
**Verdict:** ✅ Pragmatic solution  
**Why:** For MCP clients where auto-calling tools isn't possible, adapter docs can say "Start your first message with 'read holistic context' or use `/holistic` command." This makes the startup pattern explicit and portable across different MCP implementations.

**Pro:** Works regardless of MCP client behavior, documented in adapter files  
**Con:** Requires user/agent cooperation, not fully automatic

### Option 5: Register holistic_resume with prominent description + oninitialized logging
**Verdict:** ✅ Best we can do for MCP auto-path  
**Why:** Combine:
- Tool description that screams "call me first": "🎯 Resume Holistic session (call this at conversation start to get full project context)"
- Keep `sendLoggingMessage` for debugging (shows in logs)
- Rely on agent training/behavior to call tools with "resume" or "context" in the name

**Pro:** Uses MCP primitives correctly, gives agents strong signal  
**Con:** Still relies on agent choosing to call the tool

## Recommendation

**Hybrid approach for S01:**

1. **MCP path (auto when possible):**
   - Update `holistic_resume` tool description to be more prominent: "🎯 Resume Holistic session and get project context. Call this FIRST at conversation start."
   - Keep `sendLoggingMessage` for debugging (helps us verify notification was sent)
   - Document in AGENTS.md: "MCP-connected agents should see holistic_resume tool and call it automatically"

2. **Manual path (fallback for non-cooperative clients):**
   - Add `holistic_slash` tool (or just document the pattern in adapters)
   - Adapter docs say: "If you're not seeing automatic context, type 'use holistic_resume tool' or 'load holistic context'"
   - This becomes the `/holistic` command mentioned in M001 requirements

3. **Verification approach:**
   - Test in Claude Desktop: does agent call `holistic_resume` at start without user prompting?
   - If yes → MCP auto path works
   - If no → fall back to manual path documentation

## MCP Protocol Constraints

From SDK v1.27.1:

- **No "system message" primitive** — can't inject context into agent's working memory on connect
- **No "required tool call" mechanism** — can't force agent to call a tool
- **Notifications are signals, not commands** — logging, resource changes, list changes are advisory
- **Tool discovery is passive** — agent sees tools, decides if/when to call them
- **`oninitialized` fires after handshake** — good time to send signals, but agent may not act on them

## Implementation Path (T02-T08)

Given these constraints:

- **T02:** Build `buildStartupGreeting()` formatter (shared by all paths)
- **T03:** Enhance `holistic_resume` tool description, keep `sendLoggingMessage` for debugging
- **T04:** Add lightweight `/holistic` docs to AGENTS.md (manual trigger)
- **T05-T08:** Test both paths (MCP auto + manual), document which tools work which way

## Sources

- MCP SDK v1.27.1 typedefs: `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/index.d.ts`
- MCP protocol spec (inferred from SDK): request/response model, notification types
- Current implementation: `src/mcp-server.ts` lines 96-105 (sendLoggingMessage)
- Testing: manual inspection of Claude Desktop logs (notification appears in stderr but not in agent context)

---

**Confidence level:** HIGH — explored all SDK notification primitives, confirmed MCP protocol is request/response based with no "initial context push" mechanism
