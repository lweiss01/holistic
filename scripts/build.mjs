#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, cpSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

const STAGING_DIR = '.tmp-build-src';
const TSCONFIG_REPLACEMENT = '.tmp-tsconfig.json';

function walkDir(dir, callback) {
  if (!statSync(dir).isDirectory()) return;
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

function swapExtensions(dir, from, to) {
  console.log(`Swapping imports in ${dir}: .${from} → .${to}`);
  walkDir(dir, filepath => {
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

// Ensure the build process is safe and non-mutating for the source code
try {
  console.log('Preparing non-mutating build staging area...');
  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });
  cpSync('src', STAGING_DIR, { recursive: true });

  // Swap .ts → .js for compilation in the STAGING directory only
  swapExtensions(STAGING_DIR, 'ts', 'js');

  // Create a temporary tsconfig that points to the staging directory
  let tsconfigStr = readFileSync('tsconfig.json', 'utf8');
  if (tsconfigStr.charCodeAt(0) === 0xFEFF) {
    tsconfigStr = tsconfigStr.slice(1);
  }
  const tsconfig = JSON.parse(tsconfigStr);
  tsconfig.compilerOptions.rootDir = STAGING_DIR;
  tsconfig.include = [`${STAGING_DIR}/**/*.ts`];
  writeFileSync(TSCONFIG_REPLACEMENT, JSON.stringify(tsconfig, null, 2));

  // Run TypeScript compiler using the staged source
  console.log('Running tsc against staged source...');
  execSync(`npx tsc -p ${TSCONFIG_REPLACEMENT}`, { stdio: 'inherit' });
  
  console.log('✓ Build complete!');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
} finally {
  // Cleanup staging artifacts
  try {
    rmSync(STAGING_DIR, { recursive: true, force: true });
    rmSync(TSCONFIG_REPLACEMENT, { force: true });
  } catch (cleanupErr) {
    console.warn('Warning: Failed to cleanup staging directory:', cleanupErr.message);
  }
}
