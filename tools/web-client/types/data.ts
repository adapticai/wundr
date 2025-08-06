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
