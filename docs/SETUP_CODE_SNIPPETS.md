# Setup System Code Snippets & References

**Purpose**: Provide specific code locations and implementation details **Format**: File paths with
code sections and integration points

---

## 1. Setup Command Entry Points

### 1.1 Primary Standalone Implementation

**File**: `/Users/iroselli/wundr/src/cli/commands/claude-setup.ts`

**Key Function** (lines 16-91):

```typescript
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
      // Implementation
    });

  return command;
}
```

**Setup Flow** (lines 29-62):

```typescript
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

// Step 5: Initialize swarm
if (!options.skipFlow) {
  await initializeSwarm(spinner, repoPath);
}

// Step 6: Validation
await validateSetup(spinner, repoPath);
```

**Template Setup** (lines 186-204):

```typescript
async function setupProjectTemplate(
  spinner: ora.Ora,
  repoPath: string,
  templateName: string
): Promise<void> {
  spinner.text = `Applying ${templateName} template...`;

  const templates: Record<string, () => void> = {
    typescript: () => setupTypeScriptTemplate(repoPath),
    react: () => setupReactTemplate(repoPath),
    nodejs: () => setupNodeTemplate(repoPath),
    monorepo: () => setupMonorepoTemplate(repoPath),
  };

  const setupFunction = templates[templateName];
  if (!setupFunction) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  setupFunction();

  spinner.text = `${templateName} template applied`;
}
```

**Template Implementations** (lines 206-301):

TypeScript (lines 206-236):

```typescript
function setupTypeScriptTemplate(repoPath: string): void {
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
        rootDir: 'src',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }

  const srcPath = join(repoPath, 'src');
  if (!existsSync(srcPath)) {
    mkdirSync(srcPath, { recursive: true });
    writeFileSync(join(srcPath, 'index.ts'), '// Your TypeScript code here\n');
  }
}
```

React (lines 238-256):

```typescript
function setupReactTemplate(repoPath: string): void {
  const srcPath = join(repoPath, 'src');
  if (!existsSync(srcPath)) {
    mkdirSync(srcPath, { recursive: true });
  }

  const componentsPath = join(srcPath, 'components');
  if (!existsSync(componentsPath)) {
    mkdirSync(componentsPath, { recursive: true });
  }

  const hooksPath = join(srcPath, 'hooks');
  if (!existsSync(hooksPath)) {
    mkdirSync(hooksPath, { recursive: true });
  }
}
```

Monorepo (lines 273-301):

```typescript
function setupMonorepoTemplate(repoPath: string): void {
  const packagesPath = join(repoPath, 'packages');
  if (!existsSync(packagesPath)) {
    mkdirSync(packagesPath, { recursive: true });
  }

  const appsPath = join(repoPath, 'apps');
  if (!existsSync(appsPath)) {
    mkdirSync(appsPath, { recursive: true });
  }

  const packageJsonPath = join(repoPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    const packageJson = {
      name: 'monorepo-workspace',
      version: '1.0.0',
      private: true,
      workspaces: ['packages/*', 'apps/*'],
      devDependencies: {
        turbo: '^2.0.0',
      },
    };
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}
```

**MCP Tools Setup** (lines 129-169):

```typescript
async function setupMCPTools(spinner: ora.Ora, repoPath: string, global: boolean): Promise<void> {
  spinner.text = 'Setting up MCP Tools...';

  const mcpToolsPath = join(repoPath, 'mcp-tools');

  if (!existsSync(mcpToolsPath)) {
    mkdirSync(mcpToolsPath, { recursive: true });

    const installScript = `#!/bin/bash
# MCP Tools Installation Script
echo "Installing Wundr MCP Tools..."

# Add your MCP tool installations here
echo "✅ MCP Tools installation template created"
echo "Customize this script with your specific MCP tools"
`;

    writeFileSync(join(mcpToolsPath, 'install.sh'), installScript);
    execSync(`chmod +x ${join(mcpToolsPath, 'install.sh')}`);

    const mcpPackageJson = {
      name: 'mcp-tools',
      version: '1.0.0',
      description: 'MCP Tools for Claude Code integration',
      private: true,
      scripts: {
        install: './install.sh',
      },
    };

    writeFileSync(join(mcpToolsPath, 'package.json'), JSON.stringify(mcpPackageJson, null, 2));
  }
}
```

