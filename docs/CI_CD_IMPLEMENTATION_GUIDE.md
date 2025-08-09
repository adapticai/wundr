# CI/CD Implementation Guide

This document provides a comprehensive guide for implementing and managing the Wundr CI/CD pipeline using GitHub Actions.

## Overview

The Wundr project implements a modern CI/CD pipeline with the following key components:

- **Continuous Integration (CI)**: Automated testing, security scanning, and quality gates
- **Continuous Deployment (CD)**: Automated deployments to staging and production
- **Release Management**: Automated versioning and release creation
- **Security Integration**: Comprehensive security scanning throughout the pipeline
- **Monitoring**: Continuous monitoring and alerting for deployed applications

## Workflow Structure

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `master` or `develop` branches
- Pull requests to `master`
- Manual dispatch

**Jobs:**
- **Security Scan**: Trivy vulnerability scanning
- **Build & Test Matrix**: Cross-platform testing (Ubuntu, macOS, Windows)
- **E2E Tests**: Playwright end-to-end testing
- **Quality Gates**: Code quality analysis and SonarCloud integration
- **Docker Build**: Container building and testing
- **Deployment Check**: Kubernetes manifest validation

### 2. CD Pipeline (`cd.yml`)

**Triggers:**
- Push to `master` branch
- Tagged releases (`v*.*.*`)
- Manual dispatch with environment selection

**Jobs:**
- **Build & Push**: Docker image building and registry publishing
- **Deploy Staging**: Automated staging deployment
- **Deploy Production**: Production deployment with manual approval
- **Rollback**: Automatic rollback on deployment failures

### 3. Release Workflow (`release.yml`)

**Triggers:**
- Push to `master` with changelog/package.json changes
- Manual dispatch with release type selection

**Jobs:**
- **Validate Release**: Determine if release is needed and calculate version
- **Create Release**: Generate changelog, create GitHub release
- **Publish NPM**: Publish packages to NPM registry
- **Publish Docker**: Build and publish Docker images
- **Deployment PR**: Create deployment pull request

### 4. Security Scanning (`security.yml`)

**Triggers:**
- Push/PR events
- Daily scheduled scans (2 AM UTC)
- Manual dispatch

**Jobs:**
- **CodeQL Analysis**: Static code analysis
- **Dependency Scan**: NPM audit and vulnerability checking
- **Container Security**: Docker image scanning
- **SAST**: Static Application Security Testing
- **Secret Scanning**: Detect exposed secrets
- **License Compliance**: License compatibility checking
- **IaC Security**: Infrastructure as Code security validation

### 5. Monitoring (`monitoring.yml`)

**Triggers:**
- Push to `master`
- Scheduled every 30 minutes
- Manual dispatch

**Jobs:**
- **Health Checks**: Application and API health monitoring
- **Performance Check**: Lighthouse audits and response time monitoring
- **Infrastructure Check**: Kubernetes cluster health
- **Database Check**: Database connectivity and metrics
- **Security Check**: Security headers and suspicious activity monitoring
- **Alert Manager**: Incident creation and notification aggregation

## Required Secrets

### GitHub Repository Secrets

Configure the following secrets in your GitHub repository settings:

#### AWS Deployment
```
AWS_ACCESS_KEY_ID         # AWS access key for staging
AWS_SECRET_ACCESS_KEY     # AWS secret key for staging
AWS_ACCESS_KEY_ID_PROD    # AWS access key for production
AWS_SECRET_ACCESS_KEY_PROD # AWS secret key for production
AWS_REGION                # AWS region (e.g., us-west-2)
EKS_CLUSTER_NAME          # EKS cluster name for staging
EKS_CLUSTER_NAME_PROD     # EKS cluster name for production
```

#### Registry & Publishing
```
GITHUB_TOKEN              # GitHub personal access token (auto-provided)
NPM_TOKEN                 # NPM registry publishing token
DOCKERHUB_USERNAME        # Docker Hub username
DOCKERHUB_TOKEN           # Docker Hub access token
```

#### Code Quality & Security
```
CODECOV_TOKEN            # Codecov integration token
SONAR_TOKEN              # SonarCloud integration token
GITGUARDIAN_API_KEY      # GitGuardian secret scanning token
```

#### Notifications
```
SLACK_WEBHOOK_URL        # Slack webhook for general notifications
SLACK_WEBHOOK_CRITICAL   # Slack webhook for critical alerts
```

## Environment Setup

### 1. GitHub Environments

Create the following environments in your GitHub repository with appropriate protection rules:

#### Staging Environment
- **Protection Rules**: None (automatic deployment)
- **Secrets**: Staging-specific configuration
- **URL**: `https://staging.wundr.io`

#### Production Environment
- **Protection Rules**: 
  - Required reviewers (at least 2)
  - Deployment window restrictions (business hours)
- **Secrets**: Production-specific configuration
- **URL**: `https://wundr.io`

#### Production Rollback Environment
- **Protection Rules**: Break-glass access for emergency rollbacks
- **Purpose**: Emergency rollback procedures

### 2. Branch Protection Rules

Configure branch protection for `master` branch:

