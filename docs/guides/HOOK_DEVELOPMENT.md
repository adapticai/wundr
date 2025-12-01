# Hook Development Guide: Custom Automation with Claude Flow

Complete guide to creating and customizing hooks for automated workflows in Claude Flow integration
with Claude Code.

## Table of Contents

- [Hook System Overview](#hook-system-overview)
- [Built-in Hooks](#built-in-hooks)
- [Creating Custom Hooks](#creating-custom-hooks)
- [Hook Types and Events](#hook-types-and-events)
- [Advanced Hook Patterns](#advanced-hook-patterns)
- [Hook Orchestration](#hook-orchestration)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Testing Hooks](#testing-hooks)

## Hook System Overview

Hooks are automated scripts that run at specific points in the Claude Flow workflow, enabling
powerful automation and customization.

### Hook Architecture

```
User Action / Agent Task
         ↓
┌────────────────────────┐
│    Pre-Operation       │
│    Hooks Execute       │
│  - Validation          │
│  - Preparation         │
│  - Context Loading     │
└────────────────────────┘
         ↓
┌────────────────────────┐
│   Main Operation       │
│   (Claude Code)        │
└────────────────────────┘
         ↓
┌────────────────────────┐
│   Post-Operation       │
│   Hooks Execute        │
│  - Formatting          │
│  - Training            │
│  - Notification        │
└────────────────────────┘
         ↓
┌────────────────────────┐
│   Session Hooks        │
│  - State Persistence   │
│  - Metrics Export      │
│  - Summary Generation  │
└────────────────────────┘
```

### Hook Lifecycle

1. **Registration**: Hook registered in system
2. **Trigger**: Event occurs (pre/post operation)
3. **Validation**: Hook checks if it should run
4. **Execution**: Hook performs its function
5. **Result**: Success/failure affects workflow
6. **Logging**: Execution logged for analysis

## Built-in Hooks

### Pre-Operation Hooks

#### pre-task

Runs before task execution begins.

```bash
npx claude-flow@alpha hooks pre-task \
  --description "Implement user authentication" \
  --agent-type backend-dev
```

**Default Actions**:

- Auto-assign agents by file type
- Load project context
- Validate environment
- Prepare resources
- Initialize memory scope

#### pre-edit

Runs before file editing.

```bash
npx claude-flow@alpha hooks pre-edit \
  --file src/auth/login.ts \
  --backup true
```

**Default Actions**:

- Create backup
- Validate file syntax
- Load file history
- Check for conflicts
- Acquire file lock

#### pre-commit (Git hook)

Runs before git commit.

```bash
# Automatically installed
npx claude-flow@alpha hooks install
```

**Default Actions**:

- Run linter
- Format code
- Run tests
- Check coverage
- Validate commit message

### Post-Operation Hooks

#### post-edit

Runs after file is edited.

```bash
npx claude-flow@alpha hooks post-edit \
  --file src/auth/login.ts \
  --memory-key "auth/login/updated"
```

**Default Actions**:

- Auto-format code (Prettier)
- Run linter (ESLint)
- Train neural patterns
- Update memory
- Generate documentation

#### post-task

Runs after task completion.

```bash
npx claude-flow@alpha hooks post-task \
  --task-id task-123 \
  --success true
```

**Default Actions**:

- Update metrics
- Store results
- Notify coordinator
- Clean up resources
- Archive artifacts

#### post-commit (Git hook)

Runs after git commit.

**Default Actions**:

- Update changelog
- Generate documentation
- Notify team
- Trigger CI/CD
- Update project board

### Session Hooks

#### session-start

Runs at beginning of session.

```bash
npx claude-flow@alpha hooks session-start \
  --session-id swarm-$(date +%s)
```

**Default Actions**:

- Initialize memory context
- Load previous state
- Setup monitoring
- Configure agents
- Start metrics collection

#### session-restore

Runs to restore previous session.

```bash
npx claude-flow@alpha hooks session-restore \
  --session-id swarm-1234567890
```

**Default Actions**:

- Load session state
- Restore agent context
- Rebuild memory
- Resume tasks
- Reconnect agents

#### session-save

Runs to save session state.

```bash
npx claude-flow@alpha hooks session-save \
  --session-id swarm-1234567890 \
  --compress true
```

**Default Actions**:

- Persist memory
- Save agent state
- Export metrics
- Archive logs
- Compress data

#### session-end

Runs at end of session.

```bash
npx claude-flow@alpha hooks session-end \
  --export-metrics true \
  --generate-summary true
```

**Default Actions**:

- Generate summary
- Export all metrics
- Persist final state
- Clean up resources
- Train patterns

### Notification Hooks

#### notify

Send notifications to various channels.

```bash
npx claude-flow@alpha hooks notify \
  --message "Feature implementation complete" \
  --channels "slack,email" \
  --priority high
```

## Creating Custom Hooks

### Basic Custom Hook

Create `.claude-flow/hooks/my-hook.js`:

```javascript
module.exports = {
  // Hook metadata
  name: 'my-custom-hook',
  version: '1.0.0',
  description: 'Custom hook for specific workflow',
  type: 'post-edit', // Hook type

  // When to run this hook
  triggers: {
    events: ['post-edit', 'post-task'],
    files: ['**/*.ts', '**/*.js'],
    agents: ['coder', 'backend-dev'],
  },

  // Configuration
  config: {
    enabled: true,
    async: true,
    timeout: 30000,
    retries: 2,
  },

  // Main execution
  async execute(context) {
    const { file, operation, agent, memory, metrics } = context;

    console.log(`Running ${this.name} for ${file}`);

    try {
      // Pre-execution validation
      if (!this.shouldRun(context)) {
        return { skip: true, reason: 'Conditions not met' };
      }

      // Main hook logic
      const result = await this.performWork(context);

      // Post-execution
      await this.recordMetrics(context, result);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Validation
  shouldRun(context) {
    // Only run for TypeScript files
    if (!context.file.endsWith('.ts')) {
      return false;
    }

    // Only run for specific agents
    if (!['coder', 'backend-dev'].includes(context.agent)) {
      return false;
    }

    return true;
  },

  // Main work
  async performWork(context) {
    // Custom logic here
    const analysis = await this.analyzeFile(context.file);
    const updates = await this.generateUpdates(analysis);
    await this.applyUpdates(context.file, updates);

    return {
      analyzed: true,
      updates: updates.length,
    };
  },

  // Metrics
  async recordMetrics(context, result) {
    await context.metrics.record({
      hook: this.name,
      file: context.file,
      duration: result.duration,
      success: true,
    });
  },

  // Custom methods
  async analyzeFile(file) {
    // Implementation
  },

  async generateUpdates(analysis) {
    // Implementation
  },

  async applyUpdates(file, updates) {
    // Implementation
  },
};
```

### Register Custom Hook

```bash
# Register the hook
npx claude-flow@alpha hooks register \
  --file .claude-flow/hooks/my-hook.js

# Verify registration
npx claude-flow@alpha hooks list --custom

# Enable/disable
npx claude-flow@alpha hooks enable my-custom-hook
npx claude-flow@alpha hooks disable my-custom-hook
```

### Git Hook Integration

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Run Claude Flow pre-commit hooks
npx claude-flow@alpha hooks pre-commit

# Exit with hook status
exit $?
```

Make executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Hook Types and Events

### Pre-Operation Hook Template

```javascript
module.exports = {
  name: 'pre-operation-hook',
  type: 'pre-operation',

  async execute(context) {
    const { operation, files, agents } = context;

    // Validate environment
    await this.validateEnvironment();

    // Prepare resources
    await this.prepareResources(files);

    // Load context
    const taskContext = await this.loadContext(operation);

    // Assign agents
    const assignments = await this.assignAgents(agents, files);

    return {
      success: true,
      context: taskContext,
      assignments,
    };
  },

  async validateEnvironment() {
    // Check Node version
    // Verify dependencies
    // Validate configuration
  },

  async prepareResources(files) {
    // Create directories
    // Initialize files
    // Setup environment
  },
};
```

### Post-Operation Hook Template

```javascript
module.exports = {
  name: 'post-operation-hook',
  type: 'post-operation',

  async execute(context) {
    const { operation, result, files } = context;

    // Format code
    await this.formatCode(files);

    // Run linter
    await this.lint(files);

    // Update documentation
    await this.updateDocs(files);

    // Train patterns
    await this.trainPatterns(operation, result);

    // Notify
    await this.notify(operation, result);

    return {
      success: true,
      formatted: true,
      linted: true,
      documented: true,
    };
  },

  async formatCode(files) {
    // Run Prettier
    for (const file of files) {
      await exec(`npx prettier --write ${file}`);
    }
  },

  async trainPatterns(operation, result) {
    // Train neural patterns from successful operation
    await neural.train({
      operation,
      result,
      quality: result.quality,
      duration: result.duration,
    });
  },
};
```

### Session Hook Template

```javascript
module.exports = {
  name: 'session-management-hook',
  type: 'session',

  async onSessionStart(context) {
    // Initialize session
    const sessionId = context.sessionId;

    // Load previous state if exists
    const state = await this.loadState(sessionId);

    // Setup monitoring
    await this.setupMonitoring(sessionId);

    // Configure agents
    await this.configureAgents(state?.agents);

    return { initialized: true };
  },

  async onSessionSave(context) {
    // Persist state
    await this.saveState(context.sessionId, context.state);

    // Export metrics
    await this.exportMetrics(context.sessionId);

    // Archive logs
    await this.archiveLogs(context.sessionId);

    return { saved: true };
  },

  async onSessionRestore(context) {
    // Load state
    const state = await this.loadState(context.sessionId);

    // Restore agents
    await this.restoreAgents(state.agents);

    // Rebuild memory
    await this.rebuildMemory(state.memory);

    return { restored: true, state };
  },

  async onSessionEnd(context) {
    // Generate summary
    const summary = await this.generateSummary(context);

    // Final metrics export
    await this.exportFinalMetrics(context.sessionId);

    // Cleanup
    await this.cleanup(context.sessionId);

    return { summary };
  },
};
```

## Advanced Hook Patterns

### Pattern 1: Conditional Hook Execution

```javascript
module.exports = {
  name: 'conditional-hook',

  // Advanced conditions
  conditions: {
    // File patterns
    files: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },

    // Agent types
    agents: ['coder', 'backend-dev'],

    // Time-based
    time: {
      businessHours: true,
      timezone: 'America/New_York',
    },

    // Environment
    environment: ['development', 'staging'],

    // Custom condition function
    custom: async context => {
      // Only run if branch is feature branch
      const branch = await exec('git branch --show-current');
      return branch.startsWith('feature/');
    },
  },

  async execute(context) {
    // Hook logic
  },
};
```

### Pattern 2: Composite Hooks

```javascript
module.exports = {
  name: 'composite-hook',
  type: 'post-edit',

  // Sub-hooks to run in sequence
  hooks: ['format-code', 'lint-code', 'run-tests', 'update-docs', 'train-patterns'],

  async execute(context) {
    const results = [];

    for (const hookName of this.hooks) {
      const hook = await this.loadHook(hookName);

      // Run sub-hook
      const result = await hook.execute(context);
      results.push({ hook: hookName, result });

      // Stop if critical hook fails
      if (hook.critical && !result.success) {
        return {
          success: false,
          failed: hookName,
          results,
        };
      }
    }

    return {
      success: true,
      results,
    };
  },
};
```

### Pattern 3: Async Hook Chain

```javascript
module.exports = {
  name: 'async-hook-chain',
  type: 'post-task',

  async execute(context) {
    // Run hooks in parallel
    const parallelHooks = [
      this.formatCode(context),
      this.generateDocs(context),
      this.updateMetrics(context),
    ];

    const parallelResults = await Promise.all(parallelHooks);

    // Then run sequential hooks
    await this.runTests(context);
    await this.trainPatterns(context);
    await this.notifyTeam(context);

    return {
      success: true,
      parallel: parallelResults,
    };
  },
};
```

### Pattern 4: Error Recovery Hook

```javascript
module.exports = {
  name: 'error-recovery-hook',
  type: 'on-error',

  async execute(context) {
    const { error, operation, attempt } = context;

    // Log error
    await this.logError(error, operation);

    // Analyze error
    const analysis = await this.analyzeError(error);

    // Attempt recovery
    if (analysis.recoverable && attempt < 3) {
      return await this.recover(context, analysis);
    }

    // Escalate if not recoverable
    await this.escalate(error, operation);

    return {
      recovered: false,
      escalated: true,
    };
  },

  async analyzeError(error) {
    // Determine if error is recoverable
    if (error.code === 'ENOENT') {
      return { recoverable: true, strategy: 'create-file' };
    }
    if (error.message.includes('timeout')) {
      return { recoverable: true, strategy: 'retry-with-backoff' };
    }
    return { recoverable: false };
  },

  async recover(context, analysis) {
    switch (analysis.strategy) {
      case 'create-file':
        await this.createMissingFile(context);
        return { recovered: true };

      case 'retry-with-backoff':
        await this.sleep(1000 * context.attempt);
        return { recovered: true, retry: true };

      default:
        return { recovered: false };
    }
  },
};
```

### Pattern 5: Plugin Hook System

```javascript
// .claude-flow/hooks/plugin-system.js
module.exports = {
  name: 'plugin-hook-system',

  // Plugins to load
  plugins: [
    '@claude-flow/plugin-prettier',
    '@claude-flow/plugin-eslint',
    '@claude-flow/plugin-jest',
    './custom-plugins/my-plugin',
  ],

  async execute(context) {
    // Load all plugins
    const plugins = await this.loadPlugins();

    // Run each plugin
    for (const plugin of plugins) {
      if (plugin.shouldRun(context)) {
        await plugin.run(context);
      }
    }

    return { success: true };
  },

  async loadPlugins() {
    return await Promise.all(
      this.plugins.map(async plugin => {
        const mod = await import(plugin);
        return new mod.default();
      })
    );
  },
};

// Plugin interface
class Plugin {
  shouldRun(context) {
    return true;
  }

  async run(context) {
    // Plugin logic
  }
}
```

## Hook Orchestration

### Hook Configuration File

Create `.claude-flow/hooks.config.json`:

```json
{
  "hooks": {
    "pre-task": {
      "enabled": true,
      "hooks": ["validate-environment", "load-context", "assign-agents"],
      "timeout": 30000,
      "critical": true
    },
    "post-edit": {
      "enabled": true,
      "hooks": ["format-code", "lint-code", "update-docs"],
      "async": true,
      "critical": false
    },
    "post-task": {
      "enabled": true,
      "hooks": ["run-tests", "update-metrics", "train-patterns", "notify-team"],
      "timeout": 120000,
      "critical": true
    },
    "session-end": {
      "enabled": true,
      "hooks": ["generate-summary", "export-metrics", "cleanup"]
    }
  },
  "global": {
    "timeout": 60000,
    "retries": 2,
    "async": true,
    "logging": true
  }
}
```

### Hook Priority and Ordering

```javascript
module.exports = {
  name: 'hook-orchestrator',

  hooks: [
    { name: 'validate', priority: 100, critical: true },
    { name: 'backup', priority: 90, critical: true },
    { name: 'format', priority: 50, critical: false },
    { name: 'lint', priority: 40, critical: false },
    { name: 'test', priority: 30, critical: true },
    { name: 'document', priority: 20, critical: false },
    { name: 'notify', priority: 10, critical: false },
  ],

  async execute(context) {
    // Sort by priority
    const sorted = this.hooks.sort((a, b) => b.priority - a.priority);

    for (const hook of sorted) {
      const result = await this.runHook(hook, context);

      // Stop if critical hook fails
      if (hook.critical && !result.success) {
        throw new Error(`Critical hook failed: ${hook.name}`);
      }
    }
  },
};
```

## Real-World Examples

### Example 1: Auto-Documentation Hook

```javascript
// .claude-flow/hooks/auto-docs.js
module.exports = {
  name: 'auto-documentation',
  type: 'post-edit',

  triggers: {
    files: ['src/**/*.ts', 'src/**/*.js'],
    exclude: ['**/*.test.*'],
  },

  async execute(context) {
    const { file } = context;

    // Parse file for exports
    const exports = await this.parseExports(file);

    // Generate JSDoc comments
    const docs = await this.generateDocs(exports);

    // Update file with docs
    await this.updateFile(file, docs);

    // Generate API reference
    await this.updateApiReference(file, exports);

    return {
      success: true,
      documented: exports.length,
    };
  },

  async parseExports(file) {
    const content = await fs.readFile(file, 'utf8');
    const ast = parse(content);

    return ast.body
      .filter(
        node => node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration'
      )
      .map(node => ({
        name: this.getExportName(node),
        type: this.getExportType(node),
        params: this.getParams(node),
      }));
  },

  async generateDocs(exports) {
    return exports.map(exp => {
      return `
/**
 * ${exp.name}
 * @param {${exp.params.map(p => p.type).join(', ')}}
 * @returns {${exp.returnType}}
 */
`;
    });
  },
};
```

### Example 2: Performance Tracking Hook

```javascript
// .claude-flow/hooks/performance-tracker.js
module.exports = {
  name: 'performance-tracker',
  type: 'post-task',

  async execute(context) {
    const { task, duration, result } = context;

    // Collect performance metrics
    const metrics = {
      taskId: task.id,
      duration,
      filesModified: result.files.length,
      linesChanged: await this.countLines(result.files),
      complexity: await this.calculateComplexity(result.files),
      timestamp: Date.now(),
    };

    // Store in time-series database
    await this.storeMetrics(metrics);

    // Check for performance degradation
    const trend = await this.analyzeTrend(task.type);

    if (trend.degrading) {
      await this.alert('Performance degradation detected', trend);
    }

    // Update dashboard
    await this.updateDashboard(metrics);

    return { success: true, metrics };
  },

  async analyzeTrend(taskType) {
    const history = await this.getHistory(taskType, 10);

    const avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / history.length;

    const recent = history.slice(-3);
    const recentAvg = recent.reduce((sum, h) => sum + h.duration, 0) / recent.length;

    return {
      degrading: recentAvg > avgDuration * 1.5,
      avgDuration,
      recentAvg,
      change: ((recentAvg - avgDuration) / avgDuration) * 100,
    };
  },
};
```

### Example 3: Test Coverage Enforcement Hook

```javascript
// .claude-flow/hooks/coverage-enforcer.js
module.exports = {
  name: 'coverage-enforcer',
  type: 'pre-commit',

  config: {
    minCoverage: 80,
    critical: true,
  },

  async execute(context) {
    // Run tests with coverage
    const coverage = await this.runCoverage();

    // Check coverage thresholds
    const passed = this.checkThresholds(coverage);

    if (!passed) {
      throw new Error(`Coverage below threshold: ${coverage.total}% < ${this.config.minCoverage}%`);
    }

    // Store coverage baseline
    await this.storeBaseline(coverage);

    // Compare with previous baseline
    const comparison = await this.compareBaseline(coverage);

    if (comparison.decreased) {
      console.warn('⚠️  Coverage decreased:', comparison);
    }

    return {
      success: true,
      coverage,
      comparison,
    };
  },

  async runCoverage() {
    const result = await exec('npm test -- --coverage --json');
    const coverage = JSON.parse(result);

    return {
      total: coverage.total.lines.pct,
      statements: coverage.total.statements.pct,
      branches: coverage.total.branches.pct,
      functions: coverage.total.functions.pct,
      lines: coverage.total.lines.pct,
    };
  },

  checkThresholds(coverage) {
    return Object.values(coverage).every(pct => pct >= this.config.minCoverage);
  },
};
```

### Example 4: Dependency Security Scanner Hook

```javascript
// .claude-flow/hooks/security-scanner.js
module.exports = {
  name: 'security-scanner',
  type: 'post-install',

  async execute(context) {
    // Run npm audit
    const auditResult = await this.runAudit();

    // Check for high/critical vulnerabilities
    if (auditResult.high > 0 || auditResult.critical > 0) {
      await this.alert('Security vulnerabilities detected', auditResult);
    }

    // Check for license compliance
    const licenses = await this.checkLicenses();

    // Scan for secrets
    const secrets = await this.scanSecrets();

    if (secrets.found) {
      throw new Error('Secrets detected in code!');
    }

    return {
      success: true,
      vulnerabilities: auditResult,
      licenses,
      secrets: secrets.found,
    };
  },

  async runAudit() {
    const result = await exec('npm audit --json');
    const audit = JSON.parse(result);

    return {
      low: audit.metadata.vulnerabilities.low,
      moderate: audit.metadata.vulnerabilities.moderate,
      high: audit.metadata.vulnerabilities.high,
      critical: audit.metadata.vulnerabilities.critical,
    };
  },

  async scanSecrets() {
    // Use tools like truffleHog, gitleaks, etc.
    const result = await exec('gitleaks detect --source . --no-git');

    return {
      found: result.length > 0,
      details: result,
    };
  },
};
```

## Best Practices

### 1. Hook Design Principles

```javascript
module.exports = {
  // ✅ Good: Single responsibility
  name: 'format-code',
  async execute(context) {
    await this.formatCode(context.files);
  },

  // ❌ Bad: Multiple responsibilities
  name: 'do-everything',
  async execute(context) {
    await this.formatCode(context.files);
    await this.runTests(context.files);
    await this.deploy(context.files);
    await this.notify(context.files);
  },
};
```

### 2. Error Handling

```javascript
module.exports = {
  async execute(context) {
    try {
      const result = await this.doWork(context);
      return { success: true, result };
    } catch (error) {
      // Log error
      await this.logError(error, context);

      // Determine if should fail or continue
      if (this.config.critical) {
        throw error; // Fail the operation
      }

      // Return error but continue
      return {
        success: false,
        error: error.message,
        continue: true,
      };
    }
  },
};
```

### 3. Performance Optimization

```javascript
module.exports = {
  // ✅ Good: Async with timeout
  config: {
    async: true,
    timeout: 30000,
  },

  async execute(context) {
    // Run with timeout
    return await Promise.race([this.doWork(context), this.timeout(this.config.timeout)]);
  },

  // ✅ Good: Batch operations
  async formatFiles(files) {
    // Process in batches of 10
    const batches = this.chunk(files, 10);

    for (const batch of batches) {
      await Promise.all(batch.map(file => this.formatFile(file)));
    }
  },
};
```

### 4. Idempotency

```javascript
module.exports = {
  // ✅ Good: Idempotent
  async execute(context) {
    // Check if already done
    const done = await this.checkIfDone(context);
    if (done) return { success: true, skipped: true };

    // Do work
    await this.doWork(context);

    // Mark as done
    await this.markAsDone(context);
  },
};
```

### 5. Configuration Management

```javascript
module.exports = {
  // Default config
  defaultConfig: {
    enabled: true,
    timeout: 30000,
    retries: 2,
  },

  // Load config
  async init() {
    const userConfig = await this.loadUserConfig();

    this.config = {
      ...this.defaultConfig,
      ...userConfig,
    };
  },

  // Allow runtime override
  async execute(context) {
    const config = {
      ...this.config,
      ...context.hookConfig,
    };

    // Use merged config
  },
};
```

## Testing Hooks

### Unit Testing Hooks

```javascript
// tests/hooks/my-hook.test.js
const hook = require('../../.claude-flow/hooks/my-hook');

describe('my-hook', () => {
  it('should format code', async () => {
    const context = {
      file: 'src/test.ts',
      agent: 'coder',
      memory: mockMemory,
      metrics: mockMetrics,
    };

    const result = await hook.execute(context);

    expect(result.success).toBe(true);
    expect(result.formatted).toBe(true);
  });

  it('should skip non-matching files', async () => {
    const context = {
      file: 'src/test.md',
      agent: 'coder',
    };

    const result = await hook.execute(context);

    expect(result.skip).toBe(true);
  });
});
```

### Integration Testing

```bash
# Test hook in isolation
npx claude-flow@alpha hooks test my-hook \
  --context test-context.json

# Test hook chain
npx claude-flow@alpha hooks test-chain \
  --hooks "format,lint,test" \
  --context test-context.json
```

### Debugging Hooks

```bash
# Enable hook debugging
npx claude-flow@alpha hooks debug my-hook \
  --verbose \
  --log-file hooks.log

# Trace hook execution
npx claude-flow@alpha hooks trace \
  --session-id swarm-123
```

## Summary

Hook development enables:

- ✅ **Automation**: Automate repetitive tasks
- ✅ **Quality**: Enforce standards automatically
- ✅ **Integration**: Connect to external tools
- ✅ **Customization**: Tailor workflows to needs
- ✅ **Monitoring**: Track and analyze operations
- ✅ **Recovery**: Handle errors gracefully

**Next Steps**:

- [Template Customization Guide](./TEMPLATE_CUSTOMIZATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [API Reference](../reference/API.md)

---

**Pro Tip**: Start with built-in hooks, customize behavior, then create custom hooks for unique
needs.
