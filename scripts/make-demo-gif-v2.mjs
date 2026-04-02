#!/usr/bin/env node

import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import GIFEncoder from 'gif-encoder-2';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dimensions optimized for file size
const WIDTH = 600;
const HEIGHT = 400;

// Create colored frames (RGBA format)
function makeFrame(r, g, b, label) {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  
  // Fill background (dark)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 30;     // R
    pixels[i + 1] = 30; // G
    pixels[i + 2] = 30; // B
    pixels[i + 3] = 255; // A
  }
  
  // Draw a colored rectangle representing terminal output
  const rectX = 50;
  const rectY = 150;
  const rectW = WIDTH - 100;
  const rectH = 100;
  
  for (let y = rectY; y < rectY + rectH; y++) {
    for (let x = rectX; x < rectX + rectW; x++) {
      const idx = (y * WIDTH + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  
  return pixels;
}

async function generateGif() {
  console.log('Generating demo.gif...');
  
  const encoder = new GIFEncoder(WIDTH, HEIGHT);
  const outPath = join(__dirname, '..', 'docs', 'demo.gif');
  const stream = createWriteStream(outPath);
  
  encoder.createReadStream().pipe(stream);
  encoder.start();
  encoder.setRepeat(0); // Loop forever
  encoder.setQuality(15); // Balance between quality and size
  encoder.setDelay(500); // 500ms per frame
  
  // Scene 1: WITHOUT Holistic (red/orange tones)
  encoder.addFrame(makeFrame(206, 145, 120)); // Starting
  encoder.setDelay(1500);
  encoder.addFrame(makeFrame(200, 100, 100)); // User explaining
  encoder.setDelay(2000);
  encoder.addFrame(makeFrame(180, 80, 80)); // Context tax
  
  // Scene 2: WITH Holistic (green/blue tones)
  encoder.setDelay(1000);
  encoder.addFrame(makeFrame(86, 156, 214)); // Reading handoff
  encoder.setDelay(1500);
  encoder.addFrame(makeFrame(78, 201, 176)); // Auto-resume
  encoder.setDelay(2000);
  encoder.addFrame(makeFrame(50, 220, 150)); // Success
  
  encoder.finish();
  
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      console.log(`✅ Generated: ${outPath}`);
      resolve(outPath);
    });
    stream.on('error', reject);
  });
}

generateGif().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