**CLAUDE.md Generation** (lines 171-184):

```typescript
async function generateClaudeConfig(spinner: ora.Ora, repoPath: string): Promise<void> {
  spinner.text = 'Generating CLAUDE.md configuration...';

  const { ClaudeConfigGenerator } =
    await import('../../claude-generator/claude-config-generator.js');
  const generator = new ClaudeConfigGenerator(repoPath);

  const claudeContent = await generator.generateClaudeMarkdown();
  const claudeFilePath = join(repoPath, 'CLAUDE.md');

  writeFileSync(claudeFilePath, claudeContent, 'utf-8');

  spinner.text = 'CLAUDE.md generated successfully';
}
```

---

### 1.2 Monorepo Package Implementation

**File**: `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/claude-setup.ts`

**Class Structure** (lines 12-93):

```typescript
export class ClaudeSetupCommands {
  constructor(private program: Command) {
    this.registerCommands();
  }

  private registerCommands(): void {
    // Main setup command
    claudeSetup
      .command('install', { isDefault: true })
      .description('Complete Claude ecosystem installation')
      .option('--skip-chrome', 'Skip Chrome installation')
      .option('--skip-mcp', 'Skip MCP tools installation')
      .option('--skip-agents', 'Skip agent configuration')
      .action(async options => {
        await this.runCompleteSetup(options);
      });

    // MCP tools installation
    claudeSetup
      .command('mcp')
      .description('Install and configure MCP tools')
      .option(
        '--tool <tool>',
        'Install specific tool (firecrawl, context7, playwright, browser, sequentialthinking)'
      )
      .action(async options => {
        await this.installMcpTools(options);
      });

    // Agent configuration
    claudeSetup
      .command('agents')
      .description('Configure Claude Flow agents')
      .option('--list', 'List available agents')
      .option('--enable <agents>', 'Enable specific agents (comma-separated)')
      .option('--profile <profile>', 'Use profile-specific agents')
      .action(async options => {
        await this.configureAgents(options);
      });

    // Validation
    claudeSetup
      .command('validate')
      .description('Validate Claude installation')
      .option('--fix', 'Attempt to fix issues')
      .action(async options => {
        await this.validateInstallation(options);
      });

    // Chrome extension
    claudeSetup
      .command('extension')
      .description('Install Browser MCP Chrome extension')
      .action(async () => {
        await this.installChromeExtension();
      });

    // Hardware optimization
    claudeSetup
      .command('optimize')
      .description('Setup hardware-adaptive Claude Code optimizations')
      .option('--force', 'Force reinstallation of optimization scripts')
      .action(async options => {
        await this.setupOptimizations(options);
      });
  }
}
```

**Agent Configuration** (lines 208-242):

```typescript
private async configureAgents(options: any): Promise<void> {
  const spinner = ora();

  if (options.list) {
    this.listAgents();
    return;
  }

  spinner.start('Configuring Claude Flow agents...');

  const agents = options.enable
    ? options.enable.split(',')
    : this.getProfileAgents(options.profile || 'fullstack');

  // Create agent configurations
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const agentsDir = path.join(homeDir, '.claude', 'agents');

  try {
    fs.mkdirSync(agentsDir, { recursive: true });

    for (const agent of agents) {
      const config = this.generateAgentConfig(agent);
      fs.writeFileSync(
        path.join(agentsDir, `${agent}.json`),
        JSON.stringify(config, null, 2)
      );
    }

    spinner.succeed(`${agents.length} agents configured`);
  } catch (error) {
    spinner.fail('Failed to configure agents');
    console.error(error);
  }
}
```

**Agent Profiles** (lines 639-664):

```typescript
private getProfileAgents(profile: string): string[] {
  const profileAgents: Record<string, string[]> = {
    frontend: ['coder', 'reviewer', 'tester', 'mobile-dev'],
    backend: [
      'coder',
      'reviewer',
      'tester',
      'backend-dev',
      'system-architect',
    ],
    fullstack: [
      'coder',
      'reviewer',
      'tester',
      'planner',
      'researcher',
      'system-architect',
    ],
    devops: ['planner', 'cicd-engineer', 'perf-analyzer', 'github-modes'],
  };

  return (
    profileAgents[profile] ||
    profileAgents.fullstack || ['coder', 'reviewer', 'tester']
  );
}
```

