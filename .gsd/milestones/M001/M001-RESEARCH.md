# M001: Core Workflow Tightening — Research

**Researched:** 2026-03-21  
**Domain:** MCP server notifications, daemon checkpoint triggers, session archiving, agent instruction patterns  
**Confidence:** HIGH

## Summary

The codebase already has strong foundations for M001's goals, but key pieces need enhancement:

1. **MCP auto-notification exists but fires on `oninitialized`** — confirmed it sends `sendLoggingMessage` with resume context. The problem from testing: it's working but content may not be rich enough or visible enough to agents.

2. **Daemon checkpoint triggers are conservative** — waits for "quiet ticks" after file changes (QUIET_TICKS_BEFORE_CHECKPOINT = 1). Already has branch-switch checkpoints. Needs: time-based triggers, file-count triggers, pre-compaction detection.

3. **No session archiving exists** — all sessions live in `.holistic/sessions/` flat directory. Need: `.holistic/sessions/archive/` subdirectory, relevance + time-based rules, auto-unarchive on reference.

4. **Agent instruction pattern exists in AGENTS.md** — but no `/holistic` slash command documentation yet. Need: add slash command pattern, update AGENTS.md with clear instructions, add tool comparison table to README.

**Primary recommendation:** S01 should focus on making the MCP notification **actionable** by the agent (not just logged), not just visible. S02 should make daemon triggers more aggressive. S03 builds archiving from scratch. S04 adds health diagnostics. S05 documents the patterns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP notification protocol | Custom push mechanism | `server.sendLoggingMessage()` | Already implemented, SDK-native |
| Session file format | New schema | Existing SessionRecord JSON | Works, backward compatible |
| Time-based scheduling | Custom cron | Node.js setInterval in daemon | Simple, already used |
| File watching | Custom fs.watch | Current repo snapshot diff | Reliable, already tested |

---

## Common Pitfalls

### Pitfall 1: MCP Notification Visibility
**What goes wrong:** Notification sends but agent doesn't act on it automatically.  
**Why it happens:** `sendLoggingMessage` appears in logs but may not surface in agent's working context - depends on client implementation.  
**How to avoid:** Test notification behavior across multiple MCP clients (Claude Desktop, Cursor). May need to send notification as tool result or use different notification method.  
**Warning signs:** Logs show notification sent, but agent conversation starts blank.

### Pitfall 2: Archive Thrashing
**What goes wrong:** Sessions archive and unarchive repeatedly, creating churn.  
**Why it happens:** Threshold too aggressive, or auto-unarchive triggers too easily.  
**How to avoid:** Use hysteresis - session must be inactive for 30+ days AND unreferenced. Unarchive only on explicit use (diff, reference in handoff), not on listing.  
**Warning signs:** State file changes frequently even when no real work happening.

### Pitfall 3: Daemon Checkpoint Spam
**What goes wrong:** Checkpoints fire too frequently, creating noise.  
**Why it happens:** Time-based trigger too short, or file-count threshold too low.  
**How to avoid:** Use AND conditions - significant files changed (5+) AND 2+ hours elapsed, OR explicit breakpoint signals. Test with real work patterns.  
**Warning signs:** Users see "checkpointed 1 file change" messages constantly.

### Pitfall 4: Slash Command Discoverability
**What goes wrong:** Users don't know `/holistic` exists or how to use it.  
**Why it happens:** No autocomplete hints, no obvious documentation in first-run experience.  
**How to avoid:** Add helper text that appears in agent's tool list or slash command menu. Make AGENTS.md extremely prominent (link from README, mention in bootstrap output).  
**Warning signs:** Users keep manually typing "read AGENTS.md and HOLISTIC.md" instead of using `/holistic`.

---

## Relevant Code

### MCP Server Notification Hook
**File:** `src/mcp-server.ts`  
**Current behavior:** `server.oninitialized` → calls `sendResumeNotification()` → builds text from `getResumePayload()` → `sendLoggingMessage()`  
**Issue:** Notification sends but may not be actionable by agent  
**Needed:** Verify notification appears in agent's working context, not just logs. May need different delivery mechanism or richer content format.

```typescript
server.oninitialized = () => {
  void sendResumeNotification(server, rootDir, DEFAULT_MCP_AGENT).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send Holistic resume notification: ${message}`);
  });
};
```

### Daemon Checkpoint Logic
**File:** `src/daemon.ts`  
**Current triggers:**
- Branch switch (immediate checkpoint)
- File changes + quiet ticks (waits for activity to settle)
- No time-based triggers
- No file-count threshold triggers

**Gap:** No "2 hours elapsed" or "10 files changed" triggers. Relies entirely on quiet-tick clustering.

```typescript
const QUIET_TICKS_BEFORE_CHECKPOINT = 1; // After 1 tick of no new changes

// Branch switch: immediate
if (branchChanged) {
  nextState = checkpointState(/* ... */);
}

// File changes: wait for quiet
if (quietTicks >= QUIET_TICKS_BEFORE_CHECKPOINT) {
  nextState = checkpointState(/* ... */);
}
```

### Session Storage
**File:** `.holistic/sessions/`  
**Current:** Flat directory, all sessions live together  
**Gap:** No archive subdirectory, no relevance tracking, no auto-archive/unarchive logic

**Session file format:**
```json
{
  "id": "session-2026-03-19T19-30-32-935Z",
  "agent": "codex",
  "status": "handed_off",
  "startedAt": "...",
  "endedAt": "...",
  "workDone": [...],
  "regressionRisks": [...]
}
```

**Needed:** Archive detection (time + relevance), move to `archive/` subdirectory, track references in recent handoffs.

### Agent Instructions
**File:** `AGENTS.md`  
**Current:** Tells agents to "Run `holistic resume --agent <name>`"  
**Gap:** No `/holistic` slash command pattern documented. No tool comparison table (MCP auto vs manual).

---

## Sources

- **Codebase:** High confidence - direct inspection of `src/mcp-server.ts`, `src/daemon.ts`, `src/core/state.ts`
- **MCP SDK:** High confidence - confirmed `sendLoggingMessage` API exists and is used
- **Testing:** Medium confidence - saw logs showing notification sent, but need live testing to confirm agent sees it
- **Session files:** High confidence - 15 sessions in `.holistic/sessions/`, format is stable

---

## Implementation Guidance for S01 (Automatic Startup Notifications)

**Key decision:** Is the notification currently failing because:
1. It's not being sent? (No - logs show it sends)
2. It's sent but not visible to agent? (Likely - needs testing)
3. It's visible but not actionable? (Possible - agent may need explicit instruction to act on it)

**Test before building:** Start Claude Desktop with MCP, check if notification appears in agent's first message or system context. If yes, problem is content/format. If no, problem is delivery mechanism.

**Potential fixes:**
- Send notification as a "system message" if MCP protocol supports it
- Include notification content in tool descriptions so agent sees it when tools load
- Add explicit instruction to agent adapters: "When you see Holistic resume notification, greet with recap and ask 3 questions"

**Verification:**
- Start Claude Desktop (MCP auto)
- Start new conversation
- Agent should greet with recap without user prompting
- User should see "continue/tweak/start new?" question immediately
