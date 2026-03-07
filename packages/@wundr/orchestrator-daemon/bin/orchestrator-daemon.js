#!/usr/bin/env node

/**
 * Orchestrator Daemon CLI entry point
 *
 * Resolution order:
 *   1. dist/cli/daemon-cli.js  (compiled daemon management CLI)
 *   2. dist/bin/cli.js         (legacy compiled CLI)
 *   3. src/cli/daemon-cli.ts   (development mode via ts-node/tsx)
 *   4. src/bin/cli.ts          (legacy development CLI)
 */

const path = require('path');
const fs = require('fs');

// Candidate paths in priority order
const candidates = [
  {
    js: path.join(__dirname, '../dist/cli/daemon-cli.js'),
    ts: path.join(__dirname, '../src/cli/daemon-cli.ts'),
  },
  {
    js: path.join(__dirname, '../dist/bin/cli.js'),
    ts: path.join(__dirname, '../src/bin/cli.ts'),
  },
];

for (const { js, ts } of candidates) {
  if (fs.existsSync(js)) {
    require(js);
    process.exit(0); // should not reach here (CLI handles its own exit)
  }

  if (fs.existsSync(ts)) {
    // Development mode: try tsx first, then ts-node
    const tsRunners = ['tsx/cjs', 'ts-node/register'];
    let loaded = false;
    for (const runner of tsRunners) {
      try {
        require(runner);
        require(ts);
        loaded = true;
        break;
      } catch {
        // try next runner
      }
    }

    if (!loaded) {
      console.error('Error: CLI not built. Run "npm run build" first.');
      console.error('\nFor development, install tsx or ts-node:');
      console.error('  npm install --save-dev tsx');
      process.exit(1);
    }
    process.exit(0);
  }
}

console.error('Error: No CLI entry point found. Run "npm run build" first.');
process.exit(1);
