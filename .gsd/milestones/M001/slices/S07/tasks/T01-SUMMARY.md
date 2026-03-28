---
id: T01
parent: S07
milestone: M001
provides: []
requires: []
affects: []
key_files: [".gitignore", ".gitattributes"]
key_decisions: ["Track .gitattributes in-repo (not ignored) so policy is portable.", "Relax JSON from strict eol=lf to text normalization to reduce Windows npm rewrite warning churn."]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran full project tests after line-ending policy changes to ensure behavior remained stable."
completed_at: 2026-03-28T20:49:55.512Z
blocker_discovered: false
---

# T01: Tracked .gitattributes and aligned cross-platform line-ending policy to reduce recurring CRLF churn.

> Tracked .gitattributes and aligned cross-platform line-ending policy to reduce recurring CRLF churn.

## What Happened
---
id: T01
parent: S07
milestone: M001
key_files:
  - .gitignore
  - .gitattributes
key_decisions:
  - Track .gitattributes in-repo (not ignored) so policy is portable.
  - Relax JSON from strict eol=lf to text normalization to reduce Windows npm rewrite warning churn.
duration: ""
verification_result: passed
completed_at: 2026-03-28T20:49:55.513Z
blocker_discovered: false
---

# T01: Tracked .gitattributes and aligned cross-platform line-ending policy to reduce recurring CRLF churn.

**Tracked .gitattributes and aligned cross-platform line-ending policy to reduce recurring CRLF churn.**

## What Happened

Identified that .gitattributes was unintentionally ignored in this repo, which meant line-ending policy was not versioned or shared. Fixed by unignoring and tracking .gitattributes, then set cross-platform defaults: auto text normalization, LF for shell/docs/code, CRLF for Windows scripts, and non-strict JSON text normalization to avoid recurring npm-managed CRLF warning noise on Windows.

## Verification

Ran full project tests after line-ending policy changes to ensure behavior remained stable.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 3600ms |


## Deviations

None.

## Known Issues

Some existing files still have mixed/CRLF worktree endings from prior history; policy is now tracked going forward.

## Files Created/Modified

- `.gitignore`
- `.gitattributes`


## Deviations
None.

## Known Issues
Some existing files still have mixed/CRLF worktree endings from prior history; policy is now tracked going forward.
