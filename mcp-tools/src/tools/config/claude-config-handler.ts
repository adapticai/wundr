import * as fs from 'fs';
import * as path from 'path';

interface ClaudeConfigArgs {
  configType: 'claude-md' | 'hooks' | 'conventions' | 'all';
  features?: string[];
}

export class ClaudeConfigHandler {
  async execute(args: ClaudeConfigArgs): Promise<string> {
    const { configType, features = [] } = args;

    try {
      switch (configType) {
        case 'claude-md':
          return this.generateClaudeMd(features);

        case 'hooks':
          return this.generateHooks(features);

        case 'conventions':
          return this.generateConventions(features);

        case 'all':
          return this.generateAllConfigs(features);

        default:
          throw new Error(`Unknown config type: ${configType}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Claude config generation failed: ${error.message}`);
      }
      throw error;
    }
  }

  private generateClaudeMd(features: string[]): string {
    const claudeMdContent = `# Claude Code Configuration - WITH VERIFICATION PROTOCOLS

## 🚨 CRITICAL: VERIFICATION PROTOCOL & REALITY CHECKS

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output  
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**FORBIDDEN BEHAVIORS:**
- ❌ NEVER claim "build successful" without running build
- ❌ NEVER say "tests pass" without running tests
- ❌ NEVER report "implemented" without verification
- ❌ NEVER hide or minimize errors
- ❌ NEVER generate fictional terminal output
- ❌ NEVER assume code works because you wrote it

**REQUIRED BEHAVIORS:**
- ✅ Run actual commands
- ✅ Show real output
- ✅ Report failures immediately
- ✅ Document issues in FAILURES.md
- ✅ Test before claiming done
- ✅ Be honest about state

### FAILURE REPORTING FORMAT
\`\`\`
❌ FAILURE: [Component Name]
Error: [Exact error message]
Location: [File and line if available]
Status: BLOCKED/PARTIAL/NEEDS_INVESTIGATION
\`\`\`

### SUCCESS REPORTING FORMAT
\`\`\`
✅ VERIFIED: [Component Name]
Build Output: [Show actual npm run build success]
Test Output: [Show actual test results]
Execution: [Show feature actually running]
\`\`\`

## Project Overview
This project uses the Wundr toolkit for systematic code quality management, governance, and standardization.

## Key Commands

### Governance & Quality
- \`npx wundr drift:detect\` - Check for code drift
- \`npx wundr drift:baseline\` - Create quality baseline
- \`npx wundr govern:report\` - Generate governance report

### Standardization
- \`npx wundr standardize:run\` - Apply code pattern fixes
- \`npx wundr standardize:review\` - Review patterns needing manual attention

### Monorepo Management
- \`npx wundr monorepo:init\` - Initialize monorepo structure
- \`npx wundr monorepo:add <name>\` - Add new package
- \`npx wundr monorepo:check-deps\` - Check for circular dependencies

### Analysis & Testing
- \`npx wundr analyze:deps\` - Analyze dependencies
- \`npx wundr test:baseline\` - Create test coverage baseline

## Code Style Guidelines

### Error Handling
Always use AppError for consistent error handling:
\`\`\`typescript
// ✅ Good
throw new AppError('User not found', 'USER_NOT_FOUND');

// ❌ Bad
throw new Error('User not found');
throw 'User not found';
\`\`\`

### Async/Await
Prefer async/await over promise chains:
\`\`\`typescript
// ✅ Good
async function fetchData() {
  const user = await getUser();
  const profile = await getProfile(user.id);
  return profile;
}

// ❌ Bad
function fetchData() {
  return getUser()
    .then(user => getProfile(user.id))
    .then(profile => profile);
}
\`\`\`

### Service Pattern
Services should extend BaseService:
\`\`\`typescript
export class UserService extends BaseService {
  constructor() {
    super('UserService');
  }

  protected async onStart(): Promise<void> {
    // Initialize service
  }

  protected async onStop(): Promise<void> {
    // Cleanup
  }
}
\`\`\`

### Import Organization
Imports should be organized in groups:
1. Node.js built-ins
2. External packages
3. Internal packages (@company/*)
4. Relative imports

## Architecture Patterns

### Monorepo Structure
\`\`\`
├── packages/           # Shared packages
│   ├── core-types/    # TypeScript types
│   ├── errors/        # Error classes
│   ├── utils/         # Utilities
│   └── services/      # Business logic
├── apps/              # Applications
│   ├── api/          # REST API
│   └── worker/       # Background jobs
└── tools/            # Build tools
\`\`\`

### Dependency Rules
- Apps can depend on packages
- Packages cannot depend on apps
- Avoid circular dependencies
- Use workspace protocol for internal deps

## Testing Requirements
- Minimum 80% code coverage
- Write tests before implementation
- Use meaningful test descriptions
- Test error scenarios

## Performance Guidelines
- Monitor bundle sizes
- Use lazy loading where appropriate
- Implement caching strategies
- Profile critical paths

${
  features.includes('ai-assistance')
    ? `
## AI Assistance Features
- Use MCP tools for automated checks
- Run standardization before commits
- Generate reports for PR reviews
- Monitor drift continuously
`
    : ''
}

${
  features.includes('governance')
    ? `
## Governance Workflow
1. Create baseline weekly
2. Check drift before merges
3. Generate compliance reports
4. Address violations immediately
`
    : ''
}

## Commit Conventions
Follow conventional commits:
- feat: New features
- fix: Bug fixes
- docs: Documentation
- style: Code style changes
- refactor: Code refactoring
- test: Test additions/changes
- chore: Build/tool changes

## Resources
- [Wundr Documentation](../docs/README.md)
- [MCP Tools Guide](../mcp-tools/README.md)
- [Architecture Decisions](../docs/architecture/decisions/)
`;

    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    fs.writeFileSync(claudeMdPath, claudeMdContent);

    return JSON.stringify(
      {
        success: true,
        action: 'generate-claude-md',
        filePath: 'CLAUDE.md',
        features: features.length > 0 ? features : ['default'],
        message: 'CLAUDE.md generated successfully',
        sections: [
          'Project Overview',
          'Key Commands',
          'Code Style Guidelines',
          'Architecture Patterns',
          'Testing Requirements',
          'Performance Guidelines',
          'Commit Conventions',
        ],
      },
      null,
      2
    );
  }

