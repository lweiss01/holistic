# Holistic Roadmap

This directory contains detailed implementation plans for Holistic features organized into phases. Each roadmap document includes tasks, validation steps, testing strategy, and success criteria.

## Product Focus Guardrail

Holistic should stay focused on one job: durable cross-agent context continuity anchored in the repo.

## Guiding Principles

- Holistic should recognize workflow systems, not become one.
- Holistic owns session continuity, not project planning structure.
- Prefer lightweight references to external workflow context over first-class phases, slices, tickets, or other methodology-specific models.
- If a feature adds ceremony, workflow lock-in, or planning bloat without strengthening continuity, it probably does not belong in Holistic.

## Design Philosophy: Set It and Forget It

**Pattern:** If it requires the user to remember a CLI command, it should either be automatic or flow through the agent conversation.

The ideal Holistic experience is:
- **Setup once** — `holistic bootstrap` on a new machine
- **Work normally** — open repo, agent reads context, work happens
- **Background continuity** — checkpoints, handoffs, memory hygiene happen automatically or through natural agent conversation
- **CLI is optional** — power users can use `holistic status`, `holistic diff`, etc., but most users never need to

**Design test for new features:**
- ✓ Good: "The agent sees this warning and suggests action"
- ✓ Good: "This happens automatically in the background"
- ✗ Bad: "The user should run this command regularly"
- ✗ Bad: "The user needs to check this dashboard"

**Agent-conversation-first, CLI-optional** — Surface important state and actions through the agent's natural interaction flow, not through commands the user must remember to run.

## Capture Philosophy: Silent Partner

**Holistic is a silent partner working in the background, remembering everything so you don't have to.**

The system should be **proactive about automatic capture:**
- Checkpoints happen automatically when meaningful work occurs (file changes, time elapsed, git commits, natural breakpoints)
- Agents initiate checkpoints during conversation when they detect progress ("Fixed auth bug, checkpointing this")
- Handoff drafts trigger on idle, session completion signals, or when work feels done
- Memory hygiene (archiving) happens in the background based on relevance and time

**Health warnings are edge-case diagnostics, not user nagging:**
- Warnings should detect when the capture system failed, not remind users to checkpoint
- "⚠️ Daemon hasn't checkpointed in 3 days - is it running?" (system health check)
- "⚠️ 50+ file changes with no checkpoint - investigating..." (diagnostic anomaly)

**If users see warnings frequently, the automatic capture system needs improvement, not the users.**

The test: Can a user work for weeks without thinking about Holistic, yet still have perfect continuity when switching agents or devices? That's the goal.

## Product North Star

The real north star for Holistic is:

**Open repo, start working, Holistic quietly keeps continuity alive.**

That means the ideal user experience is not "run more commands." It is:

- repo context is already available when work starts
- recent work is resumed or inferred automatically when possible
- checkpoints happen in the background when useful
- handoffs are drafted with little or no ceremony
- cross-device continuity survives without constant user babysitting

Future roadmap work should therefore prefer **workflow disappearance** over surface-area growth. A feature only belongs if it reduces user effort while strengthening durable continuity.

Future roadmap work should only be prioritized when it directly improves one or more of:

- preserving project memory across agent, app, or device switches
- reducing re-briefing and regression caused by missing context
- making checkpoint, resume, handoff, or review flows tighter and more reliable
- integrating with tools in thin ways that strengthen the core memory workflow

Avoid roadmap drift into broad marketing, community, analytics, or full-IDE-platform work unless it clearly reinforces that core niche and the low-touch north star above.

## Critical: Implementation Order

Do NOT skip Phase 0. Building features on a shaky foundation wastes time and creates embarrassing bugs when new users arrive.

The roadmap is organized as: Foundation -> Utility -> Workflow Disappearance -> Collaboration -> Focus -> Thin Integration

1. **Phase 0: Code Hardening** - Fix foundational issues first
2. **Phase 1: Feature Expansion** - Add high-value capabilities to the core workflow
3. **Phase 1.5: Workflow Disappearance** - Make Holistic fade into the background during normal work
4. **Phase 2: Team/Org Mode** - Enable collaborative continuity in shared repos
5. **Phase 3: Core Workflow Tightening** - Keep the product sharp, low-noise, and niche-faithful
6. **Phase 4: Focused Integrations** - Add selective thin integrations that strengthen the core workflow

---

## Phase Overview

