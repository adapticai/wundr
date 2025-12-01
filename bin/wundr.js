#!/usr/bin/env node

/**
 * Wundr CLI Entry Point
 * Main executable for the Wundr dashboard system
 */

const path = require('path');
const { existsSync } = require('fs');

// Check if we're in development or production
const isDev = existsSync(path.join(__dirname, '../src'));
const isTS = existsSync(path.join(__dirname, '../tsconfig.json'));

async function main() {
  try {
    if (isDev && isTS) {
      // Development mode - use ts-node
      require('ts-node').register({
        project: path.join(__dirname, '../tsconfig.json'),
        compilerOptions: {
          module: 'commonjs',
        },
      });

      // Import TypeScript files
      const {
        createCLIProgram,
      } = require('../src/integration/cli/DashboardCLI');
      const {
        createInitCommand,
      } = require('../src/integration/cli/InitCommand');

      const program = createCLIProgram();

      // Add init-dashboard command
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      // Parse arguments
      await program.parseAsync(process.argv);
    } else {
      // Production mode - use compiled JavaScript
      const {
        createCLIProgram,
      } = require('../dist/integration/cli/DashboardCLI');
      const {
        createInitCommand,
      } = require('../dist/integration/cli/InitCommand');

      const program = createCLIProgram();

      // Add init-dashboard command
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      // Parse arguments
      await program.parseAsync(process.argv);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
