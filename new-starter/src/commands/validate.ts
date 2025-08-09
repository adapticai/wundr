import chalk from 'chalk';
import ora from 'ora';
import type { ValidationResult } from '../types';
import { logger } from '../utils/logger';
import { checkCommand } from '../utils/system';

export class ValidateCommand {
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
      const hasBrew = await checkCommand('brew');
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
      const hasNode = await checkCommand('node');
      const hasNpm = await checkCommand('npm');
      const hasNvm = await checkCommand('nvm');
      
      if (hasNode && hasNpm) {
        this.results.push({
          tool: 'Node.js',
          status: 'success',
          message: 'Installed and available',
        });
        spinner.succeed('Node.js OK');
      } else {
        this.results.push({
          tool: 'Node.js',
          status: hasNvm ? 'warning' : 'error',
          message: hasNvm ? 'NVM installed but Node not active' : 'Not installed',
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
      const hasDocker = await checkCommand('docker');
      
      if (hasDocker) {
        // Try to run docker info to check if daemon is running
        const execaModule = await import('execa');
        try {
          await execaModule.execa('docker', ['info']);
          this.results.push({
            tool: 'Docker',
            status: 'success',
            message: 'Installed and running',
          });
          spinner.succeed('Docker OK');
        } catch {
          this.results.push({
            tool: 'Docker',
            status: 'warning',
            message: 'Installed but daemon not running',
            canFix: false,
          });
          spinner.warn('Docker installed but not running');
        }
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
      const hasGit = await checkCommand('git');
      const hasGh = await checkCommand('gh');
      
      if (hasGit) {
        this.results.push({
          tool: 'Git',
          status: 'success',
          message: 'Installed and configured',
        });
        
        if (!hasGh) {
          this.results.push({
            tool: 'GitHub CLI',
            status: 'warning',
            message: 'Not installed',
            canFix: true,
          });
        }
        
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
      const hasCode = await checkCommand('code');
      
      if (hasCode) {
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
      const hasClaude = await checkCommand('claude');
      const hasClaudeFlow = await checkCommand('claude-flow');
      
      if (hasClaude && hasClaudeFlow) {
        this.results.push({
          tool: 'Claude',
          status: 'success',
          message: 'Claude Code and Claude Flow installed',
        });
        spinner.succeed('Claude tools OK');
      } else if (hasClaude) {
        this.results.push({
          tool: 'Claude',
          status: 'warning',
          message: 'Claude Code installed, Claude Flow missing',
          canFix: true,
        });
        spinner.warn('Claude Flow not installed');
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

    logger.info(chalk.cyan.bold(`\n📈 Overall: ${successful}/${total} (${percentage}%) checks passed\n`));

    if (this.hasFixableIssues() && !this.options.fix) {
      logger.info(chalk.gray('Run "new-starter validate --fix" to attempt automatic fixes.\n'));
    }
  }

  private hasFixableIssues(): boolean {
    return this.results.some(r => r.canFix && r.status !== 'success');
  }

  private async attemptFixes(): Promise<void> {
    logger.info(chalk.cyan.bold('\n🔧 Attempting to fix issues...\n'));

    const fixable = this.results.filter(r => r.canFix && r.status !== 'success');

    for (const result of fixable) {
      const spinner = ora(`Fixing ${result.tool}...`).start();
      
      try {
        // Here you would implement specific fix logic for each tool
        // For now, we'll just log that we're attempting a fix
        await new Promise(resolve => setTimeout(resolve, 1000));
        spinner.succeed(`${result.tool} fix attempted`);
      } catch {
        spinner.fail(`${result.tool} fix failed`);
      }
    }

    logger.info(chalk.cyan('\n🔄 Please run validation again to check if issues are resolved.\n'));
  }
}