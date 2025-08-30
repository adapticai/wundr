#!/usr/bin/env node

/**
 * Wundr Claude CLI - Dynamic CLAUDE.md Generator and Repository Setup
 * 
 * This CLI provides comprehensive tools for setting up and configuring
 * Claude Code integration in any repository with intelligent detection
 * and customization capabilities.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createClaudeInitCommand } from './commands/claude-init.js';
import { createClaudeAuditCommand } from './commands/claude-audit.js';  
import { createClaudeSetupCommand } from './commands/claude-setup.js';

const program = new Command();

program
  .name('wundr')
  .description('Wundr CLI - Intelligent Claude Code Configuration')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-color', 'Disable colored output');

// Add Claude-specific commands
program.addCommand(createClaudeInitCommand());
program.addCommand(createClaudeAuditCommand());
program.addCommand(createClaudeSetupCommand());

// Global command for quick setup
program
  .command('init')
  .description('Quick initialization of Claude Code in current directory')
  .option('-a, --audit', 'Run audit first')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Quick Claude Code Initialization'));
    console.log(chalk.blue('==================================='));
    
    try {
      // Import and run the initialization
      const { ClaudeConfigGenerator } = await import('../claude-generator/claude-config-generator.js');
      const generator = new ClaudeConfigGenerator(process.cwd());
      
      if (options.audit) {
        console.log(chalk.yellow('📊 Running repository audit...'));
        const auditResult = await generator.auditRepository();
        console.log(`Score: ${auditResult.score}/100`);
        
        if (auditResult.issues.length > 0) {
          console.log(chalk.yellow(`Found ${auditResult.issues.length} issues to address.`));
        }
      }
      
      console.log(chalk.yellow('📄 Generating CLAUDE.md...'));
      const claudeContent = await generator.generateClaudeMarkdown();
      
      // Write the file
      const fs = await import('fs');
      const path = await import('path');
      const claudeFilePath = path.join(process.cwd(), 'CLAUDE.md');
      
      fs.writeFileSync(claudeFilePath, claudeContent, 'utf-8');
      
      console.log(chalk.green('✅ CLAUDE.md created successfully!'));
      console.log(chalk.blue(`📍 Location: ${claudeFilePath}`));
      
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log('1. Review and customize CLAUDE.md');
      console.log('2. Run: wundr claude-setup (for full setup)');
      console.log('3. Set up MCP tools: cd mcp-tools && ./install.sh');
      
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Help command enhancement
program
  .command('help-claude')
  .description('Comprehensive help for Claude Code integration')
  .action(() => {
    console.log(chalk.blue('🤖 Wundr Claude Code Integration Guide'));
    console.log(chalk.blue('====================================='));
    
    console.log(chalk.yellow('\n📋 Available Commands:'));
    console.log('• wundr init                 - Quick CLAUDE.md generation');
    console.log('• wundr claude-init          - Full initialization with options');
    console.log('• wundr claude-audit         - Comprehensive repository audit');
    console.log('• wundr claude-setup         - Complete setup with all tools');
    
    console.log(chalk.yellow('\n🔧 Common Workflows:'));
    console.log(chalk.green('New Project Setup:'));
    console.log('  wundr claude-setup --template=typescript');
    console.log('  # Complete setup with TypeScript template');
    
    console.log(chalk.green('\nExisting Project:'));
    console.log('  wundr claude-audit --detailed');
    console.log('  wundr claude-init --interactive');
    console.log('  # Audit first, then interactive setup');
    
    console.log(chalk.green('\nMonorepo Setup:'));
    console.log('  wundr claude-setup --template=monorepo');
    console.log('  # Specialized monorepo configuration');
    
    console.log(chalk.yellow('\n📊 Audit Features:'));
    console.log('• Project type detection (React, Node.js, TypeScript, etc.)');
    console.log('• Quality standards analysis (linting, testing, formatting)');
    console.log('• Security vulnerability scanning');
    console.log('• Performance optimization recommendations');
    console.log('• Agent configuration suggestions');
    
    console.log(chalk.yellow('\n🤖 Agent Types by Project:'));
    console.log('• React/Next.js: ui-designer, accessibility-tester, performance-optimizer');
    console.log('• Node.js: api-designer, security-auditor, database-architect');
    console.log('• Monorepo: package-coordinator, build-orchestrator, version-manager');
    console.log('• CLI: ux-designer, help-writer, platform-tester');
    
    console.log(chalk.yellow('\n🔧 MCP Tools:'));
    console.log('• drift_detection - Monitor code quality drift');
    console.log('• pattern_standardize - Auto-fix code patterns');
    console.log('• dependency_analyze - Analyze dependencies');
    console.log('• test_baseline - Manage test coverage');
    console.log('• monorepo_manage - Monorepo coordination');
    
    console.log(chalk.yellow('\n📚 Resources:'));
    console.log('• Documentation: ./docs/CLAUDE_CODE_INTEGRATION.md');
    console.log('• Templates: ./templates/');
    console.log('• Examples: ./examples/');
    
    console.log(chalk.green('\n✨ Need help? Run any command with --help for detailed options!'));
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err: any) {
  if (err.code === 'commander.help' || err.code === 'commander.version') {
    process.exit(0);
  }
  
  console.error(chalk.red('❌ Command failed:'));
  console.error(chalk.red(err.message || String(err)));
  process.exit(1);
}

// If no command provided, show help
if (!process.argv.slice(2).length) {
  console.log(chalk.blue('🤖 Wundr - Intelligent Claude Code Configuration'));
  console.log(chalk.blue('=============================================='));
  console.log(chalk.yellow('\nQuick start: wundr init'));
  console.log(chalk.yellow('Full setup:  wundr claude-setup'));
  console.log(chalk.yellow('Get help:    wundr help-claude'));
  console.log(chalk.gray('\nRun with --help for all options'));
}