# Setup System Integration Guide

**Purpose**: Consolidate and enhance the project initialization system **Target**: Unified,
comprehensive project setup with full CLAUDE.md and template integration **Scope**: Setup commands,
generators, templates, and configuration

---

## 1. Current State vs Target State

### Current Architecture (Fragmented)

```
Project Initialization
├── /src/cli/commands/claude-setup.ts (standalone)
│   └── Basic template creation
│   └── Dynamic CLAUDE.md generation
│   └── Limited to simple projects
│
├── /packages/@wundr/cli/commands/claude-setup.ts (class-based)
│   └── Agent configuration
│   └── MCP tools setup
│   └── Hardware optimization
│   └── Multiple sub-commands
│
├── /packages/@wundr/cli/commands/setup.ts (environment)
│   └── Machine setup
│   └── Tool validation
│   └── Profile-based orchestration
│
└── /setup/install.sh (bash)
    └── Dependency checking
    └── Directory creation
```

### Target Architecture (Unified)

```
Project Initialization
└── UnifiedClaudeSetupCommands
    ├── Pre-Setup Validation
    │   ├── Git verification
    │   ├── Tool checks (Node, npm, git)
    │   └── Environment detection
    │
    ├── Core Setup Steps
    │   ├── 1. Claude Flow installation
    │   ├── 2. MCP tools setup
    │   ├── 3. Agent configuration
    │   ├── 4. CLAUDE.md generation
    │   ├── 5. Project structure creation
    │   ├── 6. Configuration template setup
    │   ├── 7. Git hooks installation
    │   ├── 8. Swarm initialization
    │   └── 9. Comprehensive validation
    │
    ├── Sub-Commands
    │   ├── setup mcp
    │   ├── setup agents
    │   ├── setup optimize
    │   ├── setup validate [--fix]
    │   └── setup extension
    │
    └── Integration Points
        ├── ProjectDetector
        ├── TemplateEngine
        ├── TemplateManager
        ├── QualityAnalyzer
        └── RepositoryAuditor
```

---

## 2. Detailed Integration Steps

### Step 1: Create Unified Setup Class

**File**: `/Users/iroselli/wundr/packages/@wundr/cli/src/commands/claude-setup-unified.ts`

```typescript
// New unified implementation combining both approaches

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ClaudeConfigGenerator } from '../../../src/claude-generator/claude-config-generator.js';
import { TemplateManager } from '../../../computer-setup/src/templates/template-manager.js';

export class UnifiedClaudeSetupCommands {
  constructor(private program: Command) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const claudeSetup = this.program
      .command('claude-setup')
      .alias('cs')
      .description('Complete Claude Code, Claude Flow, and MCP setup');

    // Main command
    claudeSetup
      .command('install', { isDefault: true })
      .description('Complete Claude ecosystem installation')
      .option('--skip-chrome', 'Skip Chrome installation')
      .option('--skip-mcp', 'Skip MCP tools')
      .option('--skip-agents', 'Skip agent configuration')
      .option('--skip-optimization', 'Skip hardware optimization')
      .action(async options => {
        await this.runCompleteSetup(options);
      });

    // Other commands...
  }

  private async runCompleteSetup(options: any): Promise<void> {
    const spinner = ora('Starting Claude Code setup...').start();

    try {
      // Step 1: Validate prerequisites
      await this.validatePrerequisites(spinner);

      // Step 2: Setup Claude Flow
      if (!options.skipFlow) {
        await this.setupClaudeFlow(spinner);
      }

      // Step 3: Setup MCP Tools
      if (!options.skipMcp) {
        await this.setupMCPTools(spinner);
      }

      // Step 4: Configure agents
      if (!options.skipAgents) {
        await this.configureAgents(spinner);
      }

      // Step 5: Generate CLAUDE.md
      await this.generateClaudeConfig(spinner);

      // Step 6: Create project structure
      await this.createProjectStructure(spinner);

      // Step 7: Setup configuration templates
      await this.setupConfigTemplates(spinner);

      // Step 8: Setup git hooks
      await this.setupGitHooks(spinner);

      // Step 9: Initialize swarm
      await this.initializeSwarm(spinner);

      // Step 10: Setup hardware optimization
      if (!options.skipOptimization) {
        await this.setupOptimizations(spinner);
      }

      // Step 11: Validation
      await this.validateSetup(spinner);

      spinner.succeed(chalk.green('Claude Code setup completed!'));
      this.displayFinalInstructions();
    } catch (error) {
      spinner.fail(chalk.red(`Setup failed: ${error.message}`));
      process.exit(1);
    }
  }

  // Individual setup methods...
}
```

