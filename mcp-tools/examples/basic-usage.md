# MCP Tools Basic Usage Examples

This file contains practical examples of using Wundr MCP tools with Claude Code.

## 🎯 Common Scenarios

### 1. Daily Code Quality Check

**Natural Language:**
```
"Good morning! Run my daily code quality check: detect drift, check dependencies, and show test coverage"
```

**What Claude Does:**
1. Runs drift detection against latest baseline
2. Checks for circular dependencies
3. Compares test coverage with baseline
4. Provides summary with actionable items

### 2. Pre-Commit Validation

**Natural Language:**
```
"I'm about to commit. Make sure my code meets all standards"
```

**What Claude Does:**
1. Runs pattern standardization (auto-fix)
2. Checks for drift violations
3. Validates test coverage threshold
4. Ensures no circular dependencies
5. Gives go/no-go recommendation

### 3. Weekly Maintenance

**Natural Language:**
```
"It's Friday. Run weekly maintenance: create new baseline, generate report, and clean up unused dependencies"
```

**What Claude Does:**
1. Creates new drift baseline
2. Archives old baseline
3. Generates weekly governance report
4. Identifies unused dependencies
5. Provides cleanup recommendations

## 📋 Step-by-Step Workflows

### Workflow 1: New Feature Development

```
Step 1: "I'm starting a new feature for user authentication"
Claude: Creates feature branch and sets up monitoring

Step 2: "Add a new auth-service package to the monorepo"
Claude: Uses monorepo_manage to create package structure

Step 3: "Check if my implementation follows our patterns"
Claude: Runs pattern_standardize in review mode

Step 4: "Fix any pattern violations automatically"
Claude: Applies standardization rules

Step 5: "Create tests and check coverage"
Claude: Runs tests and compares with baseline

Step 6: "Generate a report for my PR"
Claude: Creates governance report for the feature
```

### Workflow 2: Legacy Code Refactoring

```
Step 1: "Analyze dependencies in the legacy module"
Claude: Runs dependency analysis with graph output

Step 2: "Find and fix circular dependencies"
Claude: Identifies circles and suggests refactoring

Step 3: "Standardize error handling in legacy code"
Claude: Applies error handling patterns

Step 4: "Create a baseline before major refactoring"
Claude: Creates drift and test baselines

Step 5: "After refactoring, check what changed"
Claude: Compares against baseline and reports

Step 6: "Update baselines with improved metrics"
Claude: Updates baselines for future comparison
```

### Workflow 3: Monorepo Migration

```
Step 1: "Analyze my codebase for monorepo migration"
Claude: Runs analysis and generates report

Step 2: "Create a migration plan"
Claude: Uses monorepo_manage to create plan

Step 3: "Initialize monorepo structure"
Claude: Sets up directories and configs

Step 4: "Migrate services one by one"
Claude: Guides through each migration step

Step 5: "Check for issues after migration"
Claude: Validates dependencies and structure

Step 6: "Set up governance for the monorepo"
Claude: Creates baselines and standards
```

## 🔧 Advanced Examples

### Custom Pattern Rules

**Natural Language:**
```
"Apply only error handling and import standardization, show me what will change first"
```

**Tool Invocation:**
```javascript
pattern_standardize({
  action: "run",
  rules: ["consistent-error-handling", "import-ordering"],
  dryRun: true
})
```

### Targeted Dependency Analysis

**Natural Language:**
```
"Check for circular dependencies only in the services folder and create a visual graph"
```

**Tool Invocation:**
```javascript
dependency_analyze({
  scope: "circular",
  target: "src/services",
  outputFormat: "graph"
})
```

### Conditional Baseline Creation

**Natural Language:**
```
"If test coverage is above 85%, create a new baseline"
```

**Claude's Logic:**
1. First runs test_baseline compare
2. Checks if coverage > 85%
3. If true, creates new baseline
4. If false, provides improvement suggestions

## 💡 Pro Tips

### 1. Batch Operations
```
"Run all quality checks in parallel: drift, patterns, dependencies, and coverage"
```
Claude will execute all checks simultaneously for faster results.

### 2. Contextual Recommendations
```
"Based on the current state of the code, what should I focus on?"
```
Claude analyzes all metrics and provides prioritized recommendations.

### 3. Historical Analysis
```
"Show me how code quality has changed over the last month"
```
Claude uses trend analysis to show improvements or regressions.

### 4. Integration Validation
```
"Validate that my changes won't break anything in production"
```
Claude runs comprehensive checks including:
- Drift detection
- Dependency validation
- Test coverage verification
- Pattern compliance

## 🚀 Quick Commands Cheatsheet

| Task | Command |
|------|---------|
| Quick quality check | "Check code quality" |
| Fix all patterns | "Standardize everything" |
| Find problems | "What's wrong with my code?" |
| Pre-commit check | "Can I commit?" |
| Weekly maintenance | "Run weekly cleanup" |
| Monorepo health | "Check monorepo status" |
| Test validation | "Validate test coverage" |
| Dependency audit | "Audit dependencies" |
| Create configs | "Set up Claude Code" |
| Generate reports | "Create governance report" |

## 📊 Interpreting Results

### Drift Detection Severity Levels
- **None**: No issues, code is clean
- **Low**: Minor issues, fix at convenience
- **Medium**: Should fix before next release
- **High**: Fix in current sprint
- **Critical**: Block deployments, fix immediately

### Pattern Standardization Results
- **Green**: All patterns comply
- **Yellow**: Minor violations, auto-fixed
- **Red**: Manual intervention required

### Dependency Analysis Indicators
- **Circular**: Must fix, blocks builds
- **Unused**: Can remove, reduces size
- **Outdated**: Should update for security
- **Healthy**: No issues found

### Test Coverage Thresholds
- **>90%**: Excellent coverage
- **80-90%**: Good coverage
- **70-80%**: Acceptable, needs improvement
- **<70%**: Below standard, add tests

## 🎓 Learning Resources

1. **Interactive Tutorial**
   ```
   "Show me how to use MCP tools step by step"
   ```

2. **Best Practices Guide**
   ```
   "What are the best practices for using these tools?"
   ```

3. **Troubleshooting Help**
   ```
   "Help me debug why the tools aren't working"
   ```

4. **Custom Configuration**
   ```
   "Help me customize the tools for my project"
   ```