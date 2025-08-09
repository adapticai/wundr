# Quick Start Guide

Get up and running with Wundr in under 5 minutes. This guide will walk you through your first code analysis and help you understand the key features.

## Step 1: Install Wundr

If you haven't installed Wundr yet, follow our [Installation Guide](./installation.md).

Quick install:

```bash
npm install -g @wundr/cli
```

## Step 2: Run Your First Analysis

### Analyze Current Directory

Navigate to your project directory and run:

```bash
wundr analyze
```

This will:
- Scan all supported files in the current directory
- Generate a comprehensive analysis report
- Create visualizations and recommendations

### Analyze Specific Path

You can also analyze a specific directory or file:

```bash
wundr analyze ./src
wundr analyze ./src/components/UserProfile.tsx
```

## Step 3: Explore the Results

Wundr generates several outputs:

### Terminal Output

You'll see a summary in your terminal:

```
🔍 Wundr Analysis Complete

📊 Summary:
  Files Analyzed: 127
  Code Entities: 543
  Issues Found: 23
  Duplicates: 8 groups
  Circular Dependencies: 3

🎯 Top Issues:
  • High complexity in UserService.processData() (line 45)
  • Duplicate code block in utils/validation.ts
  • Circular dependency: components → services → components

📈 Quality Score: 78/100
```

### Interactive Report

Open the generated HTML report:

```bash
wundr serve
# Opens http://localhost:3000 in your browser
```

### JSON Report

For programmatic access:

```bash
wundr analyze --format json --output report.json
```

## Step 4: Understanding the Results

### Dashboard Overview

The main dashboard shows:
- **Quality Metrics**: Maintainability index, test coverage, technical debt
- **Code Distribution**: File types, sizes, complexity distribution
- **Issue Breakdown**: By severity, category, and type
- **Dependency Graph**: Visual representation of your code structure

### Key Sections

#### 🔍 **Analysis Entities**
Every class, function, component, and module in your codebase with metrics like:
- Complexity score
- Size and line count
- Dependencies and dependents
- Last modification date

#### 🚨 **Issues & Recommendations**
Categorized problems with:
- Severity levels (Critical, High, Medium, Low)
- Specific file locations and line numbers
- Actionable suggestions for improvement
- Auto-fix availability where possible

#### 🔄 **Duplicates**
Code duplication analysis showing:
- Similar code blocks across files
- Consolidation opportunities
- Similarity percentages
- Refactoring suggestions

#### 📈 **Dependencies**
Dependency analysis including:
- Circular dependency detection
- Unused imports and exports
- Dependency graph visualization
- Architecture insights

## Step 5: Take Action

### Fix High-Priority Issues

Start with critical and high-severity issues:

```bash
# Get detailed issue information
wundr issues --severity high

# Auto-fix where possible
wundr fix --auto --dry-run  # Preview changes
wundr fix --auto           # Apply fixes
```

### Address Duplicates

Review and consolidate duplicate code:

```bash
wundr duplicates --interactive
```

This opens an interactive mode to review and merge duplicates.

### Improve Architecture

Resolve circular dependencies:

```bash
wundr dependencies --circular --fix
```

## Step 6: Continuous Monitoring

### Set Up Git Hooks

Automatically analyze changes:

```bash
wundr setup --hooks
```

This adds pre-commit hooks to prevent quality regressions.

### CI/CD Integration

Add Wundr to your pipeline:

```yaml
# GitHub Actions example
- name: Code Quality Analysis
  run: |
    npm install -g @wundr/cli
    wundr analyze --ci --threshold 75
```

### Regular Reports

Schedule periodic analysis:

```bash
# Weekly report
wundr analyze --schedule weekly --email team@company.com
```

## Configuration Examples

### Basic Configuration

Create a `wundr.config.json`:

```json
{
  "analysis": {
    "patterns": ["src/**/*.{ts,tsx,js,jsx}"],
    "ignore": ["**/*.test.*", "**/*.spec.*"],
    "complexity": {
      "threshold": 10
    }
  },
  "reporting": {
    "format": "html",
    "includeCharts": true
  }
}
```

### Advanced Configuration

For larger projects:

```json
{
  "analysis": {
    "patterns": [
      "src/**/*.{ts,tsx}",
      "lib/**/*.ts",
      "components/**/*.tsx"
    ],
    "ignore": [
      "node_modules/**",
      "**/*.d.ts",
      "**/__tests__/**"
    ],
    "rules": {
      "duplicateDetection": {
        "enabled": true,
        "minLines": 5,
        "similarity": 0.8
      },
      "complexity": {
        "threshold": 15,
        "includeTests": false
      },
      "dependencies": {
        "detectCircular": true,
        "maxDepth": 10
      }
    }
  },
  "reporting": {
    "formats": ["html", "json", "pdf"],
    "output": "./reports",
    "charts": {
      "complexity": true,
      "dependencies": true,
      "trends": true
    }
  },
  "integrations": {
    "git": {
      "enabled": true,
      "includeHistory": true
    },
    "jira": {
      "enabled": false,
      "server": "https://company.atlassian.net",
      "project": "DEV"
    }
  }
}
```

## Common Use Cases

### React Project Analysis

```bash
wundr analyze \
  --patterns "src/**/*.{tsx,ts}" \
  --rules react,hooks,accessibility \
  --output react-analysis.html
```

### Node.js Backend Analysis

```bash
wundr analyze \
  --patterns "src/**/*.ts,lib/**/*.js" \
  --rules security,performance,architecture \
  --ignore "**/*.test.*"
```

### Monorepo Analysis

```bash
wundr analyze \
  --patterns "packages/*/src/**/*.ts" \
  --workspace-mode \
  --cross-package-analysis
```

## Interactive Features

### Web Dashboard

Launch the interactive dashboard:

```bash
wundr dashboard
```

Features:
- Real-time code navigation
- Interactive dependency graphs
- Drill-down analysis
- Team collaboration features

### VS Code Extension

With the VS Code extension installed:
- Inline issue highlighting
- Real-time analysis
- Quick fixes and refactoring
- Integration with source control

## Tips for Success

1. **Start Small**: Begin with a single module or component
2. **Set Realistic Thresholds**: Don't aim for perfection immediately
3. **Focus on High-Impact Issues**: Address critical and high-severity items first
4. **Monitor Trends**: Track quality metrics over time
5. **Team Integration**: Share reports and establish quality gates

## Next Steps

Now that you've completed your first analysis:

- [Configure Wundr](../configuration/overview.md) for your specific needs
- [Explore Advanced Features](../features/overview.md)
- [Set Up Team Workflows](../team/collaboration.md)
- [Integrate with CI/CD](../integrations/ci-cd.md)

## Getting Help

If you encounter issues:

- Check our [Troubleshooting Guide](../troubleshooting/common-issues.md)
- Browse [Frequently Asked Questions](../faq.md)
- Join our [Community Discord](https://discord.gg/wundr)
- Open an issue on [GitHub](https://github.com/adapticai/wundr/issues)