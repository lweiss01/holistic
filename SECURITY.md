# Security Policy 🔒

## Reporting Vulnerabilities

Please **do not** file public GitHub issues for sensitive security vulnerabilities.

- For **non-sensitive** security concerns, you may open a GitHub issue labeled `security`.
- For **sensitive** reports, please email the maintainer directly.

We aim to acknowledge reports within 72 hours and patch confirmed issues as quickly as possible.

---

## Overview

Holistic is a local-first developer workflow tool that adds persistence, automation, and optional Git-backed state.

It operates entirely on your machine and within your repository. This document explains what it installs, how it behaves, and the security boundaries you should understand before using it.

---

## Security Principles

Holistic is built around a small set of core security and trust principles:

1. **Local-first by default**: No telemetry, analytics, or external API calls. Data residency is managed by you.
2. **Explicit over implicit**: System-modifying operations require intentional setup via `bootstrap` or `repair`.
3. **Least surprise**: Routine commands are read-only and will never silently "fix" or mutate your environment.
4. **User control and reversibility**: Every artifact installed by Holistic can be inspected and manually removed.
5. **Minimal privilege**: Operates entirely in user space with no `sudo` or admin privileges required.
6. **Transparency over obscurity**: Generated scripts are readable, and hook behavior is clearly marked.
7. **Defense in depth (best effort)**: Includes automated secret redaction and avoids executing shell commands from untrusted or network-provided input.

---

## Trust Model: "Consent-First, Read-First"

Holistic operates on a restrictive trust model to ensure your repository remains a safe environment for both humans and AI agents.

### 1. Read-first & Read-only
Routine commands (`status`, `resume`, `diff`, `search`, `doctor`, `serve`) are designed to be strictly non-mutating and will not intentionally modify your repository state. If configuration drift or outdated hooks are detected, Holistic will surface warnings rather than automatically repairing them.

### 2. Guarded Mutation
Commands that modify state (`checkpoint`, `handoff`, `start-new`, `watch`) are clearly identified. `holistic watch` in particular is a background daemon mode that creates checkpoints automatically based on activity thresholds.

### 2. Explicit System Modification
System-level changes (writing git hooks, configuring startup daemons, or modifying MCP settings) are restricted to two high-intent commands:
- `holistic bootstrap`: The primary installation and machine setup command.
- `holistic repair`: Re-scaffolds local machine helpers if they are deleted or broken.

Both commands require explicit user confirmation (or a `--yes` flag) before modifying files outside the `.holistic/` directory.

### 3. What Holistic Does Not Do

- Does not execute arbitrary shell commands from untrusted or network-provided input

---

## What Holistic Installs — Transparent Disclosure

### Daemon (background process)
Holistic installs a background daemon that runs while your machine is on to capture session snapshots.
- **Windows:** Writes a `.cmd` file to `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`
- **macOS:** Writes a `.plist` to `~/Library/LaunchAgents/`
- **Linux:** Writes a `.service` to `~/.config/systemd/user/`

These are standard **user-space autostart mechanisms** and do not require admin privileges.

### PowerShell execution policy
- Holistic-generated PowerShell scripts use `-ExecutionPolicy RemoteSigned`.
- This allows locally-generated scripts to run without changing global policy. Holistic does **not** use `Bypass` or `Hidden` window styles.

### Git sync (portable state)
- Holistic can push session state to a hidden ref: `refs/holistic/state`.
- **Privacy Mode Enforcement**: This is **disabled by default**. When `portableState` is false, all generated sync scripts and hooks contain early-exit guards to prevent any accidental remote traffic.

### Git hooks
Holistic may install managed Git hooks (e.g., `pre-push`, `post-commit`).
- **Safety guarantees**: Hooks are clearly marked as `HOLISTIC-MANAGED`. Existing user-managed hooks are **never overwritten**.

---

## Logging and Privacy

### MCP Logging Privacy
Holistic supports configurable logging levels to prevent session metadata from leaking into system-level logs (e.g., Claude Desktop logs):
- `off`: No session data is sent to the UI.
- `minimal`: (Default) Only generic "Session Active" notifications are sent.
- `default`: Full session titles and goals are sent for maximum context.

---

## Secret Redaction & Data Scrubbing

Holistic performs **basic automated redaction** of sensitive patterns identified during development and testing.

### Automated Scrubbing Patterns:
- **JWTs**: Complete scrubbing of JSON Web Tokens.
- **Cloud Keys**: AWS Access Key IDs (AKIA...).
- **Tokens**: GitHub PATs, Bearer tokens, and OpenAI-style `sk-...` keys.
- **Crypto Keys**: Full redaction of PEM-encoded Private Key blocks.
- **Assignment-style Secrets**: Automatic scrubbing of `password: ...`, `secret=...`, and `api_key: ...` patterns.

> [!WARNING]  
> Secret redaction is a **"best-effort" safety layer**. It is not comprehensive and is **not a substitute for secure handling of secrets**. Always use `.gitignore` for native secret files (e.g., `.env`).

---

## Threat Model

### Trust Boundaries
- **Trusted**: Your local machine, your repository, your configured Git remote.
- **Untrusted / Variable**: User input (CLI arguments), third-party AI agents, and external scripts interacting with the repo.

### Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Unintended system changes** | Explicit `bootstrap` consent; No admin privileges; Human-readable scripts. |
| **Repository mutation** | Scoped to `.holistic/`; No branch modification; Transparent hook management. |
| **Data exposure via sync** | Disabled by default; Hidden ref usage; Early-exit privacy guards. |
| **Background execution** | Standard user mechanisms; Fully removable via manual deletion of installed artifacts or regeneration using `holistic repair`. |

---

## Known Scanner Flags (False Positives)

Security scanners (e.g., socket.dev) may flag these patterns:

| Flag | Explanation |
|---|---|
| PowerShell `RemoteSigned` | Required for local scripts; does not bypass system security. |
| `detached: true` / `child.unref()` | Standard Node.js background process pattern. |
| Git push to custom ref | User-controlled remote and ref; state files only. |
| Absolute file paths in scripts | Machine-specific local paths; not network endpoints. |

---

## Supported Versions

Security fixes are applied to the latest release only.

| Version | Supported |
|---|---|
| 0.6.x (latest) | ✅ |
| < 0.6.0 | ❌ |
