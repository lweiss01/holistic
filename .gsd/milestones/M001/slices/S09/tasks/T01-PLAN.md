---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Create demo GIF showing before/after workflow

Record a 10-15 second demo GIF showing the core problem/solution contrast: agent switch without Holistic (user re-explains everything) vs. with Holistic (agent auto-resumes from handoff, asks continue/tweak/new). Optimize for <2MB file size and loop smoothly for social media embeds. Embed in README near top.

## Inputs

- ``README.md``
- ``docs/handoff-walkthrough.md``

## Expected Output

- ``docs/demo.gif``
- ``README.md``

## Verification

test -f docs/demo.gif && [ $(stat -c%s docs/demo.gif 2>/dev/null || stat -f%z docs/demo.gif 2>/dev/null) -lt 2097152 ] && grep -q 'docs/demo.gif' README.md
