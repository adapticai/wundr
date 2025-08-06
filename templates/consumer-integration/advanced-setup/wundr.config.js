/**
 * Advanced Wundr Dashboard Configuration
 * JavaScript configuration with dynamic values and complex integrations
 */

const { ConfigurationBuilder } = require('@lumic/wundr/integration');

// Environment-specific settings
const isDevelopment = process.env.NODE_ENV === 'development';
const isCI = !!process.env.CI;

module.exports = new ConfigurationBuilder()
  .branding({
    appName: process.env.WUNDR_APP_NAME || 'Advanced Project Dashboard',
    primaryColor: process.env.WUNDR_PRIMARY_COLOR || '#0066CC',
    secondaryColor: '#6B7280',
    logo: './assets/logo.svg',
    favicon: './assets/favicon.ico',
    customCss: './wundr-dashboard/themes/advanced.css'
  })
  .analysis({
    defaultPath: './src',
    excludePatterns: [
      'node_modules',
      'dist',
      'build',
      '.next',
      'coverage',
      '*.min.js',
      '*.map',
      ...(isDevelopment ? [] : ['test', 'spec'])
    ],
    includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.java', '.cs'],
    maxFileSize: isDevelopment ? 2097152 : 1048576, // 2MB in dev, 1MB in prod
    enableRealtime: isDevelopment
  })
  .integration({
    customScripts: [
      // Standard development scripts
      {
        name: 'test-unit',
        command: 'npm run test:unit',
        description: 'Run unit tests',
        safetyLevel: 'safe',
        timeout: 30000
      },
      {
        name: 'test-integration',
        command: 'npm run test:integration',
        description: 'Run integration tests',
        safetyLevel: 'safe',
        timeout: 60000
      },
      {
        name: 'lint-fix',
        command: 'npm run lint -- --fix',
        description: 'Run linting with auto-fix',
        safetyLevel: 'safe'
      },
      {
        name: 'build-analyze',
        command: 'npm run build -- --analyze',
        description: 'Build with bundle analysis',
        safetyLevel: 'safe',
        timeout: 120000
      },
      // CI-specific scripts
      ...(isCI ? [
        {
          name: 'security-audit',
          command: 'npm audit --audit-level moderate',
          description: 'Run security audit',
          safetyLevel: 'safe'
        },
        {
          name: 'coverage-report',
          command: 'npm run test:coverage',
          description: 'Generate coverage report',
          safetyLevel: 'safe',
          timeout: 90000
        }
      ] : []),
      // Development-only scripts
      ...(isDevelopment ? [
        {
          name: 'dev-server',
          command: 'npm run dev',
          description: 'Start development server',
          safetyLevel: 'moderate',
          timeout: 0 // No timeout for dev server
        },
        {
          name: 'storybook',
          command: 'npm run storybook',
          description: 'Start Storybook',
          safetyLevel: 'safe'
        }
      ] : [])
    ],
    webhooks: [
      // Slack notifications
      ...(process.env.SLACK_WEBHOOK_URL ? [{
        url: process.env.SLACK_WEBHOOK_URL,
        method: 'POST',
        events: ['after-analysis', 'error-occurred'],
        headers: {
          'Content-Type': 'application/json'
        }
      }] : []),
      // GitHub integration
      ...(process.env.GITHUB_WEBHOOK_URL ? [{
        url: process.env.GITHUB_WEBHOOK_URL,
        method: 'POST',
        events: ['after-analysis'],
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'X-GitHub-Event': 'wundr-analysis'
        }
      }] : [])
    ],
    apiEndpoints: [
      {
        name: 'project-info',
        url: '/api/project-info',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'custom-metrics',
        url: '/api/metrics/custom',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
        }
      }
    ]
  })
  .plugins([
    '@wundr/core-plugins',
    '@wundr/git-integration',
    '@wundr/performance-metrics',
    ...(isDevelopment ? ['@wundr/dev-tools'] : []),
    ...(isCI ? ['@wundr/ci-integration'] : [])
  ])
  .port(parseInt(process.env.WUNDR_PORT) || (isDevelopment ? 3000 : 8080))
  .build();