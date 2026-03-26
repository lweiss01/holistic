# Changelog

## 0.4.0 - 2026-03-26

Stopped Holistic from auto-pushing the working branch during sync, filled out the missing adapter matrix, and gave each supported tool a more specific operating guide.

- Stopped checkpoint and handoff auto-sync helpers from pushing the current working branch; they now mirror only the portable Holistic state ref.
- Updated generated handoff guidance so Holistic prepares a pending handoff commit instead of implying that it will commit or push code automatically.
- Added/generated missing adapters for Gemini, GitHub Copilot, Cursor, Goose, GSD, and GSD2.
- Added `gsd2` as a distinct supported agent instead of treating it as an alias of `gsd`.
- Made generated adapter docs tool-specific so Copilot references `.github/copilot-instructions.md`, Cursor references `.cursorrules`, Gemini references `GEMINI.md`, Goose is CLI-first, and GSD/GSD2 describe their distinct workflow expectations.
- Fixed Claude Code hook installation to register the supported `claude` agent name.
- Added regression coverage for the sync behavior change and the expanded adapter matrix.

## 0.3.0 - 2026-03-24

Closed the injection and write-back reliability gaps for Claude Code and the full agent adapter matrix.

- Added Claude Code `SessionStart` hook installation during `bootstrap` — context is now auto-injected before the first message with no prompt discipline required.
- Added Claude Code `UserPromptSubmit` hook with 15-minute debounce — non-commit work (planning, research, architectural decisions) is now periodically snapshotted automatically.
- Added `.cursorrules`, `.windsurfrules`, and `.github/copilot-instructions.md` generation on `bootstrap` — Cursor, Windsurf, and GitHub Copilot now get automatic context injection alongside Claude and Gemini.
- Fixed auto-sync reliability — the pre-push hook now actually pushes the state ref instead of just showing instructions; sync errors are logged to `.holistic/system/sync.log`; `holistic status` surfaces last sync activity and recent failures.
- Baked session-end handoff instructions into every generated adapter file — MCP-capable agents get a `holistic_handoff` tool call reminder, CLI-only agents get the equivalent shell command.
- Fixed em-dash encoding in generated docs causing garbled output in PowerShell terminals.

## 0.2.3 - 2026-03-22

Stopped teaching agents to visibly fail on missing PATH before recovering.

- Changed generated Holistic docs to recommend repo-local helper commands first in bootstrapped repos.
- Changed resume output to recommend repo-local commands directly instead of bare `holistic ...` commands.
- Tightened startup, checkpoint, and handoff guidance so agents use repo-local commands by default.
- Added regression coverage for the repo-local-first command recommendations.

## 0.2.2 - 2026-03-22

Improved first-run recovery when Holistic is available in the repo but missing from the current shell PATH.

- Added generated repo-local CLI fallback wrappers under `.holistic/system/` for Windows and macOS/Linux.
- Surfaced repo-local fallback commands in bootstrap output, resume output, and generated Holistic docs.
- Updated the README to document the repo-local fallback command for bootstrapped repos.
- Added regression coverage for the generated fallback wrappers and startup guidance.

## 0.2.1 - 2026-03-22

Hardened for real-world use after dogfooding on the project that inspired Holistic.

- Added `holistic --version` / `-v` / `version` command.
- Added version display in the ASCII splash banner.
- Fixed repo snapshot performance — now skips `node_modules` and other heavy generated directories instead of stat-ing tens of thousands of irrelevant files on every checkpoint.
- Fixed stale lock recovery — a crashed daemon or CLI no longer permanently blocks all state operations.
- Fixed corrupt session resilience — a single bad JSON file in `.holistic/sessions/` no longer crashes the entire tool.
- Fixed `bin/holistic.js` to respect `holistic.repo.json` runtime overrides in the post-handoff auto-commit flow.
- Fixed git hook refresh — hooks now self-heal from daemon startup and MCP client connections, not just CLI commands.
- Improved first-run experience — softened empty-state language in generated docs so agents don't editorialize about missing plans.

## 0.2.0 - 2026-03-21

First public npm-ready release of Holistic.

- Added a one-step `holistic bootstrap` flow for repo setup plus optional local machine integration.
- Added thin MCP server support with `holistic serve`.
- Added `holistic status` and `holistic diff`.
- Added portable hook installation plus self-healing Holistic-managed hook refresh.
- Added hidden-ref portable state sync via `refs/holistic/state` to avoid GitHub branch noise.
- Added managed `.gitattributes` generation for portable Holistic files.
- Added packaging and install smoke validation for clean-repo bootstrap.
