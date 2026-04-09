---
id: T03
parent: S09
milestone: M001
provides: []
requires: []
affects: []
key_files: [".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md", ".github/ISSUE_TEMPLATE/question.md", "SUPPORT.md", "README.md"]
key_decisions: ["Used YAML frontmatter format for issue templates to render properly in GitHub's 'New Issue' UI", "Included environment info fields (Holistic version, Node version, OS, shell, installation method) in bug report template", "Added beta feedback section to README after 'Why this matters' section pointing to issues and SUPPORT.md"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran verification command: test -f .github/ISSUE_TEMPLATE/bug_report.md && test -f .github/ISSUE_TEMPLATE/feature_request.md && test -f .github/ISSUE_TEMPLATE/question.md && test -f SUPPORT.md && grep -q 'name:' .github/ISSUE_TEMPLATE/bug_report.md && grep -q 'beta' README.md. All checks passed - all template files exist, YAML frontmatter is present, and beta callout is in README."
completed_at: 2026-04-02T20:50:11.233Z
blocker_discovered: false
---

# T03: Created GitHub issue templates (bug report, feature request, question) with YAML frontmatter, SUPPORT.md support hub, and added beta feedback callout to README

> Created GitHub issue templates (bug report, feature request, question) with YAML frontmatter, SUPPORT.md support hub, and added beta feedback callout to README

## What Happened
---
id: T03
parent: S09
milestone: M001
key_files:
  - .github/ISSUE_TEMPLATE/bug_report.md
  - .github/ISSUE_TEMPLATE/feature_request.md
  - .github/ISSUE_TEMPLATE/question.md
  - SUPPORT.md
  - README.md
key_decisions:
  - Used YAML frontmatter format for issue templates to render properly in GitHub's 'New Issue' UI
  - Included environment info fields (Holistic version, Node version, OS, shell, installation method) in bug report template
  - Added beta feedback section to README after 'Why this matters' section pointing to issues and SUPPORT.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:50:11.234Z
blocker_discovered: false
---

# T03: Created GitHub issue templates (bug report, feature request, question) with YAML frontmatter, SUPPORT.md support hub, and added beta feedback callout to README

**Created GitHub issue templates (bug report, feature request, question) with YAML frontmatter, SUPPORT.md support hub, and added beta feedback callout to README**

## What Happened

Created three GitHub issue templates under .github/ISSUE_TEMPLATE/ using YAML frontmatter format: bug_report.md with environment info fields (Holistic version, Node version, OS, shell, installation method), feature_request.md with problem/solution structure, and question.md with "what I've tried" section. Created SUPPORT.md as a central support hub pointing to README sections for common questions and GitHub issue templates for bugs/features/questions, with beta feedback emphasis and filing checklist. Added Beta Feedback Welcome section to README.md after "Why this matters" with early beta disclosure and links to issues and SUPPORT.md.

## Verification

Ran verification command: test -f .github/ISSUE_TEMPLATE/bug_report.md && test -f .github/ISSUE_TEMPLATE/feature_request.md && test -f .github/ISSUE_TEMPLATE/question.md && test -f SUPPORT.md && grep -q 'name:' .github/ISSUE_TEMPLATE/bug_report.md && grep -q 'beta' README.md. All checks passed - all template files exist, YAML frontmatter is present, and beta callout is in README.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f .github/ISSUE_TEMPLATE/bug_report.md && test -f .github/ISSUE_TEMPLATE/feature_request.md && test -f .github/ISSUE_TEMPLATE/question.md && test -f SUPPORT.md && grep -q 'name:' .github/ISSUE_TEMPLATE/bug_report.md && grep -q 'beta' README.md` | 0 | ✅ pass | 50ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/question.md`
- `SUPPORT.md`
- `README.md`


## Deviations
None.

## Known Issues
None.
