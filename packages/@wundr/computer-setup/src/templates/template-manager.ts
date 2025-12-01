import * as path from 'path';

import chalk from 'chalk';
import * as fs from 'fs-extra';
import ora from 'ora';

import { Logger } from '../utils/logger.js';

import type { DeveloperProfile } from '../types/index.js';

const logger = new Logger({ name: 'template-manager' });

/** Supported template variable value types */
export type TemplateVariableValue =
  | string
  | boolean
  | number
  | unknown[]
  | Record<string, unknown>;

export interface TemplateVariable {
  name: string;
  value: TemplateVariableValue;
  type: 'string' | 'boolean' | 'number' | 'array' | 'object';
}

export interface TemplateContext {
  profile: DeveloperProfile;
  project: ProjectInfo;
  platform: PlatformInfo;
  customVariables?: Record<string, TemplateVariableValue>;
}

export interface ProjectInfo {
  name: string;
  description: string;
  version: string;
  type: 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java';
  packageManager: 'npm' | 'pnpm' | 'yarn';
  repository?: string;
  license: string;
  author: string;
  organization?: string;
}

export interface PlatformInfo {
  os: 'darwin' | 'linux' | 'win32';
  arch: 'x64' | 'arm64';
  nodeVersion: string;
  shell: 'bash' | 'zsh' | 'fish';
}

export interface TemplateOptions {
  templateDir: string;
  outputDir: string;
  context: TemplateContext;
  dryRun?: boolean;
  verbose?: boolean;
  overwrite?: boolean;
}

