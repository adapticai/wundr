import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

interface SetupOptions {
  global?: boolean;
  skipMcp?: boolean;
  skipFlow?: boolean;
  template?: string;
}

export function createClaudeSetupCommand(): Command {
  const command = new Command('claude-setup');
  
  command
    .description('Complete setup for Claude Code integration')
    .option('-g, --global', 'Install tools globally')
    .option('--skip-mcp', 'Skip MCP tools installation')  
    .option('--skip-flow', 'Skip Claude Flow setup')
    .option('-t, --template <name>', 'Use specific project template')
    .argument('[path]', 'Path to repository (defaults to current directory)', '.')
    .action(async (path: string, options: SetupOptions) => {
      const spinner = ora('Starting Claude Code setup...').start();
      
      try {
        const repoPath = resolve(path);
        
        // Verify git repository
        if (!existsSync(join(repoPath, '.git'))) {
          spinner.stop();
          const { shouldInitGit } = await inquirer.prompt([{
            type: 'confirm',
            name: 'shouldInitGit',
            message: 'Not a git repository. Initialize git?',
            default: true
          }]);
          
          if (shouldInitGit) {
            spinner.start('Initializing git repository...');
            execSync('git init', { cwd: repoPath });
            spinner.succeed('Git repository initialized');
          } else {
            console.log(chalk.yellow('Continuing without git...'));
          }
        }

        // Step 1: Claude Flow setup
        if (!options.skipFlow) {
          await setupClaudeFlow(spinner, repoPath, options.global);
        }

        // Step 2: MCP Tools setup  
        if (!options.skipMcp) {
          await setupMCPTools(spinner, repoPath, options.global);
        }

        // Step 3: Generate CLAUDE.md
        await generateClaudeConfig(spinner, repoPath);

        // Step 4: Setup project template if specified
        if (options.template) {
          await setupProjectTemplate(spinner, repoPath, options.template);
        }

        // Step 5: Initialize swarm if Claude Flow is available
        if (!options.skipFlow) {
          await initializeSwarm(spinner, repoPath);
        }

        // Step 6: Validation
        await validateSetup(spinner, repoPath);

        spinner.succeed('Claude Code setup completed successfully!');
        
        // Final instructions
        displayFinalInstructions(repoPath, options);

      } catch (error) {
        spinner.stop();
        console.error(chalk.red('❌ Setup failed:'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}

async function setupClaudeFlow(spinner: ora.Ora, repoPath: string, global: boolean): Promise<void> {
  spinner.text = 'Setting up Claude Flow...';
  
  try {
    // Check if Claude Flow is already installed
    execSync('npx claude-flow --version', { stdio: 'ignore' });
    spinner.text = 'Claude Flow already available, configuring...';
  } catch {
    spinner.text = 'Installing Claude Flow...';
    
    if (global) {
      execSync('npm install -g claude-flow@alpha', { stdio: 'inherit' });
    } else {
      // Add to package.json dev dependencies if it exists
      if (existsSync(join(repoPath, 'package.json'))) {
        execSync('npm install --save-dev claude-flow@alpha', { cwd: repoPath, stdio: 'inherit' });
      }
    }
  }

  // Add MCP server configuration
  spinner.text = 'Configuring Claude MCP server...';
  try {
    execSync('claude mcp add claude-flow npx claude-flow@alpha mcp start', { 
      cwd: repoPath, 
      stdio: 'pipe'
    });
  } catch (error) {
    // MCP configuration might fail if Claude Desktop isn't installed
    console.log(chalk.yellow('\n⚠️  Could not configure MCP server automatically.'));
    console.log(chalk.yellow('Please run manually: claude mcp add claude-flow npx claude-flow@alpha mcp start'));
  }

  spinner.text = 'Claude Flow setup completed';
}

async function setupMCPTools(spinner: ora.Ora, repoPath: string, global: boolean): Promise<void> {
  spinner.text = 'Setting up MCP Tools...';
  
  const mcpToolsPath = join(repoPath, 'mcp-tools');
  
  // Create mcp-tools directory if it doesn't exist
  if (!existsSync(mcpToolsPath)) {
    mkdirSync(mcpToolsPath, { recursive: true });
    
    // Create basic install script
    const installScript = `#!/bin/bash
# MCP Tools Installation Script
echo "Installing Wundr MCP Tools..."

# Add your MCP tool installations here
echo "✅ MCP Tools installation template created"
echo "Customize this script with your specific MCP tools"
`;
    
    writeFileSync(join(mcpToolsPath, 'install.sh'), installScript);
    execSync(`chmod +x ${join(mcpToolsPath, 'install.sh')}`);
    
    // Create package.json for MCP tools
    const mcpPackageJson = {
      name: 'mcp-tools',
      version: '1.0.0',
      description: 'MCP Tools for Claude Code integration',
      private: true,
      scripts: {
        install: './install.sh'
      }
    };
    
    writeFileSync(
      join(mcpToolsPath, 'package.json'), 
      JSON.stringify(mcpPackageJson, null, 2)
    );
  }

  spinner.text = 'MCP Tools setup completed';
}

async function generateClaudeConfig(spinner: ora.Ora, repoPath: string): Promise<void> {
  spinner.text = 'Generating CLAUDE.md configuration...';
  
  // Use our dynamic generator
  const { ClaudeConfigGenerator } = await import('../../claude-generator/claude-config-generator.js');
  const generator = new ClaudeConfigGenerator(repoPath);
  
  const claudeContent = await generator.generateClaudeMarkdown();
  const claudeFilePath = join(repoPath, 'CLAUDE.md');
  
  writeFileSync(claudeFilePath, claudeContent, 'utf-8');
  
  spinner.text = 'CLAUDE.md generated successfully';
}

async function setupProjectTemplate(spinner: ora.Ora, repoPath: string, templateName: string): Promise<void> {
  spinner.text = `Applying ${templateName} template...`;
  
  const templates: Record<string, () => void> = {
    'typescript': () => setupTypeScriptTemplate(repoPath),
    'react': () => setupReactTemplate(repoPath),
    'nodejs': () => setupNodeTemplate(repoPath),
    'monorepo': () => setupMonorepoTemplate(repoPath)
  };

  const setupFunction = templates[templateName];
  if (!setupFunction) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(templates).join(', ')}`);
  }

  setupFunction();
  
  spinner.text = `${templateName} template applied`;
}

function setupTypeScriptTemplate(repoPath: string): void {
  // Create basic TypeScript configuration if not exists
  const tsconfigPath = join(repoPath, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        outDir: 'dist',
        rootDir: 'src'
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };
    
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }

  // Create src directory
  const srcPath = join(repoPath, 'src');
  if (!existsSync(srcPath)) {
    mkdirSync(srcPath, { recursive: true });
    writeFileSync(join(srcPath, 'index.ts'), '// Your TypeScript code here\n');
  }
}

function setupReactTemplate(repoPath: string): void {
  // Ensure React-specific structure
  const srcPath = join(repoPath, 'src');
  if (!existsSync(srcPath)) {
    mkdirSync(srcPath, { recursive: true });
  }

  // Create components directory
  const componentsPath = join(srcPath, 'components');
  if (!existsSync(componentsPath)) {
    mkdirSync(componentsPath, { recursive: true });
  }

  // Create hooks directory
  const hooksPath = join(srcPath, 'hooks');
  if (!existsSync(hooksPath)) {
    mkdirSync(hooksPath, { recursive: true });
  }
}

function setupNodeTemplate(repoPath: string): void {
  // Create basic Node.js structure
  const srcPath = join(repoPath, 'src');
  if (!existsSync(srcPath)) {
    mkdirSync(srcPath, { recursive: true });
    writeFileSync(join(srcPath, 'index.js'), '// Your Node.js code here\n');
  }

  // Create routes directory
  const routesPath = join(srcPath, 'routes');
  if (!existsSync(routesPath)) {
    mkdirSync(routesPath, { recursive: true });
  }
}

function setupMonorepoTemplate(repoPath: string): void {
  // Create packages directory
  const packagesPath = join(repoPath, 'packages');
  if (!existsSync(packagesPath)) {
    mkdirSync(packagesPath, { recursive: true });
  }

  // Create apps directory
  const appsPath = join(repoPath, 'apps');
  if (!existsSync(appsPath)) {
    mkdirSync(appsPath, { recursive: true });
  }

  // Create workspace package.json if not exists
  const packageJsonPath = join(repoPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    const packageJson = {
      name: 'monorepo-workspace',
      version: '1.0.0',
      private: true,
      workspaces: ['packages/*', 'apps/*'],
      devDependencies: {
        'turbo': '^2.0.0'
      }
    };
    
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

async function initializeSwarm(spinner: ora.Ora, repoPath: string): Promise<void> {
  spinner.text = 'Initializing Claude Flow swarm...';
  
  try {
    // Initialize basic swarm configuration
    execSync('npx claude-flow@alpha init', { 
      cwd: repoPath, 
      stdio: 'pipe' 
    });
  } catch (error) {
    // Swarm init might fail if not properly configured
    console.log(chalk.yellow('\n⚠️  Could not initialize swarm automatically.'));
    console.log(chalk.yellow('You can initialize manually later with: npx claude-flow init'));
  }

  spinner.text = 'Swarm initialization completed';
}

async function validateSetup(spinner: ora.Ora, repoPath: string): Promise<void> {
  spinner.text = 'Validating setup...';
  
  const validations = [
    { name: 'CLAUDE.md', path: join(repoPath, 'CLAUDE.md') },
    { name: 'MCP Tools', path: join(repoPath, 'mcp-tools') },
    { name: 'Git repository', path: join(repoPath, '.git') }
  ];

  const results = validations.map(validation => ({
    ...validation,
    exists: existsSync(validation.path)
  }));

  const failures = results.filter(r => !r.exists);
  if (failures.length > 0) {
    throw new Error(`Setup validation failed: Missing ${failures.map(f => f.name).join(', ')}`);
  }

  spinner.text = 'Setup validation passed';
}

function displayFinalInstructions(repoPath: string, options: SetupOptions): void {
  console.log(chalk.green('\n🎉 Claude Code Setup Complete!'));
  console.log(chalk.blue('================================'));
  
  console.log(chalk.yellow('\n📋 What was set up:'));
  console.log('✅ CLAUDE.md configuration generated');
  if (!options.skipFlow) {
    console.log('✅ Claude Flow installed and configured');
  }
  if (!options.skipMcp) {
    console.log('✅ MCP Tools directory created');
  }
  console.log('✅ Project structure validated');

  console.log(chalk.yellow('\n🚀 Next Steps:'));
  console.log('1. Review and customize CLAUDE.md as needed');
  console.log('2. Install MCP tools: cd mcp-tools && ./install.sh');
  console.log('3. Verify Claude Desktop MCP connection');
  
  if (!options.skipFlow) {
    console.log('4. Test Claude Flow: npx claude-flow sparc modes');
  }
  
  console.log('5. Start coding with optimized Claude Code integration!');

  console.log(chalk.yellow('\n📚 Resources:'));
  console.log('• Claude Flow: https://github.com/ruvnet/claude-flow');
  console.log('• MCP Documentation: https://modelcontextprotocol.io/docs');
  console.log('• Wundr Documentation: ./docs/');

  console.log(chalk.green('\n✨ Happy coding with Claude!'));
}