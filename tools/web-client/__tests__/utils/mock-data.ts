import { AnalysisData } from '@/lib/contexts/analysis-context'

export const mockAnalysisData: AnalysisData = {
  entities: [
    {
      name: 'UserService',
      path: 'src/services/user.ts',
      type: 'class',
      dependencies: ['DatabaseService', 'CacheService'],
      complexity: 15,
      issues: []
    },
    {
      name: 'AuthController',
      path: 'src/controllers/auth.ts',
      type: 'class',
      dependencies: ['UserService', 'TokenService'],
      complexity: 8,
      issues: []
    },
    {
      name: 'DatabaseService',
      path: 'src/services/database.ts',
      type: 'class',
      dependencies: [],
      complexity: 12,
      issues: []
    }
  ],
  duplicates: [
    {
      id: '1',
      type: 'structural',
      severity: 'high',
      occurrences: [
        { path: 'src/utils/validate.ts', startLine: 10, endLine: 25 },
        { path: 'src/helpers/validation.ts', startLine: 5, endLine: 20 }
      ],
      linesCount: 15
    }
  ]
}

export const mockPerformanceData = [
  {
    timestamp: new Date().toISOString(),
    buildTime: 3500,
    bundleSize: 1024000,
    memoryUsage: 256,
    cpuUsage: 45,
    loadTime: 1200
  },
  {
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    buildTime: 3200,
    bundleSize: 1020000,
    memoryUsage: 240,
    cpuUsage: 40,
    loadTime: 1100
  }
]

export const mockQualityMetrics = {
  maintainability: 85,
  reliability: 92,
  security: 78,
  coverage: 81,
  duplication: 94,
  complexity: 72,
  technicalDebt: 80,
  documentation: 65
}

export const mockGitActivities = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - i)
  return {
    date: date.toISOString().split('T')[0],
    commits: Math.floor(Math.random() * 10),
    additions: Math.floor(Math.random() * 100),
    deletions: Math.floor(Math.random() * 50),
    files: Math.floor(Math.random() * 20)
  }
})

export const mockNetworkNodes = [
  { id: 'app', label: 'App', type: 'module' as const, size: 20, dependencies: ['router', 'store'] },
  { id: 'router', label: 'Router', type: 'module' as const, size: 15, dependencies: ['utils'] },
  { id: 'store', label: 'Store', type: 'module' as const, size: 18, dependencies: ['api', 'utils'] },
  { id: 'api', label: 'API', type: 'package' as const, size: 12, dependencies: ['utils'] },
  { id: 'utils', label: 'Utils', type: 'file' as const, size: 8, dependencies: [] }
]

export const mockNetworkLinks = [
  { source: 'app', target: 'router' },
  { source: 'app', target: 'store' },
  { source: 'router', target: 'utils' },
  { source: 'store', target: 'api' },
  { source: 'store', target: 'utils' },
  { source: 'api', target: 'utils' }
]

export const mockMetricsSeries = [
  {
    name: 'Response Time',
    data: Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      value: 200 + Math.random() * 50
    })),
    unit: 'ms',
    threshold: 300
  },
  {
    name: 'Error Rate',
    data: Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      value: Math.random() * 5
    })),
    unit: '%',
    threshold: 5
  }
]