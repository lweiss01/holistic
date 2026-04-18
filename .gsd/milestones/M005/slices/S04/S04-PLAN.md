# S04: Dashboard Polish

**Goal:** Refine the UI explanations, health signals, empty/error states, and recommendation language based on findings from S01 live usage.
**Demo:** Error states have better visual weight and actionable "Retry" paths. The empty state clearly explains why no session is active.

## Tasks
- [x] **T01: Enhance empty and error state components** - Replace raw `<p>` tags with a dedicated `EmptyState` and `ErrorState` component structure in the React app.
- [x] **T02: Add actionable retries** - Allow the user to reload the active session or detail views when they encounter a network error (like when the API dies).
- [x] **T03: Refine styling** - Improve CSS for empty states and add a standardized button class.

## Success Criteria
- The dashboard gracefully handles API unavailability.
- Status and recommendation language feel premium and clear.
- Empty states do not feel like broken pages.
