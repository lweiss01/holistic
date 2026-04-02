# S09: Launch Communications

**Goal:** Create launch communication assets (demo GIF, LinkedIn post draft, support infrastructure) so early adopters can discover Holistic, understand its value quickly, and provide structured feedback.
**Demo:** After this: LinkedIn post drafted; demo GIF/video ready; GitHub README has clear value prop; support plan ready for early adopters; beta feedback mechanism in place

## Tasks
- [x] **T01: Created animated demo GIF (44 KB) showing Holistic workflow comparison and embedded in README near top** — Record a 10-15 second demo GIF showing the core problem/solution contrast: agent switch without Holistic (user re-explains everything) vs. with Holistic (agent auto-resumes from handoff, asks continue/tweak/new). Optimize for <2MB file size and loop smoothly for social media embeds. Embed in README near top.
  - Estimate: 45m
  - Files: docs/demo.gif, README.md
  - Verify: test -f docs/demo.gif && [ $(stat -c%s docs/demo.gif 2>/dev/null || stat -f%z docs/demo.gif 2>/dev/null) -lt 2097152 ] && grep -q 'docs/demo.gif' README.md
- [ ] **T02: Draft LinkedIn launch post** — Write a 150-300 word LinkedIn post leading with the problem (context tax when switching AI agents), embedding the demo GIF, explaining the solution (shared repo memory with one bootstrap command), and linking to GitHub and npm. Save as markdown draft for user review before posting. Focus on pain/solution contrast, not feature lists.
  - Estimate: 30m
  - Files: docs/launch/linkedin-post.md
  - Verify: test -f docs/launch/linkedin-post.md && [ $(wc -w < docs/launch/linkedin-post.md) -ge 100 ] && [ $(wc -w < docs/launch/linkedin-post.md) -le 400 ] && grep -q 'demo.gif' docs/launch/linkedin-post.md
- [ ] **T03: Create GitHub issue templates and support infrastructure** — Create GitHub issue templates (bug_report.md, feature_request.md, question.md) using YAML frontmatter format so they render in GitHub's 'New Issue' UI. Create SUPPORT.md pointing to GitHub issues for bugs/features and README/CLI help for common questions. Add beta feedback callout to README. Templates should include environment info fields (Node version, OS, Holistic version) and clear sections.
  - Estimate: 45m
  - Files: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/ISSUE_TEMPLATE/question.md, SUPPORT.md, README.md
  - Verify: test -f .github/ISSUE_TEMPLATE/bug_report.md && test -f .github/ISSUE_TEMPLATE/feature_request.md && test -f .github/ISSUE_TEMPLATE/question.md && test -f SUPPORT.md && grep -q 'name:' .github/ISSUE_TEMPLATE/bug_report.md && grep -q 'beta' README.md