**Hardware Optimization Setup** (lines 297-426):

```typescript
private async setupOptimizations(options: any): Promise<void> {
  const spinner = ora();
  console.log(
    chalk.cyan.bold(
      '\n⚡ Claude Code Hardware-Adaptive Optimization Setup\n'
    )
  );

  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const scriptsDir = path.join(homeDir, '.claude', 'scripts');
    const resourcesDir = path.join(
      __dirname,
      '../../../computer-setup/resources/scripts'
    );

    // Step 1: Create scripts directory
    spinner.start('Creating scripts directory...');
    fs.mkdirSync(scriptsDir, { recursive: true });
    spinner.succeed('Scripts directory ready');

    // Step 2: Copy optimization scripts
    spinner.start('Installing optimization scripts...');

    if (!fs.existsSync(resourcesDir)) {
      spinner.fail('Optimization scripts not found in resources');
      console.error(
        chalk.red(
          `Expected scripts at: ${resourcesDir}\nPlease ensure @wundr/computer-setup is installed.`
        )
      );
      return;
    }

    // Copy all scripts
    const scripts = [
      'detect-hardware-limits.js',
      'claude-optimized',
      'orchestrator.js',
      'cleanup-zombies.sh',
      'README-ORCHESTRATION.md',
      'QUICK-START.md',
    ];

    for (const script of scripts) {
      const src = path.join(resourcesDir, script);
      const dest = path.join(scriptsDir, script);

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      } else {
        console.warn(chalk.yellow(`⚠️  Script not found: ${script}`));
      }
    }

    // Make executable scripts executable
    const executableScripts = ['claude-optimized', 'cleanup-zombies.sh'];
    for (const script of executableScripts) {
      const scriptPath = path.join(scriptsDir, script);
      if (fs.existsSync(scriptPath)) {
        execSync(`chmod +x "${scriptPath}"`, { stdio: 'pipe' });
      }
    }

    spinner.succeed('Optimization scripts installed');

    // Step 3: Configure shell
    spinner.start('Configuring shell environment...');
    await this.addOptimizationToShell(homeDir);
    spinner.succeed('Shell configuration updated');

    console.log(chalk.green.bold('\n✅ Optimization setup complete!\n'));

    // Show what was installed
    console.log(chalk.cyan('📦 Installed Scripts:'));
    console.log(
      chalk.white('  • detect-hardware-limits.js - Hardware detection')
    );
    console.log(
      chalk.white('  • claude-optimized - Optimized Claude wrapper')
    );
    console.log(
      chalk.white('  • orchestrator.js - Fault-tolerant orchestration')
    );
    console.log(
      chalk.white('  • cleanup-zombies.sh - Process cleanup utility')
    );

    // ... rest of implementation
  } catch (error) {
    spinner.fail('Optimization setup failed');
    console.error(chalk.red(error));
    throw error;
  }
}
```

---

## 2. CLAUDE.md Generation System

### 2.1 Configuration Generator

**File**: `/Users/iroselli/wundr/src/claude-generator/claude-config-generator.ts`

**Main Class** (lines 16-29):

```typescript
export class ClaudeConfigGenerator {
  private rootPath: string;
  private detector: ProjectDetector;
  private qualityAnalyzer: QualityAnalyzer;
  private auditor: RepositoryAuditor;
  private templateEngine: TemplateEngine;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
    this.detector = new ProjectDetector(this.rootPath);
    this.qualityAnalyzer = new QualityAnalyzer(this.rootPath);
    this.auditor = new RepositoryAuditor(this.rootPath);
    this.templateEngine = new TemplateEngine();
  }
}
```

**Generate Config** (lines 34-65):

