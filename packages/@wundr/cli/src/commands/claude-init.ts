import { execSync } from 'child_process';
import * as path from 'path';

import chalk from 'chalk';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';

import type { Command } from 'commander';

interface ProjectInfo {
  name: string;
  description: string;
  type: string;
  hasTypeScript: boolean;
  hasReact: boolean;
  hasNext: boolean;
  isMonorepo: boolean;
  scripts: Record<string, string>;
  dependencies: string[];
}

export class ClaudeInitCommand {
  private spinner = ora();

  constructor(private program: Command) {
    this.setupCommand();
  }

  private setupCommand(): void {
    this.program
      .command('claude-init')
      .alias('ci')
      .description(
        'Initialize Claude Code and Claude Flow in current repository'
      )
      .option('-i, --interactive', 'Interactive mode with prompts')
      .option('-a, --audit', 'Run repository audit first')
      .option('-f, --force', 'Force overwrite existing CLAUDE.md')
      .option('--agents <agents>', 'Comma-separated list of agents to enable')
      .option(
        '--mcp-tools <tools>',
        'Comma-separated list of MCP tools to enable'
      )
      .option(
        '--profile <profile>',
        'Developer profile (fullstack, frontend, backend, devops)'
      )
      .action(async options => {
        await this.execute(options);
      });
  }

  private async execute(options: any): Promise<void> {
    console.log(chalk.blue.bold('\n🤖 Wundr Claude Initialization\n'));

    // Check if in a git repository
    if (!this.isGitRepo()) {
      console.error(
        chalk.red(
          '❌ Not in a git repository. Please run this command in a git repository.'
        )
      );
      process.exit(1);
    }

    // Gather project information
    const projectInfo = await this.analyzeProject();

    // Run audit if requested
    if (options.audit) {
      await this.runAudit(projectInfo);
    }

    // Interactive mode
    if (options.interactive) {
      const answers = await this.promptUser(projectInfo);
      Object.assign(options, answers);
    }

    // Generate CLAUDE.md
    await this.generateClaudeMd(projectInfo, options);

    // Setup Claude Flow
    await this.setupClaudeFlow(projectInfo, options);

    // Setup MCP tools
    await this.setupMcpTools(options.mcpTools);

    // Setup agents
    await this.setupAgents(
      options.agents || this.getDefaultAgents(projectInfo)
    );

    // Setup quality hooks
    await this.setupQualityHooks(projectInfo);

    console.log(chalk.green.bold('\n✅ Claude initialization complete!\n'));
    this.printNextSteps();
  }

  private isGitRepo(): boolean {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async analyzeProject(): Promise<ProjectInfo> {
    this.spinner.start('Analyzing project structure...');

    const projectInfo: ProjectInfo = {
      name: path.basename(process.cwd()),
      description: 'Project repository',
      type: 'unknown',
      hasTypeScript: false,
      hasReact: false,
      hasNext: false,
      isMonorepo: false,
      scripts: {},
      dependencies: [],
    };

    // Read package.json if it exists
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const pkg = await fs.readJson(packageJsonPath);
      projectInfo.name = pkg.name || projectInfo.name;
      projectInfo.description = pkg.description || projectInfo.description;
      projectInfo.scripts = pkg.scripts || {};
      projectInfo.dependencies = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
    }

    // Detect project type
    projectInfo.hasTypeScript = await fs.pathExists('tsconfig.json');
    projectInfo.hasReact = projectInfo.dependencies.includes('react');
    projectInfo.hasNext =
      (await fs.pathExists('next.config.js')) ||
      (await fs.pathExists('next.config.mjs'));
    projectInfo.isMonorepo =
      (await fs.pathExists('lerna.json')) ||
      (await fs.pathExists('pnpm-workspace.yaml')) ||
      (await fs.pathExists('rush.json'));

    // Determine project type
    if (projectInfo.hasNext) {
      projectInfo.type = 'nextjs';
    } else if (projectInfo.hasReact) {
      projectInfo.type = 'react';
    } else if (projectInfo.hasTypeScript) {
      projectInfo.type = 'typescript';
    } else if (projectInfo.dependencies.includes('express')) {
      projectInfo.type = 'node-backend';
    } else if (projectInfo.isMonorepo) {
      projectInfo.type = 'monorepo';
    } else {
      projectInfo.type = 'javascript';
    }

    this.spinner.succeed(
      `Project analyzed: ${projectInfo.name} (${projectInfo.type})`
    );
    return projectInfo;
  }

