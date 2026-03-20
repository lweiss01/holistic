# Holistic Roadmap

This directory contains detailed implementation plans for Holistic features organized into phases. Each roadmap document includes tasks, validation steps, testing strategy, and success criteria.

## ⚠️ CRITICAL: Implementation Order

**Do NOT skip Phase 0.** Building features on a shaky foundation wastes time and creates embarrassing bugs when new users arrive.

The roadmap is organized as: **Foundation → Growth → Extension**

1. **Phase 0: Code Hardening** - Fix foundational issues (MUST DO FIRST)
2. **Phase 1: Feature Expansion** - Add high-value features
3. **Phase 2: Team/Org Mode** - Enable collaborative workflows  
4. **Phase 3: Audience Growth** - Marketing and community building
5. **Phase 4: IDE Extensions** - Deep integrations (VS Code, etc.)

---

## Phase Overview

| Phase | Focus | Priority | Status | Docs |
|-------|-------|----------|--------|------|
| **Phase 0** | **Code Hardening** | 🔴 **CRITICAL** | 📋 **START HERE** | [00-code-hardening.md](./00-code-hardening.md) |
| **Phase 1** | **Feature Expansion** | 🟠 High | 📋 After Phase 0 | [01-feature-expansion.md](./01-feature-expansion.md) |
| **Phase 2** | **Team/Org Mode** | 🟡 Medium-High | 📋 After Phase 1 | *Coming soon* |
| **Phase 3** | **Audience Growth** | 🟢 Medium | 📋 After Phase 2 | *Coming soon* |
| **Phase 4** | **IDE Extensions** | 🔵 Medium | 📋 After Phase 3 | *Coming soon* |

### ✅ Completed

| Feature | Completed | Docs |
|---------|-----------|------|
| **Structured Metadata** | 2026-03-20 | [docs/structured-metadata.md](../structured-metadata.md) |

---

## Phase 0: Code Hardening 🔴 CRITICAL

**Goal:** Fix foundational code issues before any marketing or new features.

**Why This Can't Wait:**
- Silent failures confuse users
- No migration path = breaking changes for existing users
- Unprofessional rough edges when new users arrive
- Technical debt compounds with every new feature

**Tasks:**
1. Fix branch fallback ambiguity (`"master"` → `"unknown"`)
2. Expand `AgentName` union (add Gemini, Copilot, Cursor, Goose, GSD)
3. Add state migration pattern
4. Consolidate readline usage (prevent interface leaks)
5. Publish to npm (`private: false`)

**Effort:** 1-2 sessions  
**Dependencies:** None

👉 **[Full Plan](./00-code-hardening.md)**

---

## Phase 1: Feature Expansion

**Goal:** Add features that make Holistic clearly better than doing nothing.

**⚠️ Prerequisites:** Phase 0 MUST be complete first

**Tasks:**
1. MCP server mode (`holistic serve`)
2. `holistic diff` command
3. `holistic status` command
4. Git hook installer (auto-checkpoint on commit)
5. State file concurrency protection

**Effort:** 3-4 sessions  
**Dependencies:** Phase 0

👉 **[Full Plan](./01-feature-expansion.md)**

---

## Phase 2: Team/Org Mode

**Goal:** Enable collaborative workflows with contributor tracking and team-level features.

**⚠️ Prerequisites:** Phase 1 MUST be complete first

**Tasks:**
1. Contributor identity in `SessionRecord`
2. Per-contributor session filtering (`--contributor alice`)
3. Team regression ownership
4. `holistic export` for PR descriptions
5. Team handoff visualization

**Effort:** 2-3 sessions  
**Dependencies:** Phase 1

👉 **Full plan coming soon**

---

## Phase 3: Audience Growth

**Goal:** Build community and grow the user base before investing in IDE extensions.

**⚠️ Prerequisites:** Phase 1-2 complete, features are solid

**Tasks:**
1. Website (`holistic.dev` or similar)
2. "The Context Tax" blog post
3. Discord / GitHub Discussions
4. Community outreach (Reddit, Discord, etc.)
5. GitHub topic tag and discoverability SEO

**Effort:** 2-3 sessions  
**Dependencies:** Solid features (Phase 1-2)

👉 **Full plan coming soon**

---

## Phase 4: IDE Extensions

**Goal:** Deep integrations with IDEs - build this AFTER you have a real community with real feedback.

**⚠️ Prerequisites:** Phase 3 complete (real users providing feedback)

**Tasks:**
1. VS Code extension (session status bar, sidebar panel, inline checkpoint)
2. Cursor integration (leverage MCP server from Phase 1)
3. JetBrains plugin (IntelliJ, PyCharm, WebStorm)
4. Neovim/Vim plugin
5. Cross-IDE sync and handoff

**Effort:** 4-5 sessions  
**Dependencies:** Phase 3 (community feedback)

👉 **Full plan coming soon**

---

## 📋 Suggested Issue Order

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

### Phase 2 Issues (Team Mode)
11. Contributor identity + team session tracking
12. `holistic export` for PR descriptions
13. Per-contributor filtering
14. Team regression ownership

### Phase 3 Issues (Audience Growth)
15. Landing page (`holistic.dev`)
16. "The Context Tax" blog post
17. Community setup (Discord/Discussions)
18. Community outreach plan

### Phase 4 Issues (IDE Extensions)
19. VS Code extension scaffold
20. Cursor integration
21. JetBrains plugin
22. Neovim/Vim plugin

---

## Original Feature Roadmaps (Reference)

**Note:** The following roadmaps (02-05) were created before incorporating the phase-based approach. They contain valuable implementation details and code examples, but should be considered **reference material** rather than the active roadmap. The phase-based approach above (Phases 0-4) supersedes these.

### For Reference Only:

- **[02-daemon-passive-capture.md](./02-daemon-passive-capture.md)** - Technical details for background file watching and auto-checkpointing. Relevant parts will be incorporated into Phase 2 and 4.

- **[03-cross-device-sync.md](./03-cross-device-sync.md)** - State branch sync implementation. Relevant parts will be incorporated into Phase 2 (Team Mode).

- **[04-agent-integrations.md](./04-agent-integrations.md)** - GitHub Actions, git hooks, shell helpers, VS Code extension. Parts incorporated into Phase 1 (git hooks) and Phase 4 (IDE extensions).

- **[05-visualization-search.md](./05-visualization-search.md)** - Search, timeline, diff, and stats commands. Parts incorporated into Phase 1 (`holistic diff`) and Phase 2 (`holistic export`).

These documents contain implementation code examples that may be useful when building the features described in Phases 1-4.

---

**Last updated:** March 20, 2026  
**Roadmap version:** 2.0 (Phase-based)  
**Next review:** After Phase 0 completion
