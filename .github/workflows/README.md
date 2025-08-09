# 🔄 GitHub Actions CI/CD Workflows

## Overview

This directory contains enterprise-grade GitHub Actions workflows for the Wundr project, providing comprehensive continuous integration, delivery, and deployment capabilities.

## Workflows

### 1. 🔄 Enterprise CI/CD Pipeline (`enterprise-ci.yml`)

**Triggers:**
- Push to `main`, `master`, or `develop` branches
- Pull requests to `main` or `master`
- Merge queue events

**Features:**
- **Multi-Node Support**: Tests on Node.js 18 and 20
- **Quality Gates**: TypeScript compilation, ESLint, Prettier
- **Test Suite**: Unit, integration, and E2E tests with sharding
- **Security Scanning**: Dependency audit and CodeQL analysis
- **Performance Testing**: Benchmarks with trend analysis
- **Smart Caching**: Optimized dependency and artifact caching
- **Parallel Execution**: Maximum efficiency with job parallelization

**Jobs:**
1. `setup-matrix` - Dynamic version detection and change analysis
2. `quality-gates` - Code quality checks across Node versions
3. `test-suite` - Comprehensive testing with coverage reporting
4. `e2e-tests` - End-to-end testing with Playwright (multiple browsers)
5. `security-scan` - Security vulnerability and code analysis
6. `performance-benchmarks` - Performance regression testing
7. `deployment-readiness` - Readiness assessment with quality scoring
8. `notify-status` - Slack/email notifications
9. `cleanup` - Artifact cleanup and summary

### 2. 🚀 Enterprise Release Pipeline (`enterprise-release.yml`)

**Triggers:**
- Git tags matching `v*.*.*` or `*.*.*`
- GitHub releases (published/released)
- Manual workflow dispatch with release type selection

**Features:**
- **Multi-Package Support**: Handles monorepo package publishing
- **Version Management**: Automatic version generation and updating
- **Security Validation**: Comprehensive security audits before release
- **Multi-Registry Support**: NPM and Docker Hub publishing
- **Release Assets**: Automated GitHub release creation with artifacts
- **Rollback Safety**: Dry-run support and validation steps

**Jobs:**
1. `release-validation` - Validate release conditions and generate metadata
2. `comprehensive-testing` - Full test suite validation
3. `security-audit` - Security and license compliance checks
4. `create-github-release` - GitHub release with assets and checksums
5. `npm-publish` - Multi-package NPM publishing with matrix strategy
6. `docker-release` - Multi-arch Docker image building and pushing
7. `post-release-validation` - Verify published packages and images
8. `notification-hub` - Team notifications and success reporting

### 3. 🔄 Dependency Updates (`dependency-update.yml`)

**Triggers:**
- Weekly schedule (Mondays at 9 AM UTC)
- Manual workflow dispatch with update type selection

**Features:**
- **Smart Updates**: Patch, minor, major, or comprehensive updates
- **Automated Testing**: Full test suite validation after updates
- **Pull Request Creation**: Automated PRs with detailed summaries
- **Security Integration**: Security audit after dependency updates
- **Team Notifications**: Alert on security issues or update failures

## Security Features

### CodeQL Configuration
- Custom query suites for enhanced security scanning
- Path-based analysis focusing on source code
- Exclusion of test files and build artifacts
- Security-experimental queries for cutting-edge detection

### Dependency Security
- Regular security audits with configurable severity levels
- Automated security issue creation for critical vulnerabilities
- License compliance checking with prohibited license detection
- Vulnerability trend tracking and reporting

## Performance Optimizations

### Caching Strategy
- **pnpm Cache**: Dependency caching with lockfile validation
- **Turbo Cache**: Build cache for monorepo optimization
- **GitHub Actions Cache**: Artifact and intermediate result caching
- **Docker Layer Caching**: Multi-stage build optimization

### Parallel Execution
- **Job Parallelization**: Independent jobs run concurrently
- **Matrix Strategies**: Multi-version and multi-package parallelism
- **Test Sharding**: E2E tests split across multiple runners
- **Smart Dependencies**: Minimal job dependencies for maximum parallelism

## Notification System

