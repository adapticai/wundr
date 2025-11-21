#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import figlet from 'figlet';

import { version } from '../package.json';
import { WundrCLI } from './cli';
import { errorHandler } from './utils/error-handler';
import { logger } from './utils/logger';

/**
 * Main CLI entry point
 * Initializes the Wundr CLI with all commands and interactive modes
 */
async function main() {
  try {
    // Display banner
    console.log(
      chalk.cyan(
        figlet.textSync('WUNDR', {
          font: 'ANSI Shadow',
          horizontalLayout: 'fitted',
          verticalLayout: 'fitted',
        }),
      ),
    );

    console.log(
      chalk.gray(
        `The Intelligent CLI-Based Coding Agents Orchestrator v${version}\n`,
      ),
    );

    // Initialize CLI
    const cli = new WundrCLI();
    const program = cli.createProgram();

    // Parse arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    errorHandler.handle(error as Error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  errorHandler.handle(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  errorHandler.handle(reason as Error);
  process.exit(1);
});

// Execute main function
if (require.main === module) {
  main();
}

export { main };
