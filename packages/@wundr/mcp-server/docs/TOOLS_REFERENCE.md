# Wundr MCP Tools Reference

Complete reference documentation for all Wundr MCP tools available for Claude Code integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Reference Table](#quick-reference-table)
3. [Tool Documentation](#tool-documentation)
   - [drift_detection](#drift_detection)
   - [pattern_standardize](#pattern_standardize)
   - [monorepo_manage](#monorepo_manage)
   - [governance_report](#governance_report)
   - [dependency_analyze](#dependency_analyze)
   - [test_baseline](#test_baseline)
   - [claude_config](#claude_config)
4. [Tool Relationships](#tool-relationships)
5. [Error Reference](#error-reference)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The Wundr MCP Tools provide governance, standardization, and monorepo management capabilities for Claude Code. These tools integrate seamlessly with the Model Context Protocol (MCP) to enable automated code quality management.

**Total Tools**: 7 primary tools with 23 actions

**Server Name**: `wundr-mcp-tools`
**Version**: 1.0.0

---

## Quick Reference Table

| Tool Name | Purpose | Actions | Primary Use Case |
|-----------|---------|---------|------------------|
| `drift_detection` | Monitor code quality changes | `create-baseline`, `detect`, `list-baselines`, `trends` | Quality monitoring |
| `pattern_standardize` | Auto-fix code patterns | `run`, `review`, `check` | Code standardization |
| `monorepo_manage` | Monorepo lifecycle management | `init`, `plan`, `add-package`, `check-deps` | Project structure |
| `governance_report` | Generate compliance reports | `weekly`, `drift`, `quality`, `compliance` | Reporting |
| `dependency_analyze` | Analyze project dependencies | `all`, `circular`, `unused`, `external` | Dependency management |
| `test_baseline` | Manage test coverage baselines | `create`, `compare`, `update` | Test quality |
| `claude_config` | Generate Claude configurations | `claude-md`, `hooks`, `conventions`, `all` | Setup |

---

## Tool Documentation

### drift_detection

**Description**: Detect code drift by comparing current codebase state against established baselines. Essential for maintaining code quality over time.

**LLM-Friendly Description**: Use this tool to monitor how your codebase changes over time. Create baselines to capture quality metrics, then detect drift to see what has changed. Useful for preventing code quality regression.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create-baseline", "detect", "list-baselines", "trends"],
      "description": "The drift detection action to perform"
    },
    "baselineVersion": {
      "type": "string",
      "description": "Baseline version to compare against (optional, defaults to latest)"
    }
  },
  "required": ["action"]
}
```

#### Actions

##### create-baseline
Creates a new baseline snapshot of current code quality metrics.

**When to use**: At project milestones, before major refactoring, weekly/monthly as part of governance workflow.

**Output includes**:
- `version`: Unique baseline identifier
- `message`: Success/failure status
- `details`: Raw script output

##### detect
Compares current codebase against a baseline to identify drift.

**When to use**: Before merging PRs, during code reviews, as part of CI/CD pipeline.

**Output includes**:
- `severity`: `none`, `low`, `medium`, `high`, `critical`
- `recommendations`: Array of suggested fixes
- `reportPath`: Location of detailed report

##### list-baselines
Lists all available baselines with metadata.

**When to use**: To find available baselines, understand baseline history.

**Output includes**:
- `count`: Number of baselines
- `baselines`: Array of baseline metadata (version, timestamp, entities)

##### trends
Analyzes drift trends over time.

**When to use**: For weekly/monthly reporting, understanding quality trajectory.

**Output includes**:
- `entityGrowth`: Growth trend of code entities
- `duplicateTrend`: Trend of code duplicates
- `complexityTrend`: Trend of code complexity

---

### pattern_standardize

**Description**: Apply standardization rules to automatically fix code patterns and enforce consistency.

**LLM-Friendly Description**: Use this tool to automatically fix common code pattern issues like inconsistent error handling, promise chains that should use async/await, and import ordering. Can preview changes before applying.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["run", "review", "check"],
      "description": "The standardization action"
    },
    "rules": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Specific rules to apply (optional)"
    },
    "dryRun": {
      "type": "boolean",
      "description": "Preview changes without applying them"
    }
  },
  "required": ["action"]
}
```

#### Available Rules

| Rule Name | Description |
|-----------|-------------|
| `consistent-error-handling` | Replace string throws with AppError instances |
| `async-await-pattern` | Convert promise chains to async/await |
| `enum-standardization` | Convert const objects to proper enums |
| `service-lifecycle` | Ensure services extend BaseService |
| `import-ordering` | Standardize import order and grouping |
| `naming-conventions` | Fix naming convention violations |
| `optional-chaining` | Use optional chaining where appropriate |
| `type-assertions` | Replace angle bracket assertions with `as` keyword |

#### Actions

##### run
Executes standardization rules and modifies files.

**When to use**: Before commits, as part of pre-commit hooks, during refactoring.

**Output includes**:
- `totalFilesModified`: Number of files changed
- `changesByRule`: Breakdown of changes per rule
- `availableRules`: List of all rules

##### review
Identifies patterns that require manual attention.

**When to use**: When automated fixes are insufficient, to identify complex refactoring needs.

**Output includes**:
- `totalIssues`: Count of manual review items
- `issuesByCategory`: Categorized issues
- `nextSteps`: Recommended actions

##### check
Validates patterns without making changes.

**When to use**: In CI/CD to verify code meets standards, for reporting.

**Output includes**:
- `status`: Ready/needs attention
- `recommendations`: Suggested next steps

---

### monorepo_manage

**Description**: Initialize and manage monorepo structure using pnpm workspaces and Turborepo.

**LLM-Friendly Description**: Use this tool to set up a monorepo structure, add new packages, plan migrations, and check for dependency issues. Essential for managing complex multi-package projects.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["init", "plan", "add-package", "check-deps"],
      "description": "The monorepo management action"
    },
    "packageName": {
      "type": "string",
      "description": "Package name for add-package action"
    },
    "packageType": {
      "type": "string",
      "enum": ["app", "package", "tool"],
      "description": "Type of package to create"
    },
    "analysisReport": {
      "type": "string",
      "description": "Path to analysis report for migration planning"
    }
  },
  "required": ["action"]
}
```

#### Actions

##### init
Creates monorepo structure with workspace configuration.

**When to use**: Starting a new monorepo, converting existing project.

**Creates**:
- `packages/`, `apps/`, `tools/`, `docs/`, `scripts/` directories
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `turbo.json`

**Output includes**:
- `structure`: Created directories and configs
- `packageManager`: pnpm
- `nextSteps`: Installation and usage instructions

##### plan
Generates migration plan from analysis report.

**Requires**: `analysisReport` parameter with path to analysis JSON

**When to use**: Before migrating existing codebase to monorepo.

**Output includes**:
- `phases`: Migration phases with target packages and file counts
- `verificationSteps`: Post-migration verification commands

##### add-package
Creates a new package within the monorepo.

**Requires**: `packageName` parameter

**When to use**: Adding new functionality as separate package.

**Output includes**:
- `package`: Name, type, and path info
- `createdFiles`: List of generated files
- `nextSteps`: Development instructions

##### check-deps
Checks for circular dependencies between packages.

**When to use**: Before commits, in CI/CD, during refactoring.

**Output includes**:
- `hasCircularDependencies`: Boolean
- `circularDependencies`: Array of dependency paths
- `recommendation`: Suggested action

---

### governance_report

**Description**: Generate comprehensive governance reports for compliance, quality, and team metrics.

**LLM-Friendly Description**: Use this tool to generate reports about code quality, governance compliance, and team productivity. Supports weekly summaries, drift reports, quality metrics, and compliance audits.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "reportType": {
      "type": "string",
      "enum": ["weekly", "drift", "quality", "compliance"],
      "description": "Type of governance report to generate"
    },
    "format": {
      "type": "string",
      "enum": ["markdown", "json", "html"],
      "description": "Output format for the report"
    },
    "period": {
      "type": "string",
      "description": "Time period for the report (e.g., '7d', '30d')"
    }
  },
  "required": ["reportType"]
}
```

#### Report Types

##### weekly
Comprehensive weekly summary of governance metrics.

**Output includes**:
- `summary`: Commits, files changed, issues
- `highlights`: Key accomplishments
- `reportPath`: Location of generated report

##### drift
Drift-specific analysis report.

**Output includes**:
- `driftStatus`: Severity and action requirements
- `metrics`: New duplicates, complexity increase, circular deps
- `recommendations`: Suggested fixes

##### quality
Code quality metrics report.

**Output includes**:
- `codeQuality`: Score, trend, issues by severity
- `testCoverage`: Overall, unit, integration, e2e coverage
- `complexity`: Average, highest, trend
- `duplicates`: Count, percentage, trend

##### compliance
Standards compliance audit report.

**Output includes**:
- `standards`: Compliance status for each standard
- `overallCompliance`: Percentage score
- `violations`: Total and by category
- `recommendations`: Compliance improvement suggestions

---

### dependency_analyze

**Description**: Analyze and map dependencies within the codebase, identifying issues and optimization opportunities.

**LLM-Friendly Description**: Use this tool to understand your project's dependencies. Find circular dependencies, unused packages, external dependencies, and generate dependency graphs. Essential for maintaining healthy dependency relationships.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "scope": {
      "type": "string",
      "enum": ["all", "circular", "unused", "external"],
      "description": "Scope of dependency analysis"
    },
    "target": {
      "type": "string",
      "description": "Specific package or directory to analyze"
    },
    "outputFormat": {
      "type": "string",
      "enum": ["graph", "json", "markdown"],
      "description": "Format for analysis output"
    }
  },
  "required": ["scope"]
}
```

#### Scopes

##### all
Complete dependency analysis.

**Output includes**:
- `totalFiles`, `totalDependencies`
- `internalDependencies`, `externalDependencies`
- `dependencyGraph`: Nodes and edges for visualization
- `insights`: Actionable recommendations

##### circular
Finds circular dependency chains.

**Output includes**:
- `hasCircularDependencies`: Boolean
- `count`: Number of cycles
- `circles`: Array of dependency paths
- `recommendations`: Refactoring suggestions

##### unused
Identifies potentially unused dependencies.

**Output includes**:
- `unusedCount`: Number of unused deps
- `unusedDependencies`: List of package names
- `sizeSavings`: Estimated space savings
- `recommendations`: Cleanup commands

##### external
Analyzes external (npm) dependencies.

**Output includes**:
- `production`: Count, list, by category
- `development`: Count, list, by category
- `security`: Vulnerability information
- `licenses`: License risk analysis
- `outdated`: Update requirements

---

### test_baseline

**Description**: Create and manage test coverage baselines for quality tracking and enforcement.

**LLM-Friendly Description**: Use this tool to establish test coverage baselines and track coverage changes over time. Compare current coverage against baselines to catch regressions before merging.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "compare", "update"],
      "description": "Test baseline action"
    },
    "testType": {
      "type": "string",
      "enum": ["unit", "integration", "e2e", "all"],
      "description": "Type of tests to baseline"
    },
    "threshold": {
      "type": "number",
      "description": "Coverage threshold percentage"
    }
  },
  "required": ["action"]
}
```

#### Actions

##### create
Creates new test coverage baseline.

**Output includes**:
- `summary`: Coverage percentage, test results, threshold status
- `baselineFile`: Path to saved baseline
- `nextSteps`: Usage instructions

##### compare
Compares current coverage against baseline.

**Output includes**:
- `status`: `REGRESSION`, `IMPROVED`, `STABLE`
- `comparison`: Baseline vs current metrics
- `delta`: Changes in coverage metrics
- `regressions`, `improvements`: Specific changes
- `recommendations`: Action items

##### update
Updates baseline with current metrics.

**Output includes**:
- `archived`: Previous baseline preserved
- `result`: New baseline details

---

### claude_config

**Description**: Generate optimized Claude Code configuration files for project integration.

**LLM-Friendly Description**: Use this tool to set up Claude Code integration for your project. Generates CLAUDE.md with project guidelines, hooks for automated workflows, and coding conventions configuration.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "configType": {
      "type": "string",
      "enum": ["claude-md", "hooks", "conventions", "all"],
      "description": "Type of configuration to generate"
    },
    "features": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Specific features to configure"
    }
  },
  "required": ["configType"]
}
```

#### Configuration Types

##### claude-md
Generates CLAUDE.md with project guidelines.

**Available features**: `ai-assistance`, `governance`

**Output includes**:
- `filePath`: CLAUDE.md
- `sections`: List of included sections

##### hooks
Creates Claude Code workflow hooks.

**Generates**:
- `pre-commit.js`: Pre-commit validation
- `post-pr.js`: PR review automation
- `session-start.js`: Workspace initialization

**Available features**: `auto-governance`

##### conventions
Creates coding conventions configuration.

**Generates**: `.wundr-conventions.json`

**Available features**: `strict-mode`

**Output includes**:
- `rules`: Configured rule names
- `autoFixEnabled`: Boolean

##### all
Generates all configuration files.

**Generates**: CLAUDE.md, hooks, conventions, VS Code settings

**Output includes**:
- `generated`: Map of all created files
- `nextSteps`: Setup completion instructions

---

## Tool Relationships

Understanding which tools to use together for common workflows:

### Initial Project Setup
```
1. monorepo_manage (action: init)     -> Set up structure
2. claude_config (configType: all)     -> Configure Claude Code
3. drift_detection (action: create-baseline) -> Establish baseline
4. test_baseline (action: create)      -> Set coverage baseline
```

### Pre-Commit Workflow
```
1. pattern_standardize (action: run)   -> Fix patterns
2. dependency_analyze (scope: circular) -> Check deps
3. drift_detection (action: detect)    -> Check for drift
4. test_baseline (action: compare)     -> Verify coverage
```

### Weekly Governance Review
```
1. governance_report (reportType: weekly)     -> Generate summary
2. drift_detection (action: trends)           -> View trends
3. dependency_analyze (scope: unused)         -> Find cleanup opportunities
4. test_baseline (action: compare)            -> Coverage check
```

### PR Review Workflow
```
1. governance_report (reportType: compliance) -> Check compliance
2. pattern_standardize (action: review)       -> Find manual fixes
3. dependency_analyze (scope: all)            -> Full dep analysis
```

---

## Error Reference

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Script not found at: [path]` | Missing governance scripts | Run setup scripts or check installation |
| `No baseline found` | No baseline created yet | Use `create-baseline` action first |
| `Analysis report path required` | Missing `analysisReport` param | Provide path to analysis JSON |
| `Package name required` | Missing `packageName` param | Provide package name for add-package |
| `Unknown action: [action]` | Invalid action value | Check valid enum values |
| `Circular dependencies detected` | Dependency cycle found | Refactor to break cycles |

### Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "action": "action-name",
  "error": "Error description",
  "details": "Additional context"
}
```

---

## Troubleshooting

### Tool Not Responding

1. Check MCP server is running: `claude mcp list`
2. Restart MCP server: `claude mcp restart wundr`
3. Verify installation: `ls -la mcp-tools/`

### Baseline Operations Failing

1. Ensure `.governance/` directory exists
2. Check write permissions
3. Verify governance scripts are present in `scripts/governance/`

### Pattern Standardization Issues

1. Run with `dryRun: true` first to preview
2. Check for TypeScript errors that may prevent parsing
3. Review `review` action output for manual fixes needed

### Dependency Analysis Incorrect

1. Ensure `package.json` exists and is valid
2. Run `npm install` to ensure node_modules is populated
3. Check target path is valid

### Test Baseline Comparison Failing

1. Create a baseline first with `create` action
2. Ensure tests can run successfully
3. Check `.testing/baselines/` directory exists

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release with 7 tools |

---

*Generated for Wundr MCP Tools v1.0.0*
