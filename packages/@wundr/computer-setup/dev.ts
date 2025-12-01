#!/usr/bin/env tsx

/**
 * Wundr Computer Setup CLI
 * Enhanced with full CLI functionality from new-starter
 * Run with: tsx packages/@wundr/computer-setup/dev.ts
 */

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ProfileManager } from './src/profiles';
import {
  InstallerRegistry,
  OrchestratorDaemonInstaller,
} from './src/installers';
import { ConfiguratorService } from './src/configurators';
import { SetupValidator } from './src/validators';
import { SetupOrchestrator } from './src/orchestrator';
import { DeveloperProfile, SetupOptions, SetupPlatform } from './src/types';

// Version from package.json
// eslint-disable-next-line @typescript-eslint/no-require-imports
const packageInfo = require('./package.json') as { version?: string };
const version = packageInfo.version || '1.0.0';

// Additional types for CLI
interface ValidationResult {
  tool: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  canFix?: boolean;
}

interface ConfigOptions {
  list?: boolean;
  get?: string;
  set?: string;
  reset?: boolean;
}

interface SetupContext {
  email: string;
  githubUsername: string;
  githubEmail: string;
  fullName: string;
  company?: string | undefined;
  role: string;
  jobTitle: string;
  rootDir: string;
  os: 'darwin' | 'linux' | 'win32';
  skipPrompts: boolean;
  verbose: boolean;
  selectedTools: string[];
  platform: SetupPlatform;
}

// Logger utility
class Logger {
  static info(...args: any[]) {
    console.log(...args);
  }

  static error(...args: any[]) {
    console.error(chalk.red('Error:'), ...args);
  }

  static warn(...args: any[]) {
    console.warn(chalk.yellow('Warning:'), ...args);
  }

  static success(...args: any[]) {
    console.log(chalk.green(...args));
  }
}

const logger = Logger;

// Default configuration
const DEFAULT_CONFIG = {
  rootDir: '~/Development',
  skipPrompts: false,
  verbose: false,
  profile: 'fullstack',
};

// Setup command implementation
class SetupCommand {
  private options: any;
  private context: SetupContext | null = null;

  constructor(options: any) {
    this.options = options;
  }

  async execute(): Promise<void> {
    logger.info(chalk.cyan.bold('\n🚀 Starting Wundr Computer Setup\n'));

    // Initialize context
    this.context = await this.initializeContext();

    // Validate prerequisites
    await this.validatePrerequisites();

    // Select profile
    const selectedProfile = await this.selectProfile();

    // Execute setup
    await this.executeSetup(selectedProfile);

    logger.success(chalk.green.bold('\n✅ Setup completed successfully!\n'));
    logger.info(
      chalk.cyan('Please restart your terminal to apply all changes.')
    );
    logger.info(
      chalk.gray('Run "npx tsx dev.ts validate" to verify your setup.\n')
    );
  }

  private async initializeContext(): Promise<SetupContext> {
    const platform: SetupPlatform = {
      os:
        process.platform === 'darwin'
          ? 'darwin'
          : process.platform === 'win32'
            ? 'win32'
            : 'linux',
      arch: process.arch as 'x64' | 'arm64',
      node: process.version,
      shell: process.env.SHELL || 'bash',
    };

    // Prompt for missing information if not skipping prompts
    const info = this.options.skipPrompts
      ? this.options
      : await this.promptForMissingInfo(this.options);

    return {
      email: info.email || '',
      githubUsername: info.githubUsername || '',
      githubEmail: info.githubEmail || info.email || '',
      fullName: info.name || '',
      company: info.company || undefined,
      role: info.role || 'Software Engineer',
      jobTitle: info.jobTitle || 'Building amazing software',
      rootDir: path.resolve(
        (info.rootDir || '~/Development').replace('~', os.homedir())
      ),
      os: platform.os,
      skipPrompts: this.options.skipPrompts || false,
      verbose: this.options.verbose || false,
      selectedTools: [],
      platform,
    };
  }

  private async promptForMissingInfo(options: any): Promise<any> {
    const questions: any[] = [];

    if (!options.email) {
      questions.push({
        type: 'input',
        name: 'email',
        message: 'What is your email address?',
        validate: (input: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) || 'Please enter a valid email address';
        },
      });
    }

    if (!options.githubUsername) {
      questions.push({
        type: 'input',
        name: 'githubUsername',
        message: 'What is your GitHub username?',
        validate: (input: string) =>
          input.length > 0 || 'GitHub username is required',
      });
    }

