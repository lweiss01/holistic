---
slice: S03
type: execute
wave: 2
depends_on: [S01, S02]
files_modified:
  - apps/andon-dashboard/src/App.tsx
autonomous: true
must_haves:
  truths:
    - "The active session page shows a live event timeline that updates on every SSE ping"
    - "The timeline shows at least 200 recent events (tail: 200) via getTimeline()"
    - "Event rows are color-coded by tone: failed/blocked = critical, risk/scope = warning, etc."
    - "test.failed events render with tone-critical styling"
    - "No new custom hook (useTimeline) is needed — loadData already fetches the timeline"
  artifacts:
    - path: "apps/andon-dashboard/src/App.tsx"
      provides: "TimelinePanel component, eventTone/eventTypeLabels helpers, tail: 200 in loadData"
  key_links:
    - from: "ActiveSessionPage.loadData"
      to: "GET /sessions/<id>/timeline?tail=200"
      via: "getTimeline() call at line 302 (holistic-andon-redesign/App.tsx reference)"
      pattern: "getTimeline.*tail.*200"
    - from: "useLiveStream(loadData)"
      to: "timeline state refresh"
      via: "loadData is the SSE callback — no additional wiring needed"
      pattern: "useLiveStream\\(loadData\\)"
---

# M007 S03 — Timeline Panel in Active Session Page

Surface the event timeline in the live dashboard by wiring the existing `getTimeline()` call into
a visible `TimelinePanel` component. This is the end-to-end payoff for S01 (hook events entering
the DB) and S02 (WAL for write concurrency).

## Tasks

### Task 1: Increase timeline tail and pass timeline state to TimelinePanel

**Files:** `apps/andon-dashboard/src/App.tsx`

**Action:**

The `holistic-andon-redesign/App.tsx` contains the reference implementation. Do NOT copy the
whole redesign — port only the timeline-related pieces into the main `App.tsx`.

**Understand the existing wiring before touching anything:**

The `ActiveSessionPage` component already has:
- `const [timeline, setTimeline] = useState<AgentEvent[]>([])` — timeline state exists
- Inside `loadData`, `getTimeline(result.session.id, { tail: 10 })` already fetches timeline
  events and calls `setTimeline([...t.items].reverse())`
- `useLiveStream(loadData)` is already called — this is the SSE callback, so the timeline
  already refreshes on every SSE ping without any additional wiring

**There is no `refetch()` function anywhere in App.tsx.** The SSE pattern is
`useLiveStream(callbackFn)` where `callbackFn` is called on every SSE ping. Do NOT add a separate
`useTimeline` hook — it would duplicate the work `loadData` already does.

**Do NOT create a `useTimeline` custom hook.** The timeline is already fetched inside `loadData`.
A separate hook would make two API calls per SSE ping.

**Step 1:** Change `tail: 10` to `tail: 200` in the `getTimeline()` call inside `loadData`.
This is the only change needed to the data-fetching logic:

```typescript
// Before:
getTimeline(result.session.id, { tail: 10 })
// After:
getTimeline(result.session.id, { tail: 200 })
```

The `GET /sessions/<id>/timeline?tail=200` call fires on every SSE ping because `loadData` is
already the SSE callback registered via `useLiveStream(loadData)`. No additional wiring is needed.

**Step 2:** Pass `timeline` to `TimelinePanel` in the `ActiveSessionPage` render output. If
`TimelinePanel` does not yet exist in the main `App.tsx`, add it in this task (see Task 2).

**Verification checklist:**
- [ ] `tail: 200` is present in the `getTimeline()` call inside `loadData`
- [ ] `useLiveStream(loadData)` remains unchanged — it is already the SSE callback
- [ ] No `useTimeline` hook has been added
- [ ] `timeline` state is passed as a prop to `TimelinePanel`
- [ ] Network tab in DevTools shows `GET /sessions/<id>/timeline?tail=200` firing on SSE events

**Done:** Timeline fetches 200 events per SSE ping via the existing `loadData` → `useLiveStream`
wiring. No new hooks introduced.

---

### Task 2: Add `TimelinePanel` component and `eventTone` / `eventTypeLabels` helpers