  private async runAudit(projectInfo: ProjectInfo): Promise<void> {
    this.spinner.start('Running repository audit...');

    const auditResults = {
      score: 0,
      maxScore: 100,
      categories: {
        structure: { score: 0, maxScore: 20 },
        quality: { score: 0, maxScore: 20 },
        testing: { score: 0, maxScore: 20 },
        documentation: { score: 0, maxScore: 20 },
        security: { score: 0, maxScore: 20 },
      },
      recommendations: [] as string[],
    };

    // Structure checks
    if (await fs.pathExists('src')) {
      auditResults.categories.structure.score += 10;
    }
    if (await fs.pathExists('.gitignore')) {
      auditResults.categories.structure.score += 5;
    }
    if (projectInfo.isMonorepo && (await fs.pathExists('packages'))) {
      auditResults.categories.structure.score += 5;
    }

    // Quality checks
    if (
      (await fs.pathExists('.eslintrc.json')) ||
      (await fs.pathExists('.eslintrc.js'))
    ) {
      auditResults.categories.quality.score += 10;
    } else {
      auditResults.recommendations.push('Add ESLint configuration');
    }

    if (await fs.pathExists('.prettierrc')) {
      auditResults.categories.quality.score += 5;
    } else {
      auditResults.recommendations.push('Add Prettier configuration');
    }

    if (projectInfo.hasTypeScript) {
      auditResults.categories.quality.score += 5;
    }

    // Testing checks
    if (projectInfo.scripts.test) {
      auditResults.categories.testing.score += 10;
    } else {
      auditResults.recommendations.push('Add test script to package.json');
    }

    if (
      (await fs.pathExists('jest.config.js')) ||
      (await fs.pathExists('vitest.config.js'))
    ) {
      auditResults.categories.testing.score += 10;
    }

    // Documentation checks
    if (await fs.pathExists('README.md')) {
      auditResults.categories.documentation.score += 10;
    } else {
      auditResults.recommendations.push('Add README.md');
    }

    if (await fs.pathExists('docs')) {
      auditResults.categories.documentation.score += 10;
    }

    // Security checks
    if (!(await fs.pathExists('.env'))) {
      auditResults.categories.security.score += 10;
    }

    if (await fs.pathExists('.env.example')) {
      auditResults.categories.security.score += 10;
    } else if (await fs.pathExists('.env')) {
      auditResults.recommendations.push(
        'Add .env.example for environment variables'
      );
    }

    // Calculate total score
    for (const category of Object.values(auditResults.categories)) {
      auditResults.score += category.score;
    }

    this.spinner.succeed('Audit complete');

    // Display results
    console.log(chalk.cyan('\n📊 Audit Results:'));
    console.log(
      chalk.white(
        `Overall Score: ${auditResults.score}/${auditResults.maxScore}`
      )
    );

    for (const [name, category] of Object.entries(auditResults.categories)) {
      const percentage = (category.score / category.maxScore) * 100;
      const color =
        percentage >= 80
          ? chalk.green
          : percentage >= 50
            ? chalk.yellow
            : chalk.red;
      console.log(
        color(
          `  ${name}: ${category.score}/${category.maxScore} (${percentage.toFixed(0)}%)`
        )
      );
    }

    if (auditResults.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      for (const rec of auditResults.recommendations) {
        console.log(chalk.white(`  • ${rec}`));
      }
    }
  }

