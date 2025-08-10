#!/usr/bin/env ts-node

// @ts-ignore - Commander import issue with TS
import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

interface PackageOptions {
  name: string;
  description: string;
  type: 'package' | 'app';
}

async function createPackage(options: PackageOptions) {
  const { name, description, type } = options;
  
  // Determine target directory
  const targetDir = path.join(
    process.cwd(),
    type === 'package' ? 'packages' : 'apps',
    name
  );
  
  // Check if directory already exists
  if (await fs.pathExists(targetDir)) {
    console.error(chalk.red(`Error: Directory ${targetDir} already exists!`));
    process.exit(1);
  }
  
  console.log(chalk.blue(`Creating ${type} "${name}" at ${targetDir}...`));
  
  // Create directory
  await fs.ensureDir(targetDir);
  
  // Copy template files
  const templateDir = path.join(__dirname, '../templates/package-base');
  const files = await fs.readdir(templateDir);
  
  for (const file of files) {
    const sourcePath = path.join(templateDir, file);
    let targetFileName = file;
    let content = await fs.readFile(sourcePath, 'utf-8');
    
    // Process template files
    if (file.endsWith('.template')) {
      targetFileName = file.replace('.template', '');
      content = content
        .replace(/\{\{PACKAGE_NAME\}\}/g, name)
        .replace(/\{\{PACKAGE_DESCRIPTION\}\}/g, description);
    }
    
    const targetPath = path.join(targetDir, targetFileName);
    await fs.writeFile(targetPath, content);
  }
  
  // Create src directory with index.ts
  const srcDir = path.join(targetDir, 'src');
  await fs.ensureDir(srcDir);
  
  const indexContent = `/**
 * @module @wundr/${name}
 * ${description}
 */

export const VERSION = '0.0.1';

// Add your exports here
`;
  
  await fs.writeFile(path.join(srcDir, 'index.ts'), indexContent);
  
  // Create a simple test file
  const testContent = `import { VERSION } from './index';

describe('@wundr/${name}', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });
});
`;
  
  await fs.writeFile(path.join(srcDir, 'index.test.ts'), testContent);
  
  console.log(chalk.green(`✅ Successfully created ${type} "${name}"!`));
  console.log(chalk.yellow('\nNext steps:'));
  console.log(chalk.gray(`  cd ${type}s/${name}`));
  console.log(chalk.gray('  pnpm install'));
  console.log(chalk.gray('  pnpm build'));
}

// CLI setup
const program = new (Command as any)()
  .name('create-package')
  .description('Create a new package in the Wundr monorepo')
  .version('1.0.0');

program
  .command('new')
  .description('Create a new package or app')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Package name (without @wundr/ prefix):',
        validate: (input: string) => {
          if (!input) return 'Package name is required';
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Package name must be lowercase letters, numbers, and hyphens only';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: 'Package description:',
        validate: (input: string) => input ? true : 'Description is required'
      },
      {
        type: 'list',
        name: 'type',
        message: 'What type of package is this?',
        choices: [
          { name: 'Library package', value: 'package' },
          { name: 'Application', value: 'app' }
        ]
      }
    ]);
    
    await createPackage(answers as PackageOptions);
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}