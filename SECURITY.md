# Security Policy

## Reporting Vulnerabilities

Please **do not** file public GitHub issues for security vulnerabilities.

Email security concerns to: [open an issue marked `security` after confirming it is not sensitive, or email the maintainer directly]

We aim to acknowledge reports within 72 hours and patch confirmed issues as quickly as possible.

---

## What Holistic Installs — Transparent Disclosure

Holistic is a developer workflow tool that sets up persistence and local automation. This section explains exactly what it does so you can make an informed decision before running `holistic bootstrap`.

### Daemon (background process)

- Holistic installs a background daemon that runs while your machine is on.
- **Windows:** A `.cmd` file is written to `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\` so the daemon starts at login. This is the standard Windows user-space autostart mechanism — it does not require admin rights and does not touch the registry.
- **macOS:** A `.plist` file is written to `~/Library/LaunchAgents/` via the standard macOS user launch agent mechanism.
- **Linux:** A `.service` file is written to `~/.config/systemd/user/` via the standard user systemd service mechanism.

The daemon monitors the repo for activity and writes checkpoints to `.holistic/` inside the repo. It does not exfiltrate data.

### PowerShell execution policy

- Holistic-generated PowerShell scripts use `-ExecutionPolicy RemoteSigned`.
- This allows locally-generated scripts (signed or unsigned) to run without requiring system-wide policy changes. It does not bypass antivirus or security monitoring.
- We do **not** use `-ExecutionPolicy Bypass` or `-WindowStyle Hidden`.

### Git sync

- Holistic can push session state to a hidden git ref (`refs/holistic/state`) on your configured remote. This is opt-in and only pushes Holistic state files — it never touches your working branch.
- The remote and ref are set from `config.json` inside the repo, which you control. No external services are involved.

### Files written to disk

Holistic writes the following categories of files:

| Location | What | Removable? |
|---|---|---|
| `.holistic/` in repo | Session state, config, generated docs | Yes — delete the folder |
| `.holistic/system/` | Machine-local helper scripts with absolute paths | Yes — regenerate with `holistic repair` |
| Windows Startup folder | One `.cmd` launcher per bootstrapped repo | Yes — delete `holistic-<slug>.cmd` |
| macOS LaunchAgents | One `.plist` per bootstrapped repo | Yes — delete and run `launchctl remove` |
| Linux systemd user | One `.service` per bootstrapped repo | Yes — run `systemctl --user disable` |

### What Holistic does NOT do

- It does not read or transmit file contents outside your repo.
- It does not access credentials, tokens, or environment variables beyond what Node.js already has.
- It does not phone home to any external service.
- It does not execute arbitrary code from the network.

---

## Known socket.dev Scanner Flags (False Positives)

Automated security scanners may flag Holistic for the following patterns. These are explained here:

| Flag | Explanation |
|---|---|
| PowerShell `-ExecutionPolicy RemoteSigned` | Required to run locally-generated helper scripts. Does not bypass AV or system security. |
| `detached: true` / `child.unref()` in sync | Standard Node.js pattern for fire-and-forget background processes. The sync runs in the background and logs to `.holistic/system/sync.log`. |
| Git push to configurable ref | The state ref and remote are set by you in `config.json`. Holistic only pushes its own state files. |
| File path strings in scripts | Generated scripts contain absolute paths to your repo. These are local file paths, not URLs or network addresses. |

---

## Supported Versions

Holistic is in active beta. We fix security issues in the latest release only.

| Version | Supported |
|---|---|
| 0.5.x (latest) | ✅ |
| < 0.5.0 | ❌ |