```typescript
async generateConfig(): Promise<ClaudeConfig> {
  // Analyze project
  const projectType = await this.detector.detectProjectType();
  const structure = await this.detector.analyzeStructure();

  // Get package.json data
  const packageData = await this.getPackageJsonData();
  const projectMetadata = this.extractProjectMetadata(packageData);

  // Analyze quality standards
  const qualityStandards = await this.qualityAnalyzer.analyzeQualityStandards(
    packageData,
    structure
  );

  // Configure agents based on project type
  const agentConfiguration = this.configureAgents(projectType, structure);

  // Configure MCP tools
  const mcpTools = this.configureMCPTools(projectType, structure);

  const config: ClaudeConfig = {
    projectMetadata,
    projectType,
    projectStructure: structure,
    qualityStandards,
    agentConfiguration,
    mcpTools
  };

  return config;
}
```

**Generate Markdown** (lines 70-89):

```typescript
async generateClaudeMarkdown(): Promise<string> {
  const config = await this.generateConfig();
  const packageData = await this.getPackageJsonData();

  // Create template context
  const context: TemplateContext = {
    project: config.projectMetadata,
    type: config.projectType,
    structure: config.projectStructure,
    quality: config.qualityStandards,
    agents: config.agentConfiguration,
    mcp: config.mcpTools,
    buildCommands: this.extractBuildCommands(packageData),
    testCommands: this.extractTestCommands(packageData),
    lintCommands: this.extractLintCommands(packageData),
    customCommands: this.extractCustomCommands(packageData)
  };

  return this.templateEngine.generateClaudeConfig(context);
}
```

**Agent Configuration** (lines 138-208):

```typescript
private configureAgents(projectType: string, structure: any): AgentConfiguration {
  const baseAgents = ['coder', 'reviewer', 'tester', 'planner', 'researcher'];

  const specializedAgents: Record<string, string[]> = {
    'monorepo': [
      'package-coordinator',
      'build-orchestrator',
      'version-manager',
      'dependency-analyzer'
    ],
    'react': [
      'ui-designer',
      'component-architect',
      'accessibility-tester',
      'performance-optimizer'
    ],
    'nextjs': [
      'ui-designer',
      'ssr-specialist',
      'performance-optimizer',
      'seo-analyzer'
    ],
    'nodejs': [
      'api-designer',
      'security-auditor',
      'performance-optimizer',
      'database-architect'
    ],
    'cli': [
      'ux-designer',
      'help-writer',
      'integration-tester',
      'platform-tester'
    ],
    'library': [
      'api-designer',
      'documentation-writer',
      'compatibility-tester',
      'version-manager'
    ],
    'full-stack': [
      'api-designer',
      'ui-designer',
      'integration-tester',
      'security-auditor'
    ]
  };

  const projectSpecificAgents = specializedAgents[projectType] || [];

  // Determine optimal topology based on project complexity
  let topology: 'mesh' | 'hierarchical' | 'adaptive' = 'mesh';
  let maxAgents = 6;

  if (projectType === 'monorepo') {
    topology = 'hierarchical';
    maxAgents = 12;
  } else if (projectType === 'full-stack') {
    topology = 'adaptive';
    maxAgents = 10;
  }

  return {
    agents: [...baseAgents, ...projectSpecificAgents],
    swarmTopology: topology,
    maxAgents,
    specializedAgents: {
      [projectType]: projectSpecificAgents
    }
  };
}
```

**MCP Tool Configuration** (lines 210-285):

```typescript
private configureMCPTools(projectType: string, structure: any): MCPToolConfig {
  const commonTools = [
    {
      name: 'drift_detection',
      description: 'Monitor code quality drift and detect regressions',
      config: {
        enabled: true,
        checkInterval: '1d',
        thresholds: {
          complexity: 10,
          duplication: 5
        }
      }
    },
    {
      name: 'pattern_standardize',
      description: 'Automatically standardize code patterns across the codebase',
      config: {
        enabled: true,
        patterns: ['error-handling', 'import-ordering', 'naming-conventions']
      }
    },
    {
      name: 'dependency_analyze',
      description: 'Analyze and optimize project dependencies',
      config: {
        enabled: true,
        checkCircular: true,
        findUnused: true,
        securityScan: true
      }
    },
    {
      name: 'test_baseline',
      description: 'Manage test coverage baselines and quality metrics',
      config: {
        enabled: structure.hasTests,
        coverageThreshold: 80,
        trackRegression: true
      }
    }
  ];

  // Add project-specific tools
  const projectSpecificTools = [];

  if (projectType === 'monorepo') {
    projectSpecificTools.push({
      name: 'monorepo_manage',
      description: 'Specialized monorepo management and coordination',
      config: {
        enabled: true,
        packageAnalysis: true,
        buildOptimization: true
      }
    });
  }

  if (['react', 'nextjs', 'full-stack'].includes(projectType)) {
    projectSpecificTools.push({
      name: 'ui_analyzer',
      description: 'Analyze UI components for accessibility and performance',
      config: {
        enabled: true,
        accessibilityCheck: true,
        performanceMetrics: true
      }
    });
  }

  return {
    enabled: true,
    tools: [...commonTools, ...projectSpecificTools],
    autoConfiguration: true
  };
}
```

