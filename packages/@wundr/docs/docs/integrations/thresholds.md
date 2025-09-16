# Quality Thresholds

Configure quality thresholds to maintain code standards in your CI/CD pipeline.

## Overview

Quality thresholds allow you to set minimum standards that must be met for builds to pass.

## Configuration

### Basic Thresholds

```json
{
  "thresholds": {
    "qualityScore": 80,
    "patternCompliance": 90,
    "securityIssues": 0,
    "criticalIssues": 0
  }
}
```

### Advanced Thresholds

```json
{
  "thresholds": {
    "overall": {
      "score": 80,
      "trend": "improving"
    },
    "patterns": {
      "compliance": 90,
      "newViolations": 0
    },
    "quality": {
      "maintainability": 70,
      "reliability": 85,
      "security": 95
    },
    "coverage": {
      "lines": 80,
      "branches": 75
    }
  }
}
```

## Threshold Types

### Quality Score
Overall code quality rating (0-100)

### Pattern Compliance
Percentage of code following defined patterns

### Security Issues
Number of security vulnerabilities found

### Critical Issues
High-severity issues that must be addressed

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check Thresholds
  run: wundr analyze --config wundr.config.json --fail-on-threshold
```

### Jenkins

```groovy
stage('Quality Gate') {
    steps {
        sh 'wundr analyze --fail-threshold 80'
    }
}
```

## Gradual Improvement

Start with lower thresholds and gradually increase:

```json
{
  "thresholds": {
    "schedule": {
      "initial": { "score": 60 },
      "month1": { "score": 70 },
      "month3": { "score": 80 },
      "month6": { "score": 85 }
    }
  }
}
```

## Next Steps

- Set up [GitHub Actions](./github-actions.md)
- Configure [Jenkins Integration](./jenkins.md)