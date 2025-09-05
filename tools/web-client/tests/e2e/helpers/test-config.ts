/**
 * Shared test configuration for both dashboards
 */

export const TEST_CONFIG = {
  dashboards: {
    wundr: {
      name: '@wundr/dashboard',
      baseURL: 'http://localhost:3001',
      description: 'Real-time monitoring dashboard'
    },
    webClient: {
      name: 'web-client',
      baseURL: 'http://localhost:3000',
      description: 'Intelligent monorepo analysis dashboard'
    }
  },
  
  timeouts: {
    navigation: 30000,
    apiResponse: 10000,
    websocket: 5000,
    pageLoad: 15000
  },

  retries: {
    flaky: 2,
    network: 3,
    api: 2
  },

  // Expected routes for each dashboard
  routes: {
    wundr: [
      '/',
      '/dashboard',
      '/dashboard/overview'
    ],
    webClient: [
      '/',
      '/dashboard',
      '/dashboard/analysis',
      '/dashboard/analysis/entities',
      '/dashboard/analysis/dependencies',
      '/dashboard/analysis/circular',
      '/dashboard/analysis/duplicates',
      '/dashboard/analysis/scan',
      '/dashboard/docs',
      '/dashboard/docs/api',
      '/dashboard/docs/getting-started',
      '/dashboard/docs/templates',
      '/dashboard/docs/patterns',
      '/dashboard/files',
      '/dashboard/git',
      '/dashboard/performance',
      '/dashboard/quality',
      '/dashboard/reports',
      '/dashboard/scripts',
      '/dashboard/services',
      '/dashboard/settings',
      '/dashboard/templates/services',
      '/dashboard/templates/batches',
      '/dashboard/upload',
      '/dashboard/visualizations',
      '/dashboard/recommendations',
      '/dashboard/recommendations/critical',
      '/dashboard/recommendations/high',
      '/dashboard/about',
      '/dashboard/logos',
      '/dashboard/markdown-demo',
      '/dashboard/load-report'
    ]
  }
} as const;

export type DashboardName = keyof typeof TEST_CONFIG.dashboards;