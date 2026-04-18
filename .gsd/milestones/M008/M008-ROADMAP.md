# Milestone 008: Andon V4 (State Rules Engine & Attention Routing)

M008 builds the intelligent status logic that powers the true "Andon" notification layer. Instead of simply logging status checks when an agent manually commits them, the system passively computes the live agent environment and generates intervention cues based on a transparent matrix of deterministic rules.

## Slice Definition

### S01: Robust State Machine (Green/Yellow/Orange/Red/Purple)
- **Goal:** Standardize the agent health taxonomy.
- **Implementation:**
  - Define the `Green`, `Yellow`, `Orange`, `Red`, and `Purple` operational phases in `packages/core/src/rules`.
  - Rewrite the `andon-api` `ensureSession` pipeline to map ingested telemetry streams to the specific State Colors automatically.

### S02: Level 1 Operational Drift Rules Engine
- **Goal:** Flag agent struggle via operational signals (retries, timeouts, loops) before they escalate.
- **Implementation:**
  - Build deterministic threshold rules:
    - **Orange (At Risk):** 3 test suite failures back-to-back.
    - **Orange (At Risk):** Command execution loops exceeding 4 attempts.
    - **Red (Blocked):** Absolute timeout without meaningful progression.
    - **Yellow (Needs Input):** Active pause initiated or explicit question asked by agent.
  - Automatically tag the session and write the status shift event to SQLite.

### S03: Attention Routing (Intervention Inbox)
- **Goal:** Reduce the cognitive load of supervising multiple agents down to a prioritized "Action Required" view.
- **Implementation:**
  - Overhaul the React Dashboard to implement the **Intervention Inbox** concept.
  - Render active warnings in priority/severity order with actionable recommendations (e.g., "Review failing test suite output", "Pause and unblock auth bug").
  - Wire up dynamic UI hooks allowing the user to `Approve`, `Pause`, or `Cancel` the agent from the Inbox.

## Exit Criteria
- High-frequency events automatically shift an agent from Green to Orange if they are stuck in a test loop.
- The UI exposes the Intervention Inbox explicitly prioritizing Yellow and Red sessions.
- Users can click "Recommend Actions" straight from the Alert Queue to steer the troubled agent.
