#!/usr/bin/env node

/**
 * Wundr Environment Manager CLI
 * Cross-platform development environment setup and management
 */

const { program } = require('../dist/cli/commands');

program.parseAsync(process.argv).catch(error => {
  console.error('CLI Error:', error);
  process.exit(1);
});