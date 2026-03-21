# M003: Focused Integrations — DRAFT Context

**Status:** Draft — needs dedicated discussion session  
**Gathered from:** M001 planning session (2026-03-21)  
**Next:** Run `/gsd` when ready to plan M003, this draft will seed the discussion

---

## Seed Material from Current Discussion

### Why This Milestone
Expand integrations with more tools and platforms, but maintain strict focus on **strengthening core continuity workflows**, not building a broad IDE platform. Integration expansion only where it materially reduces context loss or manual handoff friction.

### Key Capabilities (Provisional)
1. **MCP-first integration patterns** — templates and standards for new MCP integrations
2. **Thin editor setups** — lightweight integration for high-value tools (Cursor, VS Code forks, etc.)
3. **Compatibility tests** — automated verification that supported integrations work
4. **Selective integration guidelines** — clear criteria for what integrations belong vs drift

### Design Constraints from M001 Discussion
- **No platform drift** — reject integrations that don't clearly improve checkpoint/resume/handoff/regression flows
- **"Silent partner" philosophy** — integrations should feel automatic or flow through agent conversation
- **"Set and forget"** — once integrated, should work in background with no maintenance
- **Agent-conversation-first** — integration value should surface through agent context, not new dashboards/UIs

### Scope Boundaries (What NOT to Build)
- Full IDE extensions with custom UI
- Broad analytics or visualization platforms
- Marketing/community/social features
- Anything that turns Holistic into a general project management tool

### Open Questions for Future Discussion
- Which tools/platforms are high-priority candidates for integration?
- What does "MCP-first pattern" mean technically? Template repo? SDK? Documentation?
- How do we test compatibility without manually verifying every tool/version combo?
- What are the explicit criteria for accepting vs rejecting an integration proposal?
- Should there be an integration marketplace/registry, or stay curated?

### Integration Points
- MCP server protocol (already established)
- Git hooks (already established)
- Shell helpers (patterns exist from Phase 1)
- Agent adapters (already have 8 agent types supported)

### Dependencies
- M001 and M002 complete (single-user and team-user experiences solid)
- Clear evidence from usage that specific integrations would reduce friction

### Technical Unknowns
- How to maintain compatibility tests as tools evolve
- Versioning strategy for integration templates
- Whether thin editor setups require tool-specific extensions or can stay generic

---

**When planning M003:**
- Start by listing candidate tools/platforms for integration priority
- Define explicit criteria for integration acceptance (reduces context loss? improves handoff? strengthens continuity?)
- Clarify what "compatibility tests" look like in practice
- Ensure integration patterns stay thin and focused on core continuity workflows
