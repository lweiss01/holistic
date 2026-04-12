# Changelog

## 0.6.1 - 2026-04-12

Trust & Privacy Hardening (M006). This release implements a "Consent-First" read-only architecture, strengthens privacy boundaries for portable state, and introduces configurable MCP logging and enhanced secret redaction.

- Implemented **Read-Only Command Policy**: Routine commands (`status`, `resume`, `diff`, `search`) are now strictly non-mutating. They will surface health warnings for outdated hooks but will never fix them silently.
- Hardened **Privacy Mode Enforcement**: When `portableState` is disabled (Privacy Mode), generated shell scripts and Git hooks now exit early to prevent any accidental remote state synchronization.
- Added **MCP Logging Privacy**: Introduced `mcpLogging` configuration (`off` | `minimal` | `default`). Defaults to `minimal` to prevent session objectives and titles from leaking into system logs.
- Expanded **Secret Redaction**: significantly strengthened the redaction engine to identify and scrub JWT tokens, Bearer tokens, AWS keys, and PEM private key blocks.
- Added **Redaction Quality Tests**: Integrated 8 new unit tests to verify that sensitive patterns are correctly scrubbed while preserving normal text.
- Added **SECURITY.md**: Published a comprehensive technical disclosure of Holistic's trust model, data residency guarantees, and safety architecture.

## 0.6.0 - 2026-04-11

Comprehensive Reliability & UX Refinement (M005). This release finalizes the security hardening milestone, introduces granular bootstrap controls, and adds support for explicit portable-state management.

- Added **Granular Bootstrap Flags**: Users can now surgically enable setup items with `--yes-hooks`, `--yes-daemon`, `--yes-mcp`, `--yes-attr`, and `--yes-claude`.
- Added `--portable` flag to `init` and `bootstrap` to explicitly toggle **Portable State (Privacy Mode)** during setup.
- Refined **Bootstrap Pre-flight UX**: The pre-flight check now clearly differentiates between "Core Configuration" (covered by `--yes`) and "Optional/Explicit" items.
- Fixed **Runtime Script Resolution**: Resolved a critical production bug where the CLI incorrectly searched for `.ts` files in built environments; now correctly resolves `.js` files when TypeScript stripping is unavailable.
- Hardened **Read-Only Diagnostics**: Refactored `holistic doctor` and `getSetupStatus` to be strictly read-only, ensuring health checks never inadvertently modify Git hooks or repository state.
- Improved **MCP Server Transparency**: Sanitized startup logging to prevent context leakage in system logs while maintaining full context availability via the `holistic_resume` tool.
- Aligned **Claude Code Hook Detection**: Fixed a bug where `holistic doctor` misreported Claude hook status by incorrectly checking the filesystem instead of `settings.json`.

## 0.5.5 - 2026-04-10

Major Security & Trust Hardening (M005) to eliminate silent automation and improve auditability.

- Added **Consent Gating** to `holistic bootstrap`: The CLI now displays a summary of system-modifying actions (daemon, hooks, Claude setup) and requires an explicit `--yes` flag to apply them.
- Added `holistic doctor` command for repository setup diagnostics and background sync health monitoring.
- Implemented **Privacy-First Defaults**: Remote portable-state syncing is now disabled by default. Users must explicitly opt-in by setting `"portableState": true` in the repo config.
- Eliminated **Silent Error Suppression**: Background sync scripts (PowerShell & Bash) now use timestamped logging to `.holistic/system/sync.log`. Failures are now visible in `holistic doctor` and `holistic status`.
- Hardened **Git-Native Snapshotting**: Refactored repo snapshotting to use `git ls-files`, ensuring $O(\text{changes})$ performance and native `.gitignore` compliance.
- Gated **Handoff Commits by Default**: Removed automatic Git commits from the `handoff` command. Holistic now prepares a `pending-commit.txt` for manual review, with an optional `--commit` flag for automated workflows.

