/**
 * API Type Definitions for Web Client
 *
 * This file contains all API-related type definitions including request/response
 * types, service interfaces, and endpoint-specific data structures.
 *
 * @version 2.0.0
 */

import type {
  ReportType,
  ReportStatus,
  ReportFilters,
  ExportFormat,
  CompleteAnalysisData
} from './reports'
import type {
  AnalysisData
} from './data'

// =============================================================================
// GENERIC API TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  error?: string
  timestamp: string
  meta?: ApiResponseMeta
}

/**
 * API response metadata
 */
export interface ApiResponseMeta {
  /** Total count for paginated responses */
  total?: number
  /** Current page for paginated responses */
  page?: number
  /** Items per page */
  limit?: number
  /** Processing duration in milliseconds */
  duration?: number
  /** API version */
  version?: string
  /** Cache information */
  cache?: {
    hit: boolean
    ttl?: number
    key?: string
  }
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T = unknown> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
  error?: string
  timestamp: string
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  success: false
  data: null
  error: string
  timestamp: string
  details?: {
    code?: string
    field?: string
    stack?: string
  }
}

// =============================================================================
// REPORT API TYPES
// =============================================================================

/**
 * Request to generate a report
 */
export interface GenerateReportRequest {
  /** Template ID to use */
  templateId: string
  /** Report name */
  name: string
  /** Report description */
  description?: string
  /** Report tags */
  tags?: string[]
  /** Template parameters */
  parameters: Record<string, unknown>
  /** Applied filters */
  filters?: ReportFilters
  /** Output formats */
  outputFormats: ExportFormat[]
  /** Report format (for backward compatibility) */
  format?: 'markdown' | 'html' | 'pdf'
}

/**
 * Report generation response
 */
export interface GenerateReportResponse {
  /** Generated report */
  report: Report
  /** Report content */
  reportContent?: string
  /** Markdown content (if requested) */
  markdown?: string
  /** Success flag */
  success: boolean
  /** Status message */
  message: string
}

/**
 * Report definition
 */
export interface Report {
  id: string
  name: string
  type: ReportType
  status: ReportStatus
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  createdBy: string
  description?: string
  tags: string[]
  size?: number
  duration?: number
  metadata: ReportMetadata
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  parameters: Record<string, unknown>
  filters?: ReportFilters
  outputFormat: ExportFormat[]
  analysisEngine?: string
  version?: string
  dataSource?: string
  processingTime?: number
}

/**
 * Report template definition
 */
export interface ReportTemplateDefinition {
  id: string
  name: string
  description: string
  type: ReportType
  category: 'standard' | 'custom' | 'enterprise'
  parameters: ReportParameterDefinition[]
  sections?: ReportSectionDefinition[]
  styling?: ReportStyling
}

/**
 * Report parameter definition
 */
export interface ReportParameterDefinition {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'daterange'
  required: boolean
  defaultValue?: unknown
  options?: Array<{ value: unknown; label: string }>
  description?: string
}

/**
 * Report section definition
 */
export interface ReportSectionDefinition {
  id: string
  title: string
  enabled: boolean
  order: number
  description?: string
}

/**
 * Report styling configuration
 */
export interface ReportStyling {
  theme: string
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    error: string
  }
  fonts: {
    heading: string
    body: string
    code: string
  }
  layout?: {
    margins?: string
    spacing?: string
    borderRadius?: string
  }
}

/**
 * Report service interface for normalization
 */
export interface ReportServiceData {
  /** Normalize analysis data */
  normalizeAnalysisData: (data: unknown) => CompleteAnalysisData
}

// =============================================================================
// GIT API TYPES
// =============================================================================

/**
 * Git operation request
 */
export interface GitOperationRequest {
  action: 'status' | 'log' | 'branches' | 'remotes' | 'tags' | 'stash' | 'diff' | 'blame' | 'show'
  repository?: string
  options?: GitOperationOptions
}

/**
 * Git operation options
 */
