# Milestone 006: Andon V2 (Closing the Loop)

M006 transforms the Andon MVP from a read-only local dashboard into a fully bidirectional, real-time, IDE-integrated command center with historical analytics.

## Strategic Priority Order
Per project direction, we are attacking the milestone in the following sequence: A (Real-Time) -> C (Callbacks) -> B (IDE/CLI integration) -> D (Analytics).

## Slice Definition

### S01: Real-Time Integration (SSE)
- **Goal:** Dashboard updates instantly without manual browser refreshes.
- **Implementation:** 
  - Add native Server-Sent Events (SSE) support to the `andon-api` native Node server.
  - Implement a `useEventSource` or similar hook in the `andon-dashboard` React app.
  - Trigger SSE broadcast events whenever a new POST to `/events` alters the active session status or adds timeline items.

### S02: Interactive Callbacks & Remediation
- **Goal:** The human can steer the agent from the UI.
- **Implementation:**
  - Introduce new API routes (e.g., `POST /sessions/active/callbacks/approve`, `POST /.../pause`).
  - The UI will render contextual action buttons based on the current `Next Human Action` recommendation.
  - The API will fire corresponding local system events (or update the SQLite state to send signals back to the agent event stream).

### S03: Deep IDE / CLI Integration
- **Goal:** Bring Andon signals directly into the developer workspace.
- **Implementation:**
  - Fulfill the `holistic-cuf` beads task by defining the Antigravity hook.
  - Create a new CLI command `holistic andon watch` or `holistic andon status` to tail the SSE stream and print colored status dots and warnings in an active background terminal.

### S04: Multi-Session & Historical Analytics
- **Goal:** Track multi-agent data over time to measure loop efficiency.
- **Implementation:**
  - Revamp the `andon-dashboard` navigation to support an "Archive" or "History" list.
  - Expand SQLite queries to track metrics: average completion time, number of blocked events per run, cost estimations per session.
  - Support tracking "parked" multi-task sessions cleanly alongside the primary active session.

## Exit Criteria
- Andon UI is 100% real-time (no F5 refreshes needed).
- Users can click "Pause" or "Approve" from the web UI and it accurately registers in the DB.
- A terminal-based CLI watcher exists for engineers who don't want to open the web UI.
- Historical metrics can be viewed for closed out agent sessions.