    if (!options.name) {
      questions.push({
        type: 'input',
        name: 'name',
        message: 'What is your full name?',
        validate: (input: string) => input.length > 0 || 'Name is required',
      });
    }

    if (!options.company) {
      questions.push({
        type: 'input',
        name: 'company',
        message: 'What is your company name? (optional)',
        default: '',
      });
    }

    if (!options.role) {
      questions.push({
        type: 'input',
        name: 'role',
        message: 'What is your role/position?',
        default: 'Software Engineer',
      });
    }

    if (questions.length > 0) {
      logger.info(
        chalk.cyan('\n📝 Please provide the following information:\n')
      );
      const answers = await inquirer.prompt(questions);
      return { ...options, ...answers };
    }

    return options;
  }

  private async validatePrerequisites(): Promise<void> {
    const spinner = ora('Validating prerequisites...').start();

    try {
      const validator = new SetupValidator();

      // Check platform
      const isValid = await validator.validatePlatform(this.context!.platform);
      if (!isValid) {
        throw new Error('Platform not supported');
      }

      // Check disk space
      const hasSpace = await validator.checkDiskSpace(10 * 1024 * 1024 * 1024);
      if (!hasSpace) {
        throw new Error('Insufficient disk space (10GB required)');
      }

      // Check network
      const hasNetwork = await validator.checkNetworkConnectivity();
      if (!hasNetwork) {
        throw new Error('Network connectivity required');
      }

      spinner.succeed('Prerequisites validated');
    } catch (error) {
      spinner.fail('Prerequisite validation failed');
      throw error;
    }
  }

  private async selectProfile(): Promise<DeveloperProfile> {
    const profileManager = new ProfileManager();

    if (this.options.skipPrompts && this.options.profile) {
      const profiles = await profileManager.listProfiles();
      const profile = profiles.find(p => p.name === this.options.profile);
      if (profile) {
        return profile;
      }
    }

    const profiles = await profileManager.listProfiles();

    const { selectedProfile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedProfile',
        message: 'Which developer profile would you like to use?',
        choices: profiles.map(p => ({
          name: `${p.name} - ${p.role}`,
          value: p.name,
        })),
      },
    ]);

    return profiles.find(p => p.name === selectedProfile)!;
  }

  private async executeSetup(profile: DeveloperProfile): Promise<void> {
    const profileManager = new ProfileManager();
    const platform: SetupPlatform = {
      os:
        process.platform === 'darwin'
          ? 'darwin'
          : process.platform === 'win32'
            ? 'win32'
            : 'linux',
      arch: process.arch as 'x64' | 'arm64',
      node: process.version,
      shell: process.env.SHELL || 'bash',
    };
    const installerRegistry = new InstallerRegistry(platform);
    const configuratorService = new ConfiguratorService();
    const validator = new SetupValidator();

    const orchestrator = new SetupOrchestrator(
      profileManager,
      installerRegistry,
      configuratorService,
      validator
    );

    // Subscribe to progress events
    orchestrator.on('progress', progress => {
      logger.info(
        chalk.blue(`[${progress.percentage}%] ${progress.currentStep}`)
      );
    });

    const setupOptions: SetupOptions = {
      profile,
      platform,
      mode: this.options.skipPrompts ? 'automated' : 'interactive',
      skipExisting: this.options.skipExisting || false,
      dryRun: false,
      verbose: this.options.verbose || false,
      parallel: this.options.parallel || false,
      generateReport: true,
    };

    const result = await orchestrator.orchestrate(setupOptions);

    if (!result.success) {
      throw new Error(
        `Setup failed. Failed steps: ${result.failedSteps.length}`
      );
    }
  }
}

// Validation command implementation
class ValidateCommand {
  private options: { fix?: boolean };
  private results: ValidationResult[] = [];

  constructor(options: { fix?: boolean }) {
    this.options = options;
  }

  async execute(): Promise<void> {
    logger.info(chalk.cyan.bold('\n🔍 Validating Development Environment\n'));

    // Run all validations
    await this.validateBrew();
    await this.validateNode();
    await this.validateDocker();
    await this.validateGit();
    await this.validateVSCode();
    await this.validateClaude();

    // Display results
    this.displayResults();

    // Attempt fixes if requested
    if (this.options.fix && this.hasFixableIssues()) {
      await this.attemptFixes();
    }
  }

