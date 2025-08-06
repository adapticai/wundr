#!/usr/bin/env node

/**
 * Main entry point for monorepo refactoring toolkit CLI
 */

import { Command } from 'commander';

interface CommandOptions {
  path?: string;
  config?: string;
  type?: string;
  pattern?: string;
  fix?: boolean;
  name?: string;
}

const program = new Command();

program
  .name('wundr')
  .description('Monorepo Refactoring Toolkit')
  .version('1.0.0');

// Analysis command
program
  .command('analyze')
  .description('Analyze codebase for refactoring opportunities')
  .option('-p, --path <path>', 'Path to analyze', process.cwd())
  .action(async (options: CommandOptions) => {
    try {
      console.log('Starting analysis...');
      console.log('Running enhanced AST analyzer on:', options.path);
      
      // For now, just run the analysis script
      const { execSync } = await import('child_process');
      execSync(`ts-node ${__dirname}/analysis/enhanced-ast-analyzer.ts ${options.path}`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      process.exit(1);
    }
  });

// Consolidation command
program
  .command('consolidate')
  .description('Consolidate duplicate code and patterns')
  .option('-c, --config <file>', 'Configuration file for consolidation')
  .action(async (options: CommandOptions) => {
    try {
      console.log('Starting consolidation...');
      console.log('Config file:', options.config || 'default');
      
      const { execSync } = await import('child_process');
      execSync(`bash ${__dirname}/consolidation/merge-duplicates.sh`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('Consolidation failed:', error);
      process.exit(1);
    }
  });

// Governance command
program
  .command('governance')
  .description('Run governance checks and generate reports')
  .option('-t, --type <type>', 'Type of governance check', 'all')
  .action(async (options: CommandOptions) => {
    try {
      console.log('Running governance checks...');
      console.log('Check type:', options.type);
      
      const { execSync } = await import('child_process');
      execSync(`ts-node ${__dirname}/governance/drift-detection.ts`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('Governance check failed:', error);
      process.exit(1);
    }
  });

// Standardization command
program
  .command('standardize')
  .description('Apply coding standards and patterns')
  .option('-p, --pattern <pattern>', 'Pattern to apply')
  .option('-f, --fix', 'Auto-fix issues', false)
  .action(async (options: CommandOptions) => {
    try {
      console.log('Applying standards...');
      console.log('Pattern:', options.pattern || 'all');
      console.log('Auto-fix:', options.fix ? 'enabled' : 'disabled');
      
      const { execSync } = await import('child_process');
      execSync(`ts-node ${__dirname}/standardization/auto-fix-patterns.ts`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('Standardization failed:', error);
      process.exit(1);
    }
  });

// Monorepo setup command
program
  .command('setup')
  .description('Setup monorepo structure')
  .option('-n, --name <name>', 'Monorepo name', '@lumic/wundr')
  .action(async (options: CommandOptions) => {
    try {
      console.log('Setting up monorepo...');
      console.log('Monorepo name:', options.name);
      
      const { execSync } = await import('child_process');
      execSync(`ts-node ${__dirname}/monorepo/monorepo-setup.ts`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('Setup failed:', error);
      process.exit(1);
    }
  });

// Interactive mode (default)
program
  .command('interactive', { isDefault: true })
  .description('Start interactive mode')
  .action(() => {
    console.log('Welcome to Monorepo Refactoring Toolkit!');
    console.log('\nAvailable commands:');
    console.log('  analyze     - Analyze codebase for refactoring opportunities');
    console.log('  consolidate - Consolidate duplicate code and patterns');
    console.log('  governance  - Run governance checks and generate reports');
    console.log('  standardize - Apply coding standards and patterns');
    console.log('  setup       - Setup monorepo structure');
    console.log('\nRun "wundr <command> --help" for more information');
  });

program.parse(process.argv);