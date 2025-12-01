import { execSync } from 'child_process';
import * as path from 'path';

import chalk from 'chalk';
import * as fs from 'fs-extra';
import ora from 'ora';

import { Logger } from '../utils/logger.js';

const logger = new Logger({ name: 'validation-checker' });

export interface ValidationResult {
  passed: boolean;
  category: string;
  check: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  fixable: boolean;
  fix?: () => Promise<void>;
}

export interface ValidationReport {
  timestamp: Date;
  projectPath: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  score: number;
}

/**
 * Validation checker for project initialization
 * Ensures all components are properly set up
 */
export class ValidationChecker {
  private spinner = ora();

  /**
   * Run comprehensive validation checks
   */
  async validate(projectPath: string): Promise<ValidationReport> {
    this.spinner.start('Running validation checks...');

    const results: ValidationResult[] = [];

    // Directory structure checks
    results.push(...(await this.validateDirectoryStructure(projectPath)));

    // File existence checks
    results.push(...(await this.validateRequiredFiles(projectPath)));

    // Content validation checks
    results.push(...(await this.validateFileContents(projectPath)));

    // Configuration validation
    results.push(...(await this.validateConfigurations(projectPath)));

    // Agent setup validation
    results.push(...(await this.validateAgentSetup(projectPath)));

    // Hook validation
    results.push(...(await this.validateHooks(projectPath)));

    // Git setup validation
    results.push(...(await this.validateGitSetup(projectPath)));

    // Dependency validation
    results.push(...(await this.validateDependencies(projectPath)));

    // Calculate metrics
    const report = this.generateReport(projectPath, results);

    this.spinner.stop();
    this.displayReport(report);

    return report;
  }

  /**
   * Validate directory structure
   */
  private async validateDirectoryStructure(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const requiredDirs = [
      { path: '.claude', description: 'Claude configuration directory' },
      { path: '.claude/agents', description: 'Agent templates directory' },
      { path: '.claude/commands', description: 'Commands directory' },
      { path: '.claude/hooks', description: 'Hooks directory' },
      { path: '.claude/conventions', description: 'Conventions directory' },
      { path: '.claude/workflows', description: 'Workflows directory' },
      { path: 'src', description: 'Source code directory', optional: true },
      { path: 'tests', description: 'Tests directory', optional: true },
      { path: 'docs', description: 'Documentation directory' },
      { path: 'scripts', description: 'Scripts directory' },
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(projectPath, dir.path);
      const exists = await fs.pathExists(dirPath);

      results.push({
        passed: exists || dir.optional === true,
        category: 'Directory Structure',
        check: `${dir.path} exists`,
        message: exists
          ? `Directory ${dir.path} found`
          : `Missing ${dir.description}: ${dir.path}`,
        severity: dir.optional ? 'warning' : 'error',
        fixable: true,
        fix: async () => {
          await fs.ensureDir(dirPath);
        },
      });
    }

    return results;
  }

  /**
   * Validate required files
   */
  private async validateRequiredFiles(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const requiredFiles = [
      { path: 'CLAUDE.md', description: 'Claude configuration file' },
      { path: 'package.json', description: 'Package manifest', optional: true },
      { path: '.gitignore', description: 'Git ignore file' },
      { path: 'README.md', description: 'Project README' },
      { path: '.claude/agents/README.md', description: 'Agent index' },
      { path: 'docs/PROJECT_SETUP.md', description: 'Setup documentation' },
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(projectPath, file.path);
      const exists = await fs.pathExists(filePath);

      results.push({
        passed: exists || file.optional === true,
        category: 'Required Files',
        check: `${file.path} exists`,
        message: exists
          ? `File ${file.path} found`
          : `Missing ${file.description}: ${file.path}`,
        severity: file.optional ? 'warning' : 'error',
        fixable: false,
      });
    }

    return results;
  }