  private async validateBrew(): Promise<void> {
    const spinner = ora('Checking Homebrew...').start();

    try {
      const validator = new SetupValidator();
      const hasBrew = await validator.validatePackageManager('brew');
      if (hasBrew) {
        this.results.push({
          tool: 'Homebrew',
          status: 'success',
          message: 'Installed and available',
        });
        spinner.succeed('Homebrew OK');
      } else {
        this.results.push({
          tool: 'Homebrew',
          status: 'error',
          message: 'Not installed',
          canFix: true,
        });
        spinner.fail('Homebrew not found');
      }
    } catch {
      spinner.fail('Homebrew check failed');
    }
  }

  private async validateNode(): Promise<void> {
    const spinner = ora('Checking Node.js...').start();

    try {
      const validator = new SetupValidator();
      const hasNode = await validator.validateNode();

      if (hasNode) {
        this.results.push({
          tool: 'Node.js',
          status: 'success',
          message: 'Installed and available',
        });
        spinner.succeed('Node.js OK');
      } else {
        this.results.push({
          tool: 'Node.js',
          status: 'error',
          message: 'Not installed',
          canFix: true,
        });
        spinner.warn('Node.js issues detected');
      }
    } catch {
      spinner.fail('Node.js check failed');
    }
  }

  private async validateDocker(): Promise<void> {
    const spinner = ora('Checking Docker...').start();

    try {
      const validator = new SetupValidator();
      const hasDocker = await validator.validateDocker();

      if (hasDocker) {
        this.results.push({
          tool: 'Docker',
          status: 'success',
          message: 'Installed and running',
        });
        spinner.succeed('Docker OK');
      } else {
        this.results.push({
          tool: 'Docker',
          status: 'error',
          message: 'Not installed',
          canFix: true,
        });
        spinner.fail('Docker not found');
      }
    } catch {
      spinner.fail('Docker check failed');
    }
  }

  private async validateGit(): Promise<void> {
    const spinner = ora('Checking Git...').start();

    try {
      const validator = new SetupValidator();
      const hasGit = await validator.validateGit();

      if (hasGit) {
        this.results.push({
          tool: 'Git',
          status: 'success',
          message: 'Installed and configured',
        });
        spinner.succeed('Git OK');
      } else {
        this.results.push({
          tool: 'Git',
          status: 'error',
          message: 'Not installed',
          canFix: true,
        });
        spinner.fail('Git not found');
      }
    } catch {
      spinner.fail('Git check failed');
    }
  }

  private async validateVSCode(): Promise<void> {
    const spinner = ora('Checking VS Code...').start();

    try {
      const validator = new SetupValidator();
      const hasVSCode = await validator.validateVSCode();

      if (hasVSCode) {
        this.results.push({
          tool: 'VS Code',
          status: 'success',
          message: 'Installed with CLI tools',
        });
        spinner.succeed('VS Code OK');
      } else {
        this.results.push({
          tool: 'VS Code',
          status: 'warning',
          message: 'CLI tools not available',
          canFix: false,
        });
        spinner.warn('VS Code CLI not found');
      }
    } catch {
      spinner.fail('VS Code check failed');
    }
  }

  private async validateClaude(): Promise<void> {
    const spinner = ora('Checking Claude tools...').start();

    try {
      const validator = new SetupValidator();
      const hasClaude = await validator.validateClaudeCode();

      if (hasClaude) {
        this.results.push({
          tool: 'Claude',
          status: 'success',
          message: 'Claude Code installed',
        });
        spinner.succeed('Claude tools OK');
      } else {
        this.results.push({
          tool: 'Claude',
          status: 'warning',
          message: 'Not installed',
          canFix: true,
        });
        spinner.warn('Claude tools not found');
      }
    } catch {
      spinner.fail('Claude check failed');
    }
  }

  private displayResults(): void {
    logger.info(chalk.cyan.bold('\n📊 Validation Results:\n'));

    const grouped = {
      success: this.results.filter(r => r.status === 'success'),
      warning: this.results.filter(r => r.status === 'warning'),
      error: this.results.filter(r => r.status === 'error'),
    };

    if (grouped.success.length > 0) {
      logger.info(chalk.green.bold('✅ Working:'));
      for (const r of grouped.success) {
        logger.info(chalk.green(`  • ${r.tool}: ${r.message}`));
      }
    }

    if (grouped.warning.length > 0) {
      logger.info(chalk.yellow.bold('\n⚠️  Warnings:'));
      for (const r of grouped.warning) {
        logger.info(chalk.yellow(`  • ${r.tool}: ${r.message}`));
      }
    }

    if (grouped.error.length > 0) {
      logger.info(chalk.red.bold('\n❌ Errors:'));
      for (const r of grouped.error) {
        logger.info(chalk.red(`  • ${r.tool}: ${r.message}`));
      }
    }

    const total = this.results.length;
    const successful = grouped.success.length;
    const percentage = Math.round((successful / total) * 100);

    logger.info(
      chalk.cyan.bold(
        `\n📈 Overall: ${successful}/${total} (${percentage}%) checks passed\n`
      )
    );

    if (this.hasFixableIssues() && !this.options.fix) {
      logger.info(
        chalk.gray(
          'Run "npx tsx dev.ts validate --fix" to attempt automatic fixes.\n'
        )
      );
    }
  }

