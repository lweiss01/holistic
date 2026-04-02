---
estimated_steps: 1
estimated_files: 5
skills_used: []
---

# T03: Create GitHub issue templates and support infrastructure

Create GitHub issue templates (bug_report.md, feature_request.md, question.md) using YAML frontmatter format so they render in GitHub's 'New Issue' UI. Create SUPPORT.md pointing to GitHub issues for bugs/features and README/CLI help for common questions. Add beta feedback callout to README. Templates should include environment info fields (Node version, OS, Holistic version) and clear sections.

## Inputs

- ``README.md``
- ``CHANGELOG.md``

## Expected Output

- ``.github/ISSUE_TEMPLATE/bug_report.md``
- ``.github/ISSUE_TEMPLATE/feature_request.md``
- ``.github/ISSUE_TEMPLATE/question.md``
- ``SUPPORT.md``
- ``README.md``

## Verification

test -f .github/ISSUE_TEMPLATE/bug_report.md && test -f .github/ISSUE_TEMPLATE/feature_request.md && test -f .github/ISSUE_TEMPLATE/question.md && test -f SUPPORT.md && grep -q 'name:' .github/ISSUE_TEMPLATE/bug_report.md && grep -q 'beta' README.md
