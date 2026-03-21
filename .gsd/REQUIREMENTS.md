# Requirements

This file is the explicit capability and coverage contract for M001: Core Workflow Tightening.

Use it to track what is actively in scope, what has been validated by completed work, what is intentionally deferred, and what is explicitly out of scope.

## Active

### R001 — MCP clients receive automatic startup context
- Class: primary-user-loop
- Status: active
- Description: When an MCP client connects (Claude Desktop, etc.), the agent immediately receives resume context without user prompting
- Why it matters: Core "set and forget" - users should never have to tell the agent to read Holistic docs
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: unmapped
- Notes: Currently sends notification but agent may not act on it - needs verification

### R002 — Non-MCP tools have lightweight manual trigger (/holistic)
- Class: primary-user-loop
- Status: active
- Description: For tools without MCP support, `/holistic` command loads context with minimal ceremony
- Why it matters: Consistent experience across tools while accepting technical limitations of non-MCP platforms
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S05
- Validation: unmapped
- Notes: Slash command should be discoverable through autocomplete/help

### R003 — Agent greets with recap + 3-question pattern automatically
- Class: primary-user-loop
- Status: active
- Description: Agent sees resume context and automatically greets with last handoff recap, asks "continue as planned, tweak the plan, or start something new?"
- Why it matters: User should know Holistic is working without having to check - the greeting IS the signal
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S05
- Validation: unmapped
- Notes: Pattern must work consistently whether MCP auto or /holistic manual

### R004 — Daemon checkpoints based on time elapsed
- Class: continuity
- Status: active
- Description: After meaningful work time (e.g., 2 hours), daemon checkpoints automatically even without file changes
- Why it matters: Captures progress during long thinking/refactoring sessions where files don't change frequently
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Should AND with other conditions to avoid spam - not purely time-based

### R005 — Daemon checkpoints based on file count threshold
- Class: continuity
- Status: active
- Description: When significant file changes occur (e.g., 5+ files), daemon checkpoints automatically
- Why it matters: Large refactors or multi-file features should checkpoint even if work isn't "quiet"
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Should combine with time or other signals to avoid checkpoint spam

### R006 — Agents can initiate checkpoints during conversation
- Class: continuity
- Status: active
- Description: Agents detect natural breakpoints (tests pass, bug fixed, feature complete) and checkpoint automatically with narration
- Why it matters: Captures progress at semantically meaningful moments, not just file-change patterns
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Agent narrates "checkpointing this progress" instead of asking permission

### R007 — Handoff drafts trigger on shorter idle periods
- Class: continuity
- Status: active
- Description: Auto-draft handoff triggers more aggressively (30min idle, session completion signals)
- Why it matters: Captures session conclusions before user closes tool, reducing lost handoffs
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: unmapped
- Notes: Already exists from Phase 1.5 but needs sensitivity tuning

### R008 — Stale sessions auto-archive (30+ days, unreferenced)
- Class: continuity
- Status: active
- Description: Sessions older than 30 days that haven't been referenced in recent work move to .holistic/sessions/archive/
- Why it matters: Keeps active session list clean without losing history - "set and forget" memory hygiene
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: none
- Validation: unmapped
- Notes: Hybrid time + relevance - must meet BOTH criteria to archive

### R009 — Archived sessions unarchive when explicitly used
- Class: continuity
- Status: active
- Description: When archived session is diffed, referenced in handoff, or searched, it moves back to active automatically
- Why it matters: Relevance-based - if you're using it, it's not stale anymore
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: none
- Validation: unmapped
- Notes: Listing archived sessions does NOT unarchive them - only actual use does

### R010 — Health warnings detect daemon failures
- Class: failure-visibility
- Status: active
- Description: Startup notification includes warning if daemon hasn't checkpointed in 3+ days (system health check)
- Why it matters: Detects when automatic capture broke, not when user forgot to checkpoint
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: M001/S01
- Validation: unmapped
- Notes: Diagnostic tone, not nagging - "daemon may not be running"

### R011 — Health warnings detect checkpoint gaps
- Class: failure-visibility
- Status: active
- Description: Unusual patterns surface as diagnostics (50+ files, no checkpoint) so agent can investigate
- Why it matters: Edge-case detection when automatic capture fails unexpectedly
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: M001/S01
- Validation: unmapped
- Notes: Should be rare - if common, automatic capture needs improvement

### R012 — Slash command helper text visible to agents
- Class: operability
- Status: active
- Description: /holistic, /checkpoint, /handoff commands have clear helper text agents can see
- Why it matters: Discoverability - agents should know these exist and what they do
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: none
- Validation: unmapped
- Notes: Helper text appears in agent tool lists or slash command menus

### R013 — README documents MCP auto vs manual tools
- Class: operability
- Status: active
- Description: README includes comparison table showing which tools support automatic startup vs require /holistic
- Why it matters: Users know what to expect based on their tool choice
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: none
- Validation: unmapped
- Notes: Simple table: Claude Desktop (auto), Web (manual), etc.

### R014 — AGENTS.md teaches /holistic pattern clearly
- Class: operability
- Status: active
- Description: AGENTS.md documents the /holistic pattern with clear instructions for what agents should do when they see it
- Why it matters: Non-MCP agents need explicit guidance to follow the startup pattern
- Source: user
- Primary owning slice: M001/S05
- Supporting slices: none
- Validation: unmapped
- Notes: Include code example showing read HOLISTIC.md → recap → 3 questions

## Validated

No requirements validated yet (milestone not started).

## Deferred

No requirements deferred.

## Out of Scope

### R100 — Web dashboard for session visualization
- Class: anti-feature
- Status: out-of-scope
- Description: Graphical dashboard showing timeline, stats, graphs
- Why it matters: Violates "agent-conversation-first" and "set and forget" - would add UI maintenance burden
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: CLI and agent context are sufficient

### R101 — Manual archive management commands
- Class: anti-feature
- Status: out-of-scope
- Description: Commands like "holistic archive <session>" or "holistic unarchive <session>"
- Why it matters: Violates "set and forget" - archiving should be fully automatic
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Archive happens automatically; explicit use unarchives automatically

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | primary-user-loop | active | M001/S01 | none | unmapped |
| R002 | primary-user-loop | active | M001/S01 | M001/S05 | unmapped |
| R003 | primary-user-loop | active | M001/S01 | M001/S05 | unmapped |
| R004 | continuity | active | M001/S02 | none | unmapped |
| R005 | continuity | active | M001/S02 | none | unmapped |
| R006 | continuity | active | M001/S02 | none | unmapped |
| R007 | continuity | active | M001/S02 | none | unmapped |
| R008 | continuity | active | M001/S03 | none | unmapped |
| R009 | continuity | active | M001/S03 | none | unmapped |
| R010 | failure-visibility | active | M001/S04 | M001/S01 | unmapped |
| R011 | failure-visibility | active | M001/S04 | M001/S01 | unmapped |
| R012 | operability | active | M001/S05 | none | unmapped |
| R013 | operability | active | M001/S05 | none | unmapped |
| R014 | operability | active | M001/S05 | none | unmapped |
| R100 | anti-feature | out-of-scope | none | none | n/a |
| R101 | anti-feature | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 14
- Mapped to slices: 14
- Validated: 0
- Unmapped active requirements: 0