## 0.5.4 - 2026-04-09

Security hardening in response to socket.dev AI-based package scanner flags.

- Removed `-WindowStyle Hidden` from the Windows daemon startup `.cmd` — the daemon now runs in a visible window, consistent with how macOS and Linux handle it.
- Downgraded PowerShell execution policy from `-ExecutionPolicy Bypass` to `-ExecutionPolicy RemoteSigned` in all three generation sites (`setup.ts`, `sync.ts`, `bin/holistic.cmd`). `RemoteSigned` is sufficient for locally-generated scripts and does not suppress antivirus or security monitoring.
- Fixed a real code quality bug in `bin/holistic.cmd`: the `COMMIT_MSG` variable read from `pending-commit.txt` was used unquoted in a `git commit -m` call. Special characters (`&`, `|`, `>`, `<`, `"`) are now stripped before use to prevent cmd.exe argument injection.
- Added `SECURITY.md` with transparent disclosure of what Holistic installs (daemon, startup entries, git sync), what it does not do (no exfiltration, no credential access, no external services), and an explanation of known scanner false positives.
- Added Security & Privacy section to `README.md` linking to `SECURITY.md`.

## 0.5.3 - 2026-04-09

Hardened state management for fresh repos and path-moved environments, and added a repair command to regenerate stale machine-local helpers.

- Added `holistic repair` to regenerate `.holistic/system/` helpers from the current repo config — fixes repos whose local helpers pointed at stale or moved paths after bootstrap.
- Fixed fresh-repo state locking — the lock file parent directory is now created before attempting to acquire the lock, preventing silent failures in repos that have never had a checkpoint.
- Fixed checkpoint seeding — new sessions created from a carryover handoff or pending work now inherit real context instead of boilerplate fallback text.
- Fixed packaged-install helper generation — generated `.holistic/system/holistic` and `holistic.cmd` now target `dist/*.js` instead of `dist/cli.ts`, so they work correctly in globally-installed (non-source) environments.
- Wired repair dispatch into the CLI — `holistic repair` now appears in help output and routes correctly.

## 0.5.2 - 2026-03-28

Cross-platform polish and hook-warning noise reduction shipped as part of the S07 technical polish slice.

- Reduced hook refresh warning noise by aggregating custom-hook skip messages instead of emitting one per hook file.
- Tracked `.gitattributes` under Holistic management and aligned cross-platform line-ending rules for generated Holistic files.
- Published npm package `holistic@0.5.2` and created GitHub tag/release `v0.5.2`.

## 0.5.1 - 2026-03-28

Shipped the S04 edge-case health diagnostics slice and released it as `holistic@0.5.1`.

- Added a daemon-health diagnostics evaluator with two warning classes:
  - stale checkpoint warning when no checkpoint is recorded for 3+ days
  - unusual pattern warning when 50+ files are changed without checkpoint evidence
- Integrated diagnostics into startup surfaces through shared greeting formatting so MCP startup notifications and `/holistic` output stay in parity.
- Added boundary and regression coverage for 3-day and 50-file thresholds, below-threshold negatives, and diagnostic (non-blaming) warning language.
- Published npm package `holistic@0.5.1` and created GitHub tag/release `v0.5.1`.

## 0.4.2 - 2026-03-26

Published the README heading fix that should have landed with the prior patch release.

- Renamed the README section heading from `What it feels like now` to `What it feels like with HOLISTIC` so the public docs match the intended wording.
- Re-published the package so npm and GitHub both reflect the corrected README copy.

## 0.4.1 - 2026-03-26

Polished the public README language and improved how Holistic surfaces top-level command failures.

- Renamed the README section to `What it feels like with HOLISTIC` and removed the stray `npm start` wording from the day-to-day workflow description.
- Improved the CLI top-level failure path so commands show a clearer `Holistic command failed.` banner before printing the underlying error.
- Kept stack traces available when present so debugging detail is still visible after the friendlier error header.

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
