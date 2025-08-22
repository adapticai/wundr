/**
 * Simple Setup Commands - Main setup entry points
 * Provides the primary wundr setup commands that integrate with computer-setup
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
// Note: Using relative path import due to workspace resolution issues in this monorepo setup
// The computer-setup package must be built first before building this CLI package
import { 
  SetupPlatform, 
  SetupProgress, 
  SetupResult, 
  RealSetupOrchestrator 
} from '../../../computer-setup/dist';

export class SetupCommands {
  private orchestrator: RealSetupOrchestrator;
  private platform: SetupPlatform;

  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.platform = this.detectPlatform();
    this.orchestrator = new RealSetupOrchestrator(this.platform);
    this.registerCommands();
  }

  private registerCommands(): void {
    // Main setup command (wundr setup)
    this.program
      .command('setup')
      .description('Set up developer machine with required tools')
      .option('-p, --profile <profile>', 'Use specific profile (frontend, backend, fullstack, devops)', 'fullstack')
      .option('--dry-run', 'Show what would be installed without making changes')
      .option('--interactive', 'Run in interactive mode')
      .action(async (options) => {
        await this.runSetup(options);
      });

    // Setup with specific profile (wundr setup:profile frontend)
    const setupProfile = this.program
      .command('setup:profile')
      .description('Set up using a specific developer profile');

    setupProfile
      .command('frontend')
      .description('Set up frontend development environment')
      .action(async () => {
        await this.runSetup({ profile: 'frontend' });
      });

    setupProfile
      .command('backend')
      .description('Set up backend development environment')
      .action(async () => {
        await this.runSetup({ profile: 'backend' });
      });

    setupProfile
      .command('fullstack')
      .description('Set up full-stack development environment')
      .action(async () => {
        await this.runSetup({ profile: 'fullstack' });
      });

    setupProfile
      .command('devops')
      .description('Set up DevOps engineering environment')
      .action(async () => {
        await this.runSetup({ profile: 'devops' });
      });

    // Validate setup (wundr setup:validate)
    this.program
      .command('setup:validate')
      .description('Validate current development environment setup')
      .option('--profile <profile>', 'Validate against specific profile')
      .option('--fix', 'Attempt to fix issues found')
      .action(async (options) => {
        await this.validateSetup(options);
      });

    // Resume setup (wundr setup:resume)
    this.program
      .command('setup:resume')
      .description('Resume interrupted setup from saved state')
      .action(async () => {
        await this.resumeSetup();
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
    console.log(chalk.cyan('\n🚀 Wundr Development Environment Setup'));
    console.log(chalk.gray('Setting up your development machine...\n'));

    try {
      // Check for resumable setup
      const canResume = await this.orchestrator.canResume();
      if (canResume && !options.dryRun) {
        const { resume } = await inquirer.prompt([{
          type: 'confirm',
          name: 'resume',
          message: 'Found incomplete setup. Resume from where you left off?',
          default: true
        }]);

        if (resume) {
          return await this.resumeSetup();
        }
      }

      // Get profile
      let profileName = options.profile;
      if (options.interactive && !profileName) {
        profileName = await this.selectProfile();
      }

      // Validate profile
      const availableProfiles = this.orchestrator.getAvailableProfiles();
      const profile = availableProfiles.find(p => 
        p.name.toLowerCase().includes(profileName.toLowerCase())
      );
      
      if (!profile) {
        console.error(chalk.red(`❌ Unknown profile: ${profileName}`));
        console.log(chalk.cyan('\n📋 Available profiles:'));
        availableProfiles.forEach(p => 
          console.log(`  • ${chalk.white(p.name)}: ${chalk.gray(p.description)}`)
        );
        return;
      }

      console.log(chalk.cyan(`\n📋 Selected Profile: ${chalk.white(profile.name)}`));
      console.log(chalk.gray(`${profile.description}`));
      console.log(chalk.gray(`Estimated time: ${profile.estimatedTimeMinutes} minutes\n`));

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 DRY RUN - Showing what would be installed:\n'));
        console.log(chalk.cyan('Required tools:'));
        profile.requiredTools.forEach(tool => console.log(`  ✓ ${tool}`));
        if (profile.optionalTools.length > 0) {
          console.log(chalk.cyan('\nOptional tools:'));
          profile.optionalTools.forEach(tool => console.log(`  • ${tool}`));
        }
        return;
      }

      // Progress tracking
      const progressCallback = (progress: SetupProgress) => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        const progressBar = this.createProgressBar(progress.percentage);
        process.stdout.write(
          `${progressBar} ${progress.percentage.toFixed(1)}% - ${progress.currentStep}`
        );
      };

      console.log(chalk.cyan('🚀 Starting setup...\n'));
      
      const result: SetupResult = await this.orchestrator.orchestrate(
        profileName,
        {
          dryRun: options.dryRun,
          skipExisting: true,
          parallel: false,
          generateReport: true
        },
        progressCallback
      );

      console.log('\n'); // New line after progress

      if (result.success) {
        console.log(chalk.green('\n✅ Setup completed successfully!'));
        console.log(chalk.gray(`Duration: ${Math.round(result.duration / 1000)}s\n`));
        
        this.showSetupSummary(result);
        this.showNextSteps();
      } else {
        console.log(chalk.red('\n❌ Setup failed!'));
        this.showErrors(result);
        console.log(chalk.cyan('\n💡 Resume with: wundr setup:resume'));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), (error as Error).message);
      console.log(chalk.cyan('\n💡 Resume with: wundr setup:resume'));
      process.exit(1);
    }
  }

  private async validateSetup(options: any): Promise<void> {
    console.log(chalk.cyan('\n🔍 Validating development environment...\n'));
    
    const spinner = ora('Running validation checks...').start();
    
    // Basic validation checks
    const checks = [
      { name: 'Node.js', test: () => this.checkCommand('node --version') },
      { name: 'Git', test: () => this.checkCommand('git --version') },
      { name: 'Homebrew', test: () => this.checkCommand('brew --version') },
      { name: 'Docker', test: () => this.checkCommand('docker --version') },
    ];

    const results: Array<{ name: string; status: 'pass' | 'fail'; version?: string; error?: string }> = [];
    
    for (const check of checks) {
      try {
        const result = await check.test();
        results.push({ 
          name: check.name, 
          status: 'pass', 
          version: result 
        });
      } catch (error) {
        results.push({ 
          name: check.name, 
          status: 'fail', 
          error: (error as Error).message 
        });
      }
    }

    spinner.stop();
    
    console.log(chalk.cyan('📊 Validation Results:\n'));
    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : '❌';
      const status = result.status === 'pass' 
        ? chalk.green(`${result.version || 'installed'}`)
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
        console.log(chalk.cyan('\n💡 Fix issues with: wundr setup:validate --fix'));
      }
    } else {
      console.log(chalk.green('\n✅ All checks passed! Environment is ready.'));
    }
  }

  private async resumeSetup(): Promise<void> {
    console.log(chalk.cyan('\n🔄 Resuming setup...\n'));
    
    const progressCallback = (progress: SetupProgress) => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      const progressBar = this.createProgressBar(progress.percentage);
      process.stdout.write(
        `${progressBar} ${progress.percentage.toFixed(1)}% - ${progress.currentStep}`
      );
    };

    try {
      const result = await this.orchestrator.resume(progressCallback);
      console.log('\n');

      if (result.success) {
        console.log(chalk.green('✅ Setup completed successfully!'));
        this.showSetupSummary(result);
        this.showNextSteps();
      } else {
        console.log(chalk.red('❌ Resume failed!'));
        this.showErrors(result);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Resume failed:'), (error as Error).message);
      process.exit(1);
    }
  }

  private async personalizeSetup(): Promise<void> {
    console.log(chalk.cyan('\n👤 Personal Configuration Setup\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Your name:',
        validate: (input: string) => input.length > 0 || 'Name is required'
      },
      {
        type: 'input',
        name: 'email',
        message: 'Your email:',
        validate: (input: string) => 
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || 'Valid email required'
      },
      {
        type: 'list',
        name: 'shell',
        message: 'Preferred shell:',
        choices: ['zsh', 'bash', 'fish'],
        default: 'zsh'
      },
      {
        type: 'confirm',
        name: 'aliases',
        message: 'Install helpful shell aliases?',
        default: true
      }
    ]);

    console.log(chalk.cyan('\n⚙️  Configuring personal settings...'));
    
    // Configure Git
    try {
      await this.runCommand(`git config --global user.name "${answers.name}"`);
      await this.runCommand(`git config --global user.email "${answers.email}"`);
      console.log(chalk.green('✅ Git configured'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not configure Git'));
    }

    console.log(chalk.green('\n✅ Personalization complete!'));
  }

  private async selectProfile(): Promise<string> {
    const profiles = this.orchestrator.getAvailableProfiles();
    
    const { selectedProfile } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedProfile',
      message: 'Select your development profile:',
      choices: profiles.map(p => ({
        name: `${p.name} - ${p.description}`,
        value: p.name.toLowerCase().replace(/\s+/g, ''),
        short: p.name
      }))
    }]);

    return selectedProfile;
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return chalk.cyan('[') + 
           chalk.green('='.repeat(filled)) + 
           chalk.gray('-'.repeat(empty)) + 
           chalk.cyan(']');
  }

  private showSetupSummary(result: SetupResult): void {
    if (result.completedSteps.length > 0) {
      console.log(chalk.cyan(`🎯 Completed (${result.completedSteps.length}):`));
      result.completedSteps.slice(0, 5).forEach(step => 
        console.log(`  ✅ ${step.replace('install-', '')}`)
      );
      if (result.completedSteps.length > 5) {
        console.log(`  ... and ${result.completedSteps.length - 5} more`);
      }
    }

    if (result.skippedSteps.length > 0) {
      console.log(chalk.yellow(`\n⏭️  Skipped (${result.skippedSteps.length}):`));
      result.skippedSteps.slice(0, 3).forEach(step => 
        console.log(`  ⏭️  ${step.replace('install-', '')} (already installed)`)
      );
    }
  }

  private showErrors(result: SetupResult): void {
    if (result.failedSteps.length > 0) {
      console.log(chalk.red(`❌ Failed (${result.failedSteps.length}):`));
      result.failedSteps.forEach(step => 
        console.log(`  ❌ ${step.replace('install-', '')}`)
      );
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\n🔍 Errors:'));
      result.errors.slice(0, 3).forEach(error => 
        console.log(`  • ${error.message}`)
      );
    }
  }

  private showNextSteps(): void {
    console.log(chalk.cyan('\n📝 Next Steps:'));
    const steps = [
      'Restart your terminal to apply changes',
      'Validate setup: wundr setup:validate',
      'Personalize: wundr setup:personalize',
      'Start coding! 🚀'
    ];
    
    steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    console.log();
  }

  private detectPlatform(): SetupPlatform {
    return {
      os: process.platform as 'darwin' | 'linux' | 'win32',
      arch: process.arch as 'x64' | 'arm64',
      version: process.version || 'unknown'
    };
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