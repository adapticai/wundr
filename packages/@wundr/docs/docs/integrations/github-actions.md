# GitHub Actions Setup

Integrate Wundr with GitHub Actions for automated code quality checks.

## Overview

Use Wundr in your CI/CD pipeline to ensure code quality standards are maintained with every commit.

## Basic Workflow

Create `.github/workflows/wundr.yml`:

```yaml
name: Wundr Code Quality Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  quality-check:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install Wundr
      run: npm install -g @wundr.io/cli

    - name: Run Analysis
      run: wundr analyze --format json --output results.json

    - name: Upload Results
      uses: actions/upload-artifact@v3
      with:
        name: wundr-results
        path: results.json
```

## Advanced Configuration

### Quality Gates

Set up quality gates to fail builds when standards aren't met:

```yaml
    - name: Check Quality Gates
      run: |
        wundr analyze --fail-threshold 80
        if [ $? -ne 0 ]; then
          echo "Quality threshold not met"
          exit 1
        fi
```

### Comment on PR

Automatically comment on pull requests with analysis results:

```yaml
    - name: Comment PR
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('results.json', 'utf8'));

          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## Wundr Analysis Results

            **Quality Score:** ${results.score}/100
            **Issues Found:** ${results.issues.length}

            See full report in the Actions artifacts.`
          });
```

## Next Steps

- Configure [Jenkins Integration](./jenkins.md)
- Set up [Quality Thresholds](./thresholds.md)