  private async promptUser(projectInfo: ProjectInfo): Promise<any> {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupClaudeFlow',
        message: 'Setup Claude Flow orchestration?',
        default: true,
      },
      {
        type: 'checkbox',
        name: 'mcpTools',
        message: 'Select MCP tools to enable:',
        choices: [
          { name: 'Firecrawl (Web scraping)', value: 'firecrawl' },
          { name: 'Context7 (Context management)', value: 'context7' },
          { name: 'Playwright (Browser automation)', value: 'playwright' },
          { name: 'Browser MCP (Chrome control)', value: 'browser' },
          {
            name: 'Sequential Thinking (MIT reasoning)',
            value: 'sequentialthinking',
          },
        ],
        default: this.getDefaultMcpTools(projectInfo),
      },
      {
        type: 'list',
        name: 'profile',
        message: 'Select developer profile:',
        choices: [
          { name: 'Full-stack Developer', value: 'fullstack' },
          { name: 'Frontend Developer', value: 'frontend' },
          { name: 'Backend Developer', value: 'backend' },
          { name: 'DevOps Engineer', value: 'devops' },
          { name: 'Custom', value: 'custom' },
        ],
        default: this.getDefaultProfile(projectInfo),
      },
    ]);

    if (answers.profile === 'custom') {
      const customAgents = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'agents',
          message: 'Select agents to enable:',
          choices: this.getAllAgentChoices(),
          default: this.getDefaultAgents(projectInfo),
        },
      ]);
      answers.agents = customAgents.agents.join(',');
    }

    return answers;
  }

  private getDefaultMcpTools(projectInfo: ProjectInfo): string[] {
    const tools = ['sequentialthinking'];
    if (projectInfo.hasReact || projectInfo.hasNext) {
      tools.push('browser', 'playwright');
    }
    return tools;
  }

  private getDefaultProfile(projectInfo: ProjectInfo): string {
    if (
      projectInfo.hasNext ||
      (projectInfo.hasReact && projectInfo.dependencies.includes('express'))
    ) {
      return 'fullstack';
    } else if (projectInfo.hasReact) {
      return 'frontend';
    } else if (
      projectInfo.dependencies.includes('express') ||
      projectInfo.dependencies.includes('fastify')
    ) {
      return 'backend';
    }
    return 'fullstack';
  }

  private getDefaultAgents(projectInfo: ProjectInfo): string[] {
    const agents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];

    if (projectInfo.hasTypeScript) {
      agents.push('system-architect');
    }
    if (projectInfo.hasReact || projectInfo.hasNext) {
      agents.push('mobile-dev');
    }
    if (projectInfo.isMonorepo) {
      agents.push('repo-architect', 'sync-coordinator');
    }

    return agents;
  }

  private getAllAgentChoices(): any[] {
    return [
      { name: 'Coder - Implementation specialist', value: 'coder' },
      { name: 'Reviewer - Code review specialist', value: 'reviewer' },
      { name: 'Tester - Testing specialist', value: 'tester' },
      { name: 'Planner - Strategic planning', value: 'planner' },
      { name: 'Researcher - Information gathering', value: 'researcher' },
      {
        name: 'System Architect - Architecture design',
        value: 'system-architect',
      },
      { name: 'Mobile Dev - React Native development', value: 'mobile-dev' },
      { name: 'Backend Dev - API development', value: 'backend-dev' },
      { name: 'ML Developer - Machine learning', value: 'ml-developer' },
      { name: 'CICD Engineer - Pipeline automation', value: 'cicd-engineer' },
      { name: 'Performance Analyzer - Optimization', value: 'perf-analyzer' },
      { name: 'GitHub Modes - GitHub integration', value: 'github-modes' },
      { name: 'PR Manager - Pull request management', value: 'pr-manager' },
      { name: 'Issue Tracker - Issue management', value: 'issue-tracker' },
      {
        name: 'Release Manager - Release coordination',
        value: 'release-manager',
      },
    ];
  }

  private async generateClaudeMd(
    projectInfo: ProjectInfo,
    options: any
  ): Promise<void> {
    this.spinner.start('Generating CLAUDE.md...');

    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');

    if ((await fs.pathExists(claudeMdPath)) && !options.force) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'CLAUDE.md already exists. Overwrite?',
          default: false,
        },
      ]);

      if (!overwrite) {
        this.spinner.warn('Skipped CLAUDE.md generation');
        return;
      }
    }

    const agents = options.agents
      ? options.agents.split(',')
      : this.getDefaultAgents(projectInfo);
    const mcpTools = options.mcpTools || this.getDefaultMcpTools(projectInfo);

    const content = `# Claude Code Configuration - ${projectInfo.name}

## Project: ${projectInfo.name}
${projectInfo.description}

## 🚨 CRITICAL: VERIFICATION PROTOCOL

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME
**After EVERY code change:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

## Project Type: ${projectInfo.type}
- TypeScript: ${projectInfo.hasTypeScript ? 'Yes' : 'No'}
- React: ${projectInfo.hasReact ? 'Yes' : 'No'}
- Next.js: ${projectInfo.hasNext ? 'Yes' : 'No'}
- Monorepo: ${projectInfo.isMonorepo ? 'Yes' : 'No'}

## Available Scripts
${Object.entries(projectInfo.scripts)
  .map(([key, value]) => `- \`npm run ${key}\`: ${value}`)
  .join('\n')}

