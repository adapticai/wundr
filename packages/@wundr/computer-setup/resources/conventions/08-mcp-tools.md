# MCP Tools Conventions

**Version**: 1.0.0
**Last Updated**: 2024-11-21
**Category**: Tooling & Automation

This document defines comprehensive conventions for using MCP (Model Context Protocol) tools, particularly Wundr MCP tools for governance, standardization, and quality management.

---

## Table of Contents

1. [MCP Overview](#mcp-overview)
2. [Tool Categories](#tool-categories)
3. [Wundr MCP Tools Reference](#wundr-mcp-tools-reference)
4. [Usage Conventions](#usage-conventions)
5. [Workflow Patterns](#workflow-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## MCP Overview

### What is MCP?

The Model Context Protocol (MCP) enables AI assistants like Claude to interact with external tools and services. MCP tools extend Claude's capabilities beyond text generation to include:

- Code quality monitoring
- Automated standardization
- Repository management
- Test coverage tracking
- Governance reporting

### Claude Code vs MCP Tools

**Claude Code Handles (Built-in):**
- File operations (Read, Write, Edit, Glob, Grep)
- Code generation and programming
- Bash commands and terminal operations
- Git operations
- Package management
- Testing and debugging

**MCP Tools Handle (Extended):**
- Coordination and planning
- Memory management
- Performance tracking
- Swarm orchestration
- GitHub integration
- Governance automation

**KEY PRINCIPLE**: MCP coordinates, Claude Code executes.

### Setup

```bash
# Add Wundr MCP server to Claude Code
claude mcp add wundr "node /path/to/wundr/mcp-tools/dist/server.js"

# Or using npm global
npm install -g @wundr/mcp-tools
claude mcp add wundr "wundr-mcp-server"

# Verify installation
claude mcp list
```

---

## Tool Categories

### Wundr MCP Tools (7 Core Tools)

| Tool | Purpose | Key Actions |
|------|---------|-------------|
| `drift_detection` | Monitor code quality changes | create-baseline, detect, trends |
| `pattern_standardize` | Auto-fix code patterns | run, review, check |
| `monorepo_manage` | Monorepo management | init, add-package, check-deps |
| `governance_report` | Generate reports | weekly, quality, compliance |
| `dependency_analyze` | Analyze dependencies | all, circular, unused, external |
| `test_baseline` | Test coverage management | create, compare, update |
| `claude_config` | Configuration generation | claude-md, hooks, conventions, all |

### Claude-Flow MCP Tools (Swarm Coordination)

| Tool | Purpose |
|------|---------|
| `swarm_init` | Initialize agent swarm |
| `agent_spawn` | Spawn new agents |
| `task_orchestrate` | Orchestrate tasks |
| `swarm_status` | Check swarm status |
| `memory_usage` | Monitor memory |
| `neural_status` | Neural network status |

---

## Wundr MCP Tools Reference

### 1. drift_detection

Monitor code quality drift by comparing against established baselines.

**Actions:**

| Action | Purpose | Output |
|--------|---------|--------|
| `create-baseline` | Create quality snapshot | version, message, details |
| `detect` | Check for drift | severity, recommendations |
| `list-baselines` | List all baselines | count, baselines array |
| `trends` | Analyze trends | growth, duplicate, complexity trends |

**Usage:**
```javascript
// Create baseline at milestone
mcp__wundr__drift_detection {
  action: "create-baseline"
}

// Detect drift before merge
mcp__wundr__drift_detection {
  action: "detect",
  baselineVersion: "v1.0"  // optional
}

// View trends over time
mcp__wundr__drift_detection {
  action: "trends"
}

// List available baselines
mcp__wundr__drift_detection {
  action: "list-baselines"
}
```

**Severity Levels:**
- `none`: No drift detected
- `low`: Minor changes, acceptable
- `medium`: Notable drift, review needed
- `high`: Significant drift, action required
- `critical`: Major regression, block deployment

---

### 2. pattern_standardize

Automatically fix code patterns and enforce consistency.

**Actions:**

| Action | Purpose | Output |
|--------|---------|--------|
| `run` | Apply fixes | filesModified, changesByRule |
| `review` | Manual attention needed | issues, nextSteps |
| `check` | Validate without fixing | status, recommendations |

**Available Rules:**

| Rule | What it does |
|------|-------------|
| `consistent-error-handling` | Replace string throws with AppError |
| `async-await-pattern` | Convert promise chains to async/await |
| `enum-standardization` | Convert const objects to enums |
| `service-lifecycle` | Ensure BaseService extension |
| `import-ordering` | Standardize import order |
| `naming-conventions` | Fix naming violations |
| `optional-chaining` | Use `?.` where appropriate |
| `type-assertions` | Use `as` keyword |

**Usage:**
```javascript
// Run all rules
mcp__wundr__pattern_standardize {
  action: "run"
}

// Run specific rules
mcp__wundr__pattern_standardize {
  action: "run",
  rules: ["import-ordering", "naming-conventions"]
}

// Preview changes first
mcp__wundr__pattern_standardize {
  action: "run",
  dryRun: true
}

// Check without modifying
mcp__wundr__pattern_standardize {
  action: "check"
}

// Find issues needing manual review
mcp__wundr__pattern_standardize {
  action: "review"
}
```

---

### 3. monorepo_manage

Initialize and manage monorepo structure with pnpm workspaces.

**Actions:**

| Action | Purpose | Requirements |
|--------|---------|--------------|
| `init` | Create monorepo | None |
| `plan` | Migration plan | analysisReport path |
| `add-package` | Create package | packageName |
| `check-deps` | Check circular deps | None |

**Usage:**
```javascript
// Initialize monorepo structure
mcp__wundr__monorepo_manage {
  action: "init"
}

// Add new package
mcp__wundr__monorepo_manage {
  action: "add-package",
  packageName: "utils",
  packageType: "package"  // app, package, or tool
}

// Check for circular dependencies
mcp__wundr__monorepo_manage {
  action: "check-deps"
}

// Generate migration plan
mcp__wundr__monorepo_manage {
  action: "plan",
  analysisReport: "./reports/analysis.json"
}
```

---

### 4. governance_report

Generate comprehensive governance and quality reports.

**Report Types:**

| Type | Purpose | Contents |
|------|---------|----------|
| `weekly` | Weekly summary | commits, changes, highlights |
| `drift` | Drift analysis | severity, metrics, recommendations |
| `quality` | Code quality | score, coverage, complexity |
| `compliance` | Standards audit | status, violations, recommendations |

**Formats:** `markdown`, `json`, `html`

**Usage:**
```javascript
// Weekly governance report
mcp__wundr__governance_report {
  reportType: "weekly",
  format: "markdown"
}

// Quality metrics report
mcp__wundr__governance_report {
  reportType: "quality",
  period: "30d"
}

// Compliance audit
mcp__wundr__governance_report {
  reportType: "compliance"
}

// Drift-specific report
mcp__wundr__governance_report {
  reportType: "drift"
}
```

---

### 5. dependency_analyze

Analyze and map project dependencies.

**Scopes:**

| Scope | Purpose | Output |
|-------|---------|--------|
| `all` | Complete analysis | graph, insights |
| `circular` | Find cycles | cycles, recommendations |
| `unused` | Find unused | packages, savings |
| `external` | NPM analysis | security, licenses, outdated |

**Output Formats:** `graph`, `json`, `markdown`

**Usage:**
```javascript
// Full dependency analysis
mcp__wundr__dependency_analyze {
  scope: "all",
  outputFormat: "markdown"
}

// Find circular dependencies
mcp__wundr__dependency_analyze {
  scope: "circular"
}

// Find unused dependencies
mcp__wundr__dependency_analyze {
  scope: "unused"
}

// Analyze external packages
mcp__wundr__dependency_analyze {
  scope: "external"
}

// Analyze specific target
mcp__wundr__dependency_analyze {
  scope: "all",
  target: "src/api"
}
```

---

### 6. test_baseline

Create and manage test coverage baselines.

**Actions:**

| Action | Purpose | Output |
|--------|---------|--------|
| `create` | Create baseline | summary, baselineFile |
| `compare` | Compare coverage | status, delta, regressions |
| `update` | Update baseline | archived, result |

**Test Types:** `unit`, `integration`, `e2e`, `all`

**Usage:**
```javascript
// Create coverage baseline
mcp__wundr__test_baseline {
  action: "create",
  testType: "all",
  threshold: 80
}

// Compare against baseline
mcp__wundr__test_baseline {
  action: "compare",
  testType: "unit"
}

// Update baseline
mcp__wundr__test_baseline {
  action: "update",
  testType: "all",
  threshold: 85
}
```

**Comparison Status:**
- `REGRESSION`: Coverage dropped
- `STABLE`: Coverage maintained
- `IMPROVED`: Coverage increased

---

### 7. claude_config

Generate Claude Code configuration files.

**Config Types:**

| Type | Generates | Features |
|------|-----------|----------|
| `claude-md` | CLAUDE.md | ai-assistance, governance |
| `hooks` | Workflow hooks | auto-governance |
| `conventions` | .wundr-conventions.json | strict-mode |
| `all` | All configs | All features |

**Usage:**
```javascript
// Generate CLAUDE.md
mcp__wundr__claude_config {
  configType: "claude-md",
  features: ["ai-assistance"]
}

// Generate hooks
mcp__wundr__claude_config {
  configType: "hooks",
  features: ["auto-governance"]
}

// Generate conventions
mcp__wundr__claude_config {
  configType: "conventions",
  features: ["strict-mode"]
}

// Generate all configurations
mcp__wundr__claude_config {
  configType: "all"
}
```

---

## Usage Conventions

### Invocation Format

```javascript
// Standard format
mcp__wundr__<tool_name> {
  <parameter>: <value>
}

// Example
mcp__wundr__drift_detection {
  action: "detect"
}
```

### Batch Operations

**ALWAYS batch related MCP calls in a single message:**
```javascript
// CORRECT: Single message batch
[BatchTool]:
  mcp__wundr__drift_detection { action: "detect" }
  mcp__wundr__dependency_analyze { scope: "circular" }
  mcp__wundr__test_baseline { action: "compare" }

// INCORRECT: Multiple messages
Message 1: mcp__wundr__drift_detection { action: "detect" }
Message 2: mcp__wundr__dependency_analyze { scope: "circular" }
// This breaks parallel coordination!
```

### Error Handling

All MCP tools return structured responses:

```javascript
// Success response
{
  "success": true,
  "action": "detect",
  // ... action-specific data
}

// Error response
{
  "success": false,
  "action": "detect",
  "error": "No baseline found",
  "details": "Run create-baseline first"
}
```

---

## Workflow Patterns

### Daily Quality Check

```javascript
// Morning quality check
[BatchTool]:
  // 1. Detect drift from baseline
  mcp__wundr__drift_detection { action: "detect" }

  // 2. Check for circular dependencies
  mcp__wundr__dependency_analyze { scope: "circular" }

  // 3. Compare test coverage
  mcp__wundr__test_baseline { action: "compare", testType: "all" }
```

### Pre-Commit Validation

```javascript
// Before committing code
[BatchTool]:
  // 1. Auto-fix patterns
  mcp__wundr__pattern_standardize { action: "run" }

  // 2. Check remaining issues
  mcp__wundr__pattern_standardize { action: "check" }

  // 3. Verify no drift
  mcp__wundr__drift_detection { action: "detect" }

  // 4. Ensure test coverage
  mcp__wundr__test_baseline { action: "compare" }
```

### Pre-Merge Review

```javascript
// Before merging PR
[BatchTool]:
  // 1. Full quality report
  mcp__wundr__governance_report { reportType: "quality" }

  // 2. Compliance check
  mcp__wundr__governance_report { reportType: "compliance" }

  // 3. Dependency analysis
  mcp__wundr__dependency_analyze { scope: "all" }

  // 4. Pattern review
  mcp__wundr__pattern_standardize { action: "review" }
```

### Weekly Maintenance

```javascript
// Weekly governance cycle
[BatchTool]:
  // 1. Create new baseline
  mcp__wundr__drift_detection { action: "create-baseline" }

  // 2. Update test baseline
  mcp__wundr__test_baseline { action: "update", threshold: 80 }

  // 3. Weekly report
  mcp__wundr__governance_report { reportType: "weekly" }

  // 4. View trends
  mcp__wundr__drift_detection { action: "trends" }

  // 5. Clean unused deps
  mcp__wundr__dependency_analyze { scope: "unused" }
```

### Project Setup

```javascript
// New project initialization
[BatchTool]:
  // 1. Initialize monorepo structure
  mcp__wundr__monorepo_manage { action: "init" }

  // 2. Generate all configs
  mcp__wundr__claude_config { configType: "all" }

  // 3. Create initial baseline
  mcp__wundr__drift_detection { action: "create-baseline" }

  // 4. Create test baseline
  mcp__wundr__test_baseline { action: "create", threshold: 80 }
```

### Release Preparation

```javascript
// Before release
[BatchTool]:
  // 1. Create release baseline
  mcp__wundr__drift_detection { action: "create-baseline" }

  // 2. Full compliance check
  mcp__wundr__governance_report { reportType: "compliance" }

  // 3. Security audit (external deps)
  mcp__wundr__dependency_analyze { scope: "external" }

  // 4. Final quality report
  mcp__wundr__governance_report { reportType: "quality" }
```

---

## Best Practices

### 1. Baseline Management

- Create baselines at project milestones
- Create baseline before major refactoring
- Update baseline weekly as part of governance
- Never skip baseline creation before releases

### 2. Pattern Standardization

- Always run with `dryRun: true` first
- Fix automated issues before manual review
- Address `review` items before merging
- Document exceptions in code comments

### 3. Dependency Management

- Run circular check before every merge
- Review unused deps monthly
- Track external dep security weekly
- Document why dependencies exist

### 4. Test Coverage

- Set realistic thresholds (start at 70-80%)
- Increase thresholds as coverage improves
- Never merge on REGRESSION status
- Investigate coverage drops immediately

### 5. Reporting

- Generate weekly reports on schedule
- Share compliance reports with team
- Act on recommendations promptly
- Track trends over time

### 6. Batch Operations

- Always batch independent MCP calls
- Use parallel execution for speed
- Don't wait between independent operations
- Combine related checks in workflows

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Script not found" | Missing scripts | Run setup scripts |
| "No baseline found" | No baseline created | Run create-baseline first |
| "Analysis report required" | Missing parameter | Provide analysisReport path |
| "Package name required" | Missing parameter | Provide packageName |
| "Unknown action" | Invalid action | Check valid enum values |

### Server Issues

```bash
# Check if server is running
claude mcp list

# Restart server
claude mcp restart wundr

# Remove and re-add
claude mcp remove wundr
claude mcp add wundr "node /path/to/server.js"

# View logs
claude mcp logs wundr
```

### Tool-Specific Issues

**Drift Detection:**
- Ensure `.governance/` directory exists
- Check write permissions
- Verify governance scripts present

**Pattern Standardization:**
- Check TypeScript compiles
- Review parsing errors
- Run with `dryRun` first

**Test Baseline:**
- Ensure tests can run
- Check `.testing/baselines/` exists
- Verify test configuration

**Dependency Analysis:**
- Valid `package.json` required
- Run `npm install` first
- Check target path validity

---

## Related Conventions

- [01-general-principles.md](./01-general-principles.md) - Core principles
- [03-testing.md](./03-testing.md) - Testing with MCP
- [06-git-workflow.md](./06-git-workflow.md) - Git with MCP

---

## Quick Reference

### Most Common Commands

```javascript
// Check quality
mcp__wundr__drift_detection { action: "detect" }

// Fix patterns
mcp__wundr__pattern_standardize { action: "run" }

// Check dependencies
mcp__wundr__dependency_analyze { scope: "circular" }

// Check tests
mcp__wundr__test_baseline { action: "compare" }

// Weekly report
mcp__wundr__governance_report { reportType: "weekly" }
```

### Workflow Cheat Sheet

| Task | Command |
|------|---------|
| Daily check | drift detect + circular deps + test compare |
| Pre-commit | pattern run + drift detect |
| Pre-merge | quality report + compliance + pattern review |
| Weekly | create baseline + weekly report + trends |
| Release | compliance + external deps + quality report |

---

**Version**: 1.0.0
**Maintainer**: Wundr Team
