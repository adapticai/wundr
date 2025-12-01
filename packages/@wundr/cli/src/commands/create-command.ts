/**
 * Create Command
 * Scaffolds new wundr-compliant projects
 */

import { getLogger } from '@wundr/core';
import { projectTemplates } from '@wundr/project-templates';
import chalk from 'chalk';
import { Command } from 'commander';

const logger = getLogger('cli:create');

export const createCommand = new Command('create')
  .description('Create a new wundr-compliant project')
  .argument(
    '[type]',
    'Project type (frontend|backend|fullstack|monorepo|library|cli)'
  )
  .argument('[name]', 'Project name')
  .option('-f, --framework <framework>', 'Framework to use')
  .option('-d, --description <description>', 'Project description')
  .option('-a, --author <author>', 'Project author')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip dependency installation')
  .option('--typescript', 'Use TypeScript', true)
  .option('--testing', 'Include testing setup', true)
  .option('--ci', 'Include CI/CD workflows', true)
  .option('--docker', 'Include Docker configuration')
  .option('-p, --path <path>', 'Path to create project in')
  .option('-l, --list', 'List available templates')
  .action(async (type?: string, name?: string, options?: any) => {
    try {
      // List templates if requested
      if (options?.list) {
        projectTemplates.listTemplates();
        return;
      }

      // Interactive mode if no arguments
      if (!type || !name) {
        await projectTemplates.createInteractive();
        return;
      }

      // Validate project type
      const validTypes = [
        'frontend',
        'backend',
        'fullstack',
        'monorepo',
        'library',
        'cli',
      ];
      if (!validTypes.includes(type)) {
        console.error(chalk.red(`Invalid project type: ${type}`));
        console.log(chalk.yellow(`Valid types: ${validTypes.join(', ')}`));
        process.exit(1);
      }

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
        path: options.path,
      });
    } catch (error) {
      logger.error('Failed to create project', error);
      console.error(
        chalk.red(
          `\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      process.exit(1);
    }
  });

// Add subcommands for specific project types
createCommand
  .command('frontend <name>')
  .description('Create a frontend application')
  .option('-f, --framework <framework>', 'Framework (next|react|vue)', 'next')
  .action(async (name: string, options: any) => {
    await projectTemplates.createProject({
      name,
      type: 'frontend',
      framework: options.framework,
      install: true,
      git: true,
    });
  });

createCommand
  .command('backend <name>')
  .description('Create a backend API')
  .option(
    '-f, --framework <framework>',
    'Framework (fastify|express|nestjs)',
    'fastify'
  )
  .action(async (name: string, options: any) => {
    await projectTemplates.createProject({
      name,
      type: 'backend',
      framework: options.framework,
      install: true,
      git: true,
    });
  });

createCommand
  .command('monorepo <name>')
  .description('Create a monorepo platform')
  .action(async (name: string) => {
    await projectTemplates.createProject({
      name,
      type: 'monorepo',
      framework: 'turborepo',
      install: true,
      git: true,
    });
  });

createCommand
  .command('fullstack <name>')
  .description('Create a full-stack application')
  .option('-s, --stack <stack>', 'Stack (next-fastify|t3)', 'next-fastify')
  .action(async (name: string, options: any) => {
    // For fullstack, we create a monorepo with both frontend and backend
    await projectTemplates.createProject({
      name,
      type: 'monorepo',
      framework: 'turborepo',
      install: true,
      git: true,
      description: 'Full-stack wundr-compliant application',
    });
  });

createCommand
  .command('library <name>')
  .description('Create an NPM library')
  .option('--react', 'React component library')
  .action(async (name: string, options: any) => {
    await projectTemplates.createProject({
      name,
      type: 'library',
      typescript: true,
      testing: true,
      install: true,
      git: true,
    });
  });

createCommand
  .command('cli <name>')
  .description('Create a CLI tool')
  .action(async (name: string) => {
    await projectTemplates.createProject({
      name,
      type: 'cli',
      typescript: true,
      testing: true,
      install: true,
      git: true,
    });
  });
