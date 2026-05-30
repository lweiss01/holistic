---
slice: S03
milestone: M007
subsystem: andon-dashboard
tags: [timeline, ui, live-feed, event-tones]
dependency_graph:
  requires: [S01, S02]
  provides: [TimelinePanel, eventTone, getTimeline, tail:200]
  affects: [apps/andon-dashboard/src/App.tsx, apps/andon-dashboard/src/api.ts, apps/andon-dashboard/src/styles.css]
tech_stack:
  added: []
  patterns: [SSE-driven timeline refresh via useLiveStream(loadData), tone-based CSS class pattern]
key_files:
  modified:
    - apps/andon-dashboard/src/App.tsx
    - apps/andon-dashboard/src/api.ts
    - apps/andon-dashboard/src/styles.css
decisions:
  - "Wired timeline into DetailPage (existing /session/<id> route) rather than a new ActiveSessionPage — ActiveSessionPage did not exist in the codebase"
  - "Timeline fetch gracefully falls back to empty array on API error so existing session detail still renders"
  - "Used tone-{tone} CSS classes on timeline rows consistent with existing CSS conventions"
metrics:
  duration_minutes: 25
  completed_at: "2026-05-30T17:28:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# M007 S03: Timeline Panel in Active Session Page Summary

**One-liner:** Live event timeline panel with tone-coded rows (critical/warning/memory/test/neutral) added to session detail page, fetching 200 events on every SSE ping via existing loadData wiring.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add getTimeline API + wire tail:200 into DetailPage | 120cc221 | api.ts |
| 2 | Add TimelinePanel component and event tone helpers | 4a1e62f2 | App.tsx, styles.css |

## What Was Built

### api.ts
- Re-exported `AgentEvent` type from andon-core
- Added `TimelineResponse` interface matching the andon-core definition
- Added `getTimeline(sessionId, { tail })` calling `GET /sessions/<id>/timeline?tail=<n>`

### App.tsx
- `eventTone(type: string)` — returns `critical` for `failed`/`blocked`, `warning` for `risk`/`scope`/`retry`, `memory` for `checkpoint`/`session`, `test` for `test`, `neutral` for all else
- `eventTypeLabels` — map of 9 event types to human-readable labels with raw type as fallback
- `formatTime()` — HH:MM:SS formatter for event timestamps
- `TimelinePanel` — scrollable `<ul>` of event rows, each carrying `tone-{tone}` CSS class; shows "No events yet." when empty
- `DetailPage` extended with: `timeline` state, `getTimeline(sessionId, { tail: 200 })` inside `loadData` (with graceful fallback), `setTimeline(timelineItems)`, and `<TimelinePanel events={timeline} />` rendered below the legacy status panel

### styles.css
- `.timeline-list` — scrollable grid container (max-height 480px)
- `.timeline-row` — 3-column grid row with left-border tone indicator
- `.timeline-row.tone-critical/warning/memory/test` — color-coded left borders
- `.timeline-badge` — monospace label with critical/warning coloring
- `.timeline-summary` — truncated summary text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Structural] ActiveSessionPage did not exist — used DetailPage instead**
- **Found during:** Task 1
- **Issue:** The key_facts stated `ActiveSessionPage` existed at line ~288 with timeline state already wired. The actual App.tsx had no such component — `/session/<id>` routed to `DetailPage`.
- **Fix:** Extended `DetailPage` with timeline state and `getTimeline` call. The SSE refresh pattern (`useLiveStream(loadData)`) was already present in `DetailPage`, satisfying the "no extra wiring" requirement exactly as described.
- **Files modified:** apps/andon-dashboard/src/App.tsx

**2. [Rule 2 - Missing feature] getTimeline not in api.ts**
- **Found during:** Task 1
- **Issue:** `getTimeline` was referenced in the plan but did not exist in api.ts.
- **Fix:** Added `getTimeline` function and `TimelineResponse` interface.
- **Files modified:** apps/andon-dashboard/src/api.ts

**3. [Rule 2 - Missing feature] holistic-andon-redesign/App.tsx does not exist**
- **Found during:** Task 2
- **Issue:** The plan says to port from `apps/andon-dashboard/src/holistic-andon-redesign/App.tsx` but this file is absent.
- **Fix:** Implemented `eventTone`, `eventTypeLabels`, and `TimelinePanel` directly per the exact specifications in the plan.
- **Files modified:** apps/andon-dashboard/src/App.tsx

## Self-Check: PASSED

- FOUND: apps/andon-dashboard/src/App.tsx
- FOUND: apps/andon-dashboard/src/api.ts
- FOUND: apps/andon-dashboard/src/styles.css
- FOUND: .gsd/milestones/M007/slices/S03/S03-SUMMARY.md
- FOUND commit 120cc221 (getTimeline API)
- FOUND commit 4a1e62f2 (TimelinePanel component)
- VERIFIED: `tail: 200` in getTimeline call (App.tsx:531)
- VERIFIED: `eventTone` function at App.tsx:90
- VERIFIED: `TimelinePanel` component at App.tsx:119
- VERIFIED: `<TimelinePanel events={timeline} />` at App.tsx:601
- VERIFIED: `test.failed` in eventTypeLabels at App.tsx:105
- VERIFIED: `"test.failed".includes("failed")` triggers tone-critical (first branch in eventTone)
