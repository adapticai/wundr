#!/usr/bin/env node

/**
 * Wundr Claude CLI Binary
 * Entry point for the dynamic CLAUDE.md generator system
 */

import('../dist/cli/wundr-claude.js').catch((error) => {
  console.error('Failed to load Wundr Claude CLI:', error.message);
  process.exit(1);
});