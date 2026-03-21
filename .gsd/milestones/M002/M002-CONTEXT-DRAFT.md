# M002: Team/Org Mode — DRAFT Context

**Status:** Draft — needs dedicated discussion session  
**Gathered from:** M001 planning session (2026-03-21)  
**Next:** Run `/gsd` when ready to plan M002, this draft will seed the discussion

---

## Seed Material from Current Discussion

### Why This Milestone
Enable collaborative workflows in shared repos where multiple contributors (humans or agents) are working on the same project. Currently Holistic tracks sessions by agent name but has no contributor identity — can't distinguish "Alice's Claude session" from "Bob's Claude session."

### Key Capabilities (Provisional)
1. **Contributor identity tracking** — know who did the work, not just which agent
2. **Per-contributor session filtering** — `holistic status --contributor alice`
3. **Team regression ownership** — track who fixed what, who owns which stability areas
4. **Export for PRs** — `holistic export` generates PR descriptions from session data
5. **Team handoff visualization** — see who worked on what and when

### Design Constraints from M001 Discussion
- **"Silent partner" philosophy applies** — team features should feel automatic, not add ceremony
- **"Set and forget" applies** — contributor identity should be inferred (git config?) not manually entered every session
- **Agent-conversation-first** — team handoff should surface through agent context, not require separate tools
- **No workflow lock-in** — team features shouldn't impose specific collaboration models

### Open Questions for Future Discussion
- How is contributor identity captured? Git config? Environment variable? Per-machine setup?
- Does contributor identity live in SessionRecord, or separate?
- How do team regressions differ from individual regressions?
- What does "team handoff visualization" actually look like?
- Should export format be configurable (GitHub PR style vs GitLab vs plain text)?
- How do we handle anonymous/unknown contributors gracefully?

### Integration Points
- Git identity (`git config user.name`, `user.email`)
- SessionRecord schema (needs contributor field)
- MCP server (might need contributor context)
- Export command (new CLI command)

### Dependencies
- M001 must be complete first (single-user experience should be solid before adding multi-user coordination)
- Archive/hygiene from M001 helps keep team memory clean

### Technical Unknowns
- Contributor filtering performance if repo has hundreds of sessions
- How to visualize team activity without building a full dashboard (stays CLI/agent-conversation-first)
- Conflict resolution when multiple contributors checkpoint concurrently

---

**When planning M002:**
- Start by confirming contributor identity capture approach
- Clarify what "team handoff visualization" means in practice (not a web dashboard, but what?)
- Decide if export is one-size-fits-all or needs templates
- Ensure team features feel automatic, not add coordination overhead
