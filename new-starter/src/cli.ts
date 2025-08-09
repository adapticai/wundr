#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { version } from '../package.json';
import { ConfigCommand } from './commands/config';
import { SetupCommand } from './commands/setup';
import { ValidateCommand } from './commands/validate';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('new-starter')
  .description('Automated development environment setup for Node.js engineers')
  .version(version, '-v, --version')
  .option('-V, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress all output except errors');

// Setup command
program
  .command('setup')
  .description('Setup development environment')
  .option('-e, --email <email>', 'Email address for configuration')
  .option('-u, --github-username <username>', 'GitHub username')
  .option('-g, --github-email <email>', 'GitHub email')
  .option('-n, --name <name>', 'Full name for Git configuration')
  .option('-c, --company <company>', 'Company name')
  .option('-r, --root-dir <dir>', 'Root directory for development', '~/Development')
  .option('-s, --skip-prompts', 'Skip all confirmation prompts')
  .option('--only <tools>', 'Install only specified tools (comma-separated)')
  .option('--exclude <tools>', 'Exclude specified tools (comma-separated)')
  .action(async (options) => {
    try {
      const setupCommand = new SetupCommand(options);
      await setupCommand.execute();
    } catch (error) {
      logger.error('Setup failed:', error);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate installation and environment')
  .option('--fix', 'Attempt to fix issues automatically')
  .action(async (options) => {
    try {
      const validateCommand = new ValidateCommand(options);
      await validateCommand.execute();
    } catch (error) {
      logger.error('Validation failed:', error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .option('--list', 'List all configuration values')
  .option('--get <key>', 'Get a configuration value')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--reset', 'Reset to default configuration')
  .action(async (options) => {
    try {
      const configCommand = new ConfigCommand(options);
      await configCommand.execute();
    } catch (error) {
      logger.error('Config operation failed:', error);
      process.exit(1);
    }
  });

// Interactive mode (default)
program
  .command('interactive', { isDefault: true })
  .description('Run in interactive mode')
  .action(async () => {
    try {
      logger.info(chalk.cyan('🚀 Welcome to New Starter!'));
      logger.info(chalk.gray('Setting up your development environment...\n'));
      
      const { default: inquirer } = await import('inquirer');
      
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔧 Setup new environment', value: 'setup' },
            { name: '✅ Validate existing setup', value: 'validate' },
            { name: '⚙️  Configure settings', value: 'config' },
            { name: '📖 View documentation', value: 'docs' },
            { name: '❌ Exit', value: 'exit' }
          ]
        }
      ]);
      
      switch (answers.action) {
        case 'setup': {
          const setupCommand = new SetupCommand({
            rootDir: '~/Development',
            skipPrompts: false,
            verbose: false
          });
          await setupCommand.execute();
          break;
        }
        case 'validate': {
          const validateCommand = new ValidateCommand({ fix: false });
          await validateCommand.execute();
          break;
        }
        case 'config': {
          const configCommand = new ConfigCommand({ list: true });
          await configCommand.execute();
          break;
        }
        case 'docs': {
          logger.info(chalk.cyan('\n📚 Documentation: https://github.com/adapticai/new-starter'));
          break;
        }
        case 'exit': {
          logger.info(chalk.green('\nGoodbye! 👋'));
          process.exit(0);
        }
      }
    } catch (error) {
      logger.error('Interactive mode failed:', error);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (process.argv.slice(2).length === 0) {
  program.outputHelp();
}