## Quality Standards
- Always run \`npm run build\` after changes
${projectInfo.scripts.test ? '- Always run `npm run test` before committing' : ''}
${projectInfo.scripts.lint ? '- Always run `npm run lint` before committing' : ''}
${projectInfo.scripts.typecheck ? '- Always run `npm run typecheck` for TypeScript projects' : ''}

## Agent Configuration
Enabled agents for this project:
${agents.map(agent => `- **${agent}**: ${this.getAgentDescription(agent)}`).join('\n')}

## MCP Tools
Enabled MCP tools:
${mcpTools.map((tool: string) => `- **${tool}**: ${this.getMcpToolDescription(tool)}`).join('\n')}

## Workflow Patterns
${this.getWorkflowPatterns(projectInfo, agents)}

## Code Style & Best Practices
- **Modular Design**: Keep files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

Generated on: ${new Date().toISOString()}
By: Wundr Claude Init
`;

    await fs.writeFile(claudeMdPath, content);
    this.spinner.succeed('CLAUDE.md generated successfully');
  }

  private getAgentDescription(agent: string): string {
    const descriptions: Record<string, string> = {
      coder: 'Implementation and code generation',
      reviewer: 'Code review and quality assurance',
      tester: 'Testing and validation',
      planner: 'Task planning and orchestration',
      researcher: 'Research and information gathering',
      'system-architect': 'System design and architecture',
      'mobile-dev': 'React Native mobile development',
      'backend-dev': 'Backend API development',
      'ml-developer': 'Machine learning development',
      'cicd-engineer': 'CI/CD pipeline automation',
      'perf-analyzer': 'Performance analysis and optimization',
      'github-modes': 'GitHub integration and automation',
      'pr-manager': 'Pull request management',
      'issue-tracker': 'Issue tracking and management',
      'release-manager': 'Release coordination and deployment',
    };
    return descriptions[agent] || 'Specialized agent';
  }

  private getMcpToolDescription(tool: string): string {
    const descriptions: Record<string, string> = {
      firecrawl: 'Web scraping and crawling',
      context7: 'Context management and vector search',
      playwright: 'Browser automation and testing',
      browser: 'Real Chrome browser control',
      sequentialthinking: 'Structured reasoning and validation',
    };
    return descriptions[tool] || 'MCP tool';
  }

  private getWorkflowPatterns(
    projectInfo: ProjectInfo,
    agents: string[]
  ): string {
    const patterns: string[] = [];

    if (projectInfo.hasReact || projectInfo.hasNext) {
      patterns.push(`### Frontend Development
1. Use **researcher** to analyze requirements
2. Use **planner** to design component structure
3. Use **coder** to implement components
4. Use **tester** to write tests
5. Use **reviewer** to validate code quality`);
    }

    if (agents.includes('github-modes')) {
      patterns.push(`### GitHub Workflow
1. Use **issue-tracker** to manage tasks
2. Use **pr-manager** for pull requests
3. Use **code-review-swarm** for reviews
4. Use **release-manager** for deployments`);
    }

    if (projectInfo.isMonorepo) {
      patterns.push(`### Monorepo Management
1. Use **repo-architect** for structure optimization
2. Use **sync-coordinator** for package synchronization
3. Use **multi-repo-swarm** for cross-package changes`);
    }

    return patterns.join('\n\n');
  }

  private async setupClaudeFlow(
    projectInfo: ProjectInfo,
    options: any
  ): Promise<void> {
    if (!options.setupClaudeFlow) {
      return;
    }

    this.spinner.start('Setting up Claude Flow...');

    try {
      // Initialize Claude Flow
      execSync('npx claude-flow@alpha init', { stdio: 'ignore' });

      // Configure for project
      const config = {
        project: projectInfo.name,
        topology: projectInfo.isMonorepo ? 'hierarchical' : 'mesh',
        agents: options.agents
          ? options.agents.split(',')
          : this.getDefaultAgents(projectInfo),
        memory: {
          backend: 'sqlite',
          path: '.claude-flow/memory.db',
        },
        neural: {
          enabled: true,
          modelPath: '.claude-flow/models',
        },
      };

      await fs.writeJson('.claude-flow/config.json', config, { spaces: 2 });
      this.spinner.succeed('Claude Flow configured');
    } catch (error) {
      this.spinner.fail('Failed to setup Claude Flow');
      console.error(chalk.red(error));
    }
  }

  private async setupMcpTools(mcpTools: string | string[]): Promise<void> {
    if (!mcpTools) {
      return;
    }

    const tools = Array.isArray(mcpTools) ? mcpTools : mcpTools.split(',');

    for (const tool of tools) {
      this.spinner.start(`Installing ${tool} MCP...`);

      try {
        switch (tool) {
          case 'firecrawl':
            execSync('npx claude mcp add firecrawl npx @firecrawl/mcp-server', {
              stdio: 'ignore',
            });
            break;
          case 'context7':
            execSync('npx claude mcp add context7 npx @context7/mcp-server', {
              stdio: 'ignore',
            });
            break;
          case 'playwright':
            execSync(
              'npx claude mcp add playwright npx @playwright/mcp-server',
              { stdio: 'ignore' }
            );
            break;
          case 'browser':
            execSync('npx claude mcp add browser npx @browser/mcp-server', {
              stdio: 'ignore',
            });
            break;
          case 'sequentialthinking':
            execSync(
              'npm install -g @modelcontextprotocol/server-sequentialthinking',
              { stdio: 'ignore' }
            );
            break;
        }
        this.spinner.succeed(`${tool} MCP installed`);
      } catch (error) {
        this.spinner.fail(`Failed to install ${tool} MCP`);
      }
    }
  }

  private async setupAgents(agents: string[]): Promise<void> {
    this.spinner.start('Setting up agents...');

    const agentsDir = path.join(process.cwd(), '.claude', 'agents');
    await fs.ensureDir(agentsDir);

    for (const agent of agents) {
      const agentConfig = {
        name: agent,
        description: this.getAgentDescription(agent),
        enabled: true,
        configuration: {
          maxTokens: 8000,
          temperature: 0.7,
          topP: 0.9,
        },
      };

      await fs.writeJson(path.join(agentsDir, `${agent}.json`), agentConfig, {
        spaces: 2,
      });
    }

    this.spinner.succeed(`${agents.length} agents configured`);
  }

  private async setupQualityHooks(projectInfo: ProjectInfo): Promise<void> {
    this.spinner.start('Setting up quality enforcement hooks...');

    const hooksDir = path.join(process.cwd(), '.claude', 'hooks');
    await fs.ensureDir(hooksDir);

    // Pre-commit hook
    const preCommitHook = `#!/bin/bash
# Claude Code Quality Enforcement

echo "🔍 Running quality checks..."

${projectInfo.scripts.typecheck ? 'npm run typecheck || exit 1' : ''}
${projectInfo.scripts.lint ? 'npm run lint || exit 1' : ''}
${projectInfo.scripts.test ? 'npm test || exit 1' : ''}

echo "✅ All quality checks passed!"
`;

    await fs.writeFile(path.join(hooksDir, 'pre-commit.sh'), preCommitHook);

    await fs.chmod(path.join(hooksDir, 'pre-commit.sh'), '755');

    this.spinner.succeed('Quality hooks configured');
  }

  private printNextSteps(): void {
    console.log(chalk.cyan('\n📋 Next Steps:'));
    console.log(chalk.white('1. Review and customize CLAUDE.md'));
    console.log(chalk.white('2. Configure API keys for MCP tools (if needed)'));
    console.log(
      chalk.white('3. Restart Claude Desktop to load new configurations')
    );
    console.log(
      chalk.white(
        '4. Run: npx claude-flow@alpha sparc tdd "your first feature"'
      )
    );
    console.log(chalk.cyan('\n🚀 Happy coding with Claude!\n'));
  }
}

const createClaudeInitCommand = (program: Command) =>
  new ClaudeInitCommand(program);
export default createClaudeInitCommand;