| Phase | Focus | Priority | Status | Docs |
|-------|-------|----------|--------|------|
| **Phase 0** | **Code Hardening** | Critical | Complete | [00-code-hardening.md](./00-code-hardening.md) |
| **Phase 1** | **Feature Expansion** | High | Complete in repo | [01-feature-expansion.md](./01-feature-expansion.md) |
| **Phase 1.5** | **Workflow Disappearance** | High | Complete in repo | [01.5-workflow-disappearance.md](./01.5-workflow-disappearance.md) |
| **Phase 2** | **Team/Org Mode** | Medium-High | Active next phase | *Coming soon* |
| **Phase 3** | **Core Workflow Tightening** | Medium | After Phase 2 | *Coming soon* |
| **Phase 4** | **Focused Integrations** | Medium | After Phase 3 | *Coming soon* |

### Completed

| Feature | Completed | Docs |
|---------|-----------|------|
| **Structured Metadata** | 2026-03-20 | [docs/structured-metadata.md](../structured-metadata.md) |
| **Phase 0: Code Hardening** | 2026-03-20 | [00-code-hardening.md](./00-code-hardening.md) |
| **Phase 1: Feature Expansion** | 2026-03-21 | [01-feature-expansion.md](./01-feature-expansion.md) |

---

## Phase 0: Code Hardening

**Goal:** Fix foundational code issues before any new features or broader adoption work.

**Why This Can't Wait:**
- Silent failures confuse users
- No migration path means breaking changes for existing users
- Rough edges show up immediately when new users arrive
- Technical debt compounds with every new feature

**Tasks:**
1. Fix branch fallback ambiguity (`"master"` -> `"unknown"`)
2. Expand `AgentName` union (add Gemini, Copilot, Cursor, Goose, GSD)
3. Add state migration pattern
4. Consolidate readline usage
5. Publish to npm (`private: false`)

**Effort:** 1-2 sessions
**Dependencies:** None

-> **[Full Plan](./00-code-hardening.md)**

---

## Phase 1: Feature Expansion

**Goal:** Add features that make Holistic clearly better than doing nothing while staying inside the core continuity workflow.

**Prerequisites:** Phase 0 must be complete first

**Status:** Complete in repo. The core deliverables are implemented and covered by the current in-repo verification path, so Phase 1.5 can begin. Release chores such as a version bump, npm publish, and fresh external MCP client validation remain follow-up work rather than blockers for the next phase.

**Tasks:**
1. MCP server mode (`holistic serve`)
2. `holistic diff` command
3. `holistic status` command
4. Git hook installer (auto-checkpoint on commit)
5. State file concurrency protection

**Effort:** 3-4 sessions
**Dependencies:** Phase 0

-> **[Full Plan](./01-feature-expansion.md)**

---

## Phase 2: Team/Org Mode

**Goal:** Enable collaborative workflows with contributor tracking and team-level continuity features.

**Prerequisites:** Phase 1 must be complete first

**Tasks:**
1. Contributor identity in `SessionRecord`
2. Per-contributor session filtering (`--contributor alice`)
3. Team regression ownership
4. `holistic export` for PR descriptions
5. Team handoff visualization

**Effort:** 2-3 sessions
**Dependencies:** Phase 1

-> **Full plan coming soon**

---

## Phase 1.5: Workflow Disappearance

**Goal:** Make Holistic feel increasingly automatic so the user can open a repo and work while continuity stays alive in the background.

**North Star:** Open repo, start working, Holistic quietly keeps continuity alive.

**Prerequisites:** Phase 1 complete and stable enough to harden the low-touch workflow.

**Status:** Complete in repo. The low-ceremony workflow is implemented and validated in the Holistic repo through Claude Desktop MCP and Codex Desktop dogfooding. Live remote-sync validation against `origin/holistic/state` remains release-hardening follow-up work rather than a blocker for Phase 2.

**Tasks:**
1. Implicit resume or context recovery when MCP clients connect
2. Auto-session inference from recent work, pending work, or last handoff
3. Smarter passive checkpoints based on meaningful repo activity instead of noisy polling alone
4. Auto-drafted handoffs on idle, disconnect, or likely session end
5. Automatic portable Holistic state sync with conservative conflict handling
6. One-command per-machine bootstrap for daemon, hooks, and supported integrations

**Effort:** 2-4 sessions
**Dependencies:** Phase 1

