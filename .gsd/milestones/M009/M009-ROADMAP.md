# Milestone 009: Andon V5 (Holistic Level 2 Drift Detection)

M009 bridges the operational metrics (Layer 1/2) with Semantic Scope (Layer 3 Context).

Level 2 Drift detects when an agent is technically executing successful commands, testing correctly, and outputting code, but actively straying outside its predetermined Holistic constraints, bounds, or prior context. We introduce Semantic Drift Flags by validating the real-time operational events against the agent's intent.

**Non-goal:** M009 does **not** remove the need for a proper **Layer 1–2** ingest path (see **M007** and **[OpenHarness](https://github.com/HKUDS/OpenHarness)**); it **compares** streams to Holistic-stated bounds. See [`.planning/CANON-LAYERS.md`](../../../.planning/CANON-LAYERS.md).

## Slice Definition

### S01: Expected Scope Validation (Scope Drift)
- **Goal:** Throw an alert when the agent writes code it wasn't told to touch.
- **Implementation:**
  - Retrieve the explicit file list or feature scope defined in the active `.holistic/state.json`.
  - Calculate intersections between the `file.changed` event streams and the expected bounds.
  - Flag the session as `Orange` ("Scope Drift: High") if an agent consistently modifies files outside its mandate without explicitly requesting an expansion.

### S02: Prior Attempt Comparison (Strategy Drift)
- **Goal:** Prevent an agent from spiraling into previously failed approaches.
- **Implementation:**
  - Plumb Holistic's known "rejected approaches" into the Andon `repository.ts` active memory cache.
  - If the agent explicitly attempts the exact same loop, dependency, or architectural pattern previously marked as rejected by human handoff, flag it for "Strategy Drift."
  - Introduce specific UI cues explicitly notifying the supervisor of the repetition.

### S03: Grounding UI Overlay (Mockup C)
- **Goal:** Make the supervisor's decision to intervene incredibly obvious by putting intent side-by-side with reality.
- **Implementation:**
  - Overhaul the Detail Inspector to explicitly present:
    - **Holistic Grounding:** "Expected Scope", "Rejected Approach", "Success Criteria".
    - **Live Signals:** "Last Event", "Files Changed", "Retry count".
    - **Drift Flags:** "Scope Drift: Medium", "Strategy Drift: Low".

## Exit Criteria
- Andon accurately diagnoses an agent's failure to adhere to the Holistic scope.
- Repeated failed strategies are proactively blocked or surfaced before the agent loops endlessly.
- The UI exposes a rich, structured comparison board allowing the human supervisor to rapidly ingest context and intervene confidently.
