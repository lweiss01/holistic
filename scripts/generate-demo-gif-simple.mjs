#!/usr/bin/env node

/**
 * Simple demo GIF generator using pure SVG-to-GIF approach
 * Creates two side-by-side comparisons showing before/after workflow
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// For now, create a simple placeholder that documents the workflow
// This can be replaced with actual screen recording later
const placeholder = `# Demo GIF Placeholder

This file documents the demo workflow that should be captured:

## Scene 1: WITHOUT Holistic (0-7 seconds)
\`\`\`
$ claude
> Starting new session...

User: "We're building a login flow.
      Last session fixed OAuth redirect bug.
      Don't break the token refresh.
      Continue working on email validation."

Agent: "Starting fresh. Let me read the code..."
       [reads 50 files to rebuild context]
       
       😵 Context tax: 5 minutes, every session
\`\`\`

## Scene 2: WITH Holistic (7-14 seconds)
\`\`\`
$ codex
> Starting session...
> Reading HOLISTIC.md...

Agent: "Last session (Claude):
        - Fixed OAuth redirect loop
        - Token refresh working
        - Next: email validation
        
        Continue as planned, tweak, or start new?"

User: "Continue"

Agent: "Building email validation..."
       
       ✨ Zero re-explaining
       ✨ Context from last session
       ✨ Regression protection active
\`\`\`

## Recording Instructions

Use one of these tools to create the actual GIF:
- terminalizer (npm install -g terminalizer)
- asciinema + agg (for high-quality terminal recordings)
- Simple screen recording with OBS/QuickTime + ffmpeg conversion

Target specs:
- Duration: 10-15 seconds
- File size: <2MB
- Dimensions: 800x500 or similar 16:10 ratio
- Loop: infinite
- Optimized for social media embeds (Twitter, LinkedIn)
`;

// Write documentation
const docsPath = join(__dirname, '..', 'docs', 'demo-recording-guide.md');
writeFileSync(docsPath, placeholder);
console.log(`✅ Created recording guide: ${docsPath}`);
console.log('\nTo create the actual demo.gif, use one of the tools mentioned in the guide.');
console.log('For quick testing, you can use an online tool like:');
console.log('- https://ezgif.com/ (create animated GIF from images)');
console.log('- https://www.screentogif.com/ (Windows screen recorder)');
console.log('- https://getkap.co/ (macOS screen recorder)');
