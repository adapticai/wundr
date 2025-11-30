#!/usr/bin/env node

/**
 * Orchestrator Daemon CLI entry point
 *
 * This is a lightweight wrapper that loads the compiled TypeScript CLI.
 */

// Check if running from development or production
const path = require('path');
const fs = require('fs');

// Try to load from dist first (production)
const distPath = path.join(__dirname, '../dist/bin/cli.js');
const srcPath = path.join(__dirname, '../src/bin/cli.ts');

if (fs.existsSync(distPath)) {
  // Production mode - use compiled version
  require(distPath);
} else if (fs.existsSync(srcPath)) {
  // Development mode - use ts-node if available
  try {
    require('ts-node/register');
    require(srcPath);
  } catch (error) {
    console.error('Error: CLI not built. Run "npm run build" first.');
    console.error('\nOr install ts-node for development mode:');
    console.error('  npm install --save-dev ts-node\n');
    process.exit(1);
  }
} else {
  console.error('Error: CLI files not found. Please reinstall the package.');
  process.exit(1);
}
