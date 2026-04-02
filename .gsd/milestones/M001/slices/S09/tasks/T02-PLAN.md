---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Draft LinkedIn launch post

Write a 150-300 word LinkedIn post leading with the problem (context tax when switching AI agents), embedding the demo GIF, explaining the solution (shared repo memory with one bootstrap command), and linking to GitHub and npm. Save as markdown draft for user review before posting. Focus on pain/solution contrast, not feature lists.

## Inputs

- ``README.md``
- ``docs/demo.gif``

## Expected Output

- ``docs/launch/linkedin-post.md``

## Verification

test -f docs/launch/linkedin-post.md && [ $(wc -w < docs/launch/linkedin-post.md) -ge 100 ] && [ $(wc -w < docs/launch/linkedin-post.md) -le 400 ] && grep -q 'demo.gif' docs/launch/linkedin-post.md