export interface GitOperationOptions {
  limit?: number
  since?: string
  until?: string
  author?: string
  grep?: string
  file?: string
  branch?: string
  format?: string
  stat?: boolean
  oneline?: boolean
}

/**
 * Git status information
 */
export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  deleted: string[]
  renamed: string[]
  conflicted: string[]
  clean: boolean
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
  subject: string
  body?: string
  additions: number
  deletions: number
  files: string[]
  refs?: string[]
}

/**
 * Git branch information
 */
export interface GitBranch {
  name: string
  current: boolean
  remote?: string
  lastCommit?: string
  lastCommitDate?: string
  ahead?: number
  behind?: number
}

/**
 * Git remote information
 */
export interface GitRemote {
  name: string
  url: string
  type: 'fetch' | 'push'
}

/**
 * Git tag information
 */
export interface GitTag {
  name: string
  hash: string
  date: string
  message?: string
  author?: string
}

// =============================================================================
// ANALYSIS API TYPES
// =============================================================================

/**
 * Analysis request
 */
export interface AnalysisRequest {
  action: 'trigger_analysis' | 'update_recommendation'
  data: AnalysisRequestData
}

/**
 * Analysis request data
 */
export interface AnalysisRequestData {
  projectId?: string
  recommendationId?: string
  status?: string
}

/**
 * Analysis service interface
 */
export interface AnalysisServiceInterface {
  getInstance(): AnalysisServiceInterface
  getAnalysisData(projectId?: string): Promise<AnalysisData>
}

// =============================================================================
// CONFIG API TYPES
// =============================================================================

/**
 * Configuration file information
 */
export interface ConfigFile {
  name: string
  path: string
  type: 'json' | 'yaml' | 'yml' | 'js' | 'ts' | 'env' | 'toml'
  size: number
  lastModified: string
  content?: Record<string, unknown>
  schema?: ConfigSchema
}

/**
 * Configuration schema definition
 */
export interface ConfigSchema {
  properties: Record<string, ConfigPropertySchema>
  required?: string[]
  additionalProperties?: boolean
}

/**
 * Configuration property schema
 */
export interface ConfigPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  default?: unknown
  required?: boolean
  enum?: unknown[]
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean
  errors: ConfigValidationError[]
  warnings: ConfigValidationWarning[]
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  path: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * Configuration validation warning
 */
export interface ConfigValidationWarning {
  path: string
  message: string
  suggestion?: string
}

/**
 * Configuration template
 */
export interface ConfigTemplate {
  name: string
  description: string
  type: string
  content: Record<string, unknown>
  schema?: ConfigSchema
  tags?: string[]
}

/**
 * Configuration request
 */
export interface ConfigRequest {
  action: 'list' | 'read' | 'write' | 'validate' | 'template' | 'merge' | 'backup'
  configName?: string
  content?: Record<string, unknown>
  templateName?: string
  options?: ConfigRequestOptions
}

/**
 * Configuration request options
 */
export interface ConfigRequestOptions {
  format?: 'json' | 'yaml' | 'env'
  validate?: boolean
  backup?: boolean
  merge?: boolean
}

// =============================================================================
// FILES API TYPES
// =============================================================================

/**
 * File system item
 */
export interface FileSystemItem {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modifiedAt: Date
  extension?: string
  mimeType?: string
  isHidden?: boolean
  children?: FileSystemItem[]
  permissions?: FilePermissions
}

/**
 * File permissions
 */
export interface FilePermissions {
  read: boolean
  write: boolean
  execute: boolean
}

/**
 * File operation request
 */
export interface FileOperationRequest {
  action: 'list' | 'read' | 'write' | 'delete' | 'move' | 'copy' | 'create'
  path: string
  content?: string
  destination?: string
  options?: FileOperationOptions
}

/**
 * File operation options
 */
export interface FileOperationOptions {
  recursive?: boolean
  backup?: boolean
  overwrite?: boolean
  createDirs?: boolean
}

// =============================================================================
// BATCH API TYPES
// =============================================================================

/**
 * Batch job information
 */
