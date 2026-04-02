#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GifWriter } from 'omggif';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Small dimensions for minimal file size
const W = 600;
const H = 400;

// Build 16-color palette (power of 2)
const pal = [
  30, 30, 30,       // 0: dark bg
  212, 212, 212,    // 1: light text
  106, 115, 125,    // 2: dim text
  86, 156, 214,     // 3: accent (blue)
  78, 201, 176,     // 4: success (green)
  206, 145, 120,    // 5: warning (orange)
  0, 0, 0,          // 6-15: unused
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0,
];

// Create simple text frame
function makeFrame(colorIndex) {
  const frame = new Uint8Array(W * H);
  frame.fill(0); // Background

  // Draw a simple colored bar as a placeholder for text
  const barY = 150;
  const barHeight = 100;
  for (let y = barY; y < barY + barHeight && y < H; y++) {
    for (let x = 50; x < W - 50; x++) {
      frame[y * W + x] = colorIndex;
    }
  }

  return frame;
}

console.log('Generating demo.gif...');

const buf = Buffer.alloc(1024 * 1024); // 1MB buffer
const gif = new GifWriter(buf, W, H, { loop: 0, palette: pal });

// Scene 1: WITHOUT Holistic (dim/warning colors)
gif.addFrame(0, 0, W, H, makeFrame(2), { delay: 200 }); // 2s
gif.addFrame(0, 0, W, H, makeFrame(5), { delay: 150 }); // 1.5s
gif.addFrame(0, 0, W, H, makeFrame(2), { delay: 200 }); // 2s

// Scene 2: WITH Holistic (success colors)
gif.addFrame(0, 0, W, H, makeFrame(3), { delay: 150 }); // 1.5s
gif.addFrame(0, 0, W, H, makeFrame(4), { delay: 200 }); // 2s
gif.addFrame(0, 0, W, H, makeFrame(4), { delay: 200 }); // 2s

const outPath = join(__dirname, '..', 'docs', 'demo.gif');
const data = buf.subarray(0, gif.end());
writeFileSync(outPath, data);

console.log(`✅ Created: ${outPath} (${data.length} bytes)`);
