# Branch Protection Rules Setup

This document outlines the required branch protection rules for the Wundr repository to ensure code
quality, security, and deployment safety.

## Master Branch Protection

Configure the following branch protection rules for the `master` branch:

### General Settings

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Security Scan",
      "Build & Test (ubuntu-latest)",
      "Build & Test (macos-latest)",
      "Build & Test (windows-latest)",
      "E2E Tests",
      "Quality Gates",
      "Docker Build & Test",
      "Deployment Readiness"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
```

### GitHub CLI Setup

Use the GitHub CLI to configure branch protection:

```bash
# Enable branch protection for master
gh api repos/:owner/:repo/branches/master/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Security Scan","Build & Test (ubuntu-latest)","Build & Test (macos-latest)","Build & Test (windows-latest)","E2E Tests","Quality Gates","Docker Build & Test","Deployment Readiness"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"require_last_push_approval":true}' \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true
```

### Web Interface Setup

1. **Navigate to Repository Settings**
   - Go to your repository on GitHub
   - Click "Settings" tab
   - Select "Branches" from sidebar

2. **Add Branch Protection Rule**
   - Click "Add rule"
   - Enter branch name pattern: `master`

3. **Configure Protection Options**

   **Require a pull request before merging:**
   - ✅ Require a pull request before merging
   - ✅ Require approvals: `2`
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from CODEOWNERS
   - ✅ Restrict pushes that create files that change the code owners file

   **Require status checks before merging:**
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - **Required status checks:**
     - Security Scan
     - Build & Test (ubuntu-latest)
     - Build & Test (macos-latest)
     - Build & Test (windows-latest)
     - E2E Tests
     - Quality Gates
     - Docker Build & Test
     - Deployment Readiness

   **Additional restrictions:**
   - ✅ Require conversation resolution before merging
   - ✅ Require signed commits
   - ✅ Require linear history
   - ✅ Include administrators
   - ❌ Allow force pushes
   - ❌ Allow deletions

## Develop Branch Protection

Configure lighter protection for the `develop` branch:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Security Scan", "Build & Test (ubuntu-latest)", "Quality Gates"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
```

## Feature Branch Naming Convention

Enforce branch naming patterns using additional rules:

### Allowed Branch Patterns

- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical fixes
- `release/*` - Release preparations
- `docs/*` - Documentation updates

### Prohibited Patterns

- Direct commits to `master`
- Direct commits to `develop`
- Branches without proper prefixes

## CODEOWNERS Configuration

Create `.github/CODEOWNERS` file to define code ownership:

```
# Global code owners
* @tech-lead @senior-dev

# CI/CD workflows
/.github/ @devops-team @tech-lead

# Docker and deployment
/Dockerfile @devops-team
/k8s/ @devops-team @tech-lead
/docker-compose*.yml @devops-team

# Configuration files
/config/ @tech-lead @senior-dev

# Security-related files
/security/ @security-team @tech-lead
/.github/workflows/security.yml @security-team

# Core application code
/src/ @tech-lead @senior-dev
/scripts/ @tech-lead

# Documentation
/docs/ @tech-lead @product-owner
/*.md @tech-lead @product-owner

# Package management
/package*.json @tech-lead
/pnpm-*.yaml @tech-lead
/turbo.json @tech-lead

# Testing
/tests/ @qa-team @senior-dev
```

## Environment-Specific Protection

### Staging Environment

- **Required Reviewers**: 1
- **Auto-deployment**: Enabled
- **Deployment Restrictions**: None

### Production Environment

- **Required Reviewers**: 2 (including 1 admin)
- **Auto-deployment**: Disabled (manual approval required)
- **Deployment Restrictions**:
  - Business hours only (9 AM - 5 PM UTC)
  - Not on weekends
  - Deployment freeze during holidays

### Production Rollback Environment

- **Purpose**: Emergency rollback procedures
- **Required Reviewers**: 1 admin (break-glass access)
- **Deployment Restrictions**: None (emergency use)

## Rulesets Configuration

