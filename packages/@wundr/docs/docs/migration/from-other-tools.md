# Migration from Other Tools

This guide helps you migrate from existing code analysis and refactoring tools to Wundr. We'll cover
common migration scenarios and provide step-by-step instructions for a smooth transition.

## Supported Migration Paths

Wundr provides automated migration assistance for:

- **ESLint + Prettier** configurations
- **SonarQube** quality profiles
- **CodeClimate** analysis rules
- **Semgrep** custom rules
- **PMD/SpotBugs** Java analysis
- **RuboCop** Ruby analysis
- **TSLint** (legacy TypeScript)

## Pre-Migration Checklist

Before starting your migration:

- [ ] **Backup your current configuration** files
- [ ] **Document custom rules** and patterns
- [ ] **Export existing reports** for comparison
- [ ] **Identify team dependencies** on current tools
- [ ] **Plan downtime** for CI/CD pipeline updates

## ESLint + Prettier Migration

### Current Setup Analysis

First, let's analyze your existing ESLint configuration:

```bash
# Analyze existing ESLint config
npx wundr migrate analyze-eslint

# Output example:
# 🔍 Found ESLint configuration:
# ├── .eslintrc.js (158 rules)
# ├── .prettierrc (12 formatting rules)
# ├── Custom rules: 23
# └── Shared configs: @typescript-eslint, airbnb
```

### Automated Migration

Run the migration wizard:

```bash
npx wundr migrate from-eslint --interactive
```

This will:

1. **Convert ESLint rules** to Wundr patterns
2. **Import Prettier settings** as formatting rules
3. **Preserve custom rules** with equivalent Wundr patterns
4. **Generate migration report** showing what changed

### Manual Configuration

For complex setups, you may need manual adjustments:

```javascript
// wundr.config.js - Generated from ESLint
module.exports = {
  extends: ['@wundr/recommended'],
  rules: {
    // Converted from ESLint rules
    complexity: ['error', { max: 10 }],
    'max-lines': ['warn', { max: 300 }],
    'no-duplicate-imports': 'error',

    // Custom Wundr patterns
    'wundr/no-wrapper-services': 'error',
    'wundr/prefer-composition': 'warn',
    'wundr/enforce-patterns': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        complexity: 'off',
      },
    },
  ],
};
```

### Team Migration Strategy

1. **Phase 1: Parallel Running** (1-2 weeks)

   ```bash
   # Run both tools during transition
   npm run lint:eslint  # Keep existing
   npm run lint:wundr   # Add new
   ```

2. **Phase 2: Team Training** (1 week)
   - Train team on Wundr dashboard
   - Update development workflows
   - Adjust IDE configurations

3. **Phase 3: Full Switch** (1 week)

   ```bash
   # Remove ESLint dependencies
   npm uninstall eslint @typescript-eslint/eslint-plugin

   # Update scripts
   npm pkg set scripts.lint="wundr analyze"
   npm pkg set scripts.fix="wundr fix --auto"
   ```

## SonarQube Migration

### Export SonarQube Configuration

```bash
# Export quality profile
curl -u admin:admin \
  "http://sonarqube.company.com/api/qualityprofiles/export?language=ts&qualityProfile=Company%20Profile" \
  -o sonar-profile.xml

# Import into Wundr
npx wundr migrate from-sonar --profile sonar-profile.xml
```

### Rule Mapping

Wundr automatically maps SonarQube rules:

| SonarQube Rule               | Wundr Pattern          | Notes                  |
| ---------------------------- | ---------------------- | ---------------------- |
| `cognitive-complexity`       | `complexity.cognitive` | Direct mapping         |
| `duplicated-string-literals` | `duplicates.strings`   | Enhanced detection     |
| `unused-imports`             | `imports.unused`       | Includes type imports  |
| `parameter-number`           | `parameters.max-count` | Configurable threshold |

### Quality Gate Migration

```yaml
# .wundr/quality-gates.yml - Generated from SonarQube
gates:
  coverage:
    minimum: 80 # From SonarQube gate
    severity: error

  duplicates:
    threshold: 3 # From SonarQube duplication threshold
    severity: error

  complexity:
    cognitive: 15 # From SonarQube cognitive complexity
    cyclomatic: 10 # From SonarQube cyclomatic complexity

  maintainability:
    rating: B # Convert SonarQube rating to percentage
    minimum: 70
```

## CodeClimate Migration

### Configuration Import

```bash
# Import CodeClimate configuration
npx wundr migrate from-codeclimate --config .codeclimate.yml

# Example .codeclimate.yml conversion:
# version: "2"
# checks:
#   argument-count:
#     config:
#       threshold: 4
#   complex-logic:
#     config:
#       threshold: 4
```

Converts to Wundr:

```json
{
  "rules": {
    "parameters.max-count": ["error", { "max": 4 }],
    "complexity.cognitive": ["error", { "max": 4 }]
  }
}
```

## Custom Rules Migration

### Rule Conversion Patterns

Most custom rules can be converted to Wundr patterns:

```javascript
// ESLint custom rule
module.exports = {
  rules: {
    'no-direct-db-access': {
      create(context) {
        return {
          MemberExpression(node) {
            if (node.object.name === 'db' && node.property.name === 'collection') {
              context.report({
                node,
                message: 'Direct database access is not allowed',
              });
            }
          },
        };
      },
    },
  },
};

// Wundr pattern equivalent
module.exports = {
  patterns: {
    'no-direct-db-access': {
      description: 'Prevent direct database access',
      pattern: 'db.collection(*)',
      severity: 'error',
      message: 'Use repository pattern instead of direct DB access',
      suggestion: 'Create a repository class for database operations',
    },
  },
};
```

### Complex Rule Migration

For complex AST-based rules:

