// Type definitions for dashboard data structures

export interface PerformanceMetrics {
  timestamp: string
  buildTime: number
  bundleSize: number
  memoryUsage: number
  cpuUsage: number
  loadTime: number
  testDuration?: number
  cacheHitRate?: number
  errorRate: number
}

// Extended analysis types for production data
export interface AnalysisEntity {
  id: string
  name: string
  path: string
  type: 'class' | 'function' | 'module' | 'component' | 'interface'
  dependencies: string[]
  complexity: number
  size: number
  lastModified: string
  issues: AnalysisIssue[]
  metrics: {
    maintainability: number
    testability: number
    reusability: number
  }
}

export interface AnalysisIssue {
  id: string
  type: 'bug' | 'vulnerability' | 'code_smell' | 'duplication' | 'complexity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  file: string
  line: number
  category: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  tags: string[]
}

export interface AnalysisDuplicate {
  id: string
  type: 'structural' | 'exact' | 'similar'
  severity: 'low' | 'medium' | 'high'
  occurrences: Array<{
    path: string
    startLine: number
    endLine: number
  }>
  linesCount: number
  similarity: number
}

export interface AnalysisRecommendation {
  id: string
  title: string
  description: string
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: 'Security' | 'Performance' | 'Maintainability' | 'Reliability' | 'Architecture'
  impact: string
  estimatedEffort: string
  suggestion?: string
  entities: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed'
  assignedTo?: string
  dueDate?: string
  dependencies: string[]
  autoFixAvailable: boolean
  quickFix?: {
    available: boolean
    action: string
    description: string
    estimatedTime: string
  }
}

export interface DashboardSummary {
  totalFiles: number
  totalEntities: number
  totalLines: number
  duplicateClusters: number
  circularDependencies: number
  unusedExports: number
  codeSmells: number
  bugs: number
  vulnerabilities: number
  technicalDebtHours: number
  maintainabilityIndex: number
  testCoverage: number
  lastAnalysis: string
}

export interface AnalysisData {
  id: string
  timestamp: string
  version: string
  summary: DashboardSummary
  entities: AnalysisEntity[]
  duplicates: AnalysisDuplicate[]
  recommendations: AnalysisRecommendation[]
  dependencies: DependencyGraph
  metrics: ProjectMetrics
  issues: AnalysisIssue[]
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
  cycles: string[][]
  orphans: string[]
}

export interface DependencyNode {
  id: string
  name: string
  type: 'internal' | 'external' | 'system'
  size: number
  complexity: number
  imports: number
  exports: number
}

export interface DependencyEdge {
  source: string
  target: string
  type: 'import' | 'require' | 'dynamic'
  weight: number
}

export interface ProjectMetrics {
  complexity: {
    average: number
    median: number
    max: number
    distribution: Record<string, number>
  }
  size: {
    totalLines: number
    codeLines: number
    commentLines: number
    blankLines: number
  }
  quality: {
    maintainabilityIndex: number
    testability: number
    reusability: number
    reliability: number
  }
  debt: {
    totalHours: number
    breakdown: Record<string, number>
    trend: 'improving' | 'stable' | 'worsening'
  }
}

export interface QualityMetrics {
  timestamp: string
  codeComplexity: number
  testCoverage: number
  duplicateLines: number
  maintainabilityIndex: number
  technicalDebt: number
  codeSmells: number
  bugs: number
  vulnerabilities: number
  linesOfCode: number
}

export interface GitActivity {
  timestamp: string
  commits: number
  additions: number
  deletions: number
  files: number
  contributors: number
  branches: number
  pullRequests: number
  issues: number
}

export interface RealtimeUpdate<T> {
  type: 'performance' | 'quality' | 'git'
  data: T
  timestamp: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  timestamp: string
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'ping' | 'pong'
  channel?: string
  payload?: any
  timestamp: string
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

export interface DataFetchOptions {
  timeRange?: TimeRange
  realtime?: boolean
  refreshInterval?: number
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expires: number
}

export interface ErrorState {
  message: string
  code?: string
  timestamp: string
  retry?: () => void
}

export interface LoadingState {
  isLoading: boolean
  isRefreshing: boolean
  progress?: number
}
