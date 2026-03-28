# M001: M001: Core Workflow Tightening

## Vision
Make Holistic a true "silent partner" - automatic capture, minimal ceremony, consistent experience across tools. Users work for weeks without thinking about Holistic, yet have perfect continuity when switching agents or devices.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Automatic Startup Notifications | high | — | ✅ | MCP clients auto-greet with recap when conversation starts; non-MCP clients respond to `/holistic` with same pattern; greeting includes last handoff summary + 3-question prompt |
| S01.5 | ASCII Splash Screen & Branding | low | S01 | ✅ | CLI commands show branded ASCII splash on init/bootstrap; README has visual identity; clear value proposition visible in repo |
| S02 | Proactive Automatic Capture | medium | S01 | ⬜ | daemon checkpoints on time elapsed (2hr) OR significant files (5+); agents initiate checkpoints at natural breakpoints in conversation; handoff drafts trigger after 30min idle or completion signals; `/checkpoint` and `/handoff` slash commands available as safety valves |
| S03 | Automatic Memory Hygiene | low | — | ⬜ | sessions >30 days old AND unreferenced move to .holistic/sessions/archive/ automatically; archived sessions move back to active when used in diff/handoff/reference; archive check runs on session start and periodically in daemon |
| S04 | Edge-Case Health Diagnostics | low | S01 | ⬜ | startup notification includes warning if daemon hasn't checkpointed in 3+ days or unusual patterns detected (50+ files, no checkpoint); warnings are diagnostic (system health) not nags (user blame) |
| S05 | Documentation & Tool Parity | low | S01, S02 | ⬜ | README tool comparison table shows which tools support MCP auto vs require `/holistic` manual; AGENTS.md documents `/holistic` pattern with clear instructions; all slash commands have helper text visible to agents |
| S06 | Real-World Dogfooding | medium | S02, S03 | ⬜ | Holistic validated in 2-3 different repos (newsthread Android app, others); rough edges identified and documented; confidence that "set and forget" works in practice with real workflows |
| S07 | Technical Polish & Cross-Platform | low | — | ⬜ | CRLF warnings fixed with proper .gitattributes; npm pack/install tested on Mac/Windows/Linux; error messages are helpful and actionable; bootstrap experience validated on clean machines; same-repo state sync no longer creates confusing GitHub PR/banner prompts for normal project repos |
| S08 | npm Publishing Preparation | low | S06, S07 | ✅ | CHANGELOG.md exists; package.json has proper keywords; README is npm-ready; global install verified; ready for npm publish as 0.2.0 |
| S09 | Launch Communications | low | S08 | ⬜ | LinkedIn post drafted; demo GIF/video ready; GitHub README has clear value prop; support plan ready for early adopters; beta feedback mechanism in place |