```bash
# Generate Wundr pattern from ESLint rule
npx wundr migrate convert-rule \
  --input custom-eslint-rule.js \
  --output wundr-pattern.js \
  --interactive
```

## CI/CD Pipeline Migration

### GitHub Actions

Replace ESLint action with Wundr:

```yaml
# Before (ESLint)
- name: Run ESLint
  run: npm run lint

- name: Run Prettier
  run: npm run format:check

# After (Wundr)
- name: Run Wundr Analysis
  run: npx wundr analyze --ci --format github

- name: Upload Analysis Report
  uses: actions/upload-artifact@v3
  with:
    name: wundr-analysis
    path: .wundr/reports/
```

### Jenkins Migration

```groovy
// Before
stage('Code Quality') {
    steps {
        sh 'npm run lint'
        sh 'npm run test:coverage'
        publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'coverage',
            reportFiles: 'index.html',
            reportName: 'Coverage Report'
        ])
    }
}

// After
stage('Wundr Analysis') {
    steps {
        sh 'npx wundr analyze --ci --format jenkins'
        sh 'npx wundr report --format html --output reports/'
        publishHTML([
            allowMissing: false,
            alwaysLinkToLastBuild: true,
            keepAll: true,
            reportDir: 'reports',
            reportFiles: 'index.html',
            reportName: 'Wundr Analysis'
        ])
    }
}
```

## Team Onboarding

### Training Materials

Create team-specific documentation:

```bash
# Generate migration guide for your team
npx wundr migrate generate-guide \
  --from eslint \
  --team-size 15 \
  --output docs/wundr-migration.md
```

### IDE Migration

**VS Code Extensions:**

- Uninstall: ESLint, Prettier
- Install: Wundr Code Analysis
- Update settings.json:

```json
{
  // Remove
  // "eslint.enable": true,
  // "editor.formatOnSave": true,

  // Add
  "wundr.enable": true,
  "wundr.analyzeOnSave": true,
  "wundr.showInlineHints": true
}
```

## Migration Validation

### Comparison Report

Generate a comparison between old and new analysis:

```bash
# Run comparison analysis
npx wundr migrate validate \
  --before-tool eslint \
  --before-results eslint-report.json \
  --after-results .wundr/reports/latest.json
```

### Quality Metrics Verification

Ensure quality metrics remain consistent:

```bash
# Compare quality metrics
npx wundr migrate compare-metrics \
  --baseline sonarqube-metrics.json \
  --current .wundr/metrics.json
```

## Rollback Plan

If issues arise during migration:

### Quick Rollback

```bash
# Restore previous configuration
git checkout HEAD~1 -- .eslintrc.js .prettierrc package.json

# Reinstall previous dependencies
npm install

# Restore CI configuration
git checkout HEAD~1 -- .github/workflows/
```

### Gradual Rollback

1. **Keep both systems** running temporarily
2. **Address specific issues** one by one
3. **Complete migration** when confidence is high

## Common Migration Issues

### Issue: Custom Rules Not Working

**Solution:** Convert custom rules to Wundr patterns:

```bash
# Debug rule conversion
npx wundr migrate debug-rule --rule custom-rule-name --verbose

# Manual conversion help
npx wundr migrate convert-help --rule-type eslint
```

### Issue: CI Pipeline Failures

**Solution:** Adjust quality gates during transition:

```bash
# Temporary relaxed gates
npx wundr config quality-gates --mode transition --duration 30d
```

### Issue: Team Resistance

**Solution:** Gradual introduction with clear benefits:

1. **Demonstrate value** with side-by-side comparisons
2. **Provide training** sessions and documentation
3. **Address concerns** individually
4. **Show productivity gains** with metrics

## Post-Migration Optimization

### Performance Tuning

```bash
# Optimize for your codebase
npx wundr optimize --analyze-performance --auto-tune

# Custom optimization
npx wundr config optimize \
  --cache-strategy aggressive \
  --parallel-analysis true \
  --ignore-patterns "**/__tests__/**"
```

### Advanced Features

Enable Wundr-specific features not available in other tools:

```bash
# Enable AI-powered suggestions
npx wundr config features --ai-suggestions true

# Enable dependency analysis
npx wundr config features --dependency-analysis true

# Enable architectural insights
npx wundr config features --architecture-analysis true
```

## Migration Success Metrics

Track these metrics to measure migration success:

- **Analysis Speed**: Compare runtime performance
- **Issue Detection**: Count of issues found vs. previous tool
- **False Positives**: Rate of incorrect issue detection
- **Team Productivity**: Developer satisfaction and workflow efficiency
- **Code Quality**: Overall quality trends post-migration

## Support During Migration

### Resources

- **[Migration Forum](https://github.com/adapticai/wundr/discussions/categories/migration)** -
  Community help
- **[Migration Office Hours](https://calendly.com/wundr/migration-help)** - Weekly support sessions
- **[Slack Channel](https://wundr.slack.com/channels/migration-support)** - Real-time assistance

### Professional Services

For enterprise migrations:

- **Migration assessment** and planning
- **Custom rule conversion** services
- **Team training** and workshops
- **CI/CD pipeline** setup assistance

Contact: [enterprise@wundr.io](mailto:enterprise@wundr.io)

## Summary

Migration to Wundr typically involves:

1. ✅ **Analysis** of current tool configuration
2. ✅ **Automated migration** with manual adjustments
3. ✅ **Parallel running** during transition period
4. ✅ **Team training** and workflow updates
5. ✅ **Validation** and optimization
6. ✅ **Full switch** with rollback plan

The migration usually takes 2-4 weeks for most teams, with minimal disruption to daily development
activities.

Ready to start your migration? [Contact our migration team](mailto:migration@wundr.io) for
personalized assistance! 🚀
