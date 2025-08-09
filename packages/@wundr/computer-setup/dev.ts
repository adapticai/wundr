#!/usr/bin/env tsx

/**
 * Development entry point for computer-setup
 * Run with: tsx packages/@wundr/computer-setup/dev.ts
 */

import { ComputerSetupManager } from './src/manager';
import { ProfileManager } from './src/profiles';
import { InstallerRegistry } from './src/installers';
import { ConfiguratorService } from './src/configurators';
import { SetupValidator } from './src/validators';
import { SetupOrchestrator } from './src/orchestrator';
import chalk from 'chalk';
import { Command } from 'commander';

async function main() {
  console.log(chalk.blue('╔══════════════════════════════════════╗'));
  console.log(chalk.blue('║   ') + chalk.green('🖥️  Wundr Computer Setup (Dev)') + chalk.blue('    ║'));
  console.log(chalk.blue('╚══════════════════════════════════════╝'));
  console.log();

  const program = new Command()
    .name('computer-setup-dev')
    .description('Development runner for computer setup')
    .version('1.0.0');

  program
    .command('validate')
    .description('Validate system requirements')
    .action(async () => {
      console.log(chalk.yellow('Validating system requirements...'));
      const validator = new SetupValidator();
      
      const platform = {
        os: process.platform as any,
        arch: process.arch as any,
        version: process.version
      };
      
      const isValid = await validator.validatePlatform(platform);
      if (isValid) {
        console.log(chalk.green('✅ System requirements met'));
      } else {
        console.log(chalk.red('❌ System requirements not met'));
      }
      
      const hasSpace = await validator.checkDiskSpace(10 * 1024 * 1024 * 1024);
      console.log(hasSpace ? chalk.green('✅ Sufficient disk space') : chalk.yellow('⚠️  Low disk space'));
      
      const hasNetwork = await validator.checkNetworkConnectivity();
      console.log(hasNetwork ? chalk.green('✅ Network connectivity') : chalk.red('❌ No network'));
    });

  program
    .command('list-profiles')
    .description('List available developer profiles')
    .action(async () => {
      const profileManager = new ProfileManager();
      const profiles = await profileManager.listProfiles();
      
      console.log(chalk.green('Available profiles:'));
      profiles.forEach(profile => {
        console.log(`  • ${chalk.cyan(profile.name)} - ${profile.description}`);
      });
    });

  program
    .command('show-profile <name>')
    .description('Show profile details')
    .action(async (name: string) => {
      const profileManager = new ProfileManager();
      const profiles = await profileManager.listProfiles();
      const profile = profiles.find(p => p.name === name);
      
      if (!profile) {
        console.log(chalk.red(`Profile '${name}' not found`));
        return;
      }
      
      console.log(chalk.green(`Profile: ${profile.name}`));
      console.log(chalk.gray(`Description: ${profile.description}`));
      console.log(chalk.gray(`Role: ${profile.role}`));
      console.log();
      console.log(chalk.yellow('Tools:'));
      console.log(JSON.stringify(profile.tools, null, 2));
    });

  program
    .command('dry-run <profile>')
    .description('Run setup in dry-run mode')
    .option('--parallel', 'Run installations in parallel')
    .option('--skip-existing', 'Skip already installed tools')
    .action(async (profileName: string, options: any) => {
      console.log(chalk.yellow(`Running dry-run for profile: ${profileName}`));
      console.log(chalk.gray('This will show what would be installed without making changes'));
      console.log();
      
      const profileManager = new ProfileManager();
      const installerRegistry = new InstallerRegistry();
      const configuratorService = new ConfiguratorService();
      const validator = new SetupValidator();
      
      const profiles = await profileManager.listProfiles();
      const profile = profiles.find(p => p.name === profileName);
      
      if (!profile) {
        console.log(chalk.red(`Profile '${profileName}' not found`));
        return;
      }
      
      const orchestrator = new SetupOrchestrator(
        profileManager,
        installerRegistry,
        configuratorService,
        validator
      );
      
      // Subscribe to progress events
      orchestrator.on('progress', (progress) => {
        console.log(chalk.blue(`[${progress.percentage}%] ${progress.currentStep}`));
      });
      
      const setupOptions = {
        profile,
        platform: {
          os: process.platform as any,
          arch: process.arch as any,
          version: process.version
        },
        mode: 'automated' as const,
        dryRun: true,
        parallel: options.parallel,
        skipExisting: options.skipExisting,
        generateReport: true
      };
      
      try {
        const result = await orchestrator.orchestrate(setupOptions);
        
        console.log();
        console.log(chalk.green('Dry-run complete!'));
        console.log(chalk.gray(`Steps that would be executed: ${result.completedSteps.length}`));
        console.log(chalk.gray(`Steps that would be skipped: ${result.skippedSteps.length}`));
        
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('Warnings:'));
          result.warnings.forEach(w => console.log(`  • ${w}`));
        }
      } catch (error) {
        console.error(chalk.red('Setup failed:'), error);
      }
    });

  program
    .command('check-tools')
    .description('Check which tools are already installed')
    .action(async () => {
      const validator = new SetupValidator();
      
      console.log(chalk.yellow('Checking installed tools...'));
      console.log();
      
      // Check common tools
      const tools = [
        { name: 'Git', check: () => validator.validateGit() },
        { name: 'Node.js', check: () => validator.validateNode() },
        { name: 'Python', check: () => validator.validatePython() },
        { name: 'Docker', check: () => validator.validateDocker() },
        { name: 'VS Code', check: () => validator.validateVSCode() },
        { name: 'Claude Code', check: () => validator.validateClaudeCode() },
        { name: 'pnpm', check: () => validator.validatePackageManager('pnpm') },
        { name: 'yarn', check: () => validator.validatePackageManager('yarn') },
      ];
      
      for (const tool of tools) {
        try {
          const isInstalled = await tool.check();
          if (isInstalled) {
            console.log(chalk.green(`✅ ${tool.name}`));
          } else {
            console.log(chalk.gray(`⭕ ${tool.name} (not installed)`));
          }
        } catch {
          console.log(chalk.gray(`⭕ ${tool.name} (not installed)`));
        }
      }
      
      console.log();
      const installedTools = await validator.getInstalledTools();
      if (installedTools.length > 0) {
        console.log(chalk.green('Detailed versions:'));
        installedTools.forEach(tool => {
          console.log(`  • ${tool.name}: ${tool.version}`);
        });
      }
    });

  // Parse arguments
  await program.parseAsync(process.argv);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}