# Support

## Getting Help

### Common Questions

Most common questions are answered in the [README](./README.md):

- **Installation**: See the [Install](#install-) section
- **Setup**: See [Set up a repo](#set-up-a-repo-)
- **Daily workflow**: See [Daily workflow](#daily-workflow-)
- **Commands**: See the [Commands](#commands) section

### CLI Help

For command-specific help:

```bash
holistic --help
```

---

## Troubleshooting

### Local helpers not working after moving the repo

If you moved your project folder or reinstalled Node and the `.holistic/system/` helper scripts give errors, run:

```bash
holistic repair
```

This regenerates all machine-local helpers (`.holistic/system/holistic.cmd`, sync scripts, etc.) from your current repo config. It's the fastest fix for any "stale path" issues.

### Holistic not on PATH

Every bootstrapped repo includes a repo-local fallback:

- **Windows**: `.\.holistic\system\holistic.cmd <command>`
- **macOS/Linux**: `./.holistic/system/holistic <command>`

Use these if `holistic` is not found in your shell after install.

### Checking current state

```bash
holistic status
```

This shows the active session, last handoff, and any pending work without changing anything.

### Updating to the latest version

```bash
npm install -g holistic@latest
holistic repair
```

Running `repair` after an update ensures your repo-local helpers point at the newly installed version.

### Andon (optional supervision layer)

Andon is a **local-first** companion stack in this repository (not part of the published `holistic` npm tarball). It ingests events, stores them in SQLite, and serves a small dashboard. Holistic can **emit lifecycle events** to Andon when the API is reachable.

| Variable | Purpose |
|----------|---------|
| `ANDON_API_BASE_URL` | Base URL for the Andon API (default `http://127.0.0.1:4318`). |
| `ANDON_DISABLED` | Set to `true` to stop Holistic from posting events. |
| `ANDON_DEBUG` | Set to `true` to log dropped events or connection errors from Holistic. |
| `HOLISTIC_REPO` | Absolute path to a Holistic-enabled repo; the Andon API uses it for a **file-backed** Holistic bridge (reads `.holistic/state.json` and session files). If unset or invalid, the API uses a mock bridge for demos. |
| `VITE_ANDON_API_BASE_URL` | Dashboard dev server override for the API base URL (see `apps/andon-dashboard`). |

From the repo root after `npm install`, see [docs/andon-mvp.md](./docs/andon-mvp.md) for migrate, seed, and `npm run andon:*` scripts.

---

## Filing an Issue

For bugs, feature requests, or questions not covered here:

- **Bug Reports**: [Create a bug report](https://github.com/lweiss01/holistic/issues/new?template=bug_report.md)
- **Feature Requests**: [Suggest a feature](https://github.com/lweiss01/holistic/issues/new?template=feature_request.md)
- **Questions**: [Ask a question](https://github.com/lweiss01/holistic/issues/new?template=question.md)

Browse all open issues: [All Issues](https://github.com/lweiss01/holistic/issues)

### Before filing, please:

1. Check if the issue is already reported or being discussed
2. Update to the latest version: `npm install -g holistic@latest`
3. Run `holistic status` and include the output
4. Include your environment details (Node version, OS, shell)

---

## Community & Social

If Holistic is working well for you, sharing your experience helps early-stage open source projects more than you might think.

- ⭐ **Star the repo** on [GitHub](https://github.com/lweiss01/holistic) — it helps others find it
- 💬 **Post about it** on LinkedIn, Threads, or X — tag `#Holistic` or mention the GitHub link
- 🐛 **File issues** even for small rough edges — early adopter feedback directly shapes the roadmap

---

## Beta Feedback

Holistic is in early beta and moving fast. If you hit rough edges, unexpected behavior, or have ideas, please open an issue. Every report shapes the next release.

## Response Time

This is a small open-source project maintained with care. Response times vary, but all issues are reviewed. Pull requests with tests are especially welcome.
