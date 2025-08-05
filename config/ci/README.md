# CI/CD Configuration Documentation

This directory contains configuration files and documentation for the Continuous Integration and Continuous Deployment (CI/CD) workflows used in the Monorepo Refactoring Toolkit.

## Overview

The CI/CD system is built on GitHub Actions and provides comprehensive automation for:

- **Code Quality Assurance**: Automated testing, linting, and validation
- **Drift Detection**: Continuous monitoring for code quality regression
- **Refactor Quality Checks**: Specialized validation for refactoring pull requests
- **Progress Reporting**: Automated weekly progress reports
- **Release Management**: Automated versioning and release processes

## Workflow Files

### GitHub Actions Workflows (`.github/workflows/`)

| Workflow | Purpose | Triggers | Description |
|----------|---------|----------|-------------|
| `drift-detection.yml` | Code drift monitoring | PR, Schedule, Manual | Detects code quality drift and creates actionable reports |
| `refactor-check.yml` | Refactor PR validation | PR (refactor), Manual | Validates refactoring changes and ensures quality improvements |
| `weekly-report.yml` | Progress reporting | Schedule (weekly), Manual | Generates comprehensive weekly progress reports |
| `build.yml` | Build validation | Push, PR | Validates project structure, linting, and TypeScript compilation |
| `test.yml` | Test execution | Push, PR, Manual | Runs unit tests, integration tests, and functionality validation |
| `release.yml` | Release automation | Tags, Manual | Automates release creation, artifact building, and distribution |

### Configuration Files (This Directory)

| File | Purpose | Used By |
|------|---------|---------|
| `drift-detection.yml` | Drift detection settings | `drift-detection.yml` workflow |
| `refactor-check.yml` | Refactor validation settings | `refactor-check.yml` workflow |
| `weekly-report.yml` | Weekly report settings | `weekly-report.yml` workflow |

## Workflow Details

### 1. Drift Detection (`drift-detection.yml`)

**Purpose**: Continuously monitor code quality and detect when the codebase drifts from established standards.

**Key Features**:
- Runs comprehensive code analysis on PRs and scheduled intervals
- Compares current state against quality thresholds
- Creates GitHub issues for critical drift
- Generates consolidation batches for remediation
- Comments on PRs with analysis results

**Configuration**: See `drift-detection.yml` for threshold settings, analysis depth, and notification preferences.

**Triggers**:
- Pull requests to master/main
- Daily at 2 AM UTC (scheduled)
- Manual dispatch with configurable analysis depth

### 2. Refactor Quality Check (`refactor-check.yml`)

**Purpose**: Ensure refactoring pull requests actually improve code quality.

**Key Features**:
- Automatically detects refactoring PRs based on keywords and labels
- Runs before/after analysis to measure improvements
- Validates that refactoring doesn't break imports or create circular dependencies
- Assigns quality grades (A-F) based on improvements
- Blocks merge if quality regressions are detected

**Configuration**: See `refactor-check.yml` for keyword detection, scoring weights, and quality thresholds.

**Triggers**:
- Pull requests with refactoring keywords or labels
- Manual dispatch with PR number

### 3. Weekly Progress Report (`weekly-report.yml`)

**Purpose**: Generate comprehensive weekly reports on refactoring progress.

**Key Features**:
- Analyzes Git activity (commits, contributors, file changes)
- Tracks pull request activity and categorizes refactoring PRs
- Runs comprehensive code analysis for current state
- Compares metrics week-over-week for trend analysis
- Creates GitHub issues with detailed reports
- Calculates activity and progress scores

**Configuration**: See `weekly-report.yml` for scoring weights, report content, and notification settings.

**Triggers**:
- Weekly on Sundays at 9 AM UTC
- Manual dispatch with configurable report period

### 4. Build Validation (`build.yml`)

**Purpose**: Validate project structure, code quality, and compilation.

**Key Features**:
- Validates required directory and file structure
- Runs ESLint and Prettier checks
- Performs TypeScript compilation validation
- Tests shell script syntax
- Validates JSON/YAML configuration files
- Sets commit status for PR validation

**Triggers**:
- Push to master/main/develop branches
- Pull requests
- Manual dispatch

### 5. Test Suite (`test.yml`)

**Purpose**: Execute comprehensive test suite including unit, integration, and functionality tests.

**Key Features**:
- Runs existing unit tests with coverage reporting
- Tests script functionality with real data
- Validates analysis workflow end-to-end
- Checks documentation completeness
- Provides configurable test scope (unit, integration, full)

**Triggers**:
- Push to master/main/develop branches
- Pull requests
- Manual dispatch with test scope selection