### Step 2: Integrate CLAUDE.md Generation

**Location**: In `generateClaudeConfig()` method

```typescript
private async generateClaudeConfig(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Generating CLAUDE.md configuration...';

  try {
    const repoPath = process.cwd();
    const generator = new ClaudeConfigGenerator(repoPath);

    // Use existing generators
    const claudeContent = await generator.generateClaudeMarkdown();

    // Write to file
    const claudePath = join(repoPath, 'CLAUDE.md');
    writeFileSync(claudePath, claudeContent, 'utf-8');

    spinner.text = 'CLAUDE.md generated successfully';
  } catch (error) {
    throw new Error(`Failed to generate CLAUDE.md: ${error.message}`);
  }
}
```

### Step 3: Create Full Project Structure

**New Method**: `createProjectStructure()`

```typescript
private async createProjectStructure(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Creating project structure...';

  const repoPath = process.cwd();
  const dirs = [
    '.claude',
    '.claude/agents',
    '.claude/commands',
    '.claude/helpers',
    'config',
    'scripts',
    'docs',
    'tests',
    'src',
    'examples',
    'mcp-tools'
  ];

  for (const dir of dirs) {
    const dirPath = join(repoPath, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create default files
  await this.createDefaultFiles(spinner, repoPath);

  spinner.text = 'Project structure created';
}

private async createDefaultFiles(
  spinner: ora.Ora,
  repoPath: string
): Promise<void> {
  // Create .claude/settings.json
  const settingsPath = join(repoPath, '.claude/settings.json');
  if (!existsSync(settingsPath)) {
    const settings = {
      project: basename(repoPath),
      claudeFlow: { enabled: true, version: 'alpha' },
      agents: { enabled: true },
      mcp: { enabled: true },
      hooks: { enabled: true }
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  // Create config templates
  const templateFiles = [
    { name: 'eslint.config.js', content: getEslintTemplate() },
    { name: 'prettier.config.js', content: getPrettierTemplate() },
    { name: 'jest.config.js', content: getJestTemplate() }
  ];

  for (const file of templateFiles) {
    const filePath = join(repoPath, 'config', file.name);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, file.content);
    }
  }

  // Create documentation templates
  const docsFiles = [
    { name: 'DEVELOPMENT.md', content: getDevelopmentGuideTemplate() },
    { name: 'ARCHITECTURE.md', content: getArchitectureTemplate() }
  ];

  for (const file of docsFiles) {
    const filePath = join(repoPath, 'docs', file.name);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, file.content);
    }
  }

  // Create scripts
  const scripts = [
    { name: 'setup.sh', content: getSetupScriptTemplate() },
    { name: 'validate.sh', content: getValidateScriptTemplate() }
  ];

  for (const script of scripts) {
    const scriptPath = join(repoPath, 'scripts', script.name);
    if (!existsSync(scriptPath)) {
      writeFileSync(scriptPath, script.content);
      execSync(`chmod +x "${scriptPath}"`);
    }
  }
}
```

### Step 4: Setup Agent Configuration Templates

**New Method**: `setupAgentTemplates()`