export class TemplateManager {
  private readonly templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(__dirname, '../../templates');
  }

  /**
   * Copy and customize templates for a project
   */
  async copyTemplates(options: TemplateOptions): Promise<void> {
    const spinner = ora('Copying and customizing templates').start();

    try {
      const templatePath = path.resolve(this.templatesDir, options.templateDir);
      const outputPath = path.resolve(options.outputDir);

      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Template directory not found: ${templatePath}`);
      }

      if (options.verbose) {
        spinner.text = `Processing templates from ${templatePath}`;
      }

      await this.processDirectory(templatePath, outputPath, options);

      spinner.succeed(chalk.green('Templates processed successfully'));
    } catch (error) {
      spinner.fail(chalk.red(`Template processing failed: ${error}`));
      throw error;
    }
  }

  /**
   * Copy specific template file with customization
   */
  async copyTemplate(
    templateName: string,
    outputPath: string,
    context: TemplateContext,
    options?: { overwrite?: boolean; verbose?: boolean }
  ): Promise<void> {
    const templatePath = this.getTemplatePath(templateName);

    if (!(await fs.pathExists(templatePath))) {
      throw new Error(`Template not found: ${templateName}`);
    }

    if (!options?.overwrite && (await fs.pathExists(outputPath))) {
      logger.info(chalk.yellow(`Skipping existing file: ${outputPath}`));
      return;
    }

    const content = await fs.readFile(templatePath, 'utf-8');
    const customizedContent = this.replaceVariables(content, context);

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, customizedContent);

    if (options?.verbose) {
      logger.info(chalk.blue(`Created: ${outputPath}`));
    }
  }

  /**
   * Generate configuration files for a project
   */
  async generateConfigs(
    projectPath: string,
    context: TemplateContext,
    configs: string[]
  ): Promise<void> {
    const spinner = ora('Generating configuration files').start();

    try {
      for (const config of configs) {
        await this.generateConfig(config, projectPath, context);
      }

      spinner.succeed(chalk.green('Configuration files generated'));
    } catch (error) {
      spinner.fail(chalk.red(`Configuration generation failed: ${error}`));
      throw error;
    }
  }

  /**
   * Generate a specific configuration file
   */
  private async generateConfig(
    configType: string,
    projectPath: string,
    context: TemplateContext
  ): Promise<void> {
    const configMap = {
      eslint: {
        template: 'config/eslint/eslint.config.js',
        output: '.eslintrc.js',
      },
      prettier: {
        template: 'config/prettier/.prettierrc.js',
        output: '.prettierrc.js',
      },
      jest: {
        template: 'config/jest/jest.config.js',
        output: 'jest.config.js',
      },
      'tsconfig-base': {
        template: 'config/typescript/tsconfig.base.json',
        output: 'tsconfig.json',
      },
      'tsconfig-node': {
        template: 'config/typescript/tsconfig.node.json',
        output: 'tsconfig.json',
      },
      'tsconfig-react': {
        template: 'config/typescript/tsconfig.react.json',
        output: 'tsconfig.json',
      },
      docker: {
        template: 'docker/Dockerfile.node',
        output: 'Dockerfile',
      },
      'docker-compose': {
        template: 'docker/docker-compose.yml',
        output: 'docker-compose.yml',
      },
      'github-issues': {
        template: 'github',
        output: '.github',
      },
      'slack-manifest': {
        template: 'slack/manifest.json',
        output: 'slack-manifest.json',
      },
      'claude-flow': {
        template: 'claude-flow/swarm.config.js',
        output: 'claude-flow.config.js',
      },
    };

    const config = configMap[configType as keyof typeof configMap];
    if (!config) {
      throw new Error(`Unknown config type: ${configType}`);
    }

    const outputPath = path.join(projectPath, config.output);

    if (config.template === 'github') {
      // Special handling for GitHub templates
      await this.copyGitHubTemplates(projectPath, context);
    } else {
      await this.copyTemplate(config.template, outputPath, context, {
        overwrite: true,
      });
    }
  }

  /**
   * Copy GitHub templates (issue templates, PR template)
   */
  private async copyGitHubTemplates(
    projectPath: string,
    context: TemplateContext
  ): Promise<void> {
    const githubDir = path.join(projectPath, '.github');
    await fs.ensureDir(githubDir);

    // Copy issue templates
    const issueTemplatesDir = path.join(githubDir, 'ISSUE_TEMPLATE');
    await fs.ensureDir(issueTemplatesDir);

    const issueTemplates = [
      'bug_report.md',
      'feature_request.md',
      'config.yml',
    ];
    for (const template of issueTemplates) {
      await this.copyTemplate(
        `github/ISSUE_TEMPLATE/${template}`,
        path.join(issueTemplatesDir, template),
        context,
        { overwrite: true }
      );
    }

    // Copy PR template
    await this.copyTemplate(
      'github/pull_request_template.md',
      path.join(githubDir, 'pull_request_template.md'),
      context,
      { overwrite: true }
    );
  }

  /**
   * Process directory recursively
   */
  private async processDirectory(
    templateDir: string,
    outputDir: string,
    options: TemplateOptions
  ): Promise<void> {
    const entries = await fs.readdir(templateDir, { withFileTypes: true });

    for (const entry of entries) {
      const templatePath = path.join(templateDir, entry.name);
      const outputPath = path.join(outputDir, entry.name);

      if (entry.isDirectory()) {
        await fs.ensureDir(outputPath);
        await this.processDirectory(templatePath, outputPath, options);
      } else {
        await this.processFile(templatePath, outputPath, options);
      }
    }
  }

  /**
   * Process individual file
   */
  private async processFile(
    templatePath: string,
    outputPath: string,
    options: TemplateOptions
  ): Promise<void> {
    if (!options.overwrite && (await fs.pathExists(outputPath))) {
      if (options.verbose) {
        logger.info(chalk.yellow(`Skipping existing file: ${outputPath}`));
      }
      return;
    }

    if (options.dryRun) {
      logger.info(chalk.blue(`Would create: ${outputPath}`));
      return;
    }

    const content = await fs.readFile(templatePath, 'utf-8');
    const customizedContent = this.replaceVariables(content, options.context);

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, customizedContent);

    if (options.verbose) {
      logger.info(chalk.green(`Created: ${outputPath}`));
    }
  }

  /**
   * Replace template variables in content
   */
  private replaceVariables(content: string, context: TemplateContext): string {
    const variables = this.buildVariableMap(context);

    // Replace simple variables {{VARIABLE}}
    let result = content.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const value = variables[varName.trim()];
      return value !== undefined ? String(value) : match;
    });

    // Handle conditional blocks {{#CONDITION}}...{{/CONDITION}}
    result = this.processConditionals(result, variables);

    // Handle list iterations {{#ARRAY}}...{{/ARRAY}}
    result = this.processArrays(result, variables);

    return result;
  }

  /**
   * Process conditional template blocks
   */
  private processConditionals(
    content: string,
    variables: Record<string, TemplateVariableValue>
  ): string {
    return content.replace(
      /\{\{#([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs,
      (match, condition, innerContent) => {
        const value = variables[condition.trim()];
        return this.isTruthy(value) ? innerContent : '';
      }
    );
  }

  /**
   * Process array template blocks
   */
  private processArrays(
    content: string,
    variables: Record<string, TemplateVariableValue>
  ): string {
    return content.replace(
      /\{\{#([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs,
      (match, arrayName, template) => {
        const array = variables[arrayName.trim()];

        if (!Array.isArray(array)) {
          return '';
        }

        return array
          .map((item, index) => {
            let itemContent = template;

            // Replace item properties
            if (typeof item === 'object') {
              for (const [key, value] of Object.entries(item)) {
                itemContent = itemContent.replace(
                  new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
                  String(value)
                );
              }
            } else {
              itemContent = itemContent.replace(/\{\{\.}\}/g, String(item));
            }

            // Handle special array variables
            itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
            itemContent = itemContent.replace(
              /\{\{@first\}\}/g,
              String(index === 0)
            );
            itemContent = itemContent.replace(
              /\{\{@last\}\}/g,
              String(index === array.length - 1)
            );

            return itemContent;
          })
          .join('');
      }
    );
  }

  /**
   * Build variable map from context
   */
  private buildVariableMap(
    context: TemplateContext
  ): Record<string, TemplateVariableValue> {
    const { profile, project, platform } = context;

    const variables: Record<string, TemplateVariableValue> = {
      // Project variables
      PROJECT_NAME: project.name,
      PROJECT_DESCRIPTION: project.description,
      PROJECT_VERSION: project.version,
      PROJECT_TYPE: project.type,
      PACKAGE_MANAGER: project.packageManager,
      REPOSITORY_URL: project.repository,
      LICENSE: project.license,
      AUTHOR: project.author,
      ORGANIZATION: project.organization,

      // Platform variables
      OS: platform.os,
      ARCH: platform.arch,
      NODE_VERSION: platform.nodeVersion,
      SHELL: platform.shell,

      // Profile variables
      DEVELOPER_NAME: profile.name,
      DEVELOPER_EMAIL: profile.email,
      ROLE: profile.role,
      TEAM: profile.team,

      // Common configurations
      PORT: 3000,
      HOST_PORT: 3000,
      CONTAINER_PORT: 3000,
      BUILD_OUTPUT_DIR: 'dist',
      ENTRY_POINT: 'index.js',

      // Environment variables
      NODE_ENV: 'development',

      // Tool configurations
      REACT_PROJECT: profile.frameworks?.react || false,
      TYPESCRIPT_PROJECT: true,
      NODE_PROJECT: true,

      // Database configurations
      INCLUDE_POSTGRES: profile.tools?.databases?.postgresql || false,
      INCLUDE_REDIS: profile.tools?.databases?.redis || false,
      POSTGRES_VERSION: '16',
      REDIS_VERSION: '7',

      // Custom variables
      ...context.customVariables,
    };

    return variables;
  }

  /**
   * Check if value is truthy for template conditions
   */
  private isTruthy(value: TemplateVariableValue): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      return value.length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return Boolean(value);
  }

  /**
   * Get template path
   */
  private getTemplatePath(templateName: string): string {
    return path.join(this.templatesDir, templateName);
  }

  /**
   * List available templates
   */
  async listTemplates(): Promise<string[]> {
    const templates: string[] = [];

    async function scanDir(dir: string, prefix = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await scanDir(fullPath, relativePath);
        } else {
          templates.push(relativePath);
        }
      }
    }

    await scanDir(this.templatesDir);
    return templates.sort();
  }
}

export default TemplateManager;