export interface BatchJobInfo {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  estimatedDuration: number
  actualDuration?: number
  errors: string[]
  warnings: string[]
}

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
  action: 'create' | 'start' | 'pause' | 'cancel' | 'status' | 'results'
  jobId?: string
  configuration?: BatchConfiguration
}

/**
 * Batch configuration
 */
export interface BatchConfiguration {
  templateIds: string[]
  consolidationType: 'merge' | 'replace' | 'archive'
  priority: 'low' | 'medium' | 'high' | 'critical'
  options?: BatchConfigurationOptions
}

/**
 * Batch configuration options
 */
export interface BatchConfigurationOptions {
  backupStrategy?: 'auto' | 'manual' | 'none'
  conflictResolution?: 'interactive' | 'auto' | 'skip'
  maxConcurrentJobs?: number
  retryAttempts?: number
  timeoutPerTemplate?: number
  rollbackOnFailure?: boolean
}

// =============================================================================
// WEBSOCKET API TYPES
// =============================================================================

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'ping' | 'pong' | 'auth'
  channel?: string
  payload?: WebSocketPayload
  timestamp: string
  id?: string
}

/**
 * WebSocket payload
 */
export interface WebSocketPayload {
  [key: string]: unknown
}

/**
 * WebSocket subscription options
 */
export interface WebSocketSubscriptionOptions {
  channel: string
  filters?: Record<string, unknown>
  frequency?: number
}

// =============================================================================
// PERFORMANCE & MONITORING TYPES
// =============================================================================

/**
 * Performance metrics API response
 */
export interface PerformanceMetricsResponse {
  metrics: PerformanceMetric[]
  aggregated: AggregatedPerformanceMetrics
  trends: PerformanceTrends
}

/**
 * Performance metric
 */
export interface PerformanceMetric {
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

/**
 * Aggregated performance metrics
 */
export interface AggregatedPerformanceMetrics {
  averages: Omit<PerformanceMetric, 'timestamp'>
  totals: Pick<PerformanceMetric, 'buildTime' | 'testDuration'>
  ranges: {
    min: Omit<PerformanceMetric, 'timestamp'>
    max: Omit<PerformanceMetric, 'timestamp'>
  }
}

/**
 * Performance trends
 */
export interface PerformanceTrends {
  buildTime: TrendDirection
  bundleSize: TrendDirection
  memoryUsage: TrendDirection
  loadTime: TrendDirection
  errorRate: TrendDirection
}

/**
 * Trend direction
 */
export type TrendDirection = 'improving' | 'stable' | 'degrading'

// =============================================================================
// SEARCH & QUERY TYPES
// =============================================================================

/**
 * Search request
 */
export interface SearchRequest {
  query: string
  filters?: SearchFilters
  sorting?: SearchSorting
  pagination?: SearchPagination
}

/**
 * Search filters
 */
export interface SearchFilters {
  types?: string[]
  categories?: string[]
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  severity?: string[]
}

/**
 * Search sorting
 */
export interface SearchSorting {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * Search pagination
 */
export interface SearchPagination {
  page: number
  limit: number
}

/**
 * Search response
 */
export interface SearchResponse<T = unknown> {
  results: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  facets?: SearchFacets
  suggestions?: string[]
}

/**
 * Search facets
 */
export interface SearchFacets {
  [key: string]: Array<{
    value: string
    count: number
  }>
}

// =============================================================================
// VALIDATION & UTILITY TYPES
// =============================================================================

/**
 * Validation result
 */
export interface ValidationResult<T = unknown> {
  valid: boolean
  data?: T
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string
  message: string
  code?: string
  value?: unknown
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: Date
  windowSize: number
}

/**
 * API health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: ServiceHealthStatus[]
  version: string
  uptime: number
}

/**
 * Service health status
 */
export interface ServiceHealthStatus {
  name: string
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  lastCheck: string
  error?: string
}

// =============================================================================
// EXPORTS
// =============================================================================

// All interfaces are already exported directly above
// Re-exports removed to prevent TypeScript declaration conflicts