GitHub Rulesets provide additional protection beyond branch rules:

```json
{
  "name": "Wundr Repository Protection",
  "target": "branch",
  "source_type": "Repository",
  "source": "adapticai/wundr",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/master", "refs/heads/develop"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": [
          {
            "context": "Security Scan",
            "integration_id": null
          },
          {
            "context": "Build & Test (ubuntu-latest)",
            "integration_id": null
          }
        ],
        "strict_required_status_checks_policy": true
      }
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 2,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "deletion",
      "parameters": {}
    },
    {
      "type": "non_fast_forward",
      "parameters": {}
    }
  ],
  "bypass_actors": [
    {
      "actor_id": 1,
      "actor_type": "Integration",
      "bypass_mode": "always"
    }
  ]
}
```

## Security Considerations

### Required Checks Before Merge

1. **Security Scanning**
   - Vulnerability scanning passes
   - No high/critical security issues
   - Secret scanning passes

2. **Code Quality**
   - All tests pass (unit, integration, e2e)
   - Code coverage meets threshold (>80%)
   - Linting passes without errors
   - TypeScript compilation successful

3. **Review Requirements**
   - At least 2 approving reviews
   - Code owner approval
   - All conversations resolved
   - No stale reviews after new commits

### Bypass Permissions

Only allow bypass in emergency situations:

- **Who can bypass**: Repository administrators only
- **When to bypass**: Critical security patches, emergency hotfixes
- **Process**: Document bypass reason, create follow-up issue

## Monitoring and Compliance

### Audit Requirements

- Log all bypass activities
- Regular review of protection rules
- Compliance reporting for security audits

### Alerting

Configure alerts for:

- Branch protection rule changes
- Bypass activities
- Failed status checks on master
- Unauthorized direct pushes (if they occur)

## Automation

### GitHub Actions Integration

```yaml
# Workflow to validate branch protection
name: Branch Protection Validation

on:
  push:
    branches: [master]
  schedule:
    - cron: '0 9 * * 1' # Weekly on Monday

jobs:
  validate-protection:
    runs-on: ubuntu-latest
    steps:
      - name: Check branch protection
        uses: actions/github-script@v7
        with:
          script: |
            const protection = await github.rest.repos.getBranchProtection({
              owner: context.repo.owner,
              repo: context.repo.repo,
              branch: 'master'
            });

            // Validate required checks
            const requiredChecks = [
              'Security Scan',
              'Build & Test (ubuntu-latest)',
              'E2E Tests',
              'Quality Gates'
            ];

            const actualChecks = protection.data.required_status_checks.contexts;
            const missing = requiredChecks.filter(check => !actualChecks.includes(check));

            if (missing.length > 0) {
              throw new Error(`Missing required status checks: ${missing.join(', ')}`);
            }
```

## Troubleshooting

### Common Issues

**Issue**: Status checks not appearing in required list **Solution**:

- Ensure workflow names match exactly
- Check if workflows have run at least once
- Verify workflow files are in `.github/workflows/`

**Issue**: CODEOWNERS not being enforced **Solution**:

- Check file location (must be in `.github/CODEOWNERS`)
- Verify syntax and team/user references
- Ensure "Require review from CODEOWNERS" is enabled

**Issue**: Administrators can't bypass rules **Solution**:

- Check "Include administrators" setting
- Verify admin permissions are correctly set
- Consider using bypass actors for specific cases

### Support

For issues with branch protection:

1. Check GitHub documentation
2. Verify repository permissions
3. Contact DevOps team for assistance
4. Create issue with `branch-protection` label

## Implementation Checklist

- [ ] Configure master branch protection rules
- [ ] Set up develop branch protection rules
- [ ] Create CODEOWNERS file
- [ ] Configure environment protection rules
- [ ] Set up GitHub Rulesets (if using)
- [ ] Test branch protection with test PR
- [ ] Document any custom requirements
- [ ] Train team on new protection rules
- [ ] Set up monitoring and alerting
- [ ] Create bypass procedures for emergencies
