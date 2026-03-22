# Structured Metadata Guide

Holistic v1.1+ supports enhanced structured metadata for impact notes and regression risks. This provides richer context for future agents while maintaining backward compatibility with plain text.

## Overview

**Why structured metadata?**
- **Severity levels** - Quickly identify critical vs. low-priority changes
- **Area tags** - Filter and search by component (CLI, daemon, docs, etc.)
- **Outcome tracking** - Know if changes succeeded, partially worked, or failed
- **Validation checklists** - Concrete steps to verify regression prevention
- **Session relationships** - Link related work across sessions

## New Types

### Severity
```typescript
type Severity = "critical" | "high" | "medium" | "low" | "info";
```

### Outcome Status
```typescript
type OutcomeStatus = "success" | "partial" | "failed" | "ongoing" | "unknown";
```

### Area Tags
```typescript
type AreaTag = 
  | "cli"           // Command-line interface
  | "daemon"        // Background daemon/watcher
  | "state-management" // Session and state handling
  | "docs"          // Documentation generation
  | "git-integration"  // Git snapshot and commit handling
  | "sync"          // Cross-device sync functionality
  | "adapters"      // Agent-specific adapters
  | "tests"         // Test infrastructure
  | "types"         // TypeScript type definitions
  | "architecture"  // System architecture/design
  | "ux";           // User experience
```

## Structured Impact Notes

### Basic Structure
```typescript
interface ImpactNote {
  description: string;           // What changed and why it matters
  severity?: Severity;           // How important is this change?
  affectedAreas?: AreaTag[];     // Which components were affected?
  outcome?: OutcomeStatus;       // Was it successful?
}
```

### Example Usage

**Plain text (still supported):**
```bash
holistic checkpoint \
  --impact "Added resume flow state and daemon setup"
```

**Structured metadata (new):**
```typescript
// In code or via JSON input
{
  impactsStructured: [
    {
      description: "Added resume flow state and daemon setup",
      severity: "high",
      affectedAreas: ["cli", "state-management", "daemon"],
      outcome: "success"
    }
  ]
}
```

**Rendered output:**
```markdown
- Why it mattered:
- Added resume flow state and daemon setup _[severity: high | areas: cli, state-management, daemon | outcome: success]_
```

## Structured Regression Risks

### Basic Structure
```typescript
interface RegressionRisk {
  description: string;
  severity?: Severity;
  affectedAreas?: AreaTag[];
  validationChecklist?: ValidationItem[];
}

interface ValidationItem {
  description: string;
  command?: string;
  expectedOutcome?: string;
}
```

### Example Usage

**Plain text (still supported):**
```bash
holistic checkpoint \
  --regression "Do not lose active goal when a new session starts"
```

**Structured metadata with validation (new):**
```typescript
{
  regressionsStructured: [
    {
      description: "Do not lose active goal when a new session starts",
      severity: "critical",
      affectedAreas: ["state-management", "cli"],
      validationChecklist: [
        {
          description: "Start a session with a goal",
          command: "holistic start-new --goal 'Test goal'",
          expectedOutcome: "Session created with currentGoal set"
        },
        {
          description: "Start another session without ending the first",
          command: "holistic start-new --goal 'Second goal'",
          expectedOutcome: "First session preserved in pendingWork with original goal"
        },
        {
          description: "Resume and verify first goal is still accessible",
          command: "holistic resume --json",
          expectedOutcome: "JSON shows first goal in pendingWork array"
        }
      ]
    }
  ]
}
```

**Rendered output:**
```markdown
- Do not regress:
- Do not lose active goal when a new session starts _[severity: critical | areas: state-management, cli]_
  - Validation checklist:
  - Start a session with a goal
    - Command: `holistic start-new --goal 'Test goal'`
    - Expected: Session created with currentGoal set
  - Start another session without ending the first
    - Command: `holistic start-new --goal 'Second goal'`
    - Expected: First session preserved in pendingWork with original goal
  - Resume and verify first goal is still accessible
    - Command: `holistic resume --json`
    - Expected: JSON shows first goal in pendingWork array
```

## Session-Level Metadata

You can also add session-level structured metadata:

```typescript
interface SessionRecord {
  // ... existing fields ...
  
  // Session-level metadata
  severity?: Severity;              // Overall session importance
  outcomeStatus?: OutcomeStatus;    // Did the session achieve its goal?
  affectedAreas?: AreaTag[];        // Which components did this session touch?
  relatedSessions?: string[];       // IDs of related/dependent sessions
}
```

### Example

```typescript
{
  severity: "high",
  outcomeStatus: "success",
  affectedAreas: ["daemon", "sync", "state-management"],
  relatedSessions: [
    "session-2026-03-19T19-30-32-935Z",
    "session-2026-03-20T00-04-53-218Z"
  ]
}
```