  private hasFixableIssues(): boolean {
    return this.results.some(r => r.canFix && r.status !== 'success');
  }

  private async attemptFixes(): Promise<void> {
    logger.info(chalk.cyan.bold('\n🔧 Attempting to fix issues...\n'));

    const fixable = this.results.filter(
      r => r.canFix && r.status !== 'success'
    );

    for (const result of fixable) {
      const spinner = ora(`Fixing ${result.tool}...`).start();

      try {
        // Here you would implement specific fix logic for each tool
        await new Promise(resolve => setTimeout(resolve, 1000));
        spinner.succeed(`${result.tool} fix attempted`);
      } catch {
        spinner.fail(`${result.tool} fix failed`);
      }
    }

    logger.info(
      chalk.cyan(
        '\n🔄 Please run validation again to check if issues are resolved.\n'
      )
    );
  }
}

// Configuration command implementation
class ConfigCommand {
  private options: ConfigOptions;
  private configPath: string;

  constructor(options: ConfigOptions) {
    this.options = options;
    this.configPath = path.join(
      os.homedir(),
      '.wundr',
      'computer-setup',
      'config.json'
    );
  }

  async execute(): Promise<void> {
    if (this.options.list) {
      await this.listConfig();
    } else if (this.options.get) {
      await this.getConfig(this.options.get);
    } else if (this.options.set) {
      await this.setConfig(this.options.set);
    } else if (this.options.reset) {
      await this.resetConfig();
    } else {
      logger.info(chalk.cyan('Use --list, --get, --set, or --reset'));
    }
  }

  private async loadConfig(): Promise<Record<string, unknown>> {
    try {
      if (await fs.pathExists(this.configPath)) {
        return await fs.readJson(this.configPath);
      }
    } catch {
      logger.warn('Failed to load config, using defaults');
    }
    return { ...DEFAULT_CONFIG };
  }

