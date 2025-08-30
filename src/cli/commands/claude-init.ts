import { Command } from 'commander';
import { join, resolve } from 'path';
import { writeFileSync, existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ClaudeConfigGenerator } from '../../claude-generator/claude-config-generator.js';

interface ClaudeInitOptions {
  force?: boolean;
  audit?: boolean;
  interactive?: boolean;
  outputDir?: string;
}

export function createClaudeInitCommand(): Command {
  const command = new Command('claude-init');
  
  command
    .description('Initialize Claude Code configuration for a repository')
    .option('-f, --force', 'Overwrite existing CLAUDE.md file')
    .option('-a, --audit', 'Perform repository audit and show recommendations')
    .option('-i, --interactive', 'Interactive mode with prompts for customization')
    .option('-o, --output-dir <dir>', 'Output directory for CLAUDE.md (defaults to current directory)')
    .argument('[path]', 'Path to repository (defaults to current directory)', '.')
    .action(async (path: string, options: ClaudeInitOptions) => {
      const spinner = ora('Analyzing repository...').start();
      
      try {
        const repoPath = resolve(path);
        const outputPath = options.outputDir ? resolve(options.outputDir) : repoPath;
        const claudeFilePath = join(outputPath, 'CLAUDE.md');

        // Check if CLAUDE.md already exists
        if (existsSync(claudeFilePath) && !options.force) {
          spinner.stop();
          
          if (options.interactive) {
            const { shouldOverwrite } = await inquirer.prompt([{
              type: 'confirm',
              name: 'shouldOverwrite',
              message: 'CLAUDE.md already exists. Overwrite?',
              default: false
            }]);
            
            if (!shouldOverwrite) {
              console.log(chalk.yellow('Operation cancelled.'));
              return;
            }
          } else {
            console.log(chalk.yellow('CLAUDE.md already exists. Use --force to overwrite.'));
            return;
          }
        }

        // Initialize generator
        const generator = new ClaudeConfigGenerator(repoPath);

        // Perform audit if requested
        if (options.audit) {
          spinner.text = 'Auditing repository...';
          const auditResult = await generator.auditRepository();
          
          spinner.stop();
          console.log(chalk.blue('\n📊 Repository Audit Results'));
          console.log(chalk.blue('================================'));
          console.log(`${chalk.green('Overall Score:')} ${auditResult.score}/100`);
          
          if (auditResult.issues.length > 0) {
            console.log(chalk.yellow('\n⚠️  Issues Found:'));
            
            const errorIssues = auditResult.issues.filter(i => i.severity === 'error');
            const warningIssues = auditResult.issues.filter(i => i.severity === 'warning');
            const infoIssues = auditResult.issues.filter(i => i.severity === 'info');

            if (errorIssues.length > 0) {
              console.log(chalk.red('\n🚨 Critical Issues:'));
              errorIssues.forEach(issue => {
                console.log(`  ${chalk.red('•')} ${issue.message}`);
                if (issue.fix) {
                  console.log(`    ${chalk.gray('Fix:')} ${issue.fix}`);
                }
              });
            }

            if (warningIssues.length > 0) {
              console.log(chalk.yellow('\n⚠️  Warnings:'));
              warningIssues.forEach(issue => {
                console.log(`  ${chalk.yellow('•')} ${issue.message}`);
                if (issue.fix) {
                  console.log(`    ${chalk.gray('Fix:')} ${issue.fix}`);
                }
              });
            }

            if (infoIssues.length > 0) {
              console.log(chalk.blue('\nℹ️  Recommendations:'));
              infoIssues.forEach(issue => {
                console.log(`  ${chalk.blue('•')} ${issue.message}`);
                if (issue.fix) {
                  console.log(`    ${chalk.gray('Fix:')} ${issue.fix}`);
                }
              });
            }
          }

          if (auditResult.recommendations.length > 0) {
            console.log(chalk.green('\n💡 Recommendations:'));
            auditResult.recommendations.forEach(rec => {
              console.log(`  ${chalk.green('•')} ${rec}`);
            });
          }

          console.log('');
          
          if (options.interactive) {
            const { shouldContinue } = await inquirer.prompt([{
              type: 'confirm',
              name: 'shouldContinue',
              message: 'Continue with CLAUDE.md generation?',
              default: true
            }]);
            
            if (!shouldContinue) {
              console.log(chalk.yellow('Operation cancelled.'));
              return;
            }
          }

          spinner.start('Generating CLAUDE.md...');
        }

        // Generate configuration
        spinner.text = 'Generating Claude configuration...';
        const config = await generator.generateConfig();
        
        // Handle interactive customization
        if (options.interactive) {
          spinner.stop();
          config.agentConfiguration = await customizeAgentConfiguration(config.agentConfiguration);
          config.mcpTools = await customizeMCPTools(config.mcpTools);
          spinner.start('Finalizing configuration...');
        }

        // Generate CLAUDE.md content
        spinner.text = 'Writing CLAUDE.md file...';
        const claudeContent = await generator.generateClaudeMarkdown();
        
        // Write file
        writeFileSync(claudeFilePath, claudeContent, 'utf-8');
        
        spinner.stop();
        
        // Success message
        console.log(chalk.green('✅ Successfully initialized Claude Code configuration!'));
        console.log(chalk.blue(`📄 Created: ${claudeFilePath}`));
        console.log(chalk.blue(`🎯 Project Type: ${config.projectType}`));
        console.log(chalk.blue(`🤖 Agents: ${config.agentConfiguration.agents.length} configured`));
        console.log(chalk.blue(`🔧 MCP Tools: ${config.mcpTools.tools.length} available`));
        
        // Next steps
        console.log(chalk.yellow('\n📋 Next Steps:'));
        console.log('1. Review the generated CLAUDE.md file');
        console.log('2. Customize agent configurations as needed');
        console.log('3. Set up MCP tools with: cd mcp-tools && ./install.sh');
        console.log('4. Start using Claude Code with optimized configuration!');
        
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('❌ Error initializing Claude configuration:'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}

async function customizeAgentConfiguration(config: any): Promise<any> {
  console.log(chalk.blue('\n🤖 Agent Configuration'));
  console.log('===========================');
  
  const { topology } = await inquirer.prompt([{
    type: 'list',
    name: 'topology',
    message: 'Choose swarm topology:',
    choices: [
      { name: 'Mesh - All agents communicate directly', value: 'mesh' },
      { name: 'Hierarchical - Structured coordination', value: 'hierarchical' },
      { name: 'Adaptive - Dynamic based on task', value: 'adaptive' }
    ],
    default: config.swarmTopology
  }]);

  const { maxAgents } = await inquirer.prompt([{
    type: 'number',
    name: 'maxAgents',
    message: 'Maximum number of concurrent agents:',
    default: config.maxAgents,
    validate: (input: number) => input > 0 && input <= 20 ? true : 'Must be between 1 and 20'
  }]);

  return {
    ...config,
    swarmTopology: topology,
    maxAgents
  };
}

async function customizeMCPTools(config: any): Promise<any> {
  console.log(chalk.blue('\n🔧 MCP Tools Configuration'));
  console.log('==============================');
  
  const toolChoices = config.tools.map((tool: any) => ({
    name: `${tool.name} - ${tool.description}`,
    value: tool.name,
    checked: true
  }));

  const { selectedTools } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selectedTools',
    message: 'Select MCP tools to enable:',
    choices: toolChoices
  }]);

  return {
    ...config,
    tools: config.tools.filter((tool: any) => selectedTools.includes(tool.name))
  };
}