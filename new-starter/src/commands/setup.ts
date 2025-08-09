import path from 'node:path';
import chalk from 'chalk';
import { writeFile, pathExists, remove } from 'fs-extra';
import ora from 'ora';
import { TOOLS, SCRIPT_PATHS, TOOL_GROUPS } from '../constants';
import type { SetupOptions, SetupContext } from '../types';
import { logger } from '../utils/logger';
import { promptForMissingInfo } from '../utils/prompts';
import { executeShellScript, checkCommand, getOS } from '../utils/system';

export class SetupCommand {
  private options: SetupOptions;
  private context: SetupContext | null = null;

  constructor(options: SetupOptions) {
    this.options = options;
  }

  async execute(): Promise<void> {
    logger.info(chalk.cyan.bold('\n🚀 Starting New Starter Setup\n'));

    // Initialize context
    this.context = await this.initializeContext();

    // Validate prerequisites
    await this.validatePrerequisites();

    // Select tools to install
    const selectedTools = await this.selectTools();

    // Create environment file
    await this.createEnvironmentFile();

    // Execute setup scripts
    await this.executeSetupScripts(selectedTools);

    // Finalize setup
    await this.finalizeSetup();

    logger.info(chalk.green.bold('\n✅ Setup completed successfully!\n'));
    logger.info(chalk.cyan('Please restart your terminal to apply all changes.'));
    logger.info(chalk.gray('Run "new-starter validate" to verify your setup.\n'));
  }

  private async initializeContext(): Promise<SetupContext> {
    const os = getOS();
    
    // Prompt for missing information if not skipping prompts
    const info = this.options.skipPrompts 
      ? this.options 
      : await promptForMissingInfo(this.options);

    return {
      email: info.email || '',
      githubUsername: info.githubUsername || '',
      githubEmail: info.githubEmail || info.email || '',
      fullName: info.name || '',
      company: info.company || undefined,
      role: info.role || 'Software Engineer',
      jobTitle: info.jobTitle || 'Building amazing software',
      rootDir: path.resolve(info.rootDir.replace('~', process.env.HOME || '')),
      os,
      skipPrompts: this.options.skipPrompts,
      verbose: this.options.verbose || false,
      selectedTools: [],
    };
  }

  private async validatePrerequisites(): Promise<void> {
    const spinner = ora('Validating prerequisites...').start();

    try {
      // Check for sudo access
      if (this.context?.os !== 'windows') {
        const hasSudo = await checkCommand('sudo');
        if (!hasSudo) {
          throw new Error('Sudo access is required for setup');
        }
      }

      // Check for curl
      const hasCurl = await checkCommand('curl');
      if (!hasCurl) {
        throw new Error('curl is required but not installed');
      }

      spinner.succeed('Prerequisites validated');
    } catch (error) {
      spinner.fail('Prerequisite validation failed');
      throw error;
    }
  }

  private async selectTools(): Promise<string[]> {
    if (this.options.only) {
      return this.options.only.split(',').map(t => t.trim());
    }

    const allTools = Object.values(TOOLS);
    
    if (this.options.exclude) {
      const excluded = new Set(this.options.exclude.split(',').map(t => t.trim()));
      return allTools.filter(tool => !excluded.has(tool));
    }

    return allTools;
  }

  private async createEnvironmentFile(): Promise<void> {
    if (!this.context) return;

    const envContent = `
export SETUP_EMAIL="${this.context.email}"
export SETUP_GITHUB_USERNAME="${this.context.githubUsername}"
export SETUP_GITHUB_EMAIL="${this.context.githubEmail}"
export SETUP_FULL_NAME="${this.context.fullName}"
export SETUP_COMPANY="${this.context.company || ''}"
export SETUP_ROLE="${this.context.role}"
export SETUP_JOB_TITLE="${this.context.jobTitle}"
export SETUP_ROOT_DIR="${this.context.rootDir}"
export SETUP_OS="${this.context.os}"
export SETUP_SKIP_PROMPTS="${this.context.skipPrompts}"
export SETUP_VERBOSE="${this.context.verbose}"
export SCRIPT_DIR="${path.join(__dirname, '../..')}"
export LOG_FILE="/tmp/new-starter-setup.log"
`.trim();

    await writeFile('/tmp/.env.setup', envContent, { mode: 0o600 });
  }

  private async executeSetupScripts(tools: string[]): Promise<void> {
    logger.info(chalk.cyan('\nExecuting setup scripts...\n'));

    for (const tool of tools) {
      const scriptPath = SCRIPT_PATHS[tool as keyof typeof SCRIPT_PATHS];
      if (!scriptPath) {
        logger.warn(`No script found for tool: ${tool}`);
        continue;
      }

      const spinner = ora(`Setting up ${tool}...`).start();

      try {
        const fullPath = path.join(__dirname, '../..', scriptPath);
        
        // Check if script exists
        if (!await pathExists(fullPath)) {
          spinner.warn(`Script not found: ${scriptPath}`);
          continue;
        }

        // Execute script
        await executeShellScript(fullPath, {
          env: {
            ...process.env,
            PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`,
          },
        });

        spinner.succeed(`${tool} setup completed`);
      } catch (error) {
        spinner.fail(`${tool} setup failed`);
        if (this.context?.verbose) {
          logger.error(error);
        }
        
        // Continue with other tools even if one fails
        if (this.isCriticalTool(tool)) {
          throw error;
        } else {
          logger.warn(`Continuing despite ${tool} failure...`);
        }
      }
    }
  }

  private isCriticalTool(tool: string): boolean {
    // Check if the tool is in the CORE group (which only includes permissions, brew, and node)
    const coreTools: readonly string[] = TOOL_GROUPS.CORE;
    return coreTools.includes(tool);
  }

  private async finalizeSetup(): Promise<void> {
    const spinner = ora('Finalizing setup...').start();

    try {
      // Run finalize script
      const finalizePath = path.join(__dirname, '../..', 'scripts/setup/10-finalize.sh');
      if (await pathExists(finalizePath)) {
        await executeShellScript(finalizePath);
      }

      // Clean up temp files
      await remove('/tmp/.env.setup').catch(() => {});

      spinner.succeed('Setup finalized');
    } catch (error) {
      spinner.fail('Finalization failed');
      if (this.context?.verbose) {
        logger.error(error);
      }
    }
  }
}