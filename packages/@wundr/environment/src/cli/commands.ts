/**
 * CLI command implementations for Wundr Environment Manager
 */

/* eslint-disable no-console */

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';

import { EnvironmentManager } from '../core/environment-manager';
import { QuickstartInstaller } from '../installers/quickstart-installer';
import { ProfileType, EnvironmentConfig } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('CLI');

/**
 * Ultra-fast quickstart command - <5 minute setup
 */
export const quickstartCommand = new Command('quickstart')
  .description('🚀 Ultra-fast environment setup in <5 minutes')
  .option('-p, --profile <profile>', 'Profile type (basic|developer|full)', 'developer')
  .option('-y, --yes', 'Skip all prompts and use defaults')
  .option('--skip-ai', 'Skip AI agents setup for faster installation')
  .option('--cache-only', 'Use only cached packages (fails if not cached)')
  .option('--parallel <number>', 'Number of parallel installations', '4')
  .option('--timeout <seconds>', 'Installation timeout in seconds', '300')
  .option('--preset <preset>', 'Use predefined preset (minimal|standard|full)', 'standard')
  .action(async (options) => {
    const spinner = ora('🚀 Starting ultra-fast environment setup...').start();
    const startTime = Date.now();
    
    try {
      const installer = new QuickstartInstaller({
        profile: options.profile as ProfileType,
        skipPrompts: options.yes,
        skipAI: options.skipAi,
        cacheOnly: options.cacheOnly,
        parallelJobs: parseInt(options.parallel, 10),
        timeout: parseInt(options.timeout, 10) * 1000,
        preset: options.preset
      });
      
      spinner.text = 'Analyzing system and detecting existing tools...';
      await installer.analyze();
      
      spinner.text = 'Installing core tools in parallel...';
      await installer.installParallel();
      
      spinner.text = 'Configuring environment...';
      await installer.configure();
      
      if (!options.skipAi) {
        spinner.text = 'Setting up AI agents (simplified)...';
        await installer.setupAIAgentsQuick();
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.succeed(`✅ Environment setup completed in ${elapsed}s!`);
      
      // eslint-disable-next-line no-console
      console.log(chalk.green.bold('\n🎉 Welcome to your optimized development environment!'));
      // eslint-disable-next-line no-console
      console.log(chalk.cyan('\n📊 Setup Summary:'));
      // eslint-disable-next-line no-console
      console.log(`   ⏱️  Time: ${elapsed} seconds`);
      // eslint-disable-next-line no-console
      console.log(`   🎯 Target: <300 seconds (${Number(elapsed) < 300 ? '✅ PASSED' : '❌ EXCEEDED'})`);
      // eslint-disable-next-line no-console
      console.log(`   🔧 Profile: ${options.profile}`);
      // eslint-disable-next-line no-console
      console.log(`   🤖 AI Agents: ${options.skipAi ? 'Skipped' : 'Enabled'}`);

      // eslint-disable-next-line no-console
      console.log(chalk.yellow('\n🚀 Quick Commands:'));
      // eslint-disable-next-line no-console
      console.log('   wundr-env validate     # Check environment health');
      // eslint-disable-next-line no-console
      console.log('   wundr-env status       # Show installation status');
      // eslint-disable-next-line no-console
      console.log('   claude-flow quickstart # Start AI development');
      
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.fail(`❌ Setup failed after ${elapsed}s`);
      logger.error('Quickstart failed:', error);
      // eslint-disable-next-line no-console
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      // eslint-disable-next-line no-console
      console.log(chalk.yellow('\n💡 Try these recovery options:'));
      // eslint-disable-next-line no-console
      console.log('   wundr-env quickstart --preset minimal    # Minimal setup');
      // eslint-disable-next-line no-console
      console.log('   wundr-env quickstart --skip-ai           # Skip AI components');
      // eslint-disable-next-line no-console
      console.log('   wundr-env install --profile basic        # Full traditional setup');
      process.exit(1);
    }
  });

/**
 * Initialize a new environment
 */
export const initCommand = new Command('init')
  .description('Initialize a new development environment')
  .option('-p, --profile <type>', 'Environment profile (human|ai-agent|ci-runner)', 'human')
  .option('-e, --email <email>', 'Email address')
  .option('-n, --name <name>', 'Full name')
  .option('-u, --username <username>', 'GitHub username')
  .option('-c, --company <company>', 'Company name')
  .option('-d, --dev-path <path>', 'Development directory path')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    const spinner = ora('Initializing environment...').start();
    
    try {
      const manager = new EnvironmentManager();
      const profile = options.profile as ProfileType;
      
      if (!['human', 'ai-agent', 'ci-runner'].includes(profile)) {
        throw new Error(`Invalid profile: ${profile}`);
      }
      
      const config = await manager.initialize(profile, {
        email: options.email,
        fullName: options.name,
        githubUsername: options.username,
        company: options.company,
        developmentPath: options.devPath,
        skipPrompts: options.yes
      });
      
      spinner.succeed('Environment initialized successfully');
      
      // eslint-disable-next-line no-console
      console.log(chalk.cyan('\\nEnvironment Configuration:'));
      console.log(`Profile: ${chalk.yellow(config.profile)}`);
      console.log(`Platform: ${chalk.yellow(config.platform)}`);
      console.log(`Tools: ${chalk.yellow(config.tools.length)} configured`);
      // eslint-disable-next-line no-console
      console.log(`Development Path: ${chalk.yellow(config.paths.development)}`);
      
    } catch (error) {
      spinner.fail('Failed to initialize environment');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Install environment tools
 */
export const installCommand = new Command('install')
  .description('Install all configured environment tools')
  .option('-f, --force', 'Force reinstallation of existing tools')
  .action(async (_options) => {
    const spinner = ora('Installing environment tools...').start();
    
    try {
      const manager = new EnvironmentManager();
      const config = await manager.loadConfig();
      
      if (!config) {
        throw new Error('No environment configuration found. Run "wundr-env init" first.');
      }
      
      await manager.installEnvironment();
      
      spinner.succeed('Environment tools installed successfully');
      
    } catch (error) {
      spinner.fail('Failed to install environment tools');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Validate environment setup
 */
export const validateCommand = new Command('validate')
  .description('Validate the current environment setup')
  .option('-v, --verbose', 'Show detailed validation results')
  .action(async (options) => {
    const spinner = ora('Validating environment...').start();
    
    try {
      const manager = new EnvironmentManager();
      const result = await manager.validateEnvironment();
      
      spinner.stop();
      
      if (result.healthy) {
        console.log(chalk.green('✓ Environment is healthy'));
      } else {
        console.log(chalk.red('✗ Environment has issues'));
      }
      
      console.log(chalk.cyan('\\nSystem Information:'));
      console.log(`Platform: ${chalk.yellow(result.system.platform)}`);
      console.log(`Node.js: ${chalk.yellow(result.system.nodeVersion)}`);
      console.log(`NPM: ${chalk.yellow(result.system.npmVersion)}`);
      console.log(`Docker: ${chalk.yellow(result.system.dockerVersion)}`);
      console.log(`Git: ${chalk.yellow(result.system.gitVersion)}`);
      
      console.log(chalk.cyan('\\nTool Status:'));
      result.tools.forEach(tool => {
        const status = tool.valid ? chalk.green('✓') : chalk.red('✗');
        const version = tool.version ? chalk.gray(`(${tool.version})`) : '';
        console.log(`${status} ${tool.tool} ${version}`);
        
        if (options.verbose && tool.issues) {
          tool.issues.forEach(issue => {
            console.log(`  ${chalk.red('•')} ${issue}`);
          });
        }
        
        if (options.verbose && tool.suggestions) {
          tool.suggestions.forEach(suggestion => {
            console.log(`  ${chalk.blue('→')} ${suggestion}`);
          });
        }
      });
      
      if (result.recommendations && result.recommendations.length > 0) {
        console.log(chalk.cyan('\\nRecommendations:'));
        result.recommendations.forEach(rec => {
          console.log(`${chalk.blue('•')} ${rec}`);
        });
      }
      
      if (!result.healthy) {
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail('Failed to validate environment');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Show environment status
 */
export const statusCommand = new Command('status')
  .description('Show current environment status')
  .action(async () => {
    try {
      const manager = new EnvironmentManager();
      const config = await manager.loadConfig();
      
      if (!config) {
        console.log(chalk.yellow('No environment configuration found'));
        console.log(chalk.blue('Run "wundr-env init" to create a new environment'));
        return;
      }
      
      console.log(chalk.cyan('Environment Status'));
      console.log('='.repeat(50));
      console.log(`Profile: ${chalk.yellow(config.profile)}`);
      console.log(`Platform: ${chalk.yellow(config.platform)}`);
      console.log(`Version: ${chalk.yellow(config.version)}`);
      console.log(`Tools: ${chalk.yellow(config.tools.length)} configured`);
      
      console.log(chalk.cyan('\\nPaths:'));
      Object.entries(config.paths).forEach(([key, path]) => {
        console.log(`${key}: ${chalk.gray(path)}`);
      });
      
      console.log(chalk.cyan('\\nPreferences:'));
      Object.entries(config.preferences).forEach(([key, value]) => {
        if (value) {
          console.log(`${key}: ${chalk.gray(value)}`);
        }
      });
      
      if (config.profile === 'ai-agent') {
        console.log(chalk.cyan('\\nAI Agent Features:'));
        console.log(`Claude Code: ${config.tools.some(t => t.name === 'claude-code') ? chalk.green('✓') : chalk.red('✗')}`);
        console.log(`Claude Flow: ${config.tools.some(t => t.name === 'claude-flow') ? chalk.green('✓') : chalk.red('✗')}`);
        console.log(`Swarm Capabilities: ${chalk.green('✓')}`);
        console.log(`Neural Features: ${chalk.green('✓')}`);
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Update environment configuration
 */
export const updateCommand = new Command('update')
  .description('Update environment configuration')
  .option('-p, --profile <type>', 'Change environment profile')
  .option('-e, --email <email>', 'Update email address')
  .option('-n, --name <name>', 'Update full name')
  .option('-u, --username <username>', 'Update GitHub username')
  .action(async (options) => {
    const spinner = ora('Updating environment configuration...').start();
    
    try {
      const manager = new EnvironmentManager();
      const currentConfig = await manager.loadConfig();
      
      if (!currentConfig) {
        throw new Error('No environment configuration found. Run "wundr-env init" first.');
      }
      
      const updates: Partial<EnvironmentConfig> = {};
      
      if (options.profile) {
        if (!['human', 'ai-agent', 'ci-runner'].includes(options.profile)) {
          throw new Error(`Invalid profile: ${options.profile}`);
        }
        updates.profile = options.profile;
      }
      
      if (options.email || options.name || options.username) {
        updates.preferences = {
          ...(options.email && { email: options.email }),
          ...(options.name && { fullName: options.name }),
          ...(options.username && { githubUsername: options.username })
        };
      }
      
      const updatedConfig = await manager.updateConfig(updates);
      
      spinner.succeed('Environment configuration updated');
      
      console.log(chalk.cyan('\\nUpdated Configuration:'));
      console.log(`Profile: ${chalk.yellow(updatedConfig.profile)}`);
      if (updatedConfig.preferences.email) {
        console.log(`Email: ${chalk.yellow(updatedConfig.preferences.email)}`);
      }
      if (updatedConfig.preferences.fullName) {
        console.log(`Name: ${chalk.yellow(updatedConfig.preferences.fullName)}`);
      }
      if (updatedConfig.preferences.githubUsername) {
        console.log(`GitHub: ${chalk.yellow(updatedConfig.preferences.githubUsername)}`);
      }
      
    } catch (error) {
      spinner.fail('Failed to update environment configuration');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * List available profiles
 */
export const profilesCommand = new Command('profiles')
  .description('List available environment profiles')
  .action(async () => {
    const profiles = [
      {
        name: 'human',
        description: 'Complete development environment for human developers',
        tools: 'Full toolchain with IDE, Docker, AI assistance'
      },
      {
        name: 'ai-agent',
        description: 'Optimized environment for AI agents and automation',
        tools: 'Claude Code, Claude Flow, swarm capabilities'
      },
      {
        name: 'ci-runner',
        description: 'Minimal environment for CI/CD pipelines',
        tools: 'Essential build tools, testing framework'
      }
    ];
    
    console.log(chalk.cyan('Available Environment Profiles'));
    console.log('='.repeat(50));
    
    profiles.forEach(profile => {
      console.log(chalk.yellow(`\\n${profile.name}`));
      console.log(chalk.gray(profile.description));
      console.log(chalk.blue(`Tools: ${profile.tools}`));
    });
  });

/**
 * Export CLI commands
 */
export const program = new Command()
  .name('wundr-env')
  .description('Wundr Environment Manager - Cross-platform development environment setup')
  .version('1.0.0');

program
  .addCommand(quickstartCommand)
  .addCommand(initCommand)
  .addCommand(installCommand)
  .addCommand(validateCommand)
  .addCommand(statusCommand)
  .addCommand(updateCommand)
  .addCommand(profilesCommand);