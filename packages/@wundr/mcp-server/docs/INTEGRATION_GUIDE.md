# Wundr MCP Tools Integration Guide

A comprehensive guide for integrating Wundr MCP Tools with Claude Code and your development workflow.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Claude Code Integration](#claude-code-integration)
5. [Workflow Integration](#workflow-integration)
6. [CI/CD Integration](#cicd-integration)
7. [IDE Integration](#ide-integration)
8. [Advanced Configuration](#advanced-configuration)
9. [Security Considerations](#security-considerations)
10. [Upgrading](#upgrading)

---

## Prerequisites

### System Requirements

- Node.js 18.0.0 or later
- npm 8.0.0 or later (or pnpm 8.0.0+)
- Claude Code CLI installed
- Git 2.30.0 or later

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check npm version
npm --version   # Should be >= 8.0.0

# Check Claude Code
claude --version

# Check Git
git --version
```

---

## Installation

### Method 1: Quick Install Script

```bash
cd /path/to/your/project
cd mcp-tools && ./install.sh
```

### Method 2: Manual Installation

```bash
# 1. Navigate to mcp-tools directory
cd mcp-tools

# 2. Install dependencies
npm install

# 3. Build the server
npm run build

# 4. Register with Claude Code
claude mcp add wundr npx wundr-mcp-tools

# 5. Verify installation
claude mcp list
```

### Method 3: Global Installation

```bash
# Install globally
npm install -g wundr-mcp-tools

# Add to Claude Code
claude mcp add wundr wundr-mcp-tools
```

### Verify Installation

```bash
# List registered MCP servers
claude mcp list

# Test tool availability
claude --tool drift_detection --action detect
```

---

## Configuration

### MCP Configuration File

The MCP tools are configured via `mcp.json`:

```json
{
  "name": "wundr-mcp-tools",
  "version": "1.0.0",
  "description": "Wundr toolkit MCP tools for Claude Code integration",
  "server": {
    "command": "node",
    "args": ["dist/server.js"],
    "env": {
      "NODE_ENV": "production"
    }
  },
  "tools": [...]
}
```

### Environment Variables

Configure behavior through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `WUNDR_GOVERNANCE_DIR` | Governance data directory | `.governance` |
| `WUNDR_BASELINES_DIR` | Baselines storage | `.governance/baselines` |
| `WUNDR_REPORTS_DIR` | Reports output directory | `.governance/reports` |
| `WUNDR_TESTING_DIR` | Test baselines directory | `.testing/baselines` |
| `WUNDR_LOG_LEVEL` | Logging level | `info` |
| `WUNDR_DRY_RUN` | Global dry-run mode | `false` |

### Project Configuration

Create `.wundrrc.json` in your project root:

```json
{
  "governance": {
    "enabled": true,
    "autoBaseline": "weekly",
    "driftThreshold": "medium"
  },
  "standardization": {
    "rules": [
      "consistent-error-handling",
      "async-await-pattern",
      "import-ordering"
    ],
    "autoFix": true
  },
  "testing": {
    "coverageThreshold": 80,
    "types": ["unit", "integration"]
  },
  "monorepo": {
    "packageScope": "@myorg",
    "workspaceProtocol": true
  }
}
```

---

## Claude Code Integration

### Register MCP Server

```bash
# Add the Wundr MCP server to Claude Code
claude mcp add wundr-tools npx wundr-mcp-tools start

# Or with custom path
claude mcp add wundr-tools node /path/to/mcp-tools/dist/server.js
```

### Generate Configuration Files

Use the `claude_config` tool to generate project files:

```bash
# Via Claude Code
"Generate all Claude Code configuration files for this project"
```

This creates:
- `CLAUDE.md` - Project guidelines for Claude
- `.claude/hooks/` - Workflow automation hooks
- `.wundr-conventions.json` - Coding standards configuration

### CLAUDE.md Integration

Your CLAUDE.md should include Wundr tool references:

```markdown
## Key Commands

### Governance & Quality
- Use `drift_detection` tool to check for code drift
- Use `governance_report` to generate compliance reports

### Standardization
- Use `pattern_standardize` to fix code patterns
- Run with dryRun:true first to preview changes

### Dependencies
- Use `dependency_analyze` to find circular dependencies
- Use `monorepo_manage` to add new packages
```

### Claude Code Hooks

Create hooks in `.claude/hooks/`:

**pre-commit.js**
```javascript
module.exports = async (context) => {
  // Run standardization
  const result = await context.runMCPTool('pattern_standardize', {
    action: 'run',
    dryRun: false
  });

  // Check for critical drift
  const drift = await context.runMCPTool('drift_detection', {
    action: 'detect'
  });

  if (drift.severity === 'critical') {
    throw new Error('Critical drift detected!');
  }
};
```

**post-pr.js**
```javascript
module.exports = async (context) => {
  // Generate compliance report for PR
  const report = await context.runMCPTool('governance_report', {
    reportType: 'compliance',
    format: 'markdown'
  });

  await context.addPRComment(report.content);
};
```

---

## Workflow Integration

### Daily Workflow

```
Morning:
1. Check drift status
2. Review any pending manual fixes
3. Update baselines if needed

Development:
1. Run standardization before commits
2. Check for circular dependencies
3. Verify coverage against baseline

End of day:
1. Generate quality report
2. Address any regressions
```

### Pre-Commit Workflow

Recommended pre-commit sequence:

```
1. pattern_standardize (action: run)
   - Auto-fix code patterns

2. dependency_analyze (scope: circular)
   - Ensure no new circular deps

3. test_baseline (action: compare)
   - Verify coverage maintained

4. drift_detection (action: detect)
   - Check for quality drift
```

### PR Review Workflow

```
1. governance_report (reportType: compliance)
   - Generate compliance report

2. pattern_standardize (action: review)
   - Identify manual fixes needed

3. dependency_analyze (scope: all)
   - Full dependency analysis
```

### Weekly Maintenance

```
1. drift_detection (action: trends)
   - Review quality trends

2. dependency_analyze (scope: unused)
   - Find unused dependencies

3. test_baseline (action: update)
   - Update baseline if improved

4. governance_report (reportType: weekly)
   - Generate weekly summary
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Wundr Governance Check

on:
  pull_request:
    branches: [main, master]

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check drift
        run: |
          npx wundr drift:detect

      - name: Run standardization check
        run: |
          npx wundr standardize:check

      - name: Check dependencies
        run: |
          npx wundr monorepo:check-deps

      - name: Compare test coverage
        run: |
          npx wundr test:compare

      - name: Generate compliance report
        run: |
          npx wundr govern:report --type compliance --format json > compliance.json

      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: governance-report
          path: compliance.json
```

### GitLab CI

```yaml
governance:
  stage: quality
  script:
    - npm ci
    - npx wundr drift:detect
    - npx wundr standardize:check
    - npx wundr monorepo:check-deps
    - npx wundr test:compare
    - npx wundr govern:report --type compliance --format json
  artifacts:
    reports:
      governance: compliance.json
  only:
    - merge_requests
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('Governance Check') {
            steps {
                sh 'npm ci'
                sh 'npx wundr drift:detect'
                sh 'npx wundr standardize:check'
                sh 'npx wundr monorepo:check-deps'
            }
        }
        stage('Coverage Check') {
            steps {
                sh 'npx wundr test:compare'
            }
        }
        stage('Report') {
            steps {
                sh 'npx wundr govern:report --type compliance'
            }
        }
    }
}
```

---

## IDE Integration

### VS Code

Add to `.vscode/settings.json`:

```json
{
  "wundr.enabled": true,
  "wundr.autoFix.onSave": true,
  "wundr.governance.checkOnCommit": true,
  "wundr.monorepo.warnCircularDeps": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.wundr": true
  }
}
```

### VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Wundr: Check Drift",
      "type": "shell",
      "command": "npx wundr drift:detect",
      "problemMatcher": []
    },
    {
      "label": "Wundr: Standardize",
      "type": "shell",
      "command": "npx wundr standardize:run",
      "problemMatcher": []
    },
    {
      "label": "Wundr: Full Check",
      "type": "shell",
      "command": "npx wundr drift:detect && npx wundr standardize:check && npx wundr monorepo:check-deps",
      "problemMatcher": []
    }
  ]
}
```

### JetBrains IDEs

Create run configurations in `.idea/runConfigurations/`:

```xml
<component name="ProjectRunConfigurationManager">
  <configuration name="Wundr Check" type="ShConfigurationType">
    <option name="SCRIPT_TEXT" value="npx wundr drift:detect" />
    <option name="INDEPENDENT_SCRIPT_PATH" value="true" />
    <option name="SCRIPT_PATH" value="" />
    <option name="SCRIPT_OPTIONS" value="" />
    <option name="INDEPENDENT_SCRIPT_WORKING_DIRECTORY" value="true" />
    <option name="SCRIPT_WORKING_DIRECTORY" value="$PROJECT_DIR$" />
  </configuration>
</component>
```

---

## Advanced Configuration

### Custom Rules

Create custom standardization rules in `.wundr/rules/`:

```javascript
// .wundr/rules/custom-import-rule.js
module.exports = {
  name: 'custom-import-rule',
  description: 'Custom import ordering for this project',
  pattern: /^import .+ from ['"](?!@myorg)/,
  fix: (match, context) => {
    // Custom fix logic
    return context.reorderImports(match, {
      groups: ['builtin', 'external', '@myorg/*', 'relative']
    });
  }
};
```

### Baseline Customization

Configure baseline metrics in `.wundrrc.json`:

```json
{
  "governance": {
    "baseline": {
      "metrics": [
        "codeLines",
        "testCoverage",
        "complexity",
        "duplicates",
        "dependencies"
      ],
      "excludePaths": [
        "node_modules",
        "dist",
        "coverage",
        "**/*.test.ts"
      ],
      "thresholds": {
        "complexity": {
          "max": 15,
          "warning": 10
        },
        "duplicates": {
          "max": 5,
          "warning": 3
        }
      }
    }
  }
}
```

### Multi-Workspace Support

For monorepos with multiple workspaces:

```json
{
  "workspaces": {
    "packages/*": {
      "governance": {
        "enabled": true,
        "driftThreshold": "low"
      }
    },
    "apps/*": {
      "governance": {
        "enabled": true,
        "driftThreshold": "medium"
      }
    }
  }
}
```

---

## Security Considerations

### Permissions

- MCP tools run with current user permissions
- Ensure governance directories have appropriate access
- Consider read-only baseline storage for CI/CD

### Sensitive Data

- Never commit `.governance/` to public repositories
- Add to `.gitignore`:
  ```
  .governance/
  .testing/baselines/
  .wundr-cache/
  ```
- Use environment variables for sensitive paths

### Audit Logging

Enable audit logging in production:

```json
{
  "governance": {
    "audit": {
      "enabled": true,
      "logPath": ".governance/audit.log",
      "events": ["baseline-create", "drift-detect", "standardize-run"]
    }
  }
}
```

---

## Upgrading

### Check for Updates

```bash
# Check current version
npx wundr-mcp-tools --version

# Check for updates
npm outdated wundr-mcp-tools
```

### Upgrade Process

```bash
# 1. Backup current configuration
cp -r .governance .governance.backup

# 2. Update package
npm update wundr-mcp-tools

# 3. Rebuild MCP server
cd mcp-tools && npm run build

# 4. Restart MCP server
claude mcp restart wundr

# 5. Verify tools work
claude --tool drift_detection --action list-baselines

# 6. Update baselines if needed
# (only if significant changes in metrics collection)
```

### Migration Notes

When upgrading between major versions:

1. Review changelog for breaking changes
2. Update `.wundrrc.json` if schema changed
3. Regenerate hooks if hook API changed
4. Create new baseline after significant metric changes

---

## Support Resources

- **Documentation**: See `/docs/` directory
- **Issues**: Report on GitHub repository
- **API Reference**: See `TOOLS_REFERENCE.md`
- **Examples**: See `USAGE_EXAMPLES.md`

---

*Wundr MCP Tools Integration Guide v1.0.0*
