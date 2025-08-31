import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
// import { projectTemplates } from '@wundr/project-templates';
// TODO: Fix this import - project-templates package needs to be created
const projectTemplates = {
  createProject: async (options: any) => {
    console.log('Creating project with options:', options);
    // TODO: Implement actual project creation logic
    console.log('Project creation not yet implemented');
  },
  createInteractive: async () => {
    console.log('Interactive project creation not yet implemented');
    // TODO: Implement interactive project creation
  }
};

/**
 * Create commands for generating components, services, and templates
 */
export class CreateCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const createCmd = this.program
      .command('create')
      .description('create new wundr-compliant projects, components, services, and templates');

    // Create new project (full wundr-compliant project)
    createCmd
      .command('project <type> [name]')
      .alias('p')
      .description('create a new wundr-compliant project')
      .option('-f, --framework <framework>', 'framework to use')
      .option('-d, --description <description>', 'project description')
      .option('-a, --author <author>', 'project author')
      .option('--no-git', 'skip git initialization')
      .option('--no-install', 'skip dependency installation')
      .option('--typescript', 'use TypeScript', true)
      .option('--testing', 'include testing setup', true)
      .option('--ci', 'include CI/CD workflows', true)
      .option('--docker', 'include Docker configuration')
      .option('-p, --path <path>', 'path to create project in')
      .action(async (type: string, name: string | undefined, options: any) => {
        await this.createProject(type, name, options);
      });

    // Quick project creation commands
    createCmd
      .command('frontend <name>')
      .description('create a frontend application')
      .option('-f, --framework <framework>', 'framework (next|react|vue)', 'next')
      .action(async (name: string, options: any) => {
        await projectTemplates.createProject({
          name,
          type: 'frontend',
          framework: options.framework,
          install: true,
          git: true
        });
      });

    createCmd
      .command('backend <name>')
      .description('create a backend API')
      .option('-f, --framework <framework>', 'framework (fastify|express|nestjs)', 'fastify')
      .action(async (name: string, options: any) => {
        await projectTemplates.createProject({
          name,
          type: 'backend',
          framework: options.framework,
          install: true,
          git: true
        });
      });

    createCmd
      .command('monorepo <name>')
      .description('create a monorepo platform')
      .action(async (name: string) => {
        await projectTemplates.createProject({
          name,
          type: 'monorepo',
          framework: 'turborepo',
          install: true,
          git: true
        });
      });

    createCmd
      .command('fullstack <name>')
      .description('create a full-stack application')
      .action(async (name: string) => {
        await projectTemplates.createProject({
          name,
          type: 'monorepo',
          framework: 'turborepo',
          install: true,
          git: true,
          description: 'Full-stack wundr-compliant application'
        });
      });

    // Create component
    createCmd
      .command('component <name>')
      .description('create a new component')
      .option('--type <type>', 'component type (react, vue, angular)', 'react')
      .option('--template <template>', 'component template')
      .option('--with-tests', 'generate test files')
      .option('--with-stories', 'generate storybook stories')
      .action(async (name, options) => {
        await this.createComponent(name, options);
      });

    // Create service
    createCmd
      .command('service <name>')
      .description('create a new service')
      .option('--type <type>', 'service type (api, worker, microservice)', 'api')
      .option('--framework <framework>', 'framework (express, fastify, nest)', 'express')
      .option('--with-tests', 'generate test files')
      .option('--with-docs', 'generate API documentation')
      .action(async (name, options) => {
        await this.createService(name, options);
      });

    // Create package
    createCmd
      .command('package <name>')
      .description('create a new package in monorepo')
      .option('--type <type>', 'package type (library, app, tool)', 'library')
      .option('--template <template>', 'package template')
      .option('--public', 'make package public')
      .action(async (name, options) => {
        await this.createPackage(name, options);
      });

    // Create template
    createCmd
      .command('template <name>')
      .description('create a new template')
      .option('--from <source>', 'create template from existing code')
      .option('--interactive', 'use interactive template creation')
      .action(async (name, options) => {
        await this.createTemplate(name, options);
      });

    // Create workflow
    createCmd
      .command('workflow <name>')
      .description('create a new workflow or automation')
      .option('--type <type>', 'workflow type (ci, deployment, analysis)', 'ci')
      .option('--platform <platform>', 'platform (github, gitlab, jenkins)', 'github')
      .action(async (name, options) => {
        await this.createWorkflow(name, options);
      });

    // Create config
    createCmd
      .command('config <name>')
      .description('create configuration files')
      .option('--type <type>', 'config type (eslint, prettier, jest, typescript)')
      .option('--preset <preset>', 'configuration preset')
      .action(async (name, options) => {
        await this.createConfig(name, options);
      });
  }

  /**
   * Create a new wundr-compliant project
   */
  private async createProject(type: string, name: string | undefined, options: any): Promise<void> {
    try {
      // If no name provided, launch interactive mode
      if (!name) {
        await projectTemplates.createInteractive();
        return;
      }

      // Validate project type
      const validTypes = ['frontend', 'backend', 'fullstack', 'monorepo', 'library', 'cli'];
      if (!validTypes.includes(type)) {
        logger.error(`Invalid project type: ${type}`);
        logger.info(`Valid types: ${validTypes.join(', ')}`);
        process.exit(1);
      }

      logger.info(`Creating ${type} project: ${chalk.cyan(name)}`);

      // Create project with options
      await projectTemplates.createProject({
        name,
        type: type as any,
        framework: options.framework,
        description: options.description,
        author: options.author,
        git: options.git,
        install: options.install,
        typescript: options.typescript,
        testing: options.testing,
        ci: options.ci,
        docker: options.docker,
        path: options.path
      });

    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_PROJECT_FAILED',
        'Failed to create project',
        { type, name, options },
        true
      );
    }
  }

  /**
   * Create a new component
   */
  private async createComponent(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating component: ${chalk.cyan(name)}`);

      const componentData = await this.gatherComponentData(name, options);
      const outputPath = await this.determineOutputPath('components', name);

      await this.generateFromTemplate('component', componentData, outputPath);

      if (options.withTests) {
        await this.generateFromTemplate('component-test', componentData, outputPath);
      }

      if (options.withStories) {
        await this.generateFromTemplate('component-stories', componentData, outputPath);
      }

      logger.success(`Component ${name} created successfully at ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_COMPONENT_FAILED',
        'Failed to create component',
        { name, options },
        true
      );
    }
  }

  /**
   * Create a new service
   */
  private async createService(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating service: ${chalk.cyan(name)}`);

      const serviceData = await this.gatherServiceData(name, options);
      const outputPath = await this.determineOutputPath('services', name);

      await this.generateFromTemplate('service', serviceData, outputPath);

      if (options.withTests) {
        await this.generateFromTemplate('service-test', serviceData, outputPath);
      }

      if (options.withDocs) {
        await this.generateApiDocs(serviceData, outputPath);
      }

      logger.success(`Service ${name} created successfully at ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_SERVICE_FAILED',
        'Failed to create service',
        { name, options },
        true
      );
    }
  }

  /**
   * Create a new package in monorepo
   */
  private async createPackage(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating package: ${chalk.cyan(name)}`);

      const packageData = await this.gatherPackageData(name, options);
      const outputPath = await this.determinePackagePath(name, options.type);

      await this.generateFromTemplate('package', packageData, outputPath);
      await this.updateWorkspaceConfig(name, options.type);

      logger.success(`Package ${name} created successfully at ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_PACKAGE_FAILED',
        'Failed to create package',
        { name, options },
        true
      );
    }
  }

  /**
   * Create a new template
   */
  private async createTemplate(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating template: ${chalk.cyan(name)}`);

      if (options.interactive) {
        await this.interactiveTemplateCreation(name);
      } else if (options.from) {
        await this.createTemplateFromSource(name, options.from);
      } else {
        await this.createBlankTemplate(name);
      }

      logger.success(`Template ${name} created successfully`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_TEMPLATE_FAILED',
        'Failed to create template',
        { name, options },
        true
      );
    }
  }

  /**
   * Create a new workflow
   */
  private async createWorkflow(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating workflow: ${chalk.cyan(name)}`);

      const workflowData = await this.gatherWorkflowData(name, options);
      const outputPath = this.getWorkflowPath(options.platform);

      await this.generateFromTemplate('workflow', workflowData, outputPath);

      logger.success(`Workflow ${name} created successfully at ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_WORKFLOW_FAILED',
        'Failed to create workflow',
        { name, options },
        true
      );
    }
  }

  /**
   * Create configuration files
   */
  private async createConfig(name: string, options: any): Promise<void> {
    try {
      logger.info(`Creating config: ${chalk.cyan(name)}`);

      const configData = await this.gatherConfigData(name, options);
      const outputPath = process.cwd();

      await this.generateFromTemplate('config', configData, outputPath);

      logger.success(`Configuration ${name} created successfully`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_CREATE_CONFIG_FAILED',
        'Failed to create configuration',
        { name, options },
        true
      );
    }
  }

  /**
   * Data gathering methods
   */
  private async gatherComponentData(name: string, options: any): Promise<any> {
    return {
      name,
      type: options.type,
      template: options.template,
      className: this.toPascalCase(name),
      fileName: this.toKebabCase(name),
      withTests: options.withTests,
      withStories: options.withStories,
      timestamp: new Date().toISOString()
    };
  }

  private async gatherServiceData(name: string, options: any): Promise<any> {
    return {
      name,
      type: options.type,
      framework: options.framework,
      className: this.toPascalCase(name),
      fileName: this.toKebabCase(name),
      withTests: options.withTests,
      withDocs: options.withDocs,
      timestamp: new Date().toISOString()
    };
  }

  private async gatherPackageData(name: string, options: any): Promise<any> {
    const packageName = name.startsWith('@') ? name : `@wundr/${name}`;
    
    return {
      name: packageName,
      shortName: name,
      type: options.type,
      template: options.template,
      public: options.public,
      className: this.toPascalCase(name),
      fileName: this.toKebabCase(name),
      timestamp: new Date().toISOString()
    };
  }

  private async gatherWorkflowData(name: string, options: any): Promise<any> {
    return {
      name,
      type: options.type,
      platform: options.platform,
      fileName: this.toKebabCase(name),
      timestamp: new Date().toISOString()
    };
  }

  private async gatherConfigData(name: string, options: any): Promise<any> {
    return {
      name,
      type: options.type,
      preset: options.preset,
      fileName: this.getConfigFileName(name, options.type),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Template generation methods
   */
  private async generateFromTemplate(templateType: string, data: any, outputPath: string): Promise<void> {
    const templatePath = this.getTemplatePath(templateType);
    
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template ${templateType} not found`);
    }

    await fs.ensureDir(outputPath);
    
    // Copy template files and replace placeholders
    await this.copyTemplateWithReplacements(templatePath, outputPath, data);
  }

  private async copyTemplateWithReplacements(srcPath: string, destPath: string, data: any): Promise<void> {
    const files = await fs.readdir(srcPath);
    
    for (const file of files) {
      const srcFile = path.join(srcPath, file);
      const destFile = path.join(destPath, this.replacePlaceholders(file, data));
      
      const stat = await fs.stat(srcFile);
      
      if (stat.isDirectory()) {
        await fs.ensureDir(destFile);
        await this.copyTemplateWithReplacements(srcFile, destFile, data);
      } else {
        const content = await fs.readFile(srcFile, 'utf8');
        const processedContent = this.replacePlaceholders(content, data);
        await fs.writeFile(destFile, processedContent);
      }
    }
  }

  private replacePlaceholders(content: string, data: any): string {
    let result = content;
    
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(placeholder, String(value));
    });
    
    return result;
  }

  /**
   * Path determination methods
   */
  private async determineOutputPath(category: string, name: string): Promise<string> {
    const projectRoot = process.cwd();
    const srcPath = path.join(projectRoot, 'src');
    
    if (await fs.pathExists(srcPath)) {
      return path.join(srcPath, category, this.toKebabCase(name));
    }
    
    return path.join(projectRoot, category, this.toKebabCase(name));
  }

  private async determinePackagePath(name: string, type: string): Promise<string> {
    const projectRoot = process.cwd();
    const packagesPath = path.join(projectRoot, 'packages');
    const appsPath = path.join(projectRoot, 'apps');
    
    if (type === 'app' && await fs.pathExists(appsPath)) {
      return path.join(appsPath, this.toKebabCase(name));
    }
    
    return path.join(packagesPath, this.toKebabCase(name));
  }

  private getWorkflowPath(platform: string): string {
    const paths = {
      github: '.github/workflows',
      gitlab: '.gitlab-ci',
      jenkins: 'jenkins'
    };
    
    return paths[platform as keyof typeof paths] || '.github/workflows';
  }

  private getTemplatePath(templateType: string): string {
    return path.join(__dirname, '../../templates', templateType);
  }

  private getConfigFileName(name: string, type: string): string {
    const fileNames = {
      eslint: '.eslintrc.js',
      prettier: '.prettierrc.js',
      jest: 'jest.config.js',
      typescript: 'tsconfig.json'
    };
    
    return fileNames[type as keyof typeof fileNames] || `${name}.config.js`;
  }

  /**
   * Utility methods
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private async updateWorkspaceConfig(name: string, type: string): Promise<void> {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      
      if (packageJson.workspaces) {
        const workspace = type === 'app' ? 'apps/*' : 'packages/*';
        if (!packageJson.workspaces.includes(workspace)) {
          packageJson.workspaces.push(workspace);
          await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
        }
      }
    }
  }

  private async generateApiDocs(serviceData: any, outputPath: string): Promise<void> {
    // Generate API documentation based on service type and framework
    const docsPath = path.join(outputPath, 'docs');
    await fs.ensureDir(docsPath);
    
    const apiDoc = `# ${serviceData.name} API Documentation

## Overview

Service: ${serviceData.name}
Type: ${serviceData.type}
Framework: ${serviceData.framework}

## Endpoints

### GET /health
Health check endpoint

### GET /api/${serviceData.fileName}
Get ${serviceData.name} data

### POST /api/${serviceData.fileName}
Create new ${serviceData.name}

## Authentication

[Add authentication details here]

## Error Handling

[Add error handling information here]
`;
    
    await fs.writeFile(path.join(docsPath, 'api.md'), apiDoc);
  }

  private async interactiveTemplateCreation(name: string): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Template description:'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Template features:',
        choices: [
          'TypeScript',
          'React',
          'Vue',
          'Node.js',
          'Testing',
          'Storybook',
          'Documentation'
        ]
      }
    ]);
    
    // Create template based on answers
    logger.debug('Creating interactive template with:', answers);
  }

  private async createTemplateFromSource(name: string, sourcePath: string): Promise<void> {
    logger.debug(`Creating template ${name} from source: ${sourcePath}`);
    // Implementation for creating template from existing source
  }

  private async createBlankTemplate(name: string): Promise<void> {
    logger.debug(`Creating blank template: ${name}`);
    // Implementation for creating blank template structure
  }
}