-> **Full plan coming soon**

---

## Phase 3: Core Workflow Tightening

**Goal:** Tighten Holistic around its niche so the tool stays sharp, low-noise, and clearly about durable cross-agent context continuity after the low-touch workflow exists.

**Prerequisites:** Phase 1.5-2 complete and there is enough real usage to reveal where context is still noisy, shallow, or easy to lose.

**Tasks:**
1. Improve resume and handoff signal quality so important context surfaces faster
2. Add memory hygiene tools to keep history useful instead of bloated
3. Improve regression and blocker surfacing so repeated mistakes stay visible
4. Tighten onboarding and examples around the core repo-memory workflow
5. Add workflow health checks that warn when Holistic memory is stale, incomplete, or noisy

**Effort:** 2-3 sessions
**Dependencies:** Solid Phase 1.5-2 workflows

-> **Full plan coming soon**

---

## Phase 4: Focused Integrations

**Goal:** Add selective, thin integrations only when they directly strengthen the repo-memory workflow instead of turning Holistic into a broad IDE platform.

**Prerequisites:** Phase 3 complete and there is clear evidence that a specific integration will reduce context loss or manual handoff friction.

**Tasks:**
1. Ship lightweight integration patterns for MCP-capable tools first
2. Add thin editor commands or launchers only where they materially reduce context loss
3. Standardize setup snippets for high-value tools instead of building full plugin surfaces by default
4. Add compatibility tests for the supported integration paths
5. Reject or defer integrations that do not clearly improve checkpoint, resume, handoff, or regression-awareness flows

**Effort:** 2-4 sessions
**Dependencies:** Phase 3 plus validated workflow gaps

-> **Full plan coming soon**

---

## Suggested Issue Order

If you want to turn this into a GitHub issue backlog right now:

### Phase 0 Issues (Critical - Do First)
1. Fix branch fallback ambiguity (`git.ts` + `state.ts`)
2. Expand `AgentName` + add adapter docs (Gemini, Copilot, Cursor, Goose, GSD)
3. Add `migrateState()` skeleton
4. Consolidate readline in `cli.ts`
5. Flip `private: false`, publish to npm

### Phase 1 Issues (After Phase 0)
6. Add `holistic status` command
7. Add git hook installer to `holistic init`
8. MCP server mode (`holistic serve`)
9. State lock file for concurrency
10. `holistic diff` command

### Phase 1.5 Issues (Workflow Disappearance)
11. Implicit resume on MCP connect
12. Auto-session inference
13. Smarter passive checkpoint triggers
14. Auto-drafted handoffs
15. Automatic Holistic state sync
16. One-command machine bootstrap

### Phase 2 Issues (Team Mode)
17. Contributor identity + team session tracking
18. `holistic export` for PR descriptions
19. Per-contributor filtering
20. Team regression ownership

### Phase 3 Issues (Core Workflow Tightening)
21. Improve resume/handoff signal quality
22. Add memory hygiene and pruning workflow
23. Improve regression/blocker surfacing
24. Add workflow health checks

### Phase 4 Issues (Focused Integrations)
25. MCP-first integration templates and validation
26. Thin Cursor/Claude integration setup
27. Editor launcher or command experiments with strict scope
28. Integration compatibility matrix

---

## Original Feature Roadmaps (Reference)

The following roadmaps (02-05) were created before the phase-based approach. They contain useful implementation detail and code examples, but they are reference material rather than the active roadmap.

### For Reference Only

- **[02-daemon-passive-capture.md](./02-daemon-passive-capture.md)** - Technical details for background file watching and auto-checkpointing. Reuse only where they clearly strengthen the core continuity workflow.
- **[03-cross-device-sync.md](./03-cross-device-sync.md)** - State branch sync implementation. Reuse where it improves portable memory and team continuity.
- **[04-agent-integrations.md](./04-agent-integrations.md)** - Git hooks, shell helpers, and integration ideas. Reuse selectively in Phase 1 and Phase 4.
- **[05-visualization-search.md](./05-visualization-search.md)** - Search, timeline, diff, and stats commands. Reuse where they directly improve context continuity rather than general analytics.

These documents should inform the active roadmap, not expand it beyond Holistic's core niche.

---

**Last updated:** March 20, 2026
**Roadmap version:** 2.2 (phase-based, focus-constrained, workflow-disappearance north star)
**Next review:** During Phase 1.5 implementation
