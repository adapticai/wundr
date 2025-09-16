# CI/CD Integration

Integrate Wundr into your continuous integration and deployment workflows.

## GitHub Actions Integration

Add Wundr to your GitHub Actions workflow:

```yaml
name: Code Quality Check
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g @wundr/cli
      - run: wundr analyze --ci
      - run: wundr report --format=json --output=quality-report.json
```

## Jenkins Integration

Configure Wundr in your Jenkins pipeline:

```groovy
pipeline {
    agent any
    stages {
        stage('Quality Check') {
            steps {
                sh 'npm install -g @wundr/cli'
                sh 'wundr analyze --ci'
                sh 'wundr report --format=html --output=reports/'
            }
        }
    }
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports',
                reportFiles: 'index.html',
                reportName: 'Wundr Quality Report'
            ])
        }
    }
}
```

## GitLab CI Integration

Add to your `.gitlab-ci.yml`:

```yaml
quality_check:
  stage: test
  script:
    - npm install -g @wundr/cli
    - wundr analyze --ci
    - wundr report --format=junit --output=quality.xml
  artifacts:
    reports:
      junit: quality.xml
```

## Configuration Options

### CI Mode Settings

```json
{
  "ci": {
    "failOnViolations": true,
    "thresholds": {
      "complexity": "error",
      "coverage": 80,
      "patterns": "warn"
    },
    "reporting": {
      "formats": ["json", "junit", "html"],
      "outputDir": "./ci-reports"
    }
  }
}
```

## Quality Gates

Set up automated quality gates:

- Fail builds on critical violations
- Generate reports for team review
- Track quality trends over time
- Integrate with notification systems

## Next Steps

- [GitHub Actions Setup](./github-actions.md)
- [Jenkins Configuration](./jenkins.md)
- [Quality Thresholds](./thresholds.md)