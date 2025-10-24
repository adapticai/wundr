/**
 * Project Templates Manager
 * Handles creation of wundr-compliant projects
 */

import { execSync } from 'child_process';
import * as path from 'path';

import { getLogger } from '@wundr.io/core';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import Handlebars from 'handlebars';
import inquirer from 'inquirer';
import ora from 'ora';
import validatePackageName from 'validate-npm-package-name';

import { backendFastifyTemplate } from './templates/backend-fastify';
import { frontendNextTemplate } from './templates/frontend-next';
import { monorepoTurborepoTemplate } from './templates/monorepo-turborepo';
import { wundrFiles } from './templates/wundr-files';

import type {
  ProjectOptions,
  ProjectType,
  TemplateConfig,
  TemplateContext,
  ValidationResult,
} from './types';

const logger = getLogger();

export class ProjectTemplateManager {
  private templates: Map<string, TemplateConfig> = new Map();

  constructor() {
    this.registerTemplates();
  }

  /**
   * Register all available templates
   */
  private registerTemplates(): void {
    this.templates.set('frontend-next', frontendNextTemplate);
    this.templates.set('backend-fastify', backendFastifyTemplate);
    this.templates.set('monorepo-turborepo', monorepoTurborepoTemplate);
  }

  /**
   * Create a new project from template
   */
  async createProject(options: ProjectOptions): Promise<void> {
    const spinner = ora();

    try {
      // Validate project name
      const validation = this.validateProjectName(options.name);
      if (!validation.valid) {
        throw new Error(
          `Invalid project name: ${validation.errors.join(', ')}`,
        );
      }

      // Determine project path
      const projectPath = path.resolve(
        options.path || process.cwd(),
        options.name,
      );

      // Check if directory exists
      if (await fs.pathExists(projectPath)) {
        throw new Error(`Directory ${projectPath} already exists`);
      }

      // Get template
      const templateKey = this.getTemplateKey(options.type, options.framework);
      const template = this.templates.get(templateKey);
      if (!template) {
        throw new Error(`Template not found: ${templateKey}`);
      }

      spinner.start('Creating project structure...');

      // Create project directory
      await fs.ensureDir(projectPath);

      // Create template context
      const context = this.createTemplateContext(options);

      // Generate package.json
      await this.createPackageJson(projectPath, template, context);

      // Copy template files
      await this.copyTemplateFiles(projectPath, template, context);

      // Add wundr-specific files
      await this.addWundrFiles(projectPath, context);

      spinner.succeed('Project structure created');

      // Initialize git
      if (options.git !== false) {
        spinner.start('Initializing git repository...');
        await this.initializeGit(projectPath);
        spinner.succeed('Git repository initialized');
      }

      // Install dependencies
      if (options.install !== false) {
        spinner.start('Installing dependencies...');
        await this.installDependencies(projectPath);
        spinner.succeed('Dependencies installed');
      }

      // Run post-install commands
      if (template.postInstall && template.postInstall.length > 0) {
        spinner.start('Running post-install setup...');
        await this.runPostInstall(projectPath, template.postInstall);
        spinner.succeed('Post-install setup complete');
      }

      // Generate initial governance baseline
      spinner.start('Creating wundr governance baseline...');
      await this.createGovernanceBaseline(projectPath);
      spinner.succeed('Governance baseline created');

      /* eslint-disable no-console */
      // Success message
      console.log(chalk.green('\\n✨ Project created successfully!'));
      console.log(chalk.cyan(`\\n📁 Project location: ${projectPath}`));
      console.log(chalk.yellow('\\n🚀 Get started:'));
      console.log(chalk.gray(`   cd ${options.name}`));
      console.log(chalk.gray('   npm run dev'));
      console.log(chalk.gray('\\n📊 Check governance:'));
      console.log(chalk.gray('   wundr analyze'));
      console.log(chalk.gray('   wundr govern check'));
      /* eslint-enable no-console */
    } catch (error) {
      spinner.fail('Project creation failed');
      throw error;
    }
  }

