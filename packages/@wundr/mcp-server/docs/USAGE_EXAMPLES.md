# Wundr MCP Tools Usage Examples

Practical examples for using Wundr MCP tools in various scenarios.

---

## Table of Contents

1. [Quick Start Examples](#quick-start-examples)
2. [Tool-Specific Examples](#tool-specific-examples)
   - [Drift Detection Examples](#drift-detection-examples)
   - [Pattern Standardization Examples](#pattern-standardization-examples)
   - [Monorepo Management Examples](#monorepo-management-examples)
   - [Governance Report Examples](#governance-report-examples)
   - [Dependency Analysis Examples](#dependency-analysis-examples)
   - [Test Baseline Examples](#test-baseline-examples)
   - [Claude Config Examples](#claude-config-examples)
3. [Workflow Examples](#workflow-examples)
4. [Natural Language Prompts](#natural-language-prompts)
5. [Common Patterns](#common-patterns)

---

## Quick Start Examples

### First-Time Setup

```
User: "Set up Wundr governance for this project"

Claude will:
1. Initialize monorepo structure
2. Generate Claude Code configuration
3. Create initial baselines
4. Set up test coverage baseline
```

**Equivalent tool calls:**
```json
// Step 1: Set up project structure
{ "tool": "monorepo_manage", "action": "init" }

// Step 2: Generate configurations
{ "tool": "claude_config", "configType": "all" }

// Step 3: Create quality baseline
{ "tool": "drift_detection", "action": "create-baseline" }

// Step 4: Create test baseline
{ "tool": "test_baseline", "action": "create", "testType": "all", "threshold": 80 }
```

### Daily Check

```
User: "Run a quick quality check on my code"

Claude will:
1. Detect drift from baseline
2. Check for circular dependencies
3. Report any issues found
```

**Equivalent tool calls:**
```json
{ "tool": "drift_detection", "action": "detect" }
{ "tool": "dependency_analyze", "scope": "circular" }
```

---

## Tool-Specific Examples

### Drift Detection Examples

#### Example 1: Create a Baseline

**User prompt**: "Create a new baseline for code quality tracking"

**Tool call**:
```json
{
  "tool": "drift_detection",
  "arguments": {
    "action": "create-baseline"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "create-baseline",
  "version": "main-abc123",
  "message": "Baseline created successfully",
  "details": "..."
}
```

#### Example 2: Detect Drift Against Latest Baseline

**User prompt**: "Check if my code has drifted from the baseline"

**Tool call**:
```json
{
  "tool": "drift_detection",
  "arguments": {
    "action": "detect"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "detect",
  "severity": "low",
  "recommendations": [
    "Consider reducing duplicate code in src/utils",
    "Review complexity increase in auth module"
  ],
  "reportPath": ".governance/reports/drift-2024-01-15.json",
  "summary": "Drift detection completed with low severity"
}
```

#### Example 3: Detect Drift Against Specific Version

**User prompt**: "Compare current code against baseline version release-1.0"

**Tool call**:
```json
{
  "tool": "drift_detection",
  "arguments": {
    "action": "detect",
    "baselineVersion": "release-1.0"
  }
}
```

#### Example 4: View Quality Trends

**User prompt**: "Show me how code quality has changed over time"

**Tool call**:
```json
{
  "tool": "drift_detection",
  "arguments": {
    "action": "trends"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "trends",
  "trends": {
    "entityGrowth": "+12% over 30 days",
    "duplicateTrend": "Decreasing",
    "complexityTrend": "Stable"
  },
  "reportPath": ".governance/reports/trends-2024-01-15.json"
}
```

---

### Pattern Standardization Examples

#### Example 1: Auto-fix All Patterns

**User prompt**: "Fix all code pattern issues in my project"

**Tool call**:
```json
{
  "tool": "pattern_standardize",
  "arguments": {
    "action": "run"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "run",
  "totalFilesModified": 23,
  "changesByRule": {
    "consistent-error-handling": 8,
    "async-await-pattern": 5,
    "import-ordering": 10
  },
  "summary": "Standardization complete! Modified 23 files total."
}
```

#### Example 2: Preview Changes (Dry Run)

**User prompt**: "Show me what pattern fixes would be applied without changing anything"

**Tool call**:
```json
{
  "tool": "pattern_standardize",
  "arguments": {
    "action": "run",
    "dryRun": true
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "dry-run",
  "mode": "preview",
  "previewSummary": {
    "consistent-error-handling": "Would replace string throws with AppError instances",
    "async-await-pattern": "Would convert promise chains to async/await",
    "import-ordering": "Would standardize import order and grouping"
  },
  "recommendation": "Run with action:\"run\" and dryRun:false to apply changes"
}
```

#### Example 3: Apply Specific Rules Only

**User prompt**: "Only fix the import ordering in my files"

**Tool call**:
```json
{
  "tool": "pattern_standardize",
  "arguments": {
    "action": "run",
    "rules": ["import-ordering"]
  }
}
```

#### Example 4: Review Manual Fixes Needed

**User prompt**: "What patterns need manual attention?"

**Tool call**:
```json
{
  "tool": "pattern_standardize",
  "arguments": {
    "action": "review"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "review",
  "totalIssues": 5,
  "issuesByCategory": {
    "complexPromiseChains": 3,
    "nonStandardServices": 2,
    "mixedErrorHandling": 0,
    "inconsistentNaming": 0
  },
  "reportPath": "manual-review-required.md",
  "nextSteps": [
    "Review each item in the report",
    "Apply manual refactoring where needed",
    "Re-run standardization after manual fixes"
  ]
}
```

---

### Monorepo Management Examples

#### Example 1: Initialize Monorepo

**User prompt**: "Set up this project as a monorepo"

**Tool call**:
```json
{
  "tool": "monorepo_manage",
  "arguments": {
    "action": "init"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "init",
  "structure": {
    "directories": ["packages", "apps", "tools", "docs", "scripts"],
    "configs": ["package.json", "pnpm-workspace.yaml", "tsconfig.json", "turbo.json"]
  },
  "packageManager": "pnpm",
  "nextSteps": [
    "Run: pnpm install",
    "Migrate existing code to packages/",
    "Update imports to use package names",
    "Run: pnpm run build"
  ]
}
```

#### Example 2: Add New Package

**User prompt**: "Create a new package called 'auth-utils'"

**Tool call**:
```json
{
  "tool": "monorepo_manage",
  "arguments": {
    "action": "add-package",
    "packageName": "auth-utils",
    "packageType": "package"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "add-package",
  "package": {
    "name": "@company/auth-utils",
    "type": "package",
    "path": "packages/auth-utils"
  },
  "createdFiles": [
    "packages/auth-utils/package.json",
    "packages/auth-utils/tsconfig.json",
    "packages/auth-utils/src/index.ts",
    "packages/auth-utils/README.md"
  ]
}
```

#### Example 3: Add New App

**User prompt**: "Create a new application called 'admin-dashboard'"

**Tool call**:
```json
{
  "tool": "monorepo_manage",
  "arguments": {
    "action": "add-package",
    "packageName": "admin-dashboard",
    "packageType": "app"
  }
}
```

#### Example 4: Check for Circular Dependencies

**User prompt**: "Are there any circular dependencies in my monorepo?"

**Tool call**:
```json
{
  "tool": "monorepo_manage",
  "arguments": {
    "action": "check-deps"
  }
}
```

**Expected response (no issues)**:
```json
{
  "success": true,
  "action": "check-deps",
  "hasCircularDependencies": false,
  "circularDependencies": [],
  "message": "No circular dependencies found!",
  "recommendation": "Dependencies are healthy"
}
```

**Expected response (issues found)**:
```json
{
  "success": false,
  "action": "check-deps",
  "hasCircularDependencies": true,
  "circularDependencies": [
    "packages/auth -> packages/user -> packages/auth"
  ],
  "message": "Found 1 circular dependencies",
  "recommendation": "Refactor to remove circular dependencies before proceeding"
}
```

---

### Governance Report Examples

#### Example 1: Weekly Summary Report

**User prompt**: "Generate a weekly governance report"

**Tool call**:
```json
{
  "tool": "governance_report",
  "arguments": {
    "reportType": "weekly",
    "format": "markdown"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "reportType": "weekly",
  "format": "markdown",
  "reportPath": ".governance/reports/weekly-report-2024-01-15.markdown",
  "data": {
    "summary": {
      "totalCommits": 47,
      "filesChanged": 124,
      "linesAdded": 3842,
      "contributors": 5
    },
    "highlights": [
      "Successfully reduced code duplicates by 15%",
      "Improved test coverage to 82.5%"
    ]
  }
}
```

#### Example 2: Compliance Report

**User prompt**: "Check if our code meets all standards"

**Tool call**:
```json
{
  "tool": "governance_report",
  "arguments": {
    "reportType": "compliance",
    "format": "json"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "reportType": "compliance",
  "compliance": {
    "overallCompliance": 89.1,
    "certification": "PASSING",
    "violations": {
      "total": 18,
      "byCategory": {
        "naming": 3,
        "imports": 15,
        "structure": 0
      }
    }
  },
  "recommendations": [
    "Run pattern standardizer to fix import violations",
    "Review and fix 3 naming convention violations"
  ]
}
```

#### Example 3: Quality Metrics Report

**User prompt**: "Show me the code quality metrics for the last month"

**Tool call**:
```json
{
  "tool": "governance_report",
  "arguments": {
    "reportType": "quality",
    "period": "30d"
  }
}
```

---

### Dependency Analysis Examples

#### Example 1: Full Dependency Analysis

**User prompt**: "Analyze all dependencies in this project"

**Tool call**:
```json
{
  "tool": "dependency_analyze",
  "arguments": {
    "scope": "all",
    "outputFormat": "json"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "scope": "all",
  "analysis": {
    "totalFiles": 150,
    "totalDependencies": 85,
    "internalDependencies": 45,
    "externalDependencies": 40
  },
  "insights": [
    "Good balance of internal vs external dependencies"
  ]
}
```

#### Example 2: Find Circular Dependencies

**User prompt**: "Find all circular dependencies in my code"

**Tool call**:
```json
{
  "tool": "dependency_analyze",
  "arguments": {
    "scope": "circular"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "scope": "circular",
  "hasCircularDependencies": true,
  "count": 2,
  "circles": [
    ["src/services/UserService.ts", "src/models/User.ts", "src/services/UserService.ts"],
    ["src/utils/auth.ts", "src/services/AuthService.ts", "src/utils/auth.ts"]
  ],
  "recommendations": [
    "Refactor to use dependency injection",
    "Consider extracting shared interfaces"
  ]
}
```

#### Example 3: Find Unused Dependencies

**User prompt**: "What packages am I not using?"

**Tool call**:
```json
{
  "tool": "dependency_analyze",
  "arguments": {
    "scope": "unused"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "scope": "unused",
  "totalDependencies": 45,
  "unusedCount": 5,
  "unusedDependencies": [
    "moment",
    "lodash-es",
    "query-string",
    "uuid",
    "chalk"
  ],
  "sizeSavings": "~1.2 MB",
  "recommendations": [
    "Remove 5 unused dependencies",
    "Run: npm uninstall moment lodash-es query-string"
  ]
}
```

#### Example 4: Generate Dependency Graph

**User prompt**: "Create a visual dependency graph"

**Tool call**:
```json
{
  "tool": "dependency_analyze",
  "arguments": {
    "scope": "all",
    "outputFormat": "graph"
  }
}
```

---

### Test Baseline Examples

#### Example 1: Create Coverage Baseline

**User prompt**: "Set up a test coverage baseline with 80% threshold"

**Tool call**:
```json
{
  "tool": "test_baseline",
  "arguments": {
    "action": "create",
    "testType": "all",
    "threshold": 80
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "create",
  "testType": "all",
  "baselineFile": ".testing/baselines/baseline-all-latest.json",
  "summary": {
    "coverage": 82.5,
    "tests": "242/250 passed",
    "threshold": "80%",
    "status": "PASSING"
  }
}
```

#### Example 2: Compare Against Baseline

**User prompt**: "Has my test coverage regressed?"

**Tool call**:
```json
{
  "tool": "test_baseline",
  "arguments": {
    "action": "compare",
    "testType": "all"
  }
}
```

**Expected response (improved)**:
```json
{
  "success": true,
  "action": "compare",
  "status": "IMPROVED",
  "comparison": {
    "delta": {
      "overall": 2.5,
      "branches": 1.8,
      "functions": 3.2
    }
  },
  "summary": {
    "coverageChange": "+2.5%",
    "testChange": "+10 tests",
    "improvementCount": 2
  },
  "message": "Coverage IMPROVED: 85.0% (+2.5%)"
}
```

**Expected response (regression)**:
```json
{
  "success": false,
  "action": "compare",
  "status": "REGRESSION",
  "comparison": {
    "delta": {
      "overall": -5.2,
      "branches": -8.1
    },
    "regressions": [
      "Overall coverage decreased by 5.2%",
      "Branch coverage decreased by 8.1%"
    ]
  },
  "recommendations": [
    "Address coverage regressions before merging",
    "Focus on branch coverage - add tests for conditional logic"
  ]
}
```

#### Example 3: Unit Test Baseline Only

**User prompt**: "Create a baseline just for unit tests"

**Tool call**:
```json
{
  "tool": "test_baseline",
  "arguments": {
    "action": "create",
    "testType": "unit",
    "threshold": 90
  }
}
```

---

### Claude Config Examples

#### Example 1: Generate All Configurations

**User prompt**: "Set up all Claude Code configuration files"

**Tool call**:
```json
{
  "tool": "claude_config",
  "arguments": {
    "configType": "all"
  }
}
```

**Expected response**:
```json
{
  "success": true,
  "action": "generate-all",
  "generated": {
    "CLAUDE.md": "CLAUDE.md",
    "hooks": ["pre-commit.js", "post-pr.js", "session-start.js"],
    "conventions": ".wundr-conventions.json",
    "vscode": ".vscode/settings.json"
  },
  "nextSteps": [
    "Review CLAUDE.md for project guidelines",
    "Test hooks with a sample commit",
    "Customize conventions as needed"
  ]
}
```

#### Example 2: Generate CLAUDE.md with Features

**User prompt**: "Create CLAUDE.md with governance and AI assistance features"

**Tool call**:
```json
{
  "tool": "claude_config",
  "arguments": {
    "configType": "claude-md",
    "features": ["governance", "ai-assistance"]
  }
}
```

#### Example 3: Generate Workflow Hooks

**User prompt**: "Set up automated workflow hooks for commits"

**Tool call**:
```json
{
  "tool": "claude_config",
  "arguments": {
    "configType": "hooks"
  }
}
```

---

## Workflow Examples

### Pre-Release Quality Gate

```
User: "Run all quality checks before our release"

Sequence:
1. drift_detection (detect) - Check for quality drift
2. pattern_standardize (check) - Verify patterns
3. dependency_analyze (circular) - No circular deps
4. test_baseline (compare) - Coverage maintained
5. governance_report (compliance) - Full compliance report
```

### New Feature Branch Setup

```
User: "I'm starting a new feature, prepare my environment"

Sequence:
1. drift_detection (create-baseline) - Snapshot current state
2. test_baseline (create) - Capture current coverage
```

### Post-Merge Cleanup

```
User: "Clean up after the merge and update baselines"

Sequence:
1. pattern_standardize (run) - Fix any merged issues
2. dependency_analyze (unused) - Find cleanup opportunities
3. drift_detection (create-baseline) - New baseline
4. test_baseline (update) - Update coverage baseline
```

---

## Natural Language Prompts

### Common Phrases and Tool Mappings

| Natural Language | Tool | Action |
|------------------|------|--------|
| "Check code quality" | drift_detection | detect |
| "Create a baseline" | drift_detection | create-baseline |
| "Fix code patterns" | pattern_standardize | run |
| "Preview fixes" | pattern_standardize | run (dryRun: true) |
| "Set up monorepo" | monorepo_manage | init |
| "Add a new package" | monorepo_manage | add-package |
| "Check for circular deps" | dependency_analyze | circular |
| "Find unused packages" | dependency_analyze | unused |
| "Generate weekly report" | governance_report | weekly |
| "Check compliance" | governance_report | compliance |
| "Set up test baseline" | test_baseline | create |
| "Check test coverage" | test_baseline | compare |
| "Configure Claude Code" | claude_config | all |

### Example Conversations

**User**: "My build is about to go to production. Can you run all the quality checks?"

**Claude**: I'll run a comprehensive quality check for your production build.

1. Checking for code drift...
2. Analyzing dependencies for circular issues...
3. Comparing test coverage against baseline...
4. Generating compliance report...

[Results displayed]

---

**User**: "We're starting a new sprint. Help me set up fresh baselines."

**Claude**: I'll create new baselines for your sprint start.

1. Creating code quality baseline...
2. Creating test coverage baseline...
3. Generating initial quality report...

Your baselines are ready. I recommend running `drift_detection detect` at the end of each day to track progress.

---

## Common Patterns

### Pattern 1: Gate Check (Blocking)

Use before merging to enforce quality:

```json
// Run all checks - fail if any issues
[
  { "tool": "drift_detection", "action": "detect" },
  { "tool": "dependency_analyze", "scope": "circular" },
  { "tool": "test_baseline", "action": "compare" }
]
```

### Pattern 2: Report Generation (Non-blocking)

Use for visibility without blocking:

```json
[
  { "tool": "governance_report", "reportType": "quality" },
  { "tool": "drift_detection", "action": "trends" }
]
```

### Pattern 3: Cleanup Workflow

Use during maintenance windows:

```json
[
  { "tool": "pattern_standardize", "action": "run" },
  { "tool": "dependency_analyze", "scope": "unused" },
  { "tool": "drift_detection", "action": "create-baseline" }
]
```

### Pattern 4: CI/CD Pipeline

```json
// Stage 1: Quality Gate
{ "tool": "drift_detection", "action": "detect" }

// Stage 2: Pattern Check
{ "tool": "pattern_standardize", "action": "check" }

// Stage 3: Dependency Check
{ "tool": "monorepo_manage", "action": "check-deps" }

// Stage 4: Coverage Check
{ "tool": "test_baseline", "action": "compare" }

// Stage 5: Report
{ "tool": "governance_report", "reportType": "compliance" }
```

---

*Wundr MCP Tools Usage Examples v1.0.0*
