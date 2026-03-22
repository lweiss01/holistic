# Changelog

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
