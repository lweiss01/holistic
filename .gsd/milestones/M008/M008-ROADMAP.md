# Milestone 008: Guardrails, Approvals, and Worktree Isolation

This milestone realigns the earlier Andon attention-routing work into the operator-control layer that must exist before a fleet can be trusted.

## Slice Definition

### S01: Approval Policy Tiers
- **Goal:** Define which actions are safe, cautionary, dangerous, or forbidden.
- **Implementation:** Establish approval policy tiers for dependency installation, destructive shell commands, CI config changes, lockfile edits, mass file edits, secret-sensitive changes, and out-of-repo access.

### S02: Blocking Approval Flow
- **Goal:** Turn risky runtime actions into explicit approvals.
- **Implementation:** Persist `approval.requested`, `approval.granted`, and `approval.denied` events; add approve/deny API behavior; keep adapter capability flags honest about what can actually be blocked.

### S03: Graceful Stop and Process Safety
- **Goal:** Stop sessions without corrupting work.
- **Implementation:** Use a staged stop model: request stop, wait, terminate, wait, kill; capture final events and preserve evidence when a process dies badly.

### S04: Worktree Isolation
- **Goal:** Give each runtime session an isolated workspace by default.
- **Implementation:** Create per-session branches/worktrees, record branch/worktree metadata, preserve dirty worktrees on failure, and add cleanup rules that never auto-delete uncommitted evidence.

### S05: Overlap and Conflict Signals
- **Goal:** Warn when multiple agents are converging on the same files or diverging branches.
- **Implementation:** Track touched files, overlapping edit sets, and merge-readiness hints so later fleet ranking can surface conflict risk.

## Exit Criteria

- Dangerous actions can pause behind a real approval boundary.
- Worktrees are isolated per session and dirty failures are preserved.
- The system can detect overlapping file edits and branch/worktree metadata is visible to later milestones.
