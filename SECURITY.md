# Security Policy 🔒

## Reporting Vulnerabilities

Please **do not** file public GitHub issues for sensitive security vulnerabilities.

- For **non-sensitive** security concerns, you may open a GitHub issue labeled `security`.
- For **sensitive** reports, please email the maintainer directly.

We aim to acknowledge reports within 72 hours and patch confirmed issues as quickly as possible.

---

## Overview

Holistic is a local-first developer workflow tool that adds persistence, automation, and optional Git-backed state. The optional **Andon** add-on layers a local monitoring dashboard on top of it and, unlike the core tool, **opens local network ports**.

This document explains what is installed, what runs, and the security boundaries you should understand before using either.

---

## Security Principles

1. **Local-first by default**: no telemetry or analytics. The core tool makes no outbound network calls. The Andon add-on talks to `127.0.0.1` only. See [Network surface](#network-surface).
2. **Explicit over implicit**: system-modifying operations require intentional setup via `bootstrap` or `repair`.
3. **Least surprise**: routine commands are read-only and never silently "fix" or mutate your environment.
4. **User control and reversibility**: every artifact Holistic installs can be inspected and removed.
5. **Minimal privilege**: user space only. No `sudo` or admin rights.
6. **Transparency over obscurity**: generated scripts are readable and hooks are clearly marked.
7. **Containment by design**: repo-configured paths and session identifiers are validated before they reach the filesystem.
8. **Integrity by preservation**: corrupted state is backed up rather than discarded.
9. **Untrusted input stays data**: content Holistic did not author is escaped and labelled before it enters a document an agent reads as instruction.

---

## Trust Model

### Trust boundaries

| Zone | Contents |
|---|---|
| **Trusted** | Your local machine, processes running as you, your configured Git remote. |
| **Untrusted** | CLI arguments, AI agent output, git history and commit messages, repository file contents, anything arriving over a socket. |

The important consequence: **an AI agent is not a trusted input source**, and neither is your own repository's history. Both can be influenced by anyone who can land a commit or persuade an agent.

### Read-first and read-only

`status`, `resume`, `diff`, `search`, `doctor`, and `serve` are non-mutating. Configuration drift and stale hooks are surfaced as warnings rather than repaired automatically.

### Guarded mutation

`checkpoint`, `handoff`, `start-new`, and `watch` modify state and are clearly identified. `watch` is a foreground daemon that checkpoints automatically on activity thresholds.

### Explicit system modification

System-level changes (git hooks, startup daemons, MCP settings) are restricted to `holistic bootstrap` and `holistic repair`. Both require explicit confirmation or `--yes` before modifying anything outside the runtime directory.

> **Known gap:** there is currently no `--dry-run` and no `uninstall` command. Removing the daemon means deleting the startup entry by hand. Tracked as `holistic-9nm`.

---

## Network surface

The core `holistic` CLI opens no ports and makes no outbound requests.

The **Andon add-on** runs local services. It only ships in the Holistic product repo; a published npm install does not contain it, and the daemon detects its absence and skips it.

| Service | Port | Bind |
|---|---|---|
| Andon API | 4318 | `127.0.0.1` |
| Runtime service | 4320 | `127.0.0.1` |
| Dashboard (Vite dev server) | 5173 | `127.0.0.1` |

Set `HOLISTIC_ANDON=0` to stop the daemon starting these even when present.

### Why loopback binding is not sufficient on its own

Binding to `127.0.0.1` keeps remote hosts out. It does **not** keep out:

- **Any web page you visit.** A browser can issue cross-origin requests to `127.0.0.1`. With a permissive CORS policy it can read the responses too.
- **Any other process on the machine**, including a malicious dependency's postinstall script.

Both services therefore apply three independent controls.

#### 1. Origin allowlist

A request carrying a browser `Origin` header that is not allowlisted is rejected with `403` before routing, for every method including `OPTIONS`. Requests with no `Origin` (CLI writers, hooks, tests) are treated as local callers.

Allowed by default: `http://127.0.0.1:5173` and `http://localhost:5173`. Extend with `ANDON_ALLOWED_ORIGINS` (comma separated). Responses never carry a wildcard `Access-Control-Allow-Origin`.

#### 2. JSON content type required

A cross-origin `POST` using `text/plain`, form encoding, or multipart is a "simple request" and reaches a server without preflight. Request bodies must declare `application/json`, so such a request is rejected with `415` and any real cross-origin attempt is forced through a preflight the origin check refuses.

#### 3. Loopback bearer token

Every route except `/health` requires `Authorization: Bearer <token>`. Comparison is constant time.

- Stored at `~/.holistic/andon-token`, overridable with `ANDON_TOKEN_FILE`.
- Created on first service start with mode `0600`. Windows ACLs do not map onto POSIX modes, so the permission step is best effort there.
- `/health` stays public so liveness probes keep working.
- `ANDON_REQUIRE_TOKEN=0` disables authentication for local debugging and warns on stderr.

**What the token protects, stated honestly.** A `0600` file does not stop a process running as *you*: that process can simply read the file. This is accepted, because a same-user process can already read your repository, your state, and your credentials. What the token does stop is **another user on a shared machine**, **a container sharing the network namespace**, and **any caller that can reach the port but not your filesystem**. Treat it as a boundary between users and namespaces, not as a defence against yourself.

**Why the handler factories default to authentication off.** `createAndonHandler` and `createRuntimeServiceHandler` take an optional token and default to `null`, meaning no authentication. The running services enable it explicitly in their entry points, so **every real service start is authenticated**. The factory is the seam used by tests and by anyone embedding the handler, and making it secure by default would have required threading a token through every request in the test suite. The tradeoff is deliberate and has a real cost: **an embedder who calls a factory directly gets no authentication unless they pass a token.** This is documented on the option type itself. If you embed these handlers, pass `{ token: resolveServiceToken() }`.

### Process execution

The runtime service can start local processes. A caller-supplied command in a task request is refused unless **both** `HOLISTIC_ALLOW_LOCAL_COMMAND=1` is set **and** the executable appears in `HOLISTIC_LOCAL_COMMAND_ALLOWLIST`. Without those, the adapter only runs its bundled fixture. Request-supplied environment variables are filtered to the `HOLISTIC_` namespace, because `NODE_OPTIONS`, `LD_PRELOAD`, and `PATH` are code-execution vectors even with a fixed command.

---

## Prompt injection

Holistic writes `HOLISTIC.md`, which opens by telling an agent to read the entire file before doing anything else, and mirrors the same content into `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, and `.github/copilot-instructions.md`. Anything that reaches those files is read with high authority by every future agent.

The inputs are untrusted: session text is agent-authored, and repository history is authored by anyone who can commit.

**Controls**

- **Commit subjects are never quoted into the session objective.** A commit message previously landed verbatim under *Current Objective*, which made anyone able to land a commit able to write agent instructions with no compromise of anything.
- **Session-derived values are escaped.** Newlines are collapsed so a value cannot open a new block, leading headings are escaped, code fences and HTML comment markers are neutralised, and oversized values are clipped. Content is preserved as data rather than deleted.
- **Observed content is labelled.** Sections fed by session text or repo history carry a banner stating they are recorded data, not instructions from Holistic, and that directives inside them must not be followed. This includes the *Known Fixes* block, which carries the strongest instruction in the document and is therefore the most valuable to forge.
- **Safe Mode.** Setting `safeMode` in the runtime config generates minimal instructions, further reducing the surface.

**Residual risk.** Escaping defangs markdown structure. It cannot stop a plausible sentence from being persuasive. The provenance banner is what tells a reader the content is data, and it depends on the reading model honouring it.

---

## Filesystem containment

- **Configured paths.** Paths in `holistic.repo.json` are validated against the repository root. Escapes fall back to safe defaults and are reported as findings in `holistic doctor`.
- **Session identifiers.** Session ids reach the filesystem from CLI flags, MCP arguments, and agent-authored handoff metadata. They are validated against a strict character set before any path is built, and archive reactivation additionally verifies that both the source and destination resolve inside their session directories. A prefix test alone is not a guard: `session-../../..` satisfies one.
- **State writes are atomic.** State is written to a temp file and renamed. Corrupted state is quarantined with a timestamped backup and the session is flagged `degraded` rather than silently reset.
- **Turn hooks never edit `state.json`.** Per-agent turn hooks fire on every tool call and cannot take the state lock, so they write a dedicated `turn-state.json` sidecar using a temp file and atomic move. A hook doing a read-modify-write on `state.json` would lose concurrent updates and could be observed half-written.

> **Known gap:** containment is lexical and does not resolve symlinks, so a committed symlink pointing outside the repo can still redirect a write. Tracked as `holistic-hwc`.

---

## Secret redaction

Holistic performs best-effort redaction on text entering session state.

**Patterns:** JWTs, AWS access key ids, GitHub PATs, OpenAI-style `sk-` keys, Google API keys, Slack tokens, npm tokens, Bearer tokens, PEM private key blocks, and assignment-style secrets.

**Assignment handling.** Redacting every word after a keyword destroyed ordinary prose: a note reading `auth token: needs a proxy` was stored as `auth token: [REDACTED] a proxy`, silently and permanently. Redaction now keys on assignment style:

- a tight `key=value` with no surrounding whitespace is config syntax and is always redacted;
- a spaced `key: value` is how the same words appear in a sentence, so the value must look like credential material (20+ characters, or 6+ containing a digit, or 12+ containing base64 punctuation);
- quoted values are always redacted and may contain spaces.

> [!WARNING]
> Redaction is a **best-effort safety layer**, not a substitute for handling secrets properly. Keep secrets in `.gitignore`d files. Structured metadata fields are not yet fully covered; tracked as part of the audit follow-up.

---

## What Holistic installs

### Daemon

A user-space autostart entry that captures session snapshots:

- **Windows:** a `.cmd` in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`
- **macOS:** a `.plist` in `~/Library/LaunchAgents/`
- **Linux:** a `.service` in `~/.config/systemd/user/`

No admin privileges required.

### PowerShell execution policy

Generated PowerShell runs with `-ExecutionPolicy RemoteSigned`. Holistic does not use `Bypass` or hidden window styles for installed hooks.

### Git sync (portable state)

Session state can be pushed to the hidden ref `refs/holistic/state`. **Disabled by default.** With `portableState` false, generated sync scripts and hooks carry early-exit guards so no remote traffic occurs.

### Git hooks

Managed hooks are marked `HOLISTIC-MANAGED`. Existing user-managed hooks are never overwritten.

### Andon shell hooks

Generated `andon-hook` scripts POST events to the local API and attach the loopback token. The POSIX variants require `jq`; without it they exit cleanly and write nothing.

---

## Logging and privacy

`mcpLogging` controls how much session metadata reaches host logs:

- `off`: no session data sent.
- `minimal` (default): generic "session active" notification only.
- `default`: full session titles and goals.

---

## Environment variables that affect security

| Variable | Effect |
|---|---|
| `ANDON_TOKEN_FILE` | Relocates the auth token file. |
| `ANDON_REQUIRE_TOKEN=0` | Disables service authentication. Warns on stderr. |
| `ANDON_ALLOWED_ORIGINS` | Adds allowed browser origins. |
| `HOLISTIC_ALLOW_LOCAL_COMMAND=1` | Permits caller-supplied commands, with an allowlist. |
| `HOLISTIC_LOCAL_COMMAND_ALLOWLIST` | Executables permitted above. |
| `HOLISTIC_ANDON=0` | Stops the daemon starting Andon services. |
| `ANDON_API_BASE_URL` | Redirects event delivery. **Not yet restricted to loopback**; tracked as `holistic-17f`. |
| `HOLISTIC_STATE_FILE` | Redirects state reads. Same caveat. |

---

## Known scanner flags (false positives)

| Flag | Explanation |
|---|---|
| PowerShell `RemoteSigned` | Required for local scripts; does not bypass system security. |
| `detached: true` / `child.unref()` | Standard Node.js background process pattern. |
| Git push to custom ref | User-controlled remote and ref; state files only. |
| Absolute file paths in scripts | Machine-specific local paths, not network endpoints. |
| `child_process.spawn` in runtime-local | Gated behind an opt-in and an allowlist; see [Process execution](#process-execution). |

---

## Supported versions

Security fixes are applied to the latest release only.

| Version | Supported |
|---|---|
| 0.6.x (latest) | ✅ |
| < 0.6.0 | ❌ |