  /**
   * Validate file contents
   */
  private async validateFileContents(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate CLAUDE.md content
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (await fs.pathExists(claudeMdPath)) {
      const content = await fs.readFile(claudeMdPath, 'utf-8');

      // Check for essential sections
      const requiredSections = [
        'Project Overview',
        'VERIFICATION PROTOCOL',
        'Available Agents',
        'Code Style',
      ];

      for (const section of requiredSections) {
        const hasSection = content.includes(section);
        results.push({
          passed: hasSection,
          category: 'File Content',
          check: `CLAUDE.md contains ${section}`,
          message: hasSection
            ? `Section '${section}' found in CLAUDE.md`
            : `Missing section '${section}' in CLAUDE.md`,
          severity: 'warning',
          fixable: false,
        });
      }

      // Check for project-specific customization
      const hasProjectName = content.includes('{{PROJECT_NAME}}') === false;
      results.push({
        passed: hasProjectName,
        category: 'File Content',
        check: 'CLAUDE.md is customized',
        message: hasProjectName
          ? 'CLAUDE.md appears to be customized'
          : 'CLAUDE.md contains uncustomized placeholders',
        severity: 'warning',
        fixable: false,
      });
    }

    // Validate package.json if exists
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const pkg = await fs.readJson(packageJsonPath);

        results.push({
          passed: Boolean(pkg.name),
          category: 'File Content',
          check: 'package.json has name',
          message: pkg.name
            ? `Package name: ${pkg.name}`
            : 'Missing package name',
          severity: 'error',
          fixable: false,
        });

        results.push({
          passed: Boolean(pkg.version),
          category: 'File Content',
          check: 'package.json has version',
          message: pkg.version ? `Version: ${pkg.version}` : 'Missing version',
          severity: 'error',
          fixable: false,
        });

        // Check for essential scripts
        const essentialScripts = ['build', 'test'];
        for (const script of essentialScripts) {
          results.push({
            passed: Boolean(pkg.scripts?.[script]),
            category: 'File Content',
            check: `package.json has ${script} script`,
            message: pkg.scripts?.[script]
              ? `Script '${script}' defined`
              : `Missing '${script}' script`,
            severity: 'warning',
            fixable: false,
          });
        }
      } catch (_error) {
        results.push({
          passed: false,
          category: 'File Content',
          check: 'package.json is valid JSON',
          message: 'Invalid package.json format',
          severity: 'error',
          fixable: false,
        });
      }
    }

    return results;
  }

  /**
   * Validate configuration files
   */
  private async validateConfigurations(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const configFiles = [
      {
        path: '.claude/hooks/hooks.config.json',
        description: 'Hooks configuration',
      },
      {
        path: '.claude/worktree.config.json',
        description: 'Worktree configuration',
        optional: true,
      },
    ];

    for (const config of configFiles) {
      const configPath = path.join(projectPath, config.path);
      const exists = await fs.pathExists(configPath);

      if (exists || !config.optional) {
        results.push({
          passed: exists,
          category: 'Configuration',
          check: `${config.path} exists`,
          message: exists
            ? `Configuration file found: ${config.path}`
            : `Missing ${config.description}`,
          severity: config.optional ? 'info' : 'warning',
          fixable: true,
        });

        // Validate JSON structure
        if (exists) {
          try {
            await fs.readJson(configPath);
            results.push({
              passed: true,
              category: 'Configuration',
              check: `${config.path} is valid`,
              message: `Valid JSON configuration: ${config.path}`,
              severity: 'info',
              fixable: false,
            });
          } catch (_error) {
            results.push({
              passed: false,
              category: 'Configuration',
              check: `${config.path} is valid`,
              message: `Invalid JSON in ${config.path}`,
              severity: 'error',
              fixable: false,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate agent setup
   */
  private async validateAgentSetup(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const agentsDir = path.join(projectPath, '.claude/agents');

    if (await fs.pathExists(agentsDir)) {
      // Check for agent categories
      const expectedCategories = ['core', 'specialized', 'github', 'testing'];

      for (const category of expectedCategories) {
        const categoryPath = path.join(agentsDir, category);
        const exists = await fs.pathExists(categoryPath);

        results.push({
          passed: exists,
          category: 'Agent Setup',
          check: `Agent category '${category}' exists`,
          message: exists
            ? `Agent category found: ${category}`
            : `Missing agent category: ${category}`,
          severity: 'warning',
          fixable: true,
          fix: async () => {
            await fs.ensureDir(categoryPath);
          },
        });

        // Check for agent files in category
        if (exists) {
          const files = await fs.readdir(categoryPath);
          const agentFiles = files.filter(
            f => f.endsWith('.md') || f.endsWith('.json')
          );

          results.push({
            passed: agentFiles.length > 0,
            category: 'Agent Setup',
            check: `${category} has agent templates`,
            message:
              agentFiles.length > 0
                ? `Found ${agentFiles.length} agent templates in ${category}`
                : `No agent templates in ${category}`,
            severity: 'info',
            fixable: false,
          });
        }
      }

      // Check for README
      const readmePath = path.join(agentsDir, 'README.md');
      results.push({
        passed: await fs.pathExists(readmePath),
        category: 'Agent Setup',
        check: 'Agent README exists',
        message: (await fs.pathExists(readmePath))
          ? 'Agent documentation found'
          : 'Missing agent documentation',
        severity: 'warning',
        fixable: false,
      });
    }

    return results;
  }

  /**
   * Validate hooks
   */
  private async validateHooks(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const hooksDir = path.join(projectPath, '.claude/hooks');

    if (await fs.pathExists(hooksDir)) {
      const requiredHooks = [
        'pre-task.sh',
        'post-task.sh',
        'pre-edit.sh',
        'post-edit.sh',
      ];

      for (const hook of requiredHooks) {
        const hookPath = path.join(hooksDir, hook);
        const exists = await fs.pathExists(hookPath);

        results.push({
          passed: exists,
          category: 'Hooks',
          check: `Hook ${hook} exists`,
          message: exists ? `Hook found: ${hook}` : `Missing hook: ${hook}`,
          severity: 'warning',
          fixable: false,
        });

        // Check if hook is executable
        if (exists) {
          try {
            const stats = await fs.stat(hookPath);
            const isExecutable = (stats.mode & 0o111) !== 0;

            results.push({
              passed: isExecutable,
              category: 'Hooks',
              check: `${hook} is executable`,
              message: isExecutable
                ? `Hook ${hook} has execute permissions`
                : `Hook ${hook} is not executable`,
              severity: 'warning',
              fixable: true,
              fix: async () => {
                await fs.chmod(hookPath, '755');
              },
            });
          } catch (_error) {
            // Ignore permission errors
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate git setup
   */
  private async validateGitSetup(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check if it's a git repository
    const gitDir = path.join(projectPath, '.git');
    const isGitRepo = await fs.pathExists(gitDir);

    results.push({
      passed: isGitRepo,
      category: 'Git Setup',
      check: 'Git repository initialized',
      message: isGitRepo ? 'Git repository found' : 'Not a git repository',
      severity: 'warning',
      fixable: true,
      fix: async () => {
        try {
          execSync('git init', { cwd: projectPath, stdio: 'ignore' });
        } catch (_error) {
          // Ignore error
        }
      },
    });

    if (isGitRepo) {
      // Check for .gitignore
      const gitignorePath = path.join(projectPath, '.gitignore');
      results.push({
        passed: await fs.pathExists(gitignorePath),
        category: 'Git Setup',
        check: '.gitignore exists',
        message: (await fs.pathExists(gitignorePath))
          ? '.gitignore found'
          : 'Missing .gitignore',
        severity: 'warning',
        fixable: false,
      });
    }

    return results;
  }

  /**
   * Validate dependencies (if package.json exists)
   */
  private async validateDependencies(
    projectPath: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    const packageJsonPath = path.join(projectPath, 'package.json');
    const nodeModulesPath = path.join(projectPath, 'node_modules');

    if (await fs.pathExists(packageJsonPath)) {
      const hasNodeModules = await fs.pathExists(nodeModulesPath);

      results.push({
        passed: hasNodeModules,
        category: 'Dependencies',
        check: 'Dependencies installed',
        message: hasNodeModules
          ? 'node_modules directory found'
          : 'Dependencies not installed',
        severity: 'info',
        fixable: false,
      });

      // Check for lock file
      const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
      const hasLockFile = await Promise.all(
        lockFiles.map(f => fs.pathExists(path.join(projectPath, f)))
      ).then(results => results.some(r => r));

      results.push({
        passed: hasLockFile,
        category: 'Dependencies',
        check: 'Lock file exists',
        message: hasLockFile
          ? 'Dependency lock file found'
          : 'No lock file found',
        severity: 'info',
        fixable: false,
      });
    }

    return results;
  }

  /**
   * Generate validation report
   */
  private generateReport(
    projectPath: string,
    results: ValidationResult[]
  ): ValidationReport {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(
      r => !r.passed && r.severity === 'error'
    ).length;
    const warnings = results.filter(
      r => !r.passed && r.severity === 'warning'
    ).length;

    const score = (passed / results.length) * 100;

    return {
      timestamp: new Date(),
      projectPath,
      totalChecks: results.length,
      passed,
      failed,
      warnings,
      results,
      score,
    };
  }

  /**
   * Display validation report
   */
  private displayReport(report: ValidationReport): void {
    logger.info(chalk.blue.bold('\n Validation Report\n'));

    logger.info(chalk.white(`Project: ${path.basename(report.projectPath)}`));
    logger.info(chalk.white(`Total Checks: ${report.totalChecks}`));
    logger.info(chalk.green(`Passed: ${report.passed}`));
    logger.info(chalk.red(`Failed: ${report.failed}`));
    logger.info(chalk.yellow(`Warnings: ${report.warnings}`));

    const scoreColor =
      report.score >= 90
        ? chalk.green
        : report.score >= 70
          ? chalk.yellow
          : chalk.red;
    logger.info(scoreColor(`Score: ${report.score.toFixed(1)}%\n`));

    // Group results by category
    const categories = new Set(report.results.map(r => r.category));

    for (const category of categories) {
      const categoryResults = report.results.filter(
        r => r.category === category
      );
      const categoryPassed = categoryResults.filter(r => r.passed).length;

      logger.info(
        chalk.cyan(
          `\n${category} (${categoryPassed}/${categoryResults.length})`
        )
      );

      for (const result of categoryResults) {
        const icon = result.passed
          ? chalk.green('v')
          : result.severity === 'error'
            ? chalk.red('x')
            : result.severity === 'warning'
              ? chalk.yellow('!')
              : chalk.blue('i');

        logger.info(`  ${icon} ${result.check}: ${result.message}`);
      }
    }

    // Show fixable issues
    const fixable = report.results.filter(r => !r.passed && r.fixable);
    if (fixable.length > 0) {
      logger.warn(
        chalk.yellow(`\n ${fixable.length} issues can be automatically fixed`)
      );
    }

    logger.info('');
  }

  /**
   * Auto-fix fixable issues
   */
  async autoFix(projectPath: string): Promise<void> {
    const report = await this.validate(projectPath);
    const fixable = report.results.filter(r => !r.passed && r.fixable && r.fix);

    if (fixable.length === 0) {
      logger.info(chalk.green('No fixable issues found'));
      return;
    }

    logger.info(
      chalk.blue(`\nAttempting to fix ${fixable.length} issues...\n`)
    );

    for (const issue of fixable) {
      try {
        this.spinner.start(`Fixing: ${issue.check}`);
        await issue.fix!();
        this.spinner.succeed(`Fixed: ${issue.check}`);
      } catch (_error) {
        this.spinner.fail(`Failed to fix: ${issue.check}`);
      }
    }

    logger.info(chalk.green('\nAuto-fix complete. Re-running validation...\n'));
    await this.validate(projectPath);
  }
}

export default ValidationChecker;