```typescript
private async setupAgentTemplates(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Setting up agent templates...';

  const repoPath = process.cwd();
  const agentSourceDir = join(
    homedir(),
    '.claude/agents/templates'
  );
  const agentDestDir = join(repoPath, '.claude/agents');

  try {
    // Copy agent templates
    if (existsSync(agentSourceDir)) {
      const files = readdirSync(agentSourceDir);

      for (const file of files) {
        const src = join(agentSourceDir, file);
        const dest = join(agentDestDir, file);
        if (!existsSync(dest)) {
          copyFileSync(src, dest);
        }
      }
    }

    // Generate project-specific agent config
    const detector = new ProjectDetector(repoPath);
    const projectType = await detector.detectProjectType();
    const agents = this.getAgentsForProjectType(projectType);

    // Write agent configuration
    const configPath = join(agentDestDir, 'config.json');
    const config = {
      projectType,
      agents,
      enabled: true,
      topology: this.getTopologyForProjectType(projectType)
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

  } catch (error) {
    spinner.warn(`Could not setup agent templates: ${error.message}`);
  }
}
```

### Step 5: Setup MCP Tool Configuration

**New Method**: `setupMCPToolConfiguration()`

```typescript
private async setupMCPToolConfiguration(
  spinner: ora.Ora
): Promise<void> {
  spinner.text = 'Configuring MCP tools...';

  const repoPath = process.cwd();
  const detector = new ProjectDetector(repoPath);
  const projectType = await detector.detectProjectType();

  // Generate MCP configuration
  const mcpConfig = this.getMCPConfigForProjectType(projectType);

  // Write to .claude/mcp-config.json
  const configPath = join(repoPath, '.claude/mcp-config.json');
  writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));

  // Create MCP installation script
  const installScript = this.generateMCPInstallScript(mcpConfig);
  const scriptPath = join(repoPath, 'mcp-tools/install.sh');
  writeFileSync(scriptPath, installScript);
  execSync(`chmod +x "${scriptPath}"`);

  spinner.text = 'MCP tools configured';
}

private getMCPConfigForProjectType(projectType: string): any {
  const commonTools = [
    {
      name: 'drift_detection',
      enabled: true,
      config: { checkInterval: '1d' }
    },
    {
      name: 'pattern_standardize',
      enabled: true,
      config: { patterns: ['error-handling', 'imports'] }
    },
    {
      name: 'dependency_analyze',
      enabled: true,
      config: { checkCircular: true, findUnused: true }
    }
  ];

  const projectSpecificTools: Record<string, any[]> = {
    monorepo: [
      {
        name: 'monorepo_manage',
        enabled: true,
        config: { packageAnalysis: true }
      }
    ],
    react: [
      {
        name: 'ui_analyzer',
        enabled: true,
        config: { accessibilityCheck: true }
      }
    ],
    nodejs: [
      {
        name: 'api_analyzer',
        enabled: true,
        config: { securityCheck: true }
      }
    ]
  };

  return {
    enabled: true,
    tools: [
      ...commonTools,
      ...(projectSpecificTools[projectType] || [])
    ],
    autoConfiguration: true
  };
}
```

### Step 6: Setup Git Hooks

**New Method**: `setupGitHooks()`

```typescript
private async setupGitHooks(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Setting up Git hooks...';

  const repoPath = process.cwd();
  const gitDir = join(repoPath, '.git');

  if (!existsSync(gitDir)) {
    spinner.warn('Not a Git repository. Skipping hooks setup.');
    return;
  }

  try {
    // Create pre-commit hook
    const preCommitPath = join(gitDir, 'hooks/pre-commit');
    const preCommitContent = this.getPreCommitHookTemplate();
    mkdirSync(dirname(preCommitPath), { recursive: true });
    writeFileSync(preCommitContent, preCommitContent);
    execSync(`chmod +x "${preCommitPath}"`);

    // Try to install husky if available
    try {
      execSync('npx husky install', { cwd: repoPath });
    } catch {
      // Husky not available, that's okay
    }

  } catch (error) {
    spinner.warn(`Could not setup git hooks: ${error.message}`);
  }
}

private getPreCommitHookTemplate(): string {
  return `#!/bin/bash
# Pre-commit hook generated by Claude Code setup

# Run linting
npm run lint --fix 2>/dev/null

# Run type checking
npm run typecheck 2>/dev/null

# Run tests
npm run test 2>/dev/null

exit $?
`;
}
```

