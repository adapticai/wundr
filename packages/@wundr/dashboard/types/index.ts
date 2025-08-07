// Core platform types
export interface WundrProject {
  id: string
  name: string
  path: string
  description?: string
  repository?: {
    url: string
    branch: string
  }
  lastAnalyzed: Date
  status: 'active' | 'inactive' | 'archived'
  metadata?: Record<string, any>
}

// Dashboard data types
export interface DashboardData {
  project: WundrProject
  metrics: ProjectMetrics
  dependencies: DependencyData
  quality: QualityMetrics
  performance: PerformanceData
  realtime: RealtimeData
}

// Metrics and analytics
export interface ProjectMetrics {
  linesOfCode: number
  numberOfFiles: number
  testCoverage: number
  technicalDebt: number
  complexity: {
    cyclomatic: number
    cognitive: number
    maintainability: number
  }
  trends: {
    period: 'day' | 'week' | 'month'
    data: Array<{
      timestamp: Date
      value: number
      metric: string
    }>
  }
}

export interface DependencyData {
  graph: {
    nodes: DependencyNode[]
    edges: DependencyEdge[]
  }
  circular: CircularDependency[]
  outdated: OutdatedDependency[]
  vulnerabilities: SecurityVulnerability[]
  size: {
    total: number
    byType: Record<string, number>
  }
}

export interface DependencyNode {
  id: string
  name: string
  type: 'package' | 'module' | 'service' | 'component'
  version?: string
  size: number
  dependencies: string[]
  dependents: string[]
  metadata?: Record<string, any>
}

export interface DependencyEdge {
  source: string
  target: string
  type: 'imports' | 'requires' | 'extends' | 'implements'
  weight: number
}

export interface CircularDependency {
  id: string
  path: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  impact: number
  suggestion?: string
}

export interface OutdatedDependency {
  name: string
  current: string
  latest: string
  type: 'major' | 'minor' | 'patch'
  breaking: boolean
  securityIssues?: SecurityVulnerability[]
}

export interface SecurityVulnerability {
  id: string
  title: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  package: string
  version: string
  patchedIn?: string
  description: string
  references: string[]
}

// Quality metrics
export interface QualityMetrics {
  overall: number
  categories: {
    maintainability: number
    reliability: number
    security: number
    coverage: number
    duplication: number
  }
  issues: QualityIssue[]
  trends: QualityTrend[]
}

export interface QualityIssue {
  id: string
  type: 'bug' | 'vulnerability' | 'code_smell' | 'duplication'
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info'
  title: string
  description: string
  file: string
  line?: number
  suggestions: string[]
  effort: number // minutes to fix
}

export interface QualityTrend {
  date: Date
  metric: string
  value: number
  change: number
}

// Performance data
export interface PerformanceData {
  buildTime: number
  testTime: number
  bundleSize: {
    total: number
    chunks: Array<{
      name: string
      size: number
      type: 'js' | 'css' | 'asset'
    }>
  }
  runtime: {
    loadTime: number
    renderTime: number
    memoryUsage: number
  }
  trends: PerformanceTrend[]
}

export interface PerformanceTrend {
  timestamp: Date
  metric: string
  value: number
  baseline?: number
}

// Real-time data
export interface RealtimeData {
  connected: boolean
  lastUpdate: Date
  events: RealtimeEvent[]
  metrics: RealtimeMetric[]
}

export interface RealtimeEvent {
  id: string
  type: 'build' | 'test' | 'deploy' | 'analysis' | 'error'
  timestamp: Date
  status: 'started' | 'progress' | 'completed' | 'failed'
  message: string
  progress?: number
  metadata?: Record<string, any>
}

export interface RealtimeMetric {
  name: string
  value: number
  unit: string
  change?: number
  timestamp: Date
}

// Chart and visualization types
export interface ChartData<T = any> {
  labels: string[]
  datasets: ChartDataset<T>[]
}

export interface ChartDataset<T = any> {
  label: string
  data: T[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
  fill?: boolean
}

export interface ChartOptions {
  responsive: boolean
  maintainAspectRatio: boolean
  plugins?: {
    legend?: {
      display: boolean
      position?: 'top' | 'bottom' | 'left' | 'right'
    }
    tooltip?: {
      enabled: boolean
      mode?: 'index' | 'dataset' | 'point'
    }
    title?: {
      display: boolean
      text?: string
    }
  }
  scales?: Record<string, any>
  animation?: {
    duration: number
    easing?: string
  }
}

// D3 visualization types
export interface D3GraphData {
  nodes: D3Node[]
  links: D3Link[]
}

export interface D3Node {
  id: string
  label: string
  type: string
  size: number
  color?: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface D3Link {
  source: string | D3Node
  target: string | D3Node
  type: string
  weight: number
  color?: string
}

export interface HeatmapData {
  rows: string[]
  columns: string[]
  values: number[][]
  labels?: string[][]
}

// Script execution types
export interface ScriptTemplate {
  id: string
  name: string
  description: string
  category: string
  parameters: ScriptParameter[]
  script: string
  safetyLevel: SafetyLevel
  estimatedRuntime: number
  lastModified: Date
  author: string
  version: string
}

export interface ScriptParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory' | 'select'
  description: string
  required: boolean
  defaultValue?: any
  options?: string[] // for select type
  validation?: {
    pattern?: string
    min?: number
    max?: number
  }
}

export type SafetyLevel = 'safe' | 'caution' | 'dangerous'

export interface ScriptExecution {
  id: string
  templateId: string
  parameters: Record<string, any>
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: Date
  endTime?: Date
  output: string[]
  errors: string[]
  exitCode?: number
  progress?: number
}

// WebSocket types
export interface WebSocketMessage {
  type: string
  data: any
  timestamp: Date
  id?: string
}

export interface WebSocketEvent {
  event: 'connect' | 'disconnect' | 'message' | 'error'
  data?: any
}

// Theme types
export type Theme = 'light' | 'dark' | 'system'

export interface ThemeConfig {
  theme: Theme
  accentColor: string
  borderRadius: number
}

// Component prop types
export interface DashboardCardProps {
  title: string
  children: React.ReactNode
  className?: string
  loading?: boolean
  error?: string | null
  actions?: React.ReactNode
}

export interface VisualizationProps {
  data: any
  loading?: boolean
  error?: string | null
  className?: string
  height?: number
  width?: number
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: Date
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// File system types
export interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  lastModified?: Date
  children?: FileNode[]
  metadata?: {
    language?: string
    lines?: number
    complexity?: number
  }
}

// Configuration types
export interface DashboardConfig {
  layout: {
    sidebar: {
      collapsed: boolean
      width: number
    }
    theme: ThemeConfig
  }
  features: {
    realtime: boolean
    notifications: boolean
    autoRefresh: boolean
  }
  api: {
    baseUrl: string
    timeout: number
    retries: number
  }
  websocket: {
    url: string
    reconnectInterval: number
    maxReconnectAttempts: number
  }
}

// Error types
export interface DashboardError {
  id: string
  type: 'network' | 'validation' | 'server' | 'client'
  title: string
  message: string
  details?: any
  timestamp: Date
  resolved?: boolean
}

// Export utility types
export type ValueOf<T> = T[keyof T]
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>

// Re-export common types
export * from './dashboard'
export * from './charts'
export * from './websocket'