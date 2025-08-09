#!/usr/bin/env node

/**
 * Simple Wundr CLI for testing purposes
 */

const { program } = require('commander');
const packageJson = require('../package.json');

program
  .name('wundr')
  .description('Wundr - Intelligent CLI-Based Coding Agents Orchestrator')
  .version(packageJson.version);

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`Wundr v${packageJson.version}`);
  });

program
  .command('help')
  .description('Show help information')
  .action(() => {
    console.log('Wundr CLI Help:');
    console.log('  version    Show version');
    console.log('  help       Show this help');
    console.log('  analyze    Analyze project (coming soon)');
  });

program
  .command('analyze')
  .description('Analyze project structure (basic implementation)')
  .option('-p, --path <path>', 'Project path to analyze', '.')
  .action((options) => {
    console.log(`Analyzing project at: ${options.path}`);
    console.log('Analysis complete (basic implementation)');
  });

// If no command provided, show help
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);