# Jenkins Configuration

Integrate Wundr with Jenkins for continuous code quality monitoring.

## Overview

Set up Wundr in your Jenkins pipeline to automatically analyze code quality and enforce standards.

## Pipeline Configuration

### Declarative Pipeline

```groovy
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Wundr') {
            steps {
                sh 'npm install -g @wundr.io/cli'
            }
        }

        stage('Code Analysis') {
            steps {
                sh 'wundr analyze --format json --output wundr-results.json'

                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'reports',
                    reportFiles: 'index.html',
                    reportName: 'Wundr Report'
                ])
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'wundr-results.json', fingerprint: true
        }
    }
}
```

### Quality Gates

```groovy
stage('Quality Gate') {
    steps {
        script {
            def result = sh(
                script: 'wundr analyze --fail-threshold 80',
                returnStatus: true
            )

            if (result != 0) {
                error('Quality gate failed')
            }
        }
    }
}
```

## Plugin Integration

### Wundr Jenkins Plugin

Install the Wundr Jenkins plugin for enhanced integration:

1. Go to Manage Jenkins > Manage Plugins
2. Search for "Wundr"
3. Install and restart Jenkins

### Configuration

```groovy
stage('Wundr Analysis') {
    steps {
        wundrAnalysis(
            configFile: 'wundr.config.json',
            outputFormat: 'html',
            failThreshold: 80
        )
    }
}
```

## Next Steps

- Learn about [GitHub Actions Setup](./github-actions.md)
- Configure [Quality Thresholds](./thresholds.md)