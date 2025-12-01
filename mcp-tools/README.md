# Wundr MCP Tools for Claude Code

This package provides Model Context Protocol (MCP) tools that integrate the Wundr toolkit's powerful
features directly into Claude Code, enabling AI-assisted governance, standardization, and monorepo
management.

## 🚀 Quick Start

### Installation

1. **Install the MCP tools:**

   ```bash
   npm install -g @wundr/mcp-tools
   ```

2. **Configure Claude Code:** Add to your Claude Code settings:

   ```json
   {
     "mcpServers": {
       "wundr": {
         "command": "wundr-mcp",
         "args": ["start"]
       }
     }
   }
   ```

3. **Verify installation:**
   ```bash
   claude mcp list
   # Should show: wundr-mcp-tools
   ```

## 🛠️ Available Tools

### 1. Drift Detection (`drift_detection`)

Monitor code quality drift over time by creating baselines and comparing changes.

**Usage in Claude Code:**

```
"Check for code drift against the latest baseline"
"Create a new baseline for drift detection"
"Show drift trends over the last 30 days"
```

### 2. Pattern Standardization (`pattern_standardize`)

Automatically fix code patterns to match your team's standards.

**Usage in Claude Code:**

```
"Standardize error handling patterns in the codebase"
"Review patterns that need manual attention"
"Fix import ordering across all files"
```

### 3. Monorepo Management (`monorepo_manage`)

Set up and manage monorepo structures with ease.

**Usage in Claude Code:**

```
"Initialize a new monorepo structure"
"Add a new package called auth-service"
"Check for circular dependencies"
```

### 4. Governance Reports (`governance_report`)

Generate comprehensive governance and compliance reports.

**Usage in Claude Code:**

```
"Generate weekly governance report"
"Show code quality compliance status"
"Create drift detection report in markdown"
```

### 5. Dependency Analysis (`dependency_analyze`)

Analyze and visualize project dependencies.

**Usage in Claude Code:**

```
"Find all circular dependencies"
"Show unused dependencies in the project"
"Create a dependency graph for the auth module"
```

### 6. Test Baselines (`test_baseline`)

Manage test coverage baselines and track changes.

**Usage in Claude Code:**

```
"Create test coverage baseline"
"Compare current coverage against baseline"
"Update test baseline with current metrics"
```

### 7. Claude Config Helper (`claude_config`)

Generate optimized Claude Code configurations for your project.

**Usage in Claude Code:**

```
"Generate CLAUDE.md for this project"
"Set up coding conventions for Claude Code"
"Configure hooks for automated workflows"
```

## 📋 Configuration

### Environment Variables

```bash
WUNDR_MCP_LOG_LEVEL=info    # Logging level (debug, info, warn, error)
WUNDR_MCP_CACHE_DIR=.cache  # Cache directory for performance
WUNDR_MCP_TIMEOUT=30000     # Tool timeout in milliseconds
```

### Custom Configuration

Create `.wundr-mcp.json` in your project root:

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
    "excludePaths": ["node_modules", "dist"]
  },
  "monorepo": {
    "packageManager": "pnpm",
    "organization": "@company",
    "defaultScripts": {
      "build": "tsc",
      "test": "jest"
    }
  }
}
```

## 🔧 Advanced Usage

### Combining Tools

The MCP tools work together seamlessly:

1. **Full Governance Workflow:**

   ```
   "Create a drift baseline, then standardize patterns, and generate a governance report"
   ```

2. **Monorepo Migration:**

   ```
   "Analyze dependencies, create monorepo migration plan, then initialize the structure"
   ```

3. **Quality Enforcement:**
   ```
   "Check test coverage, detect drift, and standardize any new violations"
   ```

### Automation with Hooks

Configure Claude Code hooks to run tools automatically:

```javascript
// .claude/hooks/pre-commit.js
module.exports = async context => {
  // Run pattern standardization before commits
  await context.runMCPTool('pattern_standardize', {
    action: 'run',
    dryRun: false,
  });

  // Check for drift
  const drift = await context.runMCPTool('drift_detection', {
    action: 'detect',
  });

  if (drift.severity === 'critical') {
    throw new Error('Critical drift detected! Fix issues before committing.');
  }
};
```

## 🎯 Best Practices

1. **Regular Baselines:** Create drift baselines weekly or after major changes
2. **Incremental Standardization:** Run pattern fixes on changed files only
3. **Monorepo Planning:** Always generate a migration plan before restructuring
4. **Automated Reports:** Schedule weekly governance reports in CI/CD
5. **Claude Code Integration:** Use the `claude_config` tool to optimize AI assistance

## 🐛 Troubleshooting

### Common Issues

1. **Tool not found:**

   ```bash
   claude mcp restart wundr
   ```

2. **Permission errors:**

   ```bash
   chmod +x $(which wundr-mcp)
   ```

3. **Cache issues:**
   ```bash
   rm -rf .cache/wundr-mcp
   ```

### Debug Mode

Enable debug logging:

```bash
export WUNDR_MCP_LOG_LEVEL=debug
claude mcp logs wundr
```

## 📚 Examples

### Example 1: Complete Governance Check

```typescript
// Claude Code will understand:
"Run a complete governance check: analyze drift, fix patterns, and generate report"

// This triggers:
1. drift_detection { action: "detect" }
2. pattern_standardize { action: "run" }
3. governance_report { reportType: "compliance", format: "markdown" }
```

### Example 2: Monorepo Setup

```typescript
// Claude Code will understand:
"Set up a new monorepo for our microservices with auth, api, and worker packages"

// This triggers:
1. monorepo_manage { action: "init" }
2. monorepo_manage { action: "add-package", packageName: "auth", packageType: "package" }
3. monorepo_manage { action: "add-package", packageName: "api", packageType: "app" }
4. monorepo_manage { action: "add-package", packageName: "worker", packageType: "app" }
```

## 🔗 Integration with CI/CD

### GitHub Actions

```yaml
name: Governance Check
on: [push, pull_request]

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Wundr MCP Tools
        run: npm install -g @wundr/mcp-tools
      - name: Run Drift Detection
        run: wundr-mcp drift-detection detect
      - name: Generate Report
        run: wundr-mcp governance-report weekly --format markdown
```

## 📝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to the MCP tools.

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.
