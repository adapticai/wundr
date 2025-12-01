# Claude Code MCP Integration Guide

This guide explains how to use the Wundr toolkit's MCP (Model Context Protocol) tools with Claude
Code for enhanced AI-assisted development.

## 🚀 Quick Setup

### 1. Install MCP Tools

```bash
cd mcp-tools
chmod +x install.sh
./install.sh
```

### 2. Configure Claude Code

Add to your Claude Code settings:

```json
{
  "mcpServers": {
    "wundr": {
      "command": "wundr-mcp",
      "args": [],
      "env": {
        "WUNDR_MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

### 3. Verify Installation

```bash
claude mcp list
# Should show: wundr-mcp-tools
```

## 🛠️ Available MCP Tools

### Governance Tools

#### 1. Drift Detection (`drift_detection`)

Monitor code quality drift over time.

**Natural Language Examples:**

- "Check for code drift"
- "Create a new drift baseline"
- "Show drift trends for the last month"
- "Compare current code against baseline"

**Direct Tool Usage:**

```javascript
{
  "tool": "drift_detection",
  "args": {
    "action": "detect",
    "baselineVersion": "latest"
  }
}
```

#### 2. Governance Reports (`governance_report`)

Generate comprehensive governance reports.

**Natural Language Examples:**

- "Generate weekly governance report"
- "Show code quality compliance"
- "Create a drift report in markdown"
- "Generate compliance certification"

### Standardization Tools

#### 3. Pattern Standardization (`pattern_standardize`)

Automatically fix code patterns to match standards.

**Natural Language Examples:**

- "Standardize all error handling"
- "Fix import ordering issues"
- "Review patterns that need manual attention"
- "Show what patterns would be fixed (dry run)"

**Direct Tool Usage:**

```javascript
{
  "tool": "pattern_standardize",
  "args": {
    "action": "run",
    "rules": ["error-handling", "imports"],
    "dryRun": false
  }
}
```

### Monorepo Tools

#### 4. Monorepo Management (`monorepo_manage`)

Initialize and manage monorepo structures.

**Natural Language Examples:**

- "Initialize a monorepo structure"
- "Add a new package called user-service"
- "Check for circular dependencies"
- "Generate migration plan from analysis"

### Analysis Tools

#### 5. Dependency Analysis (`dependency_analyze`)

Analyze project dependencies comprehensively.

**Natural Language Examples:**

- "Find all circular dependencies"
- "Show unused npm packages"
- "Analyze external dependencies"
- "Create a dependency graph"

### Testing Tools

#### 6. Test Baselines (`test_baseline`)

Manage test coverage baselines.

**Natural Language Examples:**

- "Create test coverage baseline"
- "Compare coverage against baseline"
- "Update test baseline with current metrics"
- "Show test coverage trends"

### Configuration Tools

#### 7. Claude Config (`claude_config`)

Generate optimized Claude Code configurations.

**Natural Language Examples:**

- "Generate CLAUDE.md for this project"
- "Set up Claude Code hooks"
- "Create coding conventions config"
- "Generate all Claude configurations"

## 📋 Workflow Examples

### Example 1: Complete Quality Check

```
You: "Run a complete quality check: detect drift, fix patterns, and generate a report"

Claude will:
1. Run drift detection against baseline
2. Apply pattern standardization
3. Generate governance report
4. Provide summary and recommendations
```

### Example 2: Monorepo Setup

```
You: "Set up a monorepo with packages for auth, api, and worker services"

Claude will:
1. Initialize monorepo structure
2. Create auth package
3. Create api application
4. Create worker application
5. Set up dependencies and configs
```

### Example 3: Pre-Commit Validation

```
You: "Check if my code is ready to commit"

Claude will:
1. Run pattern standardization check
2. Detect any drift from baseline
3. Check for circular dependencies
4. Validate test coverage
5. Provide go/no-go recommendation
```

## 🔧 Advanced Configuration

### Environment Variables

```bash
# Logging level (debug, info, warn, error)
export WUNDR_MCP_LOG_LEVEL=debug

# Cache directory
export WUNDR_MCP_CACHE_DIR=.cache

# Tool timeout (milliseconds)
export WUNDR_MCP_TIMEOUT=60000
```

### Project Configuration

Create `.wundr-mcp.json` in project root:

```json
{
  "governance": {
    "baselineDir": ".governance/baselines",
    "reportFormat": "markdown",
    "severityThresholds": {
      "critical": 5,
      "high": 3,
      "medium": 1
    }
  },
  "standardization": {
    "rules": ["error-handling", "imports", "naming"],
    "autoFix": true,
    "excludePaths": ["node_modules", "dist", "coverage"]
  },
  "monorepo": {
    "packageManager": "pnpm",
    "organization": "@company",
    "defaultScripts": {
      "build": "tsc",
      "test": "jest",
      "lint": "eslint src"
    }
  },
  "testing": {
    "coverageThreshold": 80,
    "testTypes": ["unit", "integration", "e2e"]
  }
}
```

## 🎯 Best Practices

### 1. Regular Baseline Creation

```
# Weekly baseline creation
You: "Create a new drift baseline and archive the old one"
```

### 2. Pre-Merge Validation

```
# Before merging PRs
You: "Validate this branch is ready to merge: check drift, dependencies, and coverage"
```

### 3. Automated Standardization

```
# After adding new code
You: "Standardize any new code patterns and show what changed"
```

### 4. Continuous Monitoring

```
# Daily check
You: "Show me today's code quality summary and any issues"
```

## 🚨 Troubleshooting

### MCP Tools Not Found

```bash
# Restart Claude Code
claude mcp restart wundr

# Check installation
which wundr-mcp

# Reinstall if needed
cd mcp-tools && npm install && npm link
```

### Permission Errors

```bash
# Fix permissions
chmod +x mcp-tools/install.sh
chmod +x mcp-tools/wundr-mcp
```

### Debug Mode

```bash
# Enable debug logging
export WUNDR_MCP_LOG_LEVEL=debug

# View logs
claude mcp logs wundr
```

## 🔗 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Wundr Quality Gates
on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Wundr MCP Tools
        run: |
          cd mcp-tools
          npm install
          npm run build

      - name: Run Drift Detection
        run: npx wundr-mcp drift-detection detect

      - name: Check Dependencies
        run: npx wundr-mcp monorepo-manage check-deps

      - name: Validate Coverage
        run: npx wundr-mcp test-baseline compare

      - name: Generate Report
        run: npx wundr-mcp governance-report compliance --format markdown

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: governance-report
          path: .governance/reports/compliance-report-*.md
```

### Pre-Commit Hook

```javascript
// .claude/hooks/pre-commit.js
module.exports = async context => {
  // Run standardization
  await context.runMCPTool('pattern_standardize', {
    action: 'run',
    dryRun: false,
  });

  // Check drift
  const drift = await context.runMCPTool('drift_detection', {
    action: 'detect',
  });

  if (drift.severity === 'critical') {
    throw new Error('Critical drift detected!');
  }
};
```

## 📚 Additional Resources

- [Wundr Toolkit Documentation](../README.md)
- [MCP Tools README](../mcp-tools/README.md)
- [Governance Guidelines](./governance/README.md)
- [Coding Standards](./standards/GOLDEN_STANDARDS.md)

## 🤝 Contributing

To add new MCP tools:

1. Create handler in `mcp-tools/src/tools/`
2. Add to server.ts tool registry
3. Update mcp.json with tool definition
4. Add examples to documentation
5. Test with Claude Code

## 📝 License

MIT License - see [LICENSE](../LICENSE) for details.
