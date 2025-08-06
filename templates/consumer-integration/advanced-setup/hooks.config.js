/**
 * Advanced Hooks Configuration
 * Custom hooks for complex integration scenarios
 */

module.exports = {
  integration: {
    hooks: [
      // Pre-analysis hooks
      {
        name: 'cleanup-artifacts',
        event: 'before-analysis',
        type: 'sync',
        description: 'Clean up previous analysis artifacts',
        command: 'rm -rf ./analysis-output && mkdir -p ./analysis-output',
        conditions: [
          {
            type: 'environment',
            path: 'NODE_ENV',
            operator: 'not-equals',
            value: 'production'
          }
        ]
      },
      
      // Post-analysis hooks
      {
        name: 'git-commit-results',
        event: 'after-analysis',
        type: 'waterfall',
        description: 'Commit analysis results to git',
        command: 'git add analysis-output/ && git commit -m "chore: update analysis results [skip ci]"',
        conditions: [
          {
            type: 'config',
            path: 'git.autoCommit',
            operator: 'equals',
            value: true
          },
          {
            type: 'environment',
            path: 'CI',
            operator: 'not-equals',
            value: 'true'
          }
        ]
      },
      
      {
        name: 'slack-notification',
        event: 'after-analysis',
        type: 'async',
        description: 'Send analysis summary to Slack',
        script: `
          const webhook = process.env.SLACK_WEBHOOK_URL;
          if (!webhook) return context.data;
          
          const { data } = context;
          const message = {
            text: \`Analysis completed for \${data.project || 'project'}\`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: \`*Analysis Summary*\\n• Files analyzed: \${data.fileCount || 0}\\n• Issues found: \${data.issueCount || 0}\\n• Quality score: \${data.qualityScore || 'N/A'}\`
                }
              }
            ]
          };
          
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
          });
          
          return context.data;
        `,
        conditions: [
          {
            type: 'environment',
            path: 'SLACK_WEBHOOK_URL',
            operator: 'not-equals',
            value: ''
          }
        ]
      },
      
      {
        name: 'quality-gate-check',
        event: 'after-analysis',
        type: 'waterfall',
        description: 'Check quality gate and fail if not met',
        script: `
          const { data, config } = context;
          const minQuality = config.qualityGate?.minScore || 0.7;
          
          if (data.qualityScore < minQuality) {
            throw new Error(\`Quality gate failed: \${data.qualityScore} < \${minQuality}\`);
          }
          
          return data;
        `,
        conditions: [
          {
            type: 'config',
            path: 'qualityGate.enabled',
            operator: 'equals',
            value: true
          }
        ]
      },
      
      // Script execution hooks
      {
        name: 'pre-test-setup',
        event: 'before-script-execution',
        type: 'sync',
        description: 'Setup test environment',
        script: `
          const { metadata } = context;
          if (metadata.scriptName?.includes('test')) {
            // Setup test database, mock services, etc.
            process.env.NODE_ENV = 'test';
            process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
          }
          return context.data;
        `
      },
      
      {
        name: 'performance-monitoring',
        event: 'after-script-execution',
        type: 'async',
        description: 'Monitor script performance',
        script: `
          const { data, metadata } = context;
          const { scriptName, result } = metadata;
          
          if (result.duration > 30000) { // 30 seconds
            console.warn(\`Script '\${scriptName}' took \${result.duration}ms to execute\`);
            
            // Could send to monitoring service
            if (process.env.MONITORING_WEBHOOK) {
              await fetch(process.env.MONITORING_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'slow-script',
                  script: scriptName,
                  duration: result.duration,
                  timestamp: new Date().toISOString()
                })
              });
            }
          }
          
          return context.data;
        `
      },
      
      // Configuration change hooks
      {
        name: 'restart-services',
        event: 'config-changed',
        type: 'async',
        description: 'Restart services when config changes',
        script: `
          const { metadata } = context;
          const changedSection = metadata.section;
          
          if (changedSection === 'integration' || changedSection === 'plugins') {
            console.log('Configuration changed, services may need restart');
            // Could trigger service restart logic
          }
          
          return context.data;
        `
      },
      
      // Error handling hooks
      {
        name: 'error-reporting',
        event: 'error-occurred',
        type: 'async',
        description: 'Report errors to monitoring service',
        script: `
          const { data } = context;
          const error = data.error;
          
          // Log to console
          console.error('Wundr Error:', error);
          
          // Report to external service
          if (process.env.ERROR_REPORTING_URL) {
            try {
              await fetch(process.env.ERROR_REPORTING_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  service: 'wundr-dashboard',
                  error: error.message || error,
                  stack: error.stack,
                  timestamp: new Date().toISOString(),
                  metadata: data.metadata || {}
                })
              });
            } catch (reportingError) {
              console.error('Failed to report error:', reportingError);
            }
          }
          
          return context.data;
        `
      },
      
      // Cleanup hooks
      {
        name: 'temp-cleanup',
        event: 'after-dashboard-start',
        type: 'async',
        description: 'Clean up temporary files',
        command: 'find ./wundr-dashboard/temp -type f -mtime +1 -delete',
        conditions: [
          {
            type: 'environment',
            path: 'NODE_ENV',
            operator: 'equals',
            value: 'production'
          }
        ]
      }
    ],
    
    // External webhooks
    webhooks: [
      {
        url: '${SLACK_WEBHOOK_URL}',
        method: 'POST',
        events: ['after-analysis', 'error-occurred', 'config-changed'],
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000,
        retries: 2
      },
      {
        url: '${TEAMS_WEBHOOK_URL}',
        method: 'POST',
        events: ['error-occurred'],
        headers: {
          'Content-Type': 'application/json'
        }
      },
      {
        url: '${CUSTOM_WEBHOOK_URL}',
        method: 'POST',
        events: ['after-analysis'],
        headers: {
          'Authorization': 'Bearer ${WEBHOOK_TOKEN}',
          'Content-Type': 'application/json',
          'X-Source': 'wundr-dashboard'
        }
      }
    ]
  }
};