---

### 2.2 Template Engine

**File**: `/Users/iroselli/wundr/src/claude-generator/template-engine.ts`

**Main Generation** (lines 7-25):

```typescript
generateClaudeConfig(context: TemplateContext): string {
  const sections = [
    this.generateHeader(context),
    this.generateVerificationProtocol(),
    this.generateConcurrentExecution(),
    this.generateProjectOverview(context),
    this.generateCommands(context),
    this.generateWorkflowPhases(context),
    this.generateCodeStyle(context),
    this.generateAgentConfiguration(context),
    this.generateMCPTools(context),
    this.generateBuildSystem(context),
    this.generateQualityStandards(context),
    this.generateIntegrationTips(context),
    this.generateFooter()
  ].filter(Boolean);

  return sections.join('\n\n');
}
```

**Agent Configuration Section** (example):

```typescript
private generateAgentConfiguration(context: TemplateContext): string {
  const { agents } = context;

  let section = `## Agent Configuration

**Swarm Topology**: ${agents.swarmTopology}
**Max Agents**: ${agents.maxAgents}

### Enabled Agents
${agents.agents.map(agent => `- ${agent}`).join('\n')}
`;

  // Add project-specific agents
  for (const [projectType, projectAgents] of Object.entries(agents.specializedAgents)) {
    if (projectAgents.length > 0) {
      section += `\n### ${projectType} Specialized Agents
${projectAgents.map(agent => `- ${agent}`).join('\n')}
`;
    }
  }

  return section;
}
```

---

## 3. Template System References

