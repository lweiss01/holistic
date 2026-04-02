#!/usr/bin/env node

/**
 * Generate demo GIF showing Holistic before/after workflow
 * Uses omggif for pure-JS GIF encoding
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GifWriter } from 'omggif';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dimensions optimized for social media
const WIDTH = 800;
const HEIGHT = 500;
const FRAME_DELAY_CENTISECONDS = 10; // 10 centiseconds = 100ms = 10 FPS

// Simple color palette (RGB)
const COLORS = {
  bg: [30, 30, 30],      // Dark background
  text: [212, 212, 212], // Light gray text
  dim: [106, 115, 125],  // Dimmed text
  accent: [86, 156, 214], // Blue accent
  success: [78, 201, 176], // Green success
  warning: [206, 145, 120], // Orange warning
};

// Create a simple indexed color palette for GIF
const PALETTE = [];
for (let i = 0; i < 256; i++) {
  if (i === 0) PALETTE.push(...COLORS.bg); // Background
  else if (i === 1) PALETTE.push(...COLORS.text); // Normal text
  else if (i === 2) PALETTE.push(...COLORS.dim); // Dim text
  else if (i === 3) PALETTE.push(...COLORS.accent); // Accent
  else if (i === 4) PALETTE.push(...COLORS.success); // Success
  else if (i === 5) PALETTE.push(...COLORS.warning); // Warning
  else PALETTE.push(0, 0, 0); // Fill rest with black
}

// Scenes with delays in milliseconds
const scenes = [
  {
    title: 'WITHOUT Holistic',
    emoji: '😵',
    titleColor: 1,
    frames: [
      { delay: 2000, lines: [{ text: '$ claude', color: 4 }] },
      { delay: 1500, lines: [
        { text: '$ claude', color: 4 },
        { text: '> Starting new session...', color: 2 }
      ]},
      { delay: 3000, lines: [
        { text: '$ claude', color: 4 },
        { text: '> Starting new session...', color: 2 },
        { text: '', color: 0 },
        { text: 'User: "We\'re building a login flow.', color: 5 },
        { text: '      Last session fixed OAuth redirect.', color: 5 },
        { text: '      Continue email validation."', color: 5 }
      ]},
      { delay: 2500, lines: [
        { text: 'Agent: "Starting fresh. Let me read..."', color: 3 },
        { text: '       [reads 50 files to rebuild context]', color: 2 },
        { text: '', color: 0 },
        { text: '       Context tax: 5 min, every session', color: 2 }
      ]},
    ],
  },
  {
    title: 'WITH Holistic',
    emoji: '✨',
    titleColor: 4,
    frames: [
      { delay: 2000, lines: [{ text: '$ codex', color: 4 }] },
      { delay: 1500, lines: [
        { text: '$ codex', color: 4 },
        { text: '> Starting session...', color: 2 },
        { text: '> Reading HOLISTIC.md...', color: 2 }
      ]},
      { delay: 3000, lines: [
        { text: 'Agent: "Last session (Claude):', color: 3 },
        { text: '        - Fixed OAuth redirect loop', color: 1 },
        { text: '        - Token refresh working', color: 1 },
        { text: '        - Next: email validation', color: 1 },
        { text: '', color: 0 },
        { text: '        Continue, tweak, or start new?"', color: 3 }
      ]},
      { delay: 2500, lines: [
        { text: 'User: "Continue"', color: 5 },
        { text: '', color: 0 },
        { text: 'Agent: "Building email validation..."', color: 3 },
        { text: '', color: 0 },
        { text: '       Zero re-explaining', color: 4 },
        { text: '       Context from last session', color: 4 },
        { text: '       Regression protection active', color: 4 }
      ]},
    ],
  },
];

// Simple text rendering to pixel array
function createFramePixels(scene, frameData) {
  const pixels = new Uint8Array(WIDTH * HEIGHT);
  pixels.fill(0); // Fill with background color

  // Title area (simplified - just use background)
  const titleY = 10;
  
  // Content area starts lower
  const contentStartY = 100;
  const lineHeight = 25;

  frameData.lines.forEach((line, index) => {
    const y = contentStartY + (index * lineHeight);
    // For simplicity, fill entire line with the color index
    for (let x = 40; x < Math.min(WIDTH - 40, 40 + line.text.length * 8); x++) {
      for (let dy = 0; dy < 16; dy++) {
        const pixelY = y + dy;
        if (pixelY >= 0 && pixelY < HEIGHT) {
          pixels[pixelY * WIDTH + x] = line.color;
        }
      }
    }
  });

  return pixels;
}

async function generateGif() {
  console.log('Generating demo.gif...');

  const buf = Buffer.alloc(WIDTH * HEIGHT * scenes.flatMap(s => s.frames).length * 2); // Allocate buffer
  const gif = new GifWriter(buf, WIDTH, HEIGHT, { loop: 0, palette: PALETTE });

  let frameIndex = 0;

  // Generate frames for each scene
  for (const scene of scenes) {
    for (const frameData of scene.frames) {
      const pixels = createFramePixels(scene, frameData);
      const delayInCentiseconds = Math.floor(frameData.delay / 10);
      
      gif.addFrame(0, 0, WIDTH, HEIGHT, pixels, {
        delay: Math.min(delayInCentiseconds, 1000), // Cap at 100 seconds
        disposal: 2, // Restore to background
      });
      
      frameIndex++;
    }
  }

  // Write to file
  const outputPath = join(__dirname, '..', 'docs', 'demo.gif');
  const gifData = buf.subarray(0, gif.end());
  writeFileSync(outputPath, gifData);

  const fileSizeKB = (gifData.length / 1024).toFixed(2);
  console.log(`✅ Generated: ${outputPath} (${fileSizeKB} KB)`);
  
  if (gifData.length > 2 * 1024 * 1024) {
    console.warn(`⚠️  File size ${fileSizeKB} KB exceeds 2MB target`);
  }

  return outputPath;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateGif().catch((err) => {
    console.error('Failed to generate GIF:', err);
    console.error(err.stack);
    process.exit(1);
  });
}

export { generateGif };