### Step 7: Validation and Next Steps

**Enhanced Method**: `validateSetup()`

```typescript
private async validateSetup(spinner: ora.Ora): Promise<void> {
  spinner.text = 'Validating setup...';

  const repoPath = process.cwd();
  const checks = [
    { name: 'CLAUDE.md', path: join(repoPath, 'CLAUDE.md') },
    { name: '.claude/settings.json', path: join(repoPath, '.claude/settings.json') },
    { name: '.claude/agents/', path: join(repoPath, '.claude/agents') },
    { name: 'Git repository', path: join(repoPath, '.git') },
    { name: 'config/ directory', path: join(repoPath, 'config') },
    { name: 'scripts/ directory', path: join(repoPath, 'scripts') },
    { name: 'docs/ directory', path: join(repoPath, 'docs') }
  ];

  const results = checks.map(check => ({
    ...check,
    exists: existsSync(check.path)
  }));

  const failures = results.filter(r => !r.exists);

  if (failures.length > 0) {
    const missing = failures.map(f => f.name).join(', ');
    throw new Error(`Setup validation failed: Missing ${missing}`);
  }
}
```

---

## 3. Template Files to Create

### 3.1 Configuration Templates

**File**:
`/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/eslint.config.js`

```javascript
export default [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    ignores: ['node_modules', 'dist', 'build', 'coverage'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      indent: ['error', 2],
    },
  },
];
```

**File**:
`/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/prettier.config.js`

```javascript
export default {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  printWidth: 100,
};
```

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/jest.config.js`

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### 3.2 Documentation Templates

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/DEVELOPMENT.md`

```markdown
# Development Guide

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm

### Setup

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Run validation: \`npm run validate\`
4. Start development: \`npm run dev\`

## Development Workflow

### Available Commands

- \`npm run build\` - Build the project
- \`npm run dev\` - Start development server
- \`npm run test\` - Run tests
- \`npm run lint\` - Run linter
- \`npm run format\` - Format code

### Code Style

This project follows strict code standards:

- ESLint for linting
- Prettier for formatting
- TypeScript for type safety
- Jest for testing

Run \`npm run format\` before committing.

## Git Workflow

1. Create feature branch: \`git checkout -b feature/name\`
2. Make changes and commit
3. Pre-commit hooks run automatically
4. Push to remote: \`git push\`
5. Create pull request

## Testing

Run tests with: \`npm run test\`

Coverage threshold: 70%

## Troubleshooting

### Build fails

- Check Node.js version: \`node --version\`
- Clear cache: \`npm run clean\`
- Reinstall: \`rm -rf node_modules && npm install\`

### Tests fail

- Run: \`npm run test -- --verbose\`
- Check for unmet dependencies
- Review test output carefully
```

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/ARCHITECTURE.md`

```markdown
# Architecture Overview

## Project Structure

\`\`\` project/ ├── src/ # Source code ├── tests/ # Test files ├── config/ # Configuration files ├──
scripts/ # Utility scripts ├── docs/ # Documentation ├── .claude/ # Claude Code configuration ├──
mcp-tools/ # MCP tool integration └── examples/ # Example code \`\`\`

## Key Components

### Source Organization

- Modular design
- Single responsibility principle
- Clear separation of concerns

### Testing Strategy

- Unit tests for functions
- Integration tests for modules
- E2E tests for workflows
- Minimum coverage: 70%

### Build Process

- TypeScript compilation
- Asset optimization
- Distribution package creation

## Design Decisions

### Technology Stack

- Language: TypeScript
- Build Tool: [specified]
- Test Framework: Jest
- Package Manager: npm/yarn/pnpm

### Quality Standards

- Strict TypeScript mode
- ESLint enforcement
- Prettier formatting
- Pre-commit hooks

## Development Patterns

### Module Structure

- Each module is self-contained
- Clear public interfaces
- Internal implementation hidden

### Error Handling

- Try-catch for async operations
- Descriptive error messages
- Proper error propagation

### Logging

- Structured logging
- Appropriate log levels
- No sensitive data in logs
```