**Rendered in project-history.md:**
```markdown
## Daemon passive capture implementation

- Session: session-2026-03-20T14-22-15-442Z
- Agent: claude
- Status: handed_off
- When: 2026-03-20T16:45:30.123Z
- Severity: high
- Outcome: success
- Affected areas: daemon, sync, state-management
- Related sessions: session-2026-03-19T19-30-32-935Z, session-2026-03-20T00-04-53-218Z
- Goal: Implement background file watcher for passive capture
- Summary: ...
```

## Backward Compatibility

**Important:** The legacy string arrays (`impactNotes`, `regressionRisks`) are maintained for backward compatibility:

```typescript
interface SessionRecord {
  // Legacy - always populated from CLI string inputs
  impactNotes: string[];
  regressionRisks: string[];
  
  // New - optional structured versions
  impactNotesStructured?: ImpactNote[];
  regressionRisksStructured?: RegressionRisk[];
}
```

- If only plain text is provided, it goes into the legacy arrays
- If structured metadata is provided, it uses the new fields
- The rendering logic prefers structured metadata when available, falls back to plain text
- Existing sessions with plain text continue to work exactly as before

## CLI Integration (Future)

Currently, structured metadata is accessible via TypeScript/JSON. Future CLI enhancements could include:

```bash
# Add structured impact with inline metadata
holistic checkpoint \
  --impact-structured "Added daemon watch mode" \
  --impact-severity high \
  --impact-areas daemon,cli \
  --impact-outcome success

# Add regression with validation checklist
holistic checkpoint \
  --regression-structured "Daemon must auto-restart after crash" \
  --regression-severity critical \
  --regression-areas daemon \
  --regression-validate "ps aux | grep holistic-daemon" \
  --regression-validate-expect "One daemon process running"
```

## Benefits

### For Agents
- **Faster context recovery** - Scan by severity and area instead of reading everything
- **Better decision making** - Know outcome status before attempting similar work
- **Concrete validation** - Run checklist commands to verify regression prevention

### For Teams
- **Searchability** - `holistic history --search --areas daemon --severity critical`
- **Metrics** - Track success rates, identify problematic areas
- **Documentation** - Validation checklists become living test specs

### For Long-Term Memory
- **Rich filters** - "Show all critical regressions affecting state-management"
- **Impact analysis** - "What succeeded vs. what's still ongoing?"
- **Dependency tracking** - "Which sessions are related to this fix?"

## Migration Strategy

You don't need to migrate existing sessions. The system handles both formats:

1. **Leave existing sessions as-is** - They'll continue using plain text rendering
2. **Use structured metadata for new critical work** - Especially for:
   - Critical bug fixes that must not regress
   - Complex multi-session features
   - Changes affecting core architecture
3. **Add validation checklists** when you fix something another agent might break later

## Example: Real-World Structured Handoff

```typescript
// Hypothetical handoff for implementing portable state sync
{
  summary: "Implemented cross-device state sync via dedicated portable state ref",
  severity: "high",
  outcomeStatus: "success",
  affectedAreas: ["sync", "git-integration", "daemon"],
  relatedSessions: ["session-2026-03-19T19-30-32-935Z"], // Original sync planning session
  
  impactsStructured: [
    {
      description: "Portable state now syncs through refs/holistic/state",
      severity: "high",
      affectedAreas: ["sync", "git-integration"],
      outcome: "success"
    },
    {
      description: "Restore scripts can now pull remote state on new devices",
      severity: "medium",
      affectedAreas: ["sync", "cli"],
      outcome: "success"
    }
  ],
  
  regressionsStructured: [
    {
      description: "Portable state ref must stay isolated from the main working branch history",
      severity: "critical",
      affectedAreas: ["sync", "git-integration"],
      validationChecklist: [
        {
          description: "Verify the remote portable state ref exists",
          command: "git ls-remote origin refs/holistic/state",
          expectedOutcome: "A ref named refs/holistic/state is present on the remote"
        },
        {
          description: "Verify restore script fetches the portable state ref explicitly",
          command: "grep -n 'refs/holistic/state' .holistic/system/restore-state.sh",
          expectedOutcome: "Restore helper references refs/holistic/state directly"
        }
      ]
    },
    {
      description: "Sync must handle concurrent updates from multiple devices",
      severity: "high",
      affectedAreas: ["sync", "state-management"],
      validationChecklist: [
        {
          description: "Create handoff on device A",
          command: "holistic handoff && ./.holistic/system/sync-state.sh",
          expectedOutcome: "Portable state ref updated with device A handoff"
        },
        {
          description: "Create different handoff on device B before pulling A",
          command: "holistic handoff",
          expectedOutcome: "Local portable state has device B handoff"
        },
        {
          description: "Pull and verify both handoffs are preserved",
          command: ".holistic/system/restore-state.sh && cat .holistic/state.json",
          expectedOutcome: "Either both handoffs merged or user prompted for conflict resolution"
        }
      ]
    }
  ]
}
```

This creates rich, searchable, verifiable project memory that travels with the repo.
