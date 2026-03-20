#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  files.forEach(file => {
    const filepath = join(dir, file);
    const stat = statSync(filepath);
    if (stat.isDirectory()) {
      walkDir(filepath, callback);
    } else if (stat.isFile()) {
      callback(filepath);
    }
  });
}

function swapExtensions(from, to) {
  console.log(`Swapping imports: .${from} → .${to}`);
  walkDir('src', filepath => {
    if (extname(filepath) === '.ts') {
      const content = readFileSync(filepath, 'utf8');
      const regex = new RegExp(`from ['"]((?:\\.{1,2}/).+)\\.${from}['"]`, 'g');
      const updated = content.replace(regex, `from '$1.${to}'`);
      if (content !== updated) {
        writeFileSync(filepath, updated, 'utf8');
      }
    }
  });
}

// Swap .ts → .js for compilation
swapExtensions('ts', 'js');

// Run TypeScript compiler
console.log('Running tsc...');
execSync('tsc', { stdio: 'inherit' });

// Swap .js → .ts to restore source
swapExtensions('js', 'ts');

console.log('✓ Build complete!');
