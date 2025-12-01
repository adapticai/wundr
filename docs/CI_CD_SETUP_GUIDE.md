# CI/CD Setup Guide

This guide provides comprehensive instructions for setting up the complete CI/CD pipeline for Wundr.

## 🚀 Quick Start

1. **Enable GitHub Actions**: Ensure GitHub Actions are enabled for your repository
2. **Set up secrets**: Configure required secrets in GitHub repository settings
3. **Configure environments**: Set up deployment environments
4. **Install dependencies**: Run the initial setup
5. **Test workflows**: Trigger a test workflow run

## 🔐 Required Secrets

Configure these secrets in your GitHub repository settings
(`Settings > Secrets and variables > Actions`):

### Core Secrets

```bash
# NPM Publishing
NPM_TOKEN=npm_xxxxxxxxxxxxxxxx

# Docker Registry (GitHub Container Registry)
GHCR_TOKEN=${{ secrets.GITHUB_TOKEN }}  # Automatically available

# Database
DATABASE_URL=postgresql://user:password@host:port/database
POSTGRES_PASSWORD=your_postgres_password

# Cache/Session Store
REDIS_URL=redis://host:port
REDIS_PASSWORD=your_redis_password

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-char-encryption-key-here
```

### Cloud Provider Secrets

#### AWS (if using AWS deployment)

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

#### Vercel (if using Vercel deployment)

```bash
VERCEL_TOKEN=...
VERCEL_ORG_ID=...
VERCEL_PROJECT_ID=...
```

#### Railway (if using Railway deployment)

```bash
RAILWAY_TOKEN=...
```

### Monitoring & Notifications

```bash
# Codecov (for code coverage)
CODECOV_TOKEN=...

# Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Email notifications (for Let's Encrypt)
ACME_EMAIL=admin@yourdomain.com
```

### Kubernetes (if using K8s deployment)

```bash
# Base64 encoded kubeconfig
KUBE_CONFIG=...

# Or individual cluster credentials
K8S_CLUSTER_ENDPOINT=https://...
K8S_CLUSTER_TOKEN=...
K8S_CLUSTER_CA_CERT=...
```

## 🌍 Environment Variables

Configure these in GitHub repository settings (`Settings > Secrets and variables > Actions` >
`Variables` tab):

```bash
# Repository settings
DOMAIN_NAME=wundr.yourdomain.com
AWS_REGION=us-east-1
STORAGE_CLASS=gp2
DATA_STORAGE_SIZE=10Gi
LOGS_STORAGE_SIZE=5Gi

# Environment-specific settings
GRAFANA_USER=admin
LOG_LEVEL=info
REPLICAS=3

# Remote monitoring (optional)
REMOTE_WRITE_URL=https://prometheus.example.com/api/v1/write
REMOTE_WRITE_USERNAME=...
# Note: REMOTE_WRITE_PASSWORD should be a secret
```

## 🏗️ Workflow Overview

Our CI/CD pipeline consists of several interconnected workflows:

### 1. Modern CI Pipeline (`ci-modern.yml`)

- **Triggers**: Push, PR, manual dispatch
- **Features**: Multi-OS testing, security audit, performance benchmarks
- **Status checks**: Required for branch protection

### 2. Release Automation (`release-automation.yml`)

- **Triggers**: Push to main, manual dispatch
- **Features**: Changesets integration, automated versioning, npm publishing
- **Outputs**: GitHub releases, Docker images, notifications

### 3. Deployment (`deploy.yml`)

- **Triggers**: Release published, manual dispatch
- **Features**: Multi-environment deployment, rollback capability, health checks
- **Environments**: Development, staging, production

### 4. Dependency Management (`dependencies.yml`)

- **Triggers**: Schedule (weekly), manual dispatch
- **Features**: Security audits, automated updates, license compliance
- **Outputs**: Automated PRs for updates

### 5. Performance Monitoring (`monitoring.yml`)

- **Triggers**: Push, PR, schedule (daily), manual dispatch
- **Features**: Benchmarks, memory profiling, load testing, security scans
- **Outputs**: Performance reports, trend analysis

### 6. Branch Protection (`branch-protection.yml`)

- **Triggers**: Push to main, manual dispatch
- **Features**: Automated protection setup, team management, templates
- **Outputs**: Repository configuration, team assignments

## 🔧 Setup Instructions

### Step 1: Repository Configuration

1. **Enable GitHub Actions**:

   ```bash
   # In repository Settings > Actions > General
   # Allow all actions and reusable workflows
   ```

2. **Configure branch protection**:
   - Run the branch protection workflow manually
   - Or apply settings manually in repository settings

### Step 2: Environment Setup

1. **Create environments**:

   ```bash
   # Navigate to Settings > Environments
   # Create: development, staging, production
   # Configure protection rules and reviewers
   ```