### Slack Integration
- Real-time CI/CD status updates
- Release announcements with detailed metrics
- Failure alerts with actionable information
- Custom channels for different event types

### Email Notifications
- Critical failure notifications to team members
- Release summaries with installation instructions
- Security alert notifications
- Deployment readiness reports

## Configuration

### Required Secrets
```yaml
# NPM Publishing
NPM_TOKEN: "npm_token_here"

# Docker Publishing
DOCKER_USERNAME: "docker_username"
DOCKER_PASSWORD: "docker_password"

# Notifications
SLACK_WEBHOOK_URL: "slack_webhook_url"
EMAIL_USERNAME: "smtp_username"
EMAIL_PASSWORD: "smtp_password"
EMAIL_RECIPIENTS: "team@company.com"
TEAM_EMAIL: "releases@company.com"

# Optional
CODECOV_TOKEN: "codecov_token"
GITHUB_PROJECT_TOKEN: "project_token"
TURBO_TOKEN: "turbo_cache_token"
```

### Environment Variables
```yaml
# Turborepo
TURBO_TEAM: "your_team_name"

# Optional customizations
NODE_ENV: "production"
CI: true
FORCE_COLOR: 1
```

## Status Badges

The following status badges are automatically updated and displayed in the README:

- **CI/CD Pipeline**: Shows the status of the main CI/CD workflow
- **Release Pipeline**: Shows the status of the release workflow
- **Code Coverage**: Displays test coverage percentage from Codecov
- **CodeQL Security**: Shows security scanning status
- **Build Status**: Current build health indicator
- **Dependency Status**: Dependency update and security status

## Monitoring and Metrics

### Quality Scoring
The deployment readiness job calculates a quality score based on:
- **Quality Gates** (40 points): TypeScript, linting, formatting
- **Test Suite** (40 points): Unit and integration test results
- **Security Scan** (20 points): Vulnerability and code analysis

### Performance Tracking
- Benchmark results stored and tracked over time
- Performance regression detection with configurable thresholds
- Build time optimization tracking
- Resource usage monitoring

## Troubleshooting

### Common Issues

1. **TypeScript Compilation Errors**
   - Check project references in `tsconfig.json`
   - Ensure `composite: true` for referenced projects
   - Verify import paths and module resolution

2. **Test Failures**
   - Review test logs in workflow artifacts
   - Check for environment-specific issues
   - Verify test data and mock configurations

3. **Build Failures**
   - Check Turborepo cache status
   - Verify package.json scripts
   - Review dependency installation logs

4. **Security Scan Issues**
   - Update vulnerable dependencies
   - Review CodeQL alerts in Security tab
   - Check license compliance reports

### Debugging Steps

1. **Check Workflow Logs**: Review detailed logs in GitHub Actions
2. **Download Artifacts**: Download test results and reports
3. **Local Reproduction**: Run commands locally with same Node version
4. **Cache Issues**: Clear GitHub Actions cache if needed
5. **Matrix Failures**: Check specific Node version or package failures

## Maintenance

### Regular Tasks
- Review and update Node.js versions in matrix
- Update action versions (dependabot recommended)
- Monitor performance benchmarks and adjust thresholds
- Review security scan results and update exclusions
- Update notification channels and recipients

### Quarterly Reviews
- Assess workflow performance and optimization opportunities
- Review security configuration and update threat models
- Evaluate new GitHub Actions features and integrations
- Update documentation and troubleshooting guides

## Best Practices

1. **Branch Protection**: Configure branch protection rules requiring CI checks
2. **Merge Policies**: Require passing CI before merge to main branches
3. **Secret Management**: Use GitHub secrets, never hardcode sensitive values
4. **Artifact Retention**: Configure appropriate retention periods for cost optimization
5. **Concurrent Limits**: Monitor and adjust concurrency limits for resource management

## Support

For issues with these workflows:

1. Check the [GitHub Actions documentation](https://docs.github.com/en/actions)
2. Review workflow logs and artifacts
3. Consult the project's troubleshooting documentation
4. Create an issue in the project repository with workflow logs
5. Contact the platform team for enterprise-specific configurations

---

**Note**: These workflows are designed for enterprise-grade development with comprehensive testing, security, and deployment capabilities. Customize as needed for your specific requirements.