# Quality Gates Setup

Establish quality gates to ensure code standards across your team.

## Overview

Quality gates act as checkpoints in your development workflow, ensuring code meets established standards before proceeding.

## Gate Configuration

### Basic Quality Gate

```json
{
  "qualityGates": {
    "preCommit": {
      "enabled": true,
      "rules": [
        "noNewCriticalIssues",
        "maintainCoverage",
        "patternCompliance"
      ]
    },
    "prReview": {
      "enabled": true,
      "rules": [
        "qualityScoreThreshold",
        "securityCheck",
        "performanceCheck"
      ]
    }
  }
}
```

### Advanced Configuration

```json
{
  "qualityGates": {
    "development": {
      "threshold": 70,
      "blocking": false,
      "notifications": ["slack", "email"]
    },
    "staging": {
      "threshold": 85,
      "blocking": true,
      "notifications": ["slack", "teams"]
    },
    "production": {
      "threshold": 95,
      "blocking": true,
      "notifications": ["email", "pagerduty"]
    }
  }
}
```

## Gate Types

### Pre-commit Gates
- Syntax validation
- Basic quality checks
- Pattern compliance

### Pull Request Gates
- Comprehensive analysis
- Security scanning
- Performance impact

### Deployment Gates
- Full quality assessment
- Security verification
- Performance validation

## Team Integration

### Git Hooks

```bash
#!/bin/sh
# .git/hooks/pre-commit
wundr analyze --quick --fail-on-critical
```

### GitHub Actions

```yaml
name: Quality Gate

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Quality Gate
        run: wundr gate --config .wundr/quality-gates.json
```

## Notifications

Configure team notifications:

```json
{
  "notifications": {
    "slack": {
      "webhook": "https://hooks.slack.com/...",
      "channel": "#quality-alerts"
    },
    "email": {
      "recipients": ["team@company.com"],
      "template": "quality-gate-failed"
    }
  }
}
```

## Next Steps

- Learn about [Team Metrics](./metrics.md)
- Explore [Collaboration Features](./collaboration.md)