```yaml
Required status checks:
  - Security Scan
  - Build & Test (ubuntu-latest)
  - Build & Test (macos-latest)
  - Build & Test (windows-latest)
  - E2E Tests
  - Quality Gates
  - Docker Build & Test

Restrictions:
  - Require pull request reviews (2 required)
  - Dismiss stale reviews when new commits are pushed
  - Require review from CODEOWNERS
  - Require status checks to pass
  - Require branches to be up to date
  - Include administrators in restrictions
```

## Deployment Strategy

### Blue-Green Deployment

The production deployment uses a blue-green strategy for zero-downtime deployments:

1. **Deploy to inactive color** (green if blue is active)
2. **Health check new deployment** (automated verification)
3. **Switch traffic** (update service selector)
4. **Verify deployment** (monitoring and health checks)
5. **Cleanup old deployment** (after verification period)

### Rollback Mechanism

Automatic rollback is triggered if:
- Health checks fail after deployment
- Performance degrades beyond thresholds
- Error rates increase significantly

Manual rollback can be triggered through:
- GitHub Actions workflow dispatch
- Production rollback environment approval

## Monitoring and Alerting

### Health Checks

- **Application Health**: `/health` endpoint monitoring
- **API Health**: `/api/health` endpoint monitoring  
- **Response Time**: < 5 seconds threshold
- **SSL Certificate**: 30-day expiry warning

### Performance Monitoring

- **Lighthouse Audits**: Performance, accessibility, SEO scoring
- **Load Testing**: Basic response time measurement
- **Resource Usage**: CPU and memory monitoring

### Infrastructure Monitoring

- **Kubernetes Cluster**: Node status and pod health
- **Database**: Connectivity and connection pooling
- **Security**: Headers validation and suspicious activity

### Alerting Levels

1. **Info**: Normal operational status
2. **Warning**: Degraded performance or approaching thresholds
3. **Critical**: Service failure or security incident

## Best Practices

### Development Workflow

1. **Feature Development**: Create feature branch from `develop`
2. **Pull Request**: Submit PR with comprehensive tests
3. **Code Review**: Require 2+ reviewer approvals
4. **CI Validation**: All status checks must pass
5. **Merge to Master**: Triggers automatic deployment pipeline

### Release Management

1. **Semantic Versioning**: Follow semver for version numbering
2. **Changelog**: Maintain comprehensive changelog
3. **Release Notes**: Auto-generate from commit messages
4. **Deployment Verification**: Stage deployment before production

### Security

1. **Dependency Updates**: Regular security updates
2. **Secret Management**: Never commit secrets to repository
3. **Access Control**: Principle of least privilege
4. **Audit Trail**: Comprehensive logging and monitoring

### Performance Optimization

1. **Caching Strategy**: Multi-level caching in pipelines
2. **Parallel Execution**: Maximize concurrent job execution
3. **Resource Optimization**: Right-size compute resources
4. **Build Optimization**: Multi-stage Docker builds

## Troubleshooting

### Common Issues

#### CI Pipeline Failures

**Symptom**: Tests failing intermittently
**Solution**: 
- Check for flaky tests
- Review test environment setup
- Verify dependency versions

**Symptom**: Docker build failures
**Solution**:
- Check Dockerfile syntax
- Verify base image availability
- Review build context size

#### Deployment Issues

**Symptom**: Kubernetes deployment hanging
**Solution**:
- Check resource quotas
- Verify image pull secrets
- Review deployment manifests

**Symptom**: Health checks failing post-deployment
**Solution**:
- Verify application startup time
- Check environment variables
- Review service connectivity

### Debug Commands

```bash
# Check workflow logs
gh run list --workflow=ci.yml
gh run view [run-id] --log

# Check Kubernetes deployment status
kubectl get pods -n wundr-production
kubectl describe deployment wundr-production -n wundr-production
kubectl logs -l app=wundr -n wundr-production

# Check application health
curl -f https://wundr.io/health
curl -f https://wundr.io/api/health

# Monitor deployment rollout
kubectl rollout status deployment/wundr-production -n wundr-production
```

## Maintenance

### Regular Tasks

#### Weekly
- Review security scan results
- Update dependency versions
- Check performance metrics
- Review error logs

#### Monthly
- Update base Docker images
- Review and update documentation
- Analyze deployment frequency and success rates
- Security audit and compliance review

#### Quarterly
- Review and update CI/CD pipeline
- Capacity planning and scaling assessment
- Disaster recovery testing
- Team training and knowledge sharing

## Support and Resources

- **Pipeline Status**: [GitHub Actions](https://github.com/adapticai/wundr/actions)
- **Deployment Status**: [Production Dashboard](https://wundr.io/dashboard)
- **Monitoring**: [Grafana Dashboards](https://monitoring.wundr.io)
- **Documentation**: [GitHub Wiki](https://github.com/adapticai/wundr/wiki)
- **Support**: Create issue with `ci-cd` label

## Metrics and KPIs

Track the following metrics to measure CI/CD effectiveness:

- **Deployment Frequency**: Target: Daily deployments
- **Lead Time**: Commit to production < 4 hours
- **Mean Time to Recovery**: < 1 hour for critical issues
- **Change Failure Rate**: < 15% of deployments
- **Pipeline Success Rate**: > 95% CI success rate
- **Security Scan Coverage**: 100% of commits scanned
- **Test Coverage**: > 80% code coverage maintained