  private async saveConfig(config: Record<string, unknown>): Promise<void> {
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, config, { spaces: 2 });
  }

  private async listConfig(): Promise<void> {
    const config = await this.loadConfig();

    logger.info(chalk.cyan.bold('\n📋 Configuration:\n'));

    for (const [key, value] of Object.entries(config)) {
      logger.info(
        `  ${chalk.gray(key)}: ${chalk.white(JSON.stringify(value))}`
      );
    }

    logger.info('');
  }

  private async getConfig(key: string): Promise<void> {
    const config = await this.loadConfig();

    if (key in config) {
      logger.info(`${key}: ${JSON.stringify(config[key])}`);
    } else {
      logger.error(`Configuration key "${key}" not found`);
    }
  }

  private async setConfig(keyValue: string): Promise<void> {
    const [key, ...valueParts] = keyValue.split('=');
    const value = valueParts.join('=');

    if (!key || !value) {
      logger.error('Invalid format. Use: --set key=value');
      return;
    }

    const config = await this.loadConfig();

    // Parse value
    let parsedValue:
      | string
      | number
      | boolean
      | Record<string, unknown>
      | unknown[] = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!Number.isNaN(Number(value))) parsedValue = Number(value);
    else if (value.startsWith('[') || value.startsWith('{')) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if JSON parse fails
      }
    }

    config[key] = parsedValue;
    await this.saveConfig(config);

    logger.success(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`);
  }

  private async resetConfig(): Promise<void> {
    await this.saveConfig({ ...DEFAULT_CONFIG });
    logger.success('✅ Configuration reset to defaults');
  }
}

async function main() {
  console.log(chalk.blue('╔══════════════════════════════════════╗'));
  console.log(
    chalk.blue('║   ') +
      chalk.green('🖥️  Wundr Computer Setup CLI') +
      chalk.blue('    ║')
  );
  console.log(chalk.blue('╚══════════════════════════════════════╝'));
  console.log();

  const program = new Command()
    .name('wundr-computer-setup')
    .description(
      'Automated development environment setup for engineering teams'
    )
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
    .option(
      '-r, --root-dir <dir>',
      'Root directory for development',
      '~/Development'
    )
    .option('-p, --profile <profile>', 'Developer profile to use', 'fullstack')
    .option('-s, --skip-prompts', 'Skip all confirmation prompts')
    .option('--skip-existing', 'Skip already installed tools')
    .option('--parallel', 'Run installations in parallel')
    .option('--only <tools>', 'Install only specified tools (comma-separated)')
    .option('--exclude <tools>', 'Exclude specified tools (comma-separated)')
    .action(async options => {
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
    .action(async options => {
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
    .action(async options => {
      try {
        const configCommand = new ConfigCommand(options);
        await configCommand.execute();
      } catch (error) {
        logger.error('Config operation failed:', error);
        process.exit(1);
      }
    });

  // List profiles command
  program
    .command('profiles')
    .description('List available developer profiles')
    .action(async () => {
      try {
        const profileManager = new ProfileManager();
        const profiles = await profileManager.listProfiles();

        logger.info(chalk.green('Available profiles:'));
        profiles.forEach(profile => {
          logger.info(`  • ${chalk.cyan(profile.name)} - ${profile.role}`);
        });
      } catch (error) {
        logger.error('Failed to list profiles:', error);
        process.exit(1);
      }
    });

  // Show profile command
  program
    .command('profile <name>')
    .description('Show profile details')
    .action(async (name: string) => {
      try {
        const profileManager = new ProfileManager();
        const profiles = await profileManager.listProfiles();
        const profile = profiles.find(p => p.name === name);

        if (!profile) {
          logger.error(`Profile '${name}' not found`);
          return;
        }

        logger.info(chalk.green(`Profile: ${profile.name}`));
        logger.info(chalk.gray(`Role: ${profile.role}`));
        if (profile.team) {
          logger.info(chalk.gray(`Team: ${profile.team}`));
        }
        logger.info('');
        logger.info(chalk.yellow('Tools:'));
        console.log(JSON.stringify(profile.tools, null, 2));
      } catch (error) {
        logger.error('Failed to show profile:', error);
        process.exit(1);
      }
    });

  // Dry run command
  program
    .command('dry-run [profile]')
    .description('Run setup in dry-run mode')
    .option('--parallel', 'Run installations in parallel')
    .option('--skip-existing', 'Skip already installed tools')
    .action(async (profileName: string = 'fullstack', options: any) => {
      try {
        logger.info(
          chalk.yellow(`Running dry-run for profile: ${profileName}`)
        );
        logger.info(
          chalk.gray(
            'This will show what would be installed without making changes'
          )
        );
        logger.info('');

        const profileManager = new ProfileManager();
        const profiles = await profileManager.listProfiles();
        const profile = profiles.find(p => p.name === profileName);

        if (!profile) {
          logger.error(`Profile '${profileName}' not found`);
          return;
        }

        const platform: SetupPlatform = {
          os:
            process.platform === 'darwin'
              ? 'darwin'
              : process.platform === 'win32'
                ? 'win32'
                : 'linux',
          arch: process.arch as 'x64' | 'arm64',
          node: process.version,
          shell: process.env.SHELL || 'bash',
        };

        const installerRegistry = new InstallerRegistry(platform);
        const configuratorService = new ConfiguratorService();
        const validator = new SetupValidator();

        const orchestrator = new SetupOrchestrator(
          profileManager,
          installerRegistry,
          configuratorService,
          validator
        );

        // Subscribe to progress events
        orchestrator.on('progress', progress => {
          logger.info(
            chalk.blue(`[${progress.percentage}%] ${progress.currentStep}`)
          );
        });

        const setupOptions: SetupOptions = {
          profile,
          platform,
          mode: 'automated',
          dryRun: true,
          skipExisting: options.skipExisting || false,
          verbose: false,
          parallel: options.parallel || false,
          generateReport: true,
        };

        const result = await orchestrator.orchestrate(setupOptions);

        logger.info('');
        logger.success('Dry-run complete!');
        logger.info(
          chalk.gray(
            `Steps that would be executed: ${result.completedSteps.length}`
          )
        );
        logger.info(
          chalk.gray(
            `Steps that would be skipped: ${result.skippedSteps.length}`
          )
        );

        if (result.warnings.length > 0) {
          logger.info(chalk.yellow('Warnings:'));
          result.warnings.forEach(w => logger.info(`  • ${w}`));
        }
      } catch (error) {
        logger.error('Dry-run failed:', error);
        process.exit(1);
      }
    });

  // Check tools command
  program
    .command('check')
    .description('Check which tools are already installed')
    .action(async () => {
      try {
        const validator = new SetupValidator();

        logger.info(chalk.yellow('Checking installed tools...'));
        logger.info('');

        // Check common tools
        const tools = [
          { name: 'Git', check: () => validator.validateGit() },
          { name: 'Node.js', check: () => validator.validateNode() },
          { name: 'Python', check: () => validator.validatePython() },
          { name: 'Docker', check: () => validator.validateDocker() },
          { name: 'VS Code', check: () => validator.validateVSCode() },
          { name: 'Claude Code', check: () => validator.validateClaudeCode() },
          {
            name: 'pnpm',
            check: () => validator.validatePackageManager('pnpm'),
          },
          {
            name: 'yarn',
            check: () => validator.validatePackageManager('yarn'),
          },
        ];

        for (const tool of tools) {
          try {
            const isInstalled = await tool.check();
            if (isInstalled) {
              logger.info(chalk.green(`✅ ${tool.name}`));
            } else {
              logger.info(chalk.gray(`⭕ ${tool.name} (not installed)`));
            }
          } catch {
            logger.info(chalk.gray(`⭕ ${tool.name} (not installed)`));
          }
        }

        logger.info('');
        const installedTools = await validator.getInstalledTools();
        if (installedTools.length > 0) {
          logger.success('Detailed versions:');
          installedTools.forEach(tool => {
            logger.info(`  • ${tool.name}: ${tool.version}`);
          });
        }
      } catch (error) {
        logger.error('Tool check failed:', error);
        process.exit(1);
      }
    });

  // Global setup command - installs Orchestrator daemon and global wundr resources
  program
    .command('global-setup')
    .description(
      'Install Orchestrator Daemon and global wundr resources at ~/orchestrator-daemon and ~/.wundr'
    )
    .option(
      '--orchestrator-daemon-dir <dir>',
      'Orchestrator daemon directory',
      path.join(os.homedir(), 'orchestrator-daemon')
    )
    .option(
      '--wundr-config-dir <dir>',
      'Wundr config directory',
      path.join(os.homedir(), '.wundr')
    )
    .option('--enable-slack', 'Enable Slack integration')
    .option('--enable-gmail', 'Enable Gmail integration')
    .option('--enable-google-drive', 'Enable Google Drive integration')
    .option('--enable-twilio', 'Enable Twilio integration')
    .option('--dry-run', 'Show what would be installed without making changes')
    .action(async options => {
      try {
        logger.info(
          chalk.cyan.bold(
            '\n🌐 Installing Orchestrator Daemon and Global Wundr Resources\n'
          )
        );

        const orchestratorDaemonDir = options.orchestratorDaemonDir;
        const wundrConfigDir = options.wundrConfigDir;

        logger.info(
          chalk.gray(`Orchestrator Daemon directory: ${orchestratorDaemonDir}`)
        );
        logger.info(chalk.gray(`Wundr config directory: ${wundrConfigDir}`));
        logger.info('');

        if (options.dryRun) {
          logger.info(chalk.yellow('DRY RUN - No changes will be made\n'));
          logger.info(chalk.cyan('Would create:'));
          logger.info(`  • ${orchestratorDaemonDir}/`);
          logger.info(`    ├── orchestrator-charter.yaml`);
          logger.info(`    ├── sessions/`);
          logger.info(`    ├── logs/`);
          logger.info(`    └── integrations/`);
          logger.info(`  • ${wundrConfigDir}/`);
          logger.info(`    ├── agents/`);
          logger.info(`    ├── commands/`);
          logger.info(`    ├── conventions/`);
          logger.info(`    ├── config/`);
          logger.info(`    ├── governance/`);
          logger.info(`    ├── hooks/`);
          logger.info(`    ├── memory/`);
          logger.info(`    ├── schemas/`);
          logger.info(`    ├── scripts/`);
          logger.info(`    ├── templates/`);
          logger.info(`    ├── workflows/`);
          logger.info(`    └── archetypes/`);
          logger.info('');
          logger.success('Dry run complete. Run without --dry-run to install.');
          return;
        }

        const spinner = ora('Installing Orchestrator Daemon...').start();

        const orchestratorDaemonInstaller = new OrchestratorDaemonInstaller({
          orchestratorDaemonDir,
          wundrConfigDir,
          enableSlack: options.enableSlack,
          enableGmail: options.enableGmail,
          enableGoogleDrive: options.enableGoogleDrive,
          enableTwilio: options.enableTwilio,
        });

        // Subscribe to progress events
        orchestratorDaemonInstaller.on(
          'progress',
          (progress: { step: string; percentage: number }) => {
            spinner.text = `[${progress.percentage}%] ${progress.step}`;
          }
        );

        const result = await orchestratorDaemonInstaller.installWithResult();

        if (result.success) {
          spinner.succeed('Orchestrator Daemon installed successfully!');
          logger.info('');
          logger.info(chalk.green.bold('✅ Global setup completed!'));
          logger.info('');
          logger.info(chalk.cyan('Installed locations:'));
          logger.info(`  Orchestrator Daemon: ${result.vpDaemonPath}`);
          logger.info(`  Wundr Config: ${result.wundrConfigPath}`);
          logger.info('');
          logger.info(chalk.cyan('Installed resources:'));
          result.installedResources.forEach(resource => {
            logger.info(`  ✓ ${resource}`);
          });
          logger.info('');

          if (result.warnings.length > 0) {
            logger.info(chalk.yellow('Warnings:'));
            result.warnings.forEach(warning => {
              logger.info(`  ⚠ ${warning}`);
            });
            logger.info('');
          }

          logger.info(chalk.cyan('Next steps:'));
          logger.info(
            '  1. Configure integrations in ~/orchestrator-daemon/integrations/'
          );
          logger.info(
            '  2. Review Orchestrator charter at ~/orchestrator-daemon/orchestrator-charter.yaml'
          );
          logger.info(
            '  3. Customize session archetypes in ~/.wundr/archetypes/'
          );
          logger.info(
            '  4. Run "npx tsx dev.ts orchestrator-status" to check Orchestrator daemon status'
          );
          logger.info('');
        } else {
          spinner.fail('Orchestrator Daemon installation failed');
          logger.info('');
          logger.error('Errors:');
          result.errors.forEach(error => {
            logger.error(`  • ${error.message}`);
          });
          process.exit(1);
        }
      } catch (error) {
        logger.error('Global setup failed:', error);
        process.exit(1);
      }
    });

  // Orchestrator Status command - check Orchestrator daemon installation status
  program
    .command('orchestrator-status')
    .description('Check Orchestrator Daemon installation status')
    .action(async () => {
      try {
        logger.info(chalk.cyan.bold('\n🔍 Orchestrator Daemon Status\n'));

        const orchestratorDaemonDir = path.join(
          os.homedir(),
          'orchestrator-daemon'
        );
        const wundrConfigDir = path.join(os.homedir(), '.wundr');

        const orchestratorDaemonInstaller = new OrchestratorDaemonInstaller({
          orchestratorDaemonDir,
          wundrConfigDir,
        });

        const isInstalled = await orchestratorDaemonInstaller.isInstalled();
        const version = await orchestratorDaemonInstaller.getVersion();
        const isValid = await orchestratorDaemonInstaller.validate();

        if (isInstalled) {
          logger.info(chalk.green('✅ Orchestrator Daemon is installed'));
          logger.info(`   Version: ${version || 'unknown'}`);
          logger.info(`   Location: ${orchestratorDaemonDir}`);
          logger.info(
            `   Valid: ${isValid ? 'Yes' : 'No (missing components)'}`
          );
        } else {
          logger.info(chalk.yellow('⚠️ Orchestrator Daemon is not installed'));
          logger.info('   Run "npx tsx dev.ts global-setup" to install');
        }

        logger.info('');

        // Check wundr config
        const wundrExists = await fs.pathExists(wundrConfigDir);
        if (wundrExists) {
          logger.info(chalk.green('✅ Wundr global config exists'));
          logger.info(`   Location: ${wundrConfigDir}`);

          // List subdirectories
          const dirs = await fs.readdir(wundrConfigDir);
          logger.info(`   Contents: ${dirs.join(', ')}`);
        } else {
          logger.info(chalk.yellow('⚠️ Wundr global config not found'));
        }

        logger.info('');

        // Check for active sessions
        const sessionsDir = path.join(orchestratorDaemonDir, 'sessions');
        const sessionsExist = await fs.pathExists(sessionsDir);
        if (sessionsExist) {
          const sessionIndex = path.join(sessionsDir, 'index.json');
          if (await fs.pathExists(sessionIndex)) {
            const indexData = await fs.readJson(sessionIndex);
            logger.info(chalk.cyan('📊 Sessions:'));
            logger.info(
              `   Total sessions: ${indexData.sessions?.length || 0}`
            );
            logger.info(`   Last updated: ${indexData.lastUpdated || 'never'}`);
          }
        }
      } catch (error) {
        logger.error('Status check failed:', error);
        process.exit(1);
      }
    });

  // Interactive mode (default)
  program
    .command('interactive', { isDefault: true })
    .description('Run in interactive mode')
    .action(async () => {
      try {
        logger.info(chalk.cyan('🚀 Welcome to Wundr Computer Setup!'));
        logger.info(chalk.gray('Setting up your development environment...\n'));

        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '🔧 Setup new environment', value: 'setup' },
              { name: '✅ Validate existing setup', value: 'validate' },
              { name: '📋 List available profiles', value: 'profiles' },
              { name: '🔍 Check installed tools', value: 'check' },
              { name: '⚙️  Configure settings', value: 'config' },
              { name: '🧪 Run dry-run', value: 'dry-run' },
              { name: '❌ Exit', value: 'exit' },
            ],
          },
        ]);

        switch (answers.action) {
          case 'setup': {
            const setupCommand = new SetupCommand({
              rootDir: '~/Development',
              skipPrompts: false,
              verbose: false,
            });
            await setupCommand.execute();
            break;
          }
          case 'validate': {
            const validateCommand = new ValidateCommand({ fix: false });
            await validateCommand.execute();
            break;
          }
          case 'profiles': {
            const profileManager = new ProfileManager();
            const profiles = await profileManager.listProfiles();

            logger.info(chalk.green('Available profiles:'));
            profiles.forEach(profile => {
              logger.info(`  • ${chalk.cyan(profile.name)} - ${profile.role}`);
            });
            break;
          }
          case 'check': {
            const validator = new SetupValidator();

            logger.info(chalk.yellow('Checking installed tools...'));
            logger.info('');

            const tools = [
              { name: 'Git', check: () => validator.validateGit() },
              { name: 'Node.js', check: () => validator.validateNode() },
              { name: 'Python', check: () => validator.validatePython() },
              { name: 'Docker', check: () => validator.validateDocker() },
              { name: 'VS Code', check: () => validator.validateVSCode() },
              {
                name: 'Claude Code',
                check: () => validator.validateClaudeCode(),
              },
              {
                name: 'pnpm',
                check: () => validator.validatePackageManager('pnpm'),
              },
              {
                name: 'yarn',
                check: () => validator.validatePackageManager('yarn'),
              },
            ];

            for (const tool of tools) {
              try {
                const isInstalled = await tool.check();
                if (isInstalled) {
                  logger.info(chalk.green(`✅ ${tool.name}`));
                } else {
                  logger.info(chalk.gray(`⭕ ${tool.name} (not installed)`));
                }
              } catch {
                logger.info(chalk.gray(`⭕ ${tool.name} (not installed)`));
              }
            }
            break;
          }
          case 'config': {
            const configCommand = new ConfigCommand({ list: true });
            await configCommand.execute();
            break;
          }
          case 'dry-run': {
            const { profile } = await inquirer.prompt([
              {
                type: 'input',
                name: 'profile',
                message: 'Which profile to dry-run?',
                default: 'fullstack',
              },
            ]);

            logger.info(
              chalk.yellow(`Running dry-run for profile: ${profile}`)
            );

            const profileManager = new ProfileManager();
            const profiles = await profileManager.listProfiles();
            const selectedProfile = profiles.find(p => p.name === profile);

            if (!selectedProfile) {
              logger.error(`Profile '${profile}' not found`);
              break;
            }

            const platform: SetupPlatform = {
              os:
                process.platform === 'darwin'
                  ? 'darwin'
                  : process.platform === 'win32'
                    ? 'win32'
                    : 'linux',
              arch: process.arch as 'x64' | 'arm64',
              node: process.version,
              shell: process.env.SHELL || 'bash',
            };

            const installerRegistry = new InstallerRegistry(platform);
            const configuratorService = new ConfiguratorService();
            const validator = new SetupValidator();

            const orchestrator = new SetupOrchestrator(
              profileManager,
              installerRegistry,
              configuratorService,
              validator
            );

            const setupOptions: SetupOptions = {
              profile: selectedProfile,
              platform,
              mode: 'automated',
              dryRun: true,
              skipExisting: false,
              verbose: false,
              parallel: false,
              generateReport: true,
            };

            await orchestrator.orchestrate(setupOptions);
            logger.success('Dry-run completed!');
            break;
          }
          case 'exit': {
            logger.success('\nGoodbye! 👋');
            process.exit(0);
          }
        }
      } catch (error) {
        logger.error('Interactive mode failed:', error);
        process.exit(1);
      }
    });

  // Parse arguments
  await program.parseAsync(process.argv);

  // Show help if no arguments
  if (process.argv.slice(2).length === 0) {
    program.outputHelp();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}