  /**
   * Interactive project creation
   */
  async createInteractive(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        validate: (input: string) => {
          const validation = this.validateProjectName(input);
          return validation.valid || validation.errors.join(', ');
        },
      },
      {
        type: 'list',
        name: 'type',
        message: 'Project type:',
        choices: [
          { name: 'Frontend Application', value: 'frontend' },
          { name: 'Backend API', value: 'backend' },
          { name: 'Full Stack Application', value: 'fullstack' },
          { name: 'Monorepo Platform', value: 'monorepo' },
          { name: 'NPM Library', value: 'library' },
          { name: 'CLI Tool', value: 'cli' },
        ],
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: (answers: Record<string, unknown>) =>
          this.getFrameworkChoices((answers as { type: ProjectType }).type),
        when: (answers: Record<string, unknown>) =>
          ['frontend', 'backend', 'fullstack'].includes(
            (answers as { type: ProjectType }).type,
          ),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: 'A wundr-compliant project',
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:',
        default: () => {
          try {
            return execSync('git config user.name').toString().trim();
          } catch {
            return '';
          }
        },
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'testing',
        message: 'Include testing setup?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'ci',
        message: 'Include CI/CD workflows?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'docker',
        message: 'Include Docker configuration?',
        default: false,
      },
      {
        type: 'confirm',
        name: 'install',
        message: 'Install dependencies?',
        default: true,
      },
    ]);

    await this.createProject(answers as unknown as ProjectOptions);
  }

  /**
   * Validate project name
   */
  private validateProjectName(name: string): ValidationResult {
    const result = validatePackageName(name);

    if (!result.validForNewPackages) {
      return {
        valid: false,
        errors: result.errors || ['Invalid package name'],
        warnings: result.warnings || [],
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: result.warnings || [],
    };
  }

  /**
   * Get template key based on type and framework
   */
  private getTemplateKey(type: ProjectType, framework?: string): string {
    if (type === 'monorepo') {
      return 'monorepo-turborepo';
    }

    if (type === 'frontend' || framework === 'next') {
      return 'frontend-next';
    }

    if (type === 'backend' || framework === 'fastify') {
      return 'backend-fastify';
    }

    // Default templates for other types
    if (type === 'fullstack') {
      return 'monorepo-turborepo';
    }

    return 'frontend-next'; // Default
  }

  /**
   * Get framework choices based on project type
   */
  private getFrameworkChoices(
    type: ProjectType,
  ): Array<{ name: string; value: string }> {
    switch (type) {
      case 'frontend':
        return [
          { name: 'Next.js', value: 'next' },
          { name: 'React (Vite)', value: 'react' },
          { name: 'Vue', value: 'vue' },
        ];
      case 'backend':
        return [
          { name: 'Fastify', value: 'fastify' },
          { name: 'Express', value: 'express' },
          { name: 'NestJS', value: 'nestjs' },
        ];
      case 'fullstack':
        return [
          { name: 'Next.js + Fastify', value: 'next-fastify' },
          { name: 'T3 Stack', value: 't3' },
        ];
      default:
        return [];
    }
  }

  /**
   * Create template context for handlebars
   */
  private createTemplateContext(options: ProjectOptions): TemplateContext {
    return {
      projectName: options.name,
      projectNameKebab: options.name.toLowerCase().replace(/\\s+/g, '-'),
      projectNamePascal: options.name
        .split(/[\\s\\-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(''),
      description: options.description || 'A wundr-compliant project',
      author: options.author || '',
      license: options.license || 'MIT',
      year: new Date().getFullYear(),
      typescript: options.typescript !== false,
      testing: options.testing !== false,
      ci: options.ci !== false,
      docker: options.docker === true,
      wundrVersion: '1.0.0',
    };
  }

  /**
   * Create package.json
   */
  private async createPackageJson(
    projectPath: string,
    template: TemplateConfig,
    context: TemplateContext,
  ): Promise<void> {
    const packageJson = {
      name: context.projectNameKebab,
      version: '1.0.0',
      description: context.description,
      author: context.author,
      license: context.license,
      private: true,
      scripts: template.scripts,
      dependencies: template.dependencies,
      devDependencies: template.devDependencies,
    };

    await fs.writeJSON(path.join(projectPath, 'package.json'), packageJson, {
      spaces: 2,
    });
  }

  /**
   * Copy template files
   */
  private async copyTemplateFiles(
    projectPath: string,
    template: TemplateConfig,
    context: TemplateContext,
  ): Promise<void> {
    for (const file of template.files) {
      const filePath = path.join(projectPath, file.path);
      await fs.ensureDir(path.dirname(filePath));

      let content =
        typeof file.content === 'function' ? file.content() : file.content;

      // Process template if needed
      if (file.template) {
        const compiledTemplate = Handlebars.compile(content);
        content = compiledTemplate(context);
      }

      await fs.writeFile(filePath, content);
    }
  }

  /**
   * Add wundr-specific files
   */
  private async addWundrFiles(
    projectPath: string,
    context: TemplateContext,
  ): Promise<void> {
    for (const file of wundrFiles) {
      const filePath = path.join(projectPath, file.path);
      await fs.ensureDir(path.dirname(filePath));

      let content =
        typeof file.content === 'function' ? file.content() : file.content;

      // Process template if needed
      if (file.template) {
        const compiledTemplate = Handlebars.compile(content);
        content = compiledTemplate(context);
      }

      await fs.writeFile(filePath, content);
    }
  }

  /**
   * Initialize git repository
   */
  private async initializeGit(projectPath: string): Promise<void> {
    execSync('git init', { cwd: projectPath, stdio: 'ignore' });
    execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
    execSync('git commit -m "feat: initial commit (wundr-compliant project)"', {
      cwd: projectPath,
      stdio: 'ignore',
    });
  }

  /**
   * Install dependencies
   */
  private async installDependencies(projectPath: string): Promise<void> {
    // Detect package manager
    const packageManager = await this.detectPackageManager();

    execSync(`${packageManager} install`, {
      cwd: projectPath,
      stdio: 'ignore',
    });
  }

  /**
   * Run post-install commands
   */
  private async runPostInstall(
    projectPath: string,
    commands: string[],
  ): Promise<void> {
    for (const command of commands) {
      try {
        execSync(command, {
          cwd: projectPath,
          stdio: 'ignore',
        });
      } catch (_error) {
        logger.warn(`Post-install command failed: ${command}`);
      }
    }
  }

  /**
   * Create initial governance baseline
   */
  private async createGovernanceBaseline(projectPath: string): Promise<void> {
    try {
      execSync('wundr govern baseline', {
        cwd: projectPath,
        stdio: 'ignore',
      });
    } catch {
      // Wundr CLI might not be installed globally
      logger.warn('Could not create governance baseline - wundr CLI not found');
    }
  }

  /**
   * Detect package manager
   */
  private async detectPackageManager(): Promise<string> {
    // Check for pnpm
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      return 'pnpm';
    } catch {
      // Package manager not available
    }

    // Check for yarn
    try {
      execSync('yarn --version', { stdio: 'ignore' });
      return 'yarn';
    } catch {
      // Package manager not available
    }

    // Default to npm
    return 'npm';
  }

  /**
   * List available templates
   */
  listTemplates(): void {
    /* eslint-disable no-console */
    console.log(chalk.cyan('\\n📦 Available Templates:\\n'));

    for (const [key, template] of this.templates) {
      console.log(chalk.yellow(`  ${template.displayName}`));
      console.log(chalk.gray(`    Key: ${key}`));
      console.log(chalk.gray(`    ${template.description}\\n`));
    }
    /* eslint-enable no-console */
  }
}

// Export singleton instance
export const projectTemplates = new ProjectTemplateManager();
