/**
 * Simple Setup Commands - Main setup entry points
 *
 * `wundr setup` (and its sub-commands) delegate to the SAME code path as
 * `wundr computer-setup` (runComputerSetup -> ComputerSetupManager), so there is
 * a single orchestrator engine across the whole CLI. The old RealSetupOrchestrator
 * has been retired.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

import { runComputerSetup } from './computer-setup';

import type { PluginManager } from '../plugins/plugin-manager';
import type { ConfigManager } from '../utils/config-manager';

import type { Command } from 'commander';

export class SetupCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    // Main setup command (wundr setup)
    this.program
      .command('setup')
      .description('Set up developer machine with required tools')
      .option(
        '-p, --profile <profile>',
        'Use specific profile (frontend, backend, fullstack, devops)',
        'fullstack'
      )
      .option(
        '--dry-run',
        'Show what would be installed without making changes'
      )
      .option('--interactive', 'Run in interactive mode')
      .option('--no-remote-access', 'Skip remote-access provisioning')
      .action(async options => {
        await this.runSetup(options);
      });

    // Setup with specific profile (wundr setup:profile frontend)
    const setupProfile = this.program
      .command('setup:profile')
      .description('Set up using a specific developer profile');

    for (const profile of ['frontend', 'backend', 'fullstack', 'devops']) {
      setupProfile
        .command(profile)
        .description(`Set up ${profile} development environment`)
        .action(async () => {
          await this.runSetup({ profile });
        });
    }

    // Validate setup (wundr setup:validate)
    this.program
      .command('setup:validate')
      .description('Validate current development environment setup')
      .option('--profile <profile>', 'Validate against specific profile')
      .option('--fix', 'Attempt to fix issues found')
      .action(async options => {
        await this.validateSetup(options);
      });

    // Resume setup (wundr setup:resume) — re-runs idempotently, skipping
    // already-installed tools (the setup flow is now idempotent).
    this.program
      .command('setup:resume')
      .description('Re-run setup, skipping tools that are already installed')
      .option('-p, --profile <profile>', 'Profile to resume', 'fullstack')
      .action(async options => {
        await this.runSetup({ ...options, skipExisting: true });
      });

    // Personalize setup (wundr setup:personalize)
    this.program
      .command('setup:personalize')
      .description('Run personalization and configuration')
      .action(async () => {
        await this.personalizeSetup();
      });
  }

  private async runSetup(options: any): Promise<void> {
    // Single source of truth: the same handler that backs `wundr computer-setup`.
    await runComputerSetup({
      profile: options.profile,
      mode: options.interactive ? 'interactive' : 'automated',
      dryRun: Boolean(options.dryRun),
      interactive: Boolean(options.interactive),
      skipExisting: Boolean(options.skipExisting),
      remoteAccess: options.remoteAccess,
    });
  }

  private async validateSetup(options: any): Promise<void> {
    console.log(chalk.cyan('\n🔍 Validating development environment...\n'));

    const spinner = ora('Running validation checks...').start();

    const checks = [
      { name: 'Node.js', test: () => this.checkCommand('node --version') },
      { name: 'Git', test: () => this.checkCommand('git --version') },
      { name: 'Homebrew', test: () => this.checkCommand('brew --version') },
      { name: 'Docker', test: () => this.checkCommand('docker --version') },
    ];

    const results: Array<{
      name: string;
      status: 'pass' | 'fail';
      version?: string;
    }> = [];

    for (const check of checks) {
      try {
        results.push({
          name: check.name,
          status: 'pass',
          version: await check.test(),
        });
      } catch {
        results.push({ name: check.name, status: 'fail' });
      }
    }

    spinner.stop();

    console.log(chalk.cyan('📊 Validation Results:\n'));
    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : '❌';
      const status =
        result.status === 'pass'
          ? chalk.green(result.version || 'installed')
          : chalk.red('not found');
      console.log(`${icon} ${result.name}: ${status}`);
    });

    const failed = results.filter(r => r.status === 'fail');
    if (failed.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${failed.length} issues found`));
      if (options.fix) {
        console.log(chalk.cyan('\n🔧 Attempting to fix issues...'));
        await this.runSetup({ profile: options.profile || 'fullstack' });
      } else {
        console.log(
          chalk.cyan('\n💡 Fix issues with: wundr setup:validate --fix')
        );
      }
    } else {
      console.log(chalk.green('\n✅ All checks passed! Environment is ready.'));
    }
  }

  private async personalizeSetup(): Promise<void> {
    console.log(chalk.cyan('\n👤 Personal Configuration Setup\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Your name:',
        validate: (input: string) => input.length > 0 || 'Name is required',
      },
      {
        type: 'input',
        name: 'email',
        message: 'Your email:',
        validate: (input: string) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || 'Valid email required',
      },
    ]);

    console.log(chalk.cyan('\n⚙️  Configuring personal settings...'));
    try {
      await this.runCommand(`git config --global user.name "${answers.name}"`);
      await this.runCommand(
        `git config --global user.email "${answers.email}"`
      );
      console.log(chalk.green('✅ Git configured'));
    } catch {
      console.log(chalk.yellow('⚠️  Could not configure Git'));
    }

    console.log(chalk.green('\n✅ Personalization complete!'));
  }

  private async checkCommand(command: string): Promise<string> {
    const { execa } = await import('execa');
    const { stdout } = await execa('sh', ['-c', command]);
    return stdout?.split('\n')[0] || '';
  }

  private async runCommand(command: string): Promise<void> {
    const { execa } = await import('execa');
    await execa('sh', ['-c', command]);
  }
}
