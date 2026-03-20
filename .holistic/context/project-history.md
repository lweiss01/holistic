# Project History

This archive is the durable memory of what agents changed, why they changed it, and what the project impact was. Review it before revisiting a feature area.

## Finalize Holistic v1 implementation

- Session: session-2026-03-20T00-07-50-104Z
- Agent: codex
- Status: handed_off
- When: 2026-03-20T00:08:05.321Z
- Goal: Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- Summary: Clarified that hholistic is the user's local Beeftext shortcut on one laptop; the portable part is the startup prompt text, not the trigger itself.
- Work done:
- Recorded that the startup prompt is portable across tools, while the hholistic trigger is just a local text-expander shortcut.
- Updated the Holistic handoff to distinguish the portable startup prompt from the local hholistic trigger.
- Why it mattered:
- The handoff now distinguishes between portable prompt content and a machine-specific hotkey trigger, which should reduce confusion in future sessions.
- Future sessions now have a clearer explanation that the prompt content is portable but the hotkey trigger is machine-specific.
- Regression risks:
- Do not imply that hholistic or any specific hotkey name is portable across devices or IDEs.
- References:
- HOLISTIC.md
- .holistic/context/zero-touch.md

## Finalize Holistic v1 implementation

- Session: session-2026-03-20T00-04-53-218Z
- Agent: codex
- Status: handed_off
- When: 2026-03-20T00:05:25.833Z
- Goal: Review the generated history/regression docs and decide whether to add more structured fields like severity, affected areas, or validation notes.
- Summary: Added a platform-agnostic startup prompt pattern the user can bind to a hotkey so future agents reliably read the Holistic instructions before working.
- Work done:
- Provided a reusable hotkey-safe startup prompt for repo resume across IDEs and agent tools.
- Provided a reusable startup prompt the user can bind to a hotkey across IDEs and agent tools.
- Updated the Holistic session state so the hotkey guidance is preserved in the handoff docs.
- Why it mattered:
- The next session can start with a consistent agent-agnostic startup prompt instead of relying on tool-specific behavior or memory.
- Regression risks:
- Do not assume repo initialization alone will make every IDE agent read the Holistic docs automatically on open.
- References:
- HOLISTIC.md
- .holistic/context/zero-touch.md
- .holistic/context/adapters/antigravity.md

## Finalize Holistic v1 implementation

- Session: session-2026-03-19T23-33-42-124Z
- Agent: codex
- Status: handed_off
- When: 2026-03-19T23:35:06.517Z
- Goal: Clarify Antigravity startup behavior and close the session cleanly.
- Summary: Confirmed that one-time Holistic init does not force Antigravity IDE to ask what to do on repo open; current behavior depends on app cooperation or integration.
- Work done:
- Reviewed the Holistic repo instructions, durable memory docs, and Antigravity adapter to verify the intended startup contract.
- Confirmed the zero-touch limitation: the repo can preserve memory but cannot force arbitrary IDE startup behavior by itself.
- Captured the expectation gap in Holistic state and created follow-up issue holistic-cuf.
- Why it mattered:
- Clarified the current gap between the intended Antigravity resume experience and what one-time repo init can actually guarantee.
- Future agents now have an explicit record that one-time repo init alone does not deliver the expected Antigravity startup prompt experience.
- Regression risks:
- Do not imply that repo initialization alone can force Antigravity IDE to ask the user what to do on startup.
- References:
- HOLISTIC.md
- .holistic/context/zero-touch.md
- .holistic/context/adapters/antigravity.md
- docs/handoff-walkthrough.md
- holistic-cuf

## Finalize Holistic v1 implementation

- Session: session-2026-03-19T19-30-32-935Z
- Agent: codex
- Status: handed_off
- When: 2026-03-19T21:31:29.920Z
- Goal: Finalize Holistic v1 implementation and validate the long-term memory workflow
- Summary: Session wrapped with public docs, local dogfooding init, and GitHub push complete.
- Work done:
- Implemented the Holistic CLI and repo-visible docs scaffold
- Added project-history.md and regression-watch.md generation
- Added wrapper-based git commit support for handoffs
- Added MIT license, contributor guide, and cross-agent walkthrough docs
- Updated the README with quick links to contributor and walkthrough docs
- Initialized Holistic in this repo with origin and the holistic/state branch
- Verified the repo-local resume flow and reran the full test suite
- Why it mattered:
- Completed sessions now feed a durable project history document for future agents.
- Important fixes can now leave behind explicit rationale and overall impact notes.
- Long-term memory is visible immediately, not only after completed handoffs.
- Future agents can review both current state and durable historical context before changing existing behavior.
- Fixed behaviors can carry explicit rationale forward instead of depending on chat memory.
- Background capture is preserving repo activity without requiring a manual session-start command.
- Holistic now has a machine-layer path toward seamless passive capture across tools.
- Repo-visible memory remains the portable source of truth even when a tool only partially cooperates.
- Cross-device continuity no longer depends on a daemon being present everywhere.
- Handoff docs, project history, and regression memory are the portable layer agents can read on any device.
- Holistic now has generated sync/restore scripts for cross-device propagation.
- A dedicated holistic/state branch can distribute portable memory without tying it to one working branch.
- The repo now has a cleaner public onboarding path for collaborators and evaluators
- Holistic is now dogfooding itself locally in this repo
- The next session can start from a concrete roadmap instead of reconstructing follow-up work
- Regression risks:
- Before changing existing behavior, agents should review regression-watch.md so earlier fixes do not get broken accidentally.
- Behavior that was fixed in one session should be preserved unless the user explicitly wants it changed.
- Agents should still formalize important fixes with handoff metadata so archive entries stay precise over time.
- Agents should review regression-watch.md before modifying areas that were previously stabilized.
- Handoffs should include impact and regression notes whenever a fix changes behavior that could be re-broken later.
- Background capture reduces the chance that work is forgotten when agents switch tools or contexts.
- A repo alone still cannot force arbitrary apps to participate; true zero-touch requires either daemon installation or app integrations.
- Agents should treat zero-touch.md as the source of truth for what is and is not automatic.
- If sessions need to continue on another device, the handoff commit still needs to be synced to the remote repo.
- The daemon should be treated as optional; agents must not assume it exists everywhere.
- Cross-device continuity still depends on syncing the repo or state branch after handoff.
- Devices that do not have the daemon installed should still rely on repo-visible memory and synced handoff commits.
- Do not accidentally commit this repo's live local Holistic runtime state into the product repo
- Keep the public docs aligned with actual CLI and init behavior
- Preserve the repo-first, cross-device design instead of drifting toward a laptop-only workflow
- References:
- .holistic/context/project-history.md
- .holistic/context/regression-watch.md
- .holistic/context/zero-touch.md
- .holistic\config.json
- .holistic\system\sync-state.ps1
- .holistic\system\restore-state.ps1
- README.md
- CONTRIBUTING.md
- docs/handoff-walkthrough.md
- src/cli.ts