### 3.3 Script Templates

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/setup.sh`

```bash
#!/bin/bash

set -e

echo "Setting up development environment..."

# Check prerequisites
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup git hooks
echo "Setting up Git hooks..."
npx husky install 2>/dev/null || true

# Build project
echo "Building project..."
npm run build

# Run tests
echo "Running tests..."
npm run test

echo "Setup complete!"
```

**File**: `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/validate.sh`

```bash
#!/bin/bash

set -e

echo "Validating project..."

# Check Node.js
NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Check dependencies
echo "Checking dependencies..."
npm ls --depth=0 > /dev/null
echo "✓ Dependencies OK"

# Run linting
echo "Running linter..."
npm run lint 2>/dev/null || echo "⚠ Linting issues found"

# Run type checking
echo "Type checking..."
npm run typecheck 2>/dev/null || echo "⚠ Type errors found"

# Run tests
echo "Running tests..."
npm run test 2>/dev/null || echo "⚠ Tests failed"

echo "✓ Validation complete"
```

---

## 4. Integration Checklist

### Pre-Integration

- [ ] Review both claude-setup.ts implementations
- [ ] Identify common functionality
- [ ] Plan consolidation approach
- [ ] Backup existing implementations

### Implementation

- [ ] Create UnifiedClaudeSetupCommands class
- [ ] Implement validatePrerequisites()
- [ ] Implement setupClaudeFlow()
- [ ] Implement setupMCPTools()
- [ ] Implement configureAgents()
- [ ] Implement generateClaudeConfig()
- [ ] Implement createProjectStructure()
- [ ] Implement setupConfigTemplates()
- [ ] Implement setupGitHooks()
- [ ] Implement initializeSwarm()
- [ ] Implement setupOptimizations()
- [ ] Implement validateSetup()

### Testing

- [ ] Unit test each method
- [ ] Integration test full flow
- [ ] Test TypeScript template
- [ ] Test React template
- [ ] Test Node.js template
- [ ] Test Monorepo template
- [ ] Verify CLAUDE.md generation
- [ ] Verify agent configuration
- [ ] Verify MCP setup
- [ ] Test on fresh directory

### Documentation

- [ ] Update setup documentation
- [ ] Document new templates
- [ ] Create troubleshooting guide
- [ ] Update CLAUDE.md template

### Deployment

- [ ] Merge to master
- [ ] Update version
- [ ] Create release notes
- [ ] Announce to team

---

## 5. Success Criteria

### Functional Requirements

- ✓ Single unified setup command
- ✓ Comprehensive project initialization
- ✓ Dynamic CLAUDE.md generation
- ✓ Agent configuration
- ✓ MCP tool setup
- ✓ Git hooks installation
- ✓ Full directory structure creation

### Quality Requirements

- ✓ 90%+ code coverage
- ✓ All TypeScript errors fixed
- ✓ No linting violations
- ✓ All tests passing
- ✓ Zero critical security issues

### Performance Requirements

- ✓ Setup completes in < 5 minutes
- ✓ No unnecessary file operations
- ✓ Efficient validation checks
- ✓ Parallel operations where possible

### User Experience

- ✓ Clear progress indication
- ✓ Helpful error messages
- ✓ Recovery suggestions on failure
- ✓ Next steps clearly documented

---

## 6. Timeline Estimate

| Phase     | Tasks                      | Estimated Hours |
| --------- | -------------------------- | --------------- |
| Phase 1   | Code consolidation         | 8               |
| Phase 2   | Integration implementation | 16              |
| Phase 3   | Template creation          | 12              |
| Phase 4   | Testing                    | 12              |
| Phase 5   | Documentation              | 8               |
| Phase 6   | Deployment                 | 4               |
| **Total** |                            | **60**          |

---

## 7. Rollback Plan

If integration fails:

1. Keep original implementations tagged in git
2. Use feature branches for development
3. Maintain backward compatibility
4. Create gradual migration path
5. Document fallback procedures

---

**Last Updated**: 2025-11-21 **Status**: Ready for implementation **Priority**: High