2. **Set up deployment targets**:
   - Configure cloud provider credentials
   - Set up Kubernetes clusters (if applicable)
   - Configure domain names and SSL certificates

### Step 3: Dependencies Setup

1. **Install changesets**:

   ```bash
   npm install -g @changesets/cli
   npx changeset init
   ```

2. **Configure package.json scripts**:
   ```json
   {
     "scripts": {
       "changeset": "changeset",
       "version-packages": "changeset version",
       "release": "pnpm build && changeset publish",
       "benchmark": "node scripts/benchmark.js"
     }
   }
   ```

### Step 4: Monitoring Setup

1. **Configure Prometheus**:

   ```bash
   # Copy monitoring/prometheus.yml to your monitoring setup
   # Adjust targets for your environment
   ```

2. **Set up Grafana dashboards**:
   ```bash
   # Import dashboards from monitoring/grafana/dashboards/
   # Configure data sources
   ```

## 📋 Workflow Triggers

### Automatic Triggers

| Workflow               | Trigger                  | Frequency                 |
| ---------------------- | ------------------------ | ------------------------- |
| CI Pipeline            | Push/PR to main branches | On demand                 |
| Dependency Updates     | Schedule                 | Weekly (Mondays 9:00 UTC) |
| Performance Monitoring | Schedule                 | Daily (2:00 UTC)          |
| Security Scans         | Push to main             | On demand                 |

### Manual Triggers

All workflows support `workflow_dispatch` for manual execution with custom parameters.

## 🚦 Status Checks

The following status checks are required for branch protection:

- ✅ **CI Status Summary** - Overall CI pipeline status
- ✅ **Quality Checks** - Linting, formatting, type checking
- ✅ **Test Suite** - Unit, integration, and E2E tests
- ✅ **Security Audit** - Dependency vulnerabilities
- ✅ **Docker Build** - Container build and test
- ✅ **Build Validation** - Project build and structure validation

## 🔄 Release Process

### Automatic Releases (Recommended)

1. **Create changeset**:

   ```bash
   npx changeset
   # Select packages and change type (patch/minor/major)
   # Write meaningful description
   ```

2. **Commit and push**:

   ```bash
   git add .changeset/
   git commit -m "feat: add new analysis feature"
   git push
   ```

3. **Review release PR**:
   - Changesets bot creates a release PR
   - Review generated changelog
   - Merge when ready

4. **Automatic publishing**:
   - Release workflow triggers automatically
   - Publishes to npm
   - Creates GitHub release
   - Deploys to production

### Manual Releases

```bash
# Trigger manual release
gh workflow run release-automation.yml \
  -f release_type=minor \
  -f dry_run=false
```

## 🚀 Deployment Process

### Automatic Deployment

- **Production**: Triggered by GitHub releases
- **Staging**: Triggered by pushes to main branch
- **Development**: Triggered by pushes to develop branch

### Manual Deployment

```bash
# Deploy to specific environment
gh workflow run deploy.yml \
  -f environment=staging \
  -f version=v1.2.3
```

### Rollback

```bash
# Emergency rollback
gh workflow run deploy.yml \
  -f environment=production \
  -f rollback=true
```

## 📊 Monitoring & Alerts

### Performance Monitoring

- **Benchmarks**: Automated performance regression detection
- **Memory profiling**: Memory usage analysis
- **Load testing**: API endpoint stress testing
- **Security scanning**: Vulnerability detection

### Health Checks

- **Application health**: `/health` endpoint monitoring
- **Database connectivity**: Connection pool status
- **External dependencies**: API availability checks

### Alerts

Configure alerts in your monitoring system for:

- Performance degradation (>150% baseline)
- High error rates (>1%)
- Security vulnerabilities (critical/high)
- Deployment failures
- Resource exhaustion

## 🛠️ Troubleshooting

### Common Issues

1. **Workflow fails with permissions error**:

   ```bash
   # Check repository settings > Actions > General
   # Ensure "Read and write permissions" are enabled
   ```

2. **Branch protection conflicts**:

   ```bash
   # Temporarily disable protection rules
   # Apply changes
   # Re-enable protection
   ```

3. **Secrets not available in workflows**:
   ```bash
   # Ensure secrets are set at repository level
   # Check environment restrictions
   # Verify secret names match exactly
   ```

### Debug Workflows

Enable debug logging:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Manual Workflow Debugging

```bash
# List workflow runs
gh run list --workflow=ci-modern.yml

# View run details
gh run view [run-id]

# Download logs
gh run download [run-id]
```

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes Deployment Guide](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)

## 🤝 Support

For issues with the CI/CD pipeline:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review workflow run logs
3. Open an issue using the bug report template
4. Contact the DevOps team

---

**Next Steps**: After completing the setup, run the branch protection workflow to apply all
configurations automatically.
