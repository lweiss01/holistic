# Milestone 006: Andon V2 (Closing the Loop)

M006 transforms the Andon MVP from a read-only local dashboard into a fully bidirectional, real-time, IDE-integrated command center with historical analytics.

## Planning note (overlap with M005)

**Server-Sent Events** and “instant dashboard refresh” landed under **M005** (SSE `session_update` snapshots). Treat **M006 S01** as **hardening, backpressure, and parity** with any new event types — not greenfield SSE work.

**Layers:** Runtime telemetry remains **[OpenHarness](https://github.com/HKUDS/OpenHarness)**-shaped (L1–2); **Holistic** stays **context** (L3). See [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md).

## Strategic Priority Order
Per project direction, we are attacking the milestone in the following sequence: **A (Real-Time, S01)** → **C (Callbacks, S02)** → **E (Approval gates, S05)** → **B (IDE/CLI, S03)** → **D (Analytics, S04)**.

**S05** closes the gap where the UI shows a healthy **Running** session while the operator is blocked on an **IDE or harness approval** prompt; it depends on Layer 1–2 events (see [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md)) and may overlap **S03** once an event source is agreed.

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

### S05: Approval gate visibility (read path)
- **Goal:** When the harness or IDE has **pending human approval** (tool/plan/permission gate), the dashboard shows **`needs_input`**-class supervision — not “all healthy / no intervention yet.”
- **Implementation:**
  - Ingest or derive normalized events for approval-pending / approval-cleared (collector, OpenHarness hooks, or future IDE adapter — see **M007** for high-volume operational noise).
  - Extend the status engine and recommendation copy so **Why** and **Focus now** match the real bottleneck.
  - Align lamp, urgency, and primary CTA with pending-approval semantics.
- **Detail plan:** [slices/S05/S05-PLAN.md](./slices/S05/S05-PLAN.md)

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
- **Pending harness/IDE approval** is visible on the live monitor (status + Why + Focus) per **S05**; false “healthy running” while blocked on approval is treated as a defect.
- A terminal-based CLI watcher exists for engineers who don't want to open the web UI.
- Historical metrics can be viewed for closed out agent sessions.