### 6. Release Automation (`release.yml`)

**Purpose**: Automate the release process with proper versioning and artifact creation.

**Key Features**:
- Validates version format and availability
- Generates release notes from commit history
- Creates comprehensive release artifacts
- Runs full test suite before release
- Creates GitHub releases with proper assets
- Handles both stable and pre-release versions
- Cleans up old pre-releases

**Triggers**:
- Git tags matching `v*` pattern
- Manual dispatch with version specification

## Configuration Management

### Environment Variables

Common environment variables used across workflows:

```yaml
env:
  NODE_VERSION: '18'              # Node.js version for consistency
  ANALYSIS_OUTPUT_DIR: 'analysis' # Output directory for analysis results
  CACHE_VERSION: 'v1'             # Cache versioning for invalidation
```

### Secrets and Permissions

Required GitHub repository settings:

**Permissions** (GitHub Actions):
- `contents: read/write` - For checking out code and creating releases
- `issues: write` - For creating issues and comments
- `pull-requests: write` - For commenting on PRs
- `actions: read` - For reading workflow information

**Branch Protection** (Recommended):
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include these status checks:
  - `build-validation`
  - `refactor-quality-check` (for refactor PRs)
  - Test suite completion

### Artifact Management

**Retention Policies**:
- Analysis artifacts: 30 days
- Test results: 7 days
- Release artifacts: 90 days
- Weekly reports: 90 days

**Storage Locations**:
- Workflow artifacts: GitHub Actions artifacts
- Historical data: `.github/data/` directory
- Release assets: GitHub Releases

## Best Practices

### 1. Workflow Optimization

- **Caching**: Aggressive caching of npm dependencies and TypeScript builds
- **Parallel Execution**: Jobs run in parallel where possible
- **Conditional Execution**: Skip unnecessary work based on file changes
- **Timeouts**: All analysis operations have reasonable timeouts

### 2. Error Handling

- **Graceful Degradation**: Workflows continue with partial results if some steps fail
- **Clear Error Messages**: Descriptive error messages with actionable guidance
- **Status Reporting**: Proper commit status updates for PR validation

### 3. Security

- **Minimal Permissions**: Each workflow has minimal required permissions
- **No Secrets in Logs**: Sensitive information is properly masked
- **Input Validation**: User inputs are validated before use

### 4. Maintainability

- **Configuration Files**: Centralized configuration for easy maintenance
- **Documentation**: Comprehensive inline documentation
- **Versioning**: Workflows use pinned action versions for stability

## Troubleshooting

### Common Issues

**1. Analysis Timeouts**
- **Cause**: Large codebase or complex analysis
- **Solution**: Reduce analysis scope or increase timeout values in configuration

**2. Test Failures in CI**
- **Cause**: Environment differences or missing dependencies
- **Solution**: Check dependency installation and environment setup

**3. Release Workflow Failures**
- **Cause**: Version conflicts or missing permissions
- **Solution**: Verify version format and repository permissions

**4. Drift Detection False Positives**
- **Cause**: Threshold settings too strict
- **Solution**: Adjust thresholds in `drift-detection.yml` configuration

### Debugging Workflows

**Enable Debug Logging**:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

**Check Workflow Logs**:
1. Go to Actions tab in GitHub repository
2. Select the failed workflow run
3. Expand failed steps to see detailed logs
4. Look for error messages and stack traces

**Test Locally**:
```bash
# Test scripts locally before pushing
./scripts/analysis/analyze-all.sh .
npx ts-node scripts/analysis/enhanced-ast-analyzer.ts
```

## Customization

### Adding New Workflows

1. Create workflow file in `.github/workflows/`
2. Add corresponding configuration file in `config/ci/`
3. Update this README with documentation
4. Test thoroughly before merging

### Modifying Existing Workflows

1. Update workflow file and/or configuration
2. Test changes on a feature branch
3. Verify all triggers and edge cases work correctly
4. Update documentation as needed

### Integration with External Tools

The workflows are designed to be extensible. You can integrate with:

- **Slack/Teams**: Add webhook notifications
- **JIRA/Linear**: Create issues automatically
- **SonarQube**: Add code quality checks
- **Deployment Systems**: Trigger deployments on releases

## Support and Maintenance

For questions or issues with the CI/CD system:

1. Check the troubleshooting section above
2. Review workflow logs for specific error messages  
3. Consult the configuration files for available options
4. Create an issue in the repository with detailed information

The CI/CD system is designed to be self-maintaining with automatic cleanup and error recovery, but periodic review and updates are recommended to ensure optimal performance.