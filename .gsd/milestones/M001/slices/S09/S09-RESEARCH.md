# S09: Launch Communications — Research

**Date:** 2026-04-02  
**Domain:** npm package launch communications, demo asset creation, support infrastructure, beta feedback mechanisms  
**Confidence:** HIGH

## Summary

Holistic is already published at 0.5.2 on npm and has a strong README, clear value proposition, and good CHANGELOG. What's missing are the external-facing launch assets and support mechanisms that help early adopters discover, adopt, and provide feedback on the product.

The work divides cleanly into three categories:
1. **Demo assets** — short GIF or video showing the core workflow (bootstrap → agent reads context → handoff → next agent continues)
2. **Launch communications** — LinkedIn post (primary channel), with optional Twitter/social variants
3. **Support infrastructure** — GitHub issue templates, beta feedback mechanism, early adopter communication plan

This is light research territory. The patterns are well-established: create a 10-15 second demo GIF showing the "before Holistic / after Holistic" contrast, write a LinkedIn post focused on the problem (context tax across agents) rather than features, and formalize support channels so early feedback doesn't get lost.

## Recommendation

Build in this order:
1. **Demo GIF first** — needed for LinkedIn post and README. Show: agent switch without Holistic (re-explain everything) vs. with Holistic (agent reads, recaps, asks continue/tweak/new). Target 10-15 seconds, looping, auto-play friendly for social embeds.
2. **LinkedIn post** — lead with the pain (switching agents = lost context), show the GIF, explain the "one command, shared memory" value prop, link to GitHub + npm. Save as draft for user review before posting.
3. **Support infrastructure** — GitHub issue templates (bug report, feature request, question), SUPPORT.md or FAQ.md for common early adopter questions, explicit beta feedback invitation in README.

No need for a full video walkthrough yet — the existing `docs/handoff-walkthrough.md` is solid written documentation. A GIF is sufficient for social proof and quick comprehension.

## Implementation Landscape

### Key Files

- `README.md` — already has strong value prop and getting-started flow; needs demo GIF embedded near top and beta feedback callout added
- `docs/handoff-walkthrough.md` — existing written walkthrough; reference this when scripting the demo
- `.github/ISSUE_TEMPLATE/` — does not exist; needs bug report, feature request, and general question templates
- `SUPPORT.md` or `docs/SUPPORT.md` — does not exist; needs early adopter support plan and feedback channels
- Package already published at 0.5.2, so this is post-launch polish rather than pre-launch prep

### Build Order

**T01: Create demo GIF**
- Script the demo flow: show agent switch pain (Codex → Claude without Holistic = re-explain), then same switch with Holistic (agent auto-resumes from handoff)
- Record 10-15 second GIF using tool like LICEcap (free, cross-platform), Screen Studio (Mac, polished), or Supademo (web-based, annotations)
- Optimize for file size (<2MB ideal for social/email embeds) and loop smoothly
- Save as `docs/demo.gif` or `assets/demo.gif`
- Embed in README near top (after ASCII banner, before "The problem" section)

**T02: Draft LinkedIn post**
- Lead with problem: "If you use more than one AI coding assistant, you know the context tax — every session starts with re-explaining what happened last time."
- Show demo GIF inline
- Explain solution: "Holistic gives your repo shared memory. One bootstrap command, then every agent can see what happened before."
- Link to GitHub repo and npm package
- Save as `docs/launch/linkedin-post.md` for user review before posting

**T03: Set up support infrastructure**
- Create `.github/ISSUE_TEMPLATE/bug_report.md` — follows GitHub's standard format with environment info (Node version, OS, Holistic version)
- Create `.github/ISSUE_TEMPLATE/feature_request.md` — standard format with use case + benefit sections
- Create `.github/ISSUE_TEMPLATE/question.md` — lightweight template for general questions
- Create `SUPPORT.md` — points to GitHub issues for bugs/features, mentions `holistic --help` and README for common questions
- Add beta feedback callout to README: "Holistic is in active development (0.x). Early feedback helps — see SUPPORT.md or open an issue."

### Verification Approach

- **Demo GIF:** File size <2MB, loops smoothly, clearly shows problem/solution contrast, embeds correctly in README preview
- **LinkedIn post:** User reviews draft, confirms it's accurate and not cringe
- **Support infrastructure:** Issue templates render correctly in GitHub UI, SUPPORT.md is linked from README

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Demo GIF creation | LICEcap, Screen Studio, Supademo, ScreenSnap Pro | These tools auto-optimize GIF file size, handle looping, add annotations/zoom — don't try to script ffmpeg manually |
| GitHub issue templates | GitHub's standard YAML frontmatter format | GitHub parses these automatically in the "New Issue" UI — no custom tooling needed |

## Constraints

- Demo GIF must be <2MB for reliable social/email embeds and fast README load times
- LinkedIn post should be 150-300 words max — platform favors brevity + visual
- Issue templates must use GitHub's YAML frontmatter format to render in "New Issue" UI

## Common Pitfalls

- **Feature-first communication** — don't lead with "Holistic has X features." Lead with "You're tired of re-explaining your project to every new agent. Here's why."
- **Over-produced demo** — a 45-second polished video with music and transitions is harder to embed and less likely to be watched than a 12-second GIF
- **Missing the beta feedback loop** — without explicit templates and support channels, early adopter feedback gets scattered across email, Twitter DMs, random Slack messages, and is lost

## Sources

- Demo tool landscape from web search: <cite index="14-1,14-2,14-3">LICEcap is free, open-source, and easy to use for creating GIF screencasts, taking only 15 minutes from first install to completed image</cite>
- <cite index="18-9,18-17">Screen Studio (Mac-only) is highly recommended by developers for product demos and feature videos, with users describing it as "exactly what I was looking for" and "one of the best screen-recording apps"</cite>
- <cite index="16-14,16-22">Supademo builds interactive demos first then exports polished GIFs with controlled timing and annotations, producing lightweight looping files for emails and social media</cite>
- npm launch best practices from web search: <cite index="6-13,6-14">"Building npm packages in 2026 doesn't have to be complicated. Focus on the tools that matter, avoid over-configuration, and ship quality code."</cite>
- Product demo GIF best practices: <cite index="19-25,19-27,19-28,19-29">"Focus on one specific feature or action. Keep duration between 3–10 seconds. Optimize for mobile screens and test across devices. Use annotations to highlight key steps."</cite>