**Files:** `apps/andon-dashboard/src/App.tsx`

**Action:**

Port the `TimelinePanel` component, `eventTone()`, and `eventTypeLabels` map from
`apps/andon-dashboard/src/holistic-andon-redesign/App.tsx` into the main `App.tsx`.

**`eventTone(type: string): string`** — port this function exactly from the redesign (line 112):

```typescript
function eventTone(type: string): string {
  if (type.includes("failed") || type.includes("blocked")) return "critical";
  if (type.includes("risk") || type.includes("scope") || type.includes("retry")) return "warning";
  if (type.includes("checkpoint") || type.includes("session")) return "memory";
  if (type.includes("test")) return "test";
  return "neutral";
}
```

**Verify `test.failed` → `tone-critical`:** Because `"test.failed".includes("failed")` is `true`,
the first branch fires and returns `"critical"`. The CSS class `event-critical` or `tone-critical`
must be defined in the stylesheet. Confirm this by checking the existing CSS — do not rename the
tone value. If a `test.failed` event is rendered in the timeline, it MUST get the critical styling.

**`eventTypeLabels`** — a lookup map from event type string to a human-readable label. Port from
the redesign or write a minimal version covering the types in the research file:
`session.started`, `session.ended`, `command.finished`, `command.failed`, `file.changed`,
`test.finished`, `test.failed`, `agent.summary_emitted`, `user.resumed`. Map unknown types to
the raw type string as a fallback.

**`TimelinePanel`** — renders the `timeline: AgentEvent[]` prop as a scrollable list.
Each row shows: event type label, a tone-colored indicator, timestamp (relative or absolute),
and the `summary` field. Apply `eventTone()` to determine the CSS tone class for each row.
Render an empty-state message ("No events yet") if `timeline.length === 0`.

The component should be a `<section>` with a heading "Live timeline" and a `<ul>` of event rows.
Port the markup pattern from the redesign but adapt class names to match whatever CSS conventions
already exist in the main `App.tsx` stylesheet.

**Verification checklist:**
- [ ] `eventTone("test.failed")` returns `"critical"` (verify in browser console or unit test)
- [ ] `eventTone("command.failed")` returns `"critical"`
- [ ] `eventTone("file.changed")` returns `"neutral"`
- [ ] `TimelinePanel` renders without crashing when `timeline` is an empty array
- [ ] `TimelinePanel` renders event rows when `timeline` has items
- [ ] Each event row carries a CSS class derived from `eventTone()` (e.g., `event-critical`)
- [ ] `eventTypeLabels` provides a human-readable label for at least the 9 types listed above

**Done:** `TimelinePanel` is visible in the active session page, event rows are color-coded by
tone, and `test.failed` events render with the critical tone.

---

## Verification

After both tasks:

1. Start the andon-api and dashboard (`npm run dev` or equivalent).
2. Open the dashboard in a browser and navigate to an active session (or trigger one).
3. Open DevTools Network tab — confirm `GET /sessions/<id>/timeline?tail=200` fires on page load
   and again after each SSE ping.
4. In the terminal, run a failing test via the Claude Code hook (or POST a `test.failed` event
   directly to `http://127.0.0.1:4318/events`).
5. Observe that the timeline panel updates within ~1 second and the `test.failed` event row
   has the critical tone styling.

```bash
# Direct POST to verify the pipeline end to end
curl -s -X POST http://127.0.0.1:4318/events \
  -H "Content-Type: application/json" \
  -d '{"events":[{"id":"smoke-1","sessionId":"<active_session_id>","type":"test.failed","source":"collector","timestamp":"'"$(date -u +%FT%TZ)"'","summary":"Smoke test failure","payload":{}}]}'
```

Timeline panel should show the `test.failed` row with critical tone within one SSE cycle (~80ms debounce).

## Success Criteria

- `tail: 200` is set in the existing `getTimeline()` call inside `loadData`
- `useLiveStream(loadData)` drives timeline refresh — no extra wiring added
- `TimelinePanel` renders in the active session page with tone-colored event rows
- `test.failed` events render with `tone-critical` / `event-critical` styling
- No `useTimeline` custom hook was introduced