### 3.1 Template Manager

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/templates/template-manager.ts`

**Copy Templates** (lines 58-80):

```typescript
async copyTemplates(options: TemplateOptions): Promise<void> {
  const spinner = ora('Copying and customizing templates').start();

  try {
    const templatePath = path.resolve(this.templatesDir, options.templateDir);
    const outputPath = path.resolve(options.outputDir);

    if (!await fs.pathExists(templatePath)) {
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
```

### 3.2 Project Templates

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/templates/project-templates.ts`

**Create Project Templates** (lines 21-57):

```typescript
export async function createProjectTemplates(options: ProjectTemplateOptions): Promise<void> {
  const templateManager = new TemplateManager();

  console.log(chalk.blue(`\n🏗️  Setting up templates for ${options.projectType} project`));

  const context = createTemplateContext(options);

  // Generate configuration files based on project type
  const configs = getConfigsForProjectType(options.projectType, options);

  try {
    await templateManager.generateConfigs(options.projectPath, context, configs);

    if (options.includeDocker) {
      await generateDockerTemplates(templateManager, options.projectPath, context);
    }

    if (options.includeGitHub) {
      await generateGitHubTemplates(templateManager, options.projectPath, context);
    }

    if (options.includeSlack) {
      await generateSlackTemplates(templateManager, options.projectPath, context);
    }

    if (options.includeClaudeFlow) {
      await generateClaudeFlowTemplates(templateManager, options.projectPath, context);
    }

    console.log(chalk.green('✅ Project templates created successfully!'));
    printNextSteps(options);
  } catch (error) {
    console.error(chalk.red('❌ Failed to create project templates:'), error);
    throw error;
  }
}
```

**Get Configs for Project Type** (lines 90-100):

```typescript
function getConfigsForProjectType(projectType: string, options: ProjectTemplateOptions): string[] {
  const configs = ['prettier'];

  switch (projectType) {
    case 'node':
      configs.push('eslint', 'jest', 'tsconfig-node');
      break;
    case 'react':
      configs.push('eslint', 'jest', 'tsconfig-react');
      break;
    // ... more cases
  }

  return configs;
}
```

---

## 4. Integration Point Matrix

### Files That Need Integration:

| Source File                                       | Target Location                                     | Integration Type | Priority |
| ------------------------------------------------- | --------------------------------------------------- | ---------------- | -------- |
| `/src/cli/commands/claude-setup.ts`               | `/packages/@wundr/cli/src/commands/claude-setup.ts` | Consolidation    | High     |
| `/src/claude-generator/*`                         | `setupProjectTemplate()`                            | Method call      | High     |
| `/packages/@wundr/computer-setup/src/templates/*` | `setupProjectTemplate()`                            | Method call      | High     |
| `/.claude/agents/templates/*`                     | `setupAgentTemplates()`                             | File copy        | High     |
| `/setup/install.sh`                               | TypeScript implementation                           | Migration        | Medium   |

---

## 5. Type Definitions

### Type Locations:

**File**: `/Users/iroselli/wundr/src/claude-generator/types.ts` (143 lines)

Key types:

- `ProjectMetadata` - Project information
- `ProjectStructure` - Detected project structure
- `ProjectType` - Project type enum
- `QualityStandards` - Code quality configuration
- `AgentConfiguration` - Agent setup
- `MCPToolConfig` - MCP tool configuration
- `ClaudeConfig` - Complete configuration
- `TemplateContext` - Template rendering context
- `AuditResult` - Repository audit results

---

## 6. Command Invocation Examples

### Current Invocations:

```bash
# Standalone CLI
npx claude-setup [path]
npx claude-setup --template typescript

# Monorepo package
wundr claude-setup install
wundr claude-setup mcp
wundr claude-setup agents --profile fullstack
wundr claude-setup validate --fix
wundr claude-setup optimize

# Environment setup
wundr setup --profile fullstack
wundr setup:profile frontend
wundr setup:validate
wundr setup:resume
wundr setup:personalize

# Bash installer
bash setup/install.sh
```

### Target Unified Invocations:

```bash
# After consolidation
wundr claude-setup install [path]
wundr claude-setup install --skip-mcp --skip-optimization
wundr claude-setup mcp --tool firecrawl
wundr claude-setup agents --list
wundr claude-setup agents --enable coder,reviewer,tester
wundr claude-setup agents --profile backend
wundr claude-setup validate --fix
wundr claude-setup optimize --force
wundr claude-setup extension
```

---

## 7. Configuration Files Generated

### Current Files:

- `CLAUDE.md` - Dynamic configuration
- `mcp-tools/install.sh` - Stub script
- `mcp-tools/package.json` - Package metadata
- Type-specific files (tsconfig.json, etc.)

### Target Files:

- `CLAUDE.md` - Enhanced with custom sections
- `.claude/settings.json` - Unified configuration
- `.claude/agents/config.json` - Agent configuration
- `.claude/mcp-config.json` - MCP tool configuration
- `config/eslint.config.js` - Linting configuration
- `config/prettier.config.js` - Formatting configuration
- `config/jest.config.js` - Testing configuration
- `config/tsconfig.json` - TypeScript configuration
- `scripts/setup.sh` - Setup automation
- `scripts/validate.sh` - Validation automation
- `docs/DEVELOPMENT.md` - Development guide
- `docs/ARCHITECTURE.md` - Architecture documentation
- `.github/workflows/ci.yml` - CI/CD pipeline
- `Dockerfile` - Container configuration
- `.git/hooks/pre-commit` - Pre-commit hooks

---

## References & Links

### Key Files:

1. `/Users/iroselli/wundr/src/cli/commands/claude-setup.ts` - Primary implementation
2. `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/claude-setup.ts` - Alternative
   implementation
3. `/Users/iroselli/wundr/src/claude-generator/claude-config-generator.ts` - Generator
4. `/Users/iroselli/wundr/src/claude-generator/template-engine.ts` - Template engine

### Documentation:

- CLAUDE.md template:
  `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template`
- Agent templates: `/.claude/agents/templates/` (9 markdown files)

### Test Files:

- `/Users/iroselli/wundr/src/tests/claude-generator.test.ts`

---

**Last Updated**: 2025-11-21 **Status**: Reference Complete