  private generateHooks(features: string[]): string {
    const hooksDir = path.join(process.cwd(), '.claude/hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    // Pre-commit hook
    const preCommitHook = `module.exports = async (context) => {
  console.log('Running Wundr pre-commit checks...');

  // Run pattern standardization
  const standardize = await context.runMCPTool('pattern_standardize', {
    action: 'run',
    dryRun: false
  });

  // Check for drift
  const drift = await context.runMCPTool('drift_detection', {
    action: 'detect'
  });

  if (drift.severity === 'critical') {
    throw new Error('Critical drift detected! Fix issues before committing.');
  }

  // Check dependencies
  const deps = await context.runMCPTool('monorepo_manage', {
    action: 'check-deps'
  });

  if (deps.hasCircularDependencies) {
    throw new Error('Circular dependencies detected!');
  }

  console.log('✅ All checks passed!');
};`;

    fs.writeFileSync(path.join(hooksDir, 'pre-commit.js'), preCommitHook);

    // Post-PR hook
    const postPrHook = `module.exports = async (context) => {
  console.log('Generating PR review artifacts...');

  // Generate governance report
  const report = await context.runMCPTool('governance_report', {
    reportType: 'compliance',
    format: 'markdown'
  });

  // Analyze dependencies
  const deps = await context.runMCPTool('dependency_analyze', {
    scope: 'all',
    outputFormat: 'markdown'
  });

  // Create comment on PR
  const comment = \`## 🔍 Wundr Analysis Report

### Governance Compliance
\${report.summary}

### Dependency Analysis
\${deps.summary}

### Next Steps
- Review any flagged issues
- Run \\\`npx wundr standardize:run\\\` to fix patterns
- Ensure all tests pass
\`;

  await context.addPRComment(comment);
};`;

    fs.writeFileSync(path.join(hooksDir, 'post-pr.js'), postPrHook);

    // Session start hook
    const sessionStartHook = `module.exports = async (context) => {
  console.log('Initializing Wundr workspace...');

  // Check for updates
  const updates = await context.checkForUpdates('@wundr/mcp-tools');
  
  if (updates.available) {
    console.log(\`📦 Update available: \${updates.latest}\`);
  }

  // Load project conventions
  const conventions = await context.loadProjectConventions();
  
  // Set up watchers for governance
  if (${features.includes('auto-governance')}) {
    await context.watchForDrift({
      interval: 3600000, // 1 hour
      autoFix: true
    });
  }

  console.log('✅ Wundr workspace ready!');
};`;

    fs.writeFileSync(path.join(hooksDir, 'session-start.js'), sessionStartHook);

    return JSON.stringify(
      {
        success: true,
        action: 'generate-hooks',
        hooks: ['pre-commit.js', 'post-pr.js', 'session-start.js'],
        hooksDir: '.claude/hooks',
        message: 'Claude Code hooks generated successfully',
        features: features.length > 0 ? features : ['default'],
      },
      null,
      2
    );
  }

  private generateConventions(features: string[]): string {
    const conventionsContent = {
      version: '1.0.0',
      extends: '@wundr/conventions',
      rules: {
        'error-handling': {
          level: 'error',
          prefer: 'AppError',
          disallow: ['string-throws', 'generic-errors'],
        },
        'async-patterns': {
          level: 'warn',
          prefer: 'async-await',
          disallow: ['nested-promises', 'callback-hell'],
        },
        naming: {
          level: 'error',
          patterns: {
            services: '*Service',
            controllers: '*Controller',
            interfaces: 'I*',
            types: 'T*',
            enums: 'E*',
          },
        },
        imports: {
          level: 'warn',
          order: ['builtin', 'external', 'internal', 'relative'],
          groups: {
            builtin: ['node:*', 'fs', 'path', 'crypto'],
            internal: ['@company/*', '@/*'],
          },
        },
        testing: {
          level: 'error',
          coverage: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
          patterns: ['*.test.ts', '*.spec.ts'],
        },
      },
      overrides: features.includes('strict-mode')
        ? {
            '**/*.ts': {
              rules: {
                'error-handling': { level: 'error' },
                naming: { level: 'error' },
                testing: { level: 'error' },
              },
            },
          }
        : {},
      autoFix: {
        enabled: true,
        on: ['save', 'commit'],
        rules: ['imports', 'naming', 'async-patterns'],
      },
    };

    const conventionsPath = path.join(process.cwd(), '.wundr-conventions.json');
    fs.writeFileSync(
      conventionsPath,
      JSON.stringify(conventionsContent, null, 2)
    );

    return JSON.stringify(
      {
        success: true,
        action: 'generate-conventions',
        filePath: '.wundr-conventions.json',
        rules: Object.keys(conventionsContent.rules),
        autoFixEnabled: true,
        message: 'Coding conventions configuration generated',
        features: features.length > 0 ? features : ['default'],
      },
      null,
      2
    );
  }

  private generateAllConfigs(features: string[]): string {
    // Generate all configurations
    const results = {
      claudeMd: JSON.parse(this.generateClaudeMd(features)),
      hooks: JSON.parse(this.generateHooks(features)),
      conventions: JSON.parse(this.generateConventions(features)),
    };

    // Also create a VS Code settings file
    const vscodeSettings = {
      'wundr.enabled': true,
      'wundr.autoFix.onSave': true,
      'wundr.governance.checkOnCommit': true,
      'wundr.monorepo.warnCircularDeps': true,
      'editor.codeActionsOnSave': {
        'source.fixAll.wundr': true,
      },
      'files.watcherExclude': {
        '**/.governance/**': false,
        '**/.wundr-cache/**': true,
      },
    };

    const vscodeDir = path.join(process.cwd(), '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(vscodeSettings, null, 2)
    );

    return JSON.stringify(
      {
        success: true,
        action: 'generate-all',
        generated: {
          'CLAUDE.md': results.claudeMd.filePath,
          hooks: results.hooks.hooks,
          conventions: results.conventions.filePath,
          vscode: '.vscode/settings.json',
        },
        features: features.length > 0 ? features : ['default'],
        message: 'All Claude Code configurations generated successfully',
        nextSteps: [
          'Review CLAUDE.md for project guidelines',
          'Test hooks with a sample commit',
          'Customize conventions as needed',
          'Run "claude mcp restart wundr" to reload',
        ],
      },
      null,
      2
    );
  }
}
