#!/usr/bin/env node

import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import GIFEncoder from 'gif-encoder-2';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 800;
const HEIGHT = 500;

// Colors
const BG = [30, 30, 30];
const TEXT = [212, 212, 212];
const DIM = [106, 115, 125];
const ACCENT = [86, 156, 214];
const SUCCESS = [78, 201, 176];
const WARNING = [206, 145, 120];

// Simple pixel font (8x8 bitmap for key characters)
const CHARS = {
  'W': [0b01000010, 0b01000010, 0b01000010, 0b01010010, 0b01010010, 0b01101010, 0b01101010, 0b01000010],
  'I': [0b01111110, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b01111110],
  'T': [0b01111110, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000, 0b00011000],
  'H': [0b01000010, 0b01000010, 0b01000010, 0b01111110, 0b01000010, 0b01000010, 0b01000010, 0b01000010],
  'O': [0b00111100, 0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b00111100],
  'U': [0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b01000010, 0b00111100],
  'N': [0b01000010, 0b01100010, 0b01100010, 0b01010010, 0b01010010, 0b01001010, 0b01001010, 0b01000110],
  ' ': [0, 0, 0, 0, 0, 0, 0, 0],
  '✨': [0b00100100, 0b00011000, 0b01111110, 0b00011000, 0b00100100, 0b01000010, 0b00000000, 0b00000000],
  '😵': [0b00111100, 0b01000010, 0b01011010, 0b01000010, 0b01111110, 0b01000010, 0b01000010, 0b00111100],
};

function drawText(pixels, text, x, y, color) {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const bitmap = CHARS[char] || CHARS[' '];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (bitmap[row] & (1 << (7 - col))) {
          const px = x + i * 9 + col;
          const py = y + row;
          if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
            const idx = (py * WIDTH + px) * 4;
            pixels[idx] = color[0];
            pixels[idx + 1] = color[1];
            pixels[idx + 2] = color[2];
            pixels[idx + 3] = 255;
          }
        }
      }
    }
  }
}

function makeFrame(title, icon, barColor) {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  
  // Fill background
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = BG[0];
    pixels[i + 1] = BG[1];
    pixels[i + 2] = BG[2];
    pixels[i + 3] = 255;
  }
  
  // Draw title
  drawText(pixels, title, 50, 50, TEXT);
  
  // Draw icon
  drawText(pixels, icon, WIDTH - 150, 50, barColor);
  
  // Draw content area (represents terminal output)
  const barY = 200;
  const barH = 120;
  const barX = 60;
  const barW = WIDTH - 120;
  
  for (let y = barY; y < barY + barH; y++) {
    for (let x = barX; x < barX + barW; x++) {
      const idx = (y * WIDTH + x) * 4;
      // Gradient effect
      const fade = Math.max(0.3, 1 - (y - barY) / barH);
      pixels[idx] = Math.floor(barColor[0] * fade);
      pixels[idx + 1] = Math.floor(barColor[1] * fade);
      pixels[idx + 2] = Math.floor(barColor[2] * fade);
      pixels[idx + 3] = 255;
    }
  }
  
  return pixels;
}

async function generateGif() {
  console.log('Generating enhanced demo.gif...');
  
  const encoder = new GIFEncoder(WIDTH, HEIGHT);
  const outPath = join(__dirname, '..', 'docs', 'demo.gif');
  const stream = createWriteStream(outPath);
  
  encoder.createReadStream().pipe(stream);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(12); // Good quality
  
  // Scene 1: WITHOUT Holistic
  encoder.setDelay(2000);
  encoder.addFrame(makeFrame('WITHOUT HOLISTIC', '😵', WARNING));
  
  encoder.setDelay(1500);
  encoder.addFrame(makeFrame('WITHOUT HOLISTIC', '😵', [200, 100, 100]));
  
  encoder.setDelay(2000);
  encoder.addFrame(makeFrame('WITHOUT HOLISTIC', '😵', [180, 80, 80]));
  
  // Transition
  encoder.setDelay(500);
  encoder.addFrame(makeFrame('', ' ', BG));
  
  // Scene 2: WITH Holistic
  encoder.setDelay(2000);
  encoder.addFrame(makeFrame('WITH HOLISTIC', '✨', ACCENT));
  
  encoder.setDelay(1500);
  encoder.addFrame(makeFrame('WITH HOLISTIC', '✨', SUCCESS));
  
  encoder.setDelay(2500);
  encoder.addFrame(makeFrame('WITH HOLISTIC', '✨', [50, 220, 150]));
  
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
