/**
 * Performance Monitoring Type Definitions
 *
 * Comprehensive type definitions for performance monitoring, memory analysis,
 * and system metrics to replace all 'any' types in performance components.
 *
 * @version 1.0.0
 * @author Wundr Development Team
 */

// =============================================================================
// MEMORY MONITORING TYPES
// =============================================================================

/**
 * Memory status analysis result
 */
export interface MemoryStatus {
  /** Whether a memory leak is detected */
  hasLeak: boolean;
  /** Current memory status */
  status: 'normal' | 'elevated' | 'critical' | 'unknown';
  /** Memory usage percentage */
  percentage: number;
  /** Memory usage trend */
  trend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
  /** Growth rate in bytes per second */
  growthRate: number;
  /** Memory usage recommendation */
  recommendation: string;
  /** Detailed analysis */
  analysis?: {
    /** Peak memory usage */
    peakUsage: number;
    /** Average memory usage */
    averageUsage: number;
    /** Memory volatility score */
    volatility: number;
    /** Time to leak detection */
    timeToLeak?: number;
    /** Projected time to critical */
    projectedCritical?: number;
  };
  /** Leak sources if detected */
  leakSources?: Array<{
    /** Source component or module */
    source: string;
    /** Severity of the leak */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Description of the leak */
    description: string;
    /** Suggested fix */
    suggestedFix?: string;
  }>;
}

/**
 * Memory metrics data structure
 */
export interface MemoryMetrics {
  /** Metric timestamp */
  timestamp: number;
  /** Heap memory used in bytes */
  heapUsed: number;
  /** Total heap memory in bytes */
  heapTotal: number;
  /** External memory in bytes */
  external: number;
  /** Resident set size in bytes */
  rss: number;
  /** Array buffers memory in bytes */
  arrayBuffers?: number;
  /** Memory usage percentage */
  percentage?: number;
  /** Memory pressure indicator */
  pressure?: 'low' | 'medium' | 'high';
}

/**
 * System performance metrics
 */
export interface SystemMetrics {
  /** Memory metrics */
  memory: {
    /** Used memory in bytes */
    used: number;
    /** Total memory in bytes */
    total: number;
    /** Memory usage percentage */
    percentage: number;
    /** Available memory in bytes */
    available?: number;
    /** Free memory in bytes */
    free?: number;
    /** Buffer memory in bytes */
    buffers?: number;
    /** Cache memory in bytes */
    cached?: number;
  };
  /** CPU metrics */
  cpu: {
    /** CPU usage percentage */
    usage: number;
    /** CPU cores count */
    cores?: number;
    /** CPU load average */
    loadAverage?: number[];
    /** CPU frequency in MHz */
    frequency?: number;
    /** CPU temperature in Celsius */
    temperature?: number;
  };
  /** UI performance metrics */
  fps: number;
  /** DOM nodes count */
  domNodes: number;
  /** Metrics timestamp */
  timestamp: number;
  /** Additional metrics */
  additional?: {
    /** Network latency in milliseconds */
    networkLatency?: number;
    /** Disk I/O rate */
    diskIO?: number;
    /** Active connections count */
    activeConnections?: number;
    /** Thread count */
    threadCount?: number;
  };
}

/**
 * Concurrency performance data
 */
export interface ConcurrencyMetrics {
  /** Metrics timestamp */
  timestamp: number;
  /** Active workers count */
  activeWorkers: number;
  /** Queued tasks count */
  queuedTasks: number;
  /** Throughput per second */
  throughput: number;
  /** Average task duration */
  averageTaskDuration?: number;
  /** Failed tasks count */
  failedTasks?: number;
  /** Worker utilization percentage */
  workerUtilization?: number;
  /** Queue length over time */
  queueHistory?: number[];
  /** Performance bottlenecks */
  bottlenecks?: Array<{
    /** Bottleneck type */
    type: 'cpu' | 'memory' | 'io' | 'network' | 'database';
    /** Severity level */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Description */
    description: string;
    /** Impact on performance */
    impact: string;
  }>;
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlert {
  /** Alert identifier */
  id: string;
  /** Alert type */
  type: 'memory' | 'cpu' | 'network' | 'custom';
  /** Alert severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Alert title */
  title: string;
  /** Alert message */
  message: string;
  /** Alert timestamp */
  timestamp: number;
  /** Alert threshold that was breached */
  threshold?: {
    /** Metric name */
    metric: string;
    /** Threshold value */
    value: number;
    /** Comparison operator */
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
    /** Duration threshold was exceeded */
    duration?: number;
  };
  /** Suggested actions */
  actions?: string[];
  /** Alert acknowledgment */
  acknowledged?: boolean;
  /** Alert resolution */
  resolved?: boolean;
  /** Resolution timestamp */
  resolvedAt?: number;
  /** Resolution notes */
  resolutionNotes?: string;
}

// =============================================================================
// MONITORING CONFIGURATION TYPES
// =============================================================================

/**
 * Performance monitoring configuration
 */
export interface MonitoringConfig {
  /** Monitoring enabled */
  enabled: boolean;
  /** Sampling interval in milliseconds */
  samplingInterval: number;
  /** Data retention period in milliseconds */
  retentionPeriod: number;
  /** Alert thresholds */
  thresholds: {
    /** Memory usage threshold percentage */
    memoryUsage: number;
    /** CPU usage threshold percentage */
    cpuUsage: number;
    /** FPS threshold */
    fps: number;
    /** Memory leak detection threshold */
    memoryLeakRate: number;
    /** Response time threshold in milliseconds */
    responseTime: number;
    /** Error rate threshold percentage */
    errorRate: number;
  };
  /** Metrics to collect */
  metricsToCollect: Array<'memory' | 'cpu' | 'network' | 'ui' | 'custom'>;
  /** Auto-remediation enabled */
  autoRemediation: boolean;
  /** Notification settings */
  notifications: {
    /** Email notifications enabled */
    email: boolean;
    /** Browser notifications enabled */
    browser: boolean;
    /** Webhook notifications enabled */
    webhook: boolean;
    /** Webhook URL */
    webhookUrl?: string;
  };
}

/**
 * Performance benchmark configuration
 */
export interface BenchmarkConfig {
  /** Benchmark name */
  name: string;
  /** Benchmark description */
  description: string;
  /** Target metrics */
  targets: {
    /** Target memory usage in MB */
    memoryUsage?: number;
    /** Target CPU usage percentage */
    cpuUsage?: number;
    /** Target FPS */
    fps?: number;
    /** Target load time in milliseconds */
    loadTime?: number;
    /** Target response time in milliseconds */
    responseTime?: number;
  };
  /** Test duration in milliseconds */
  duration: number;
  /** Warm-up period in milliseconds */
  warmupPeriod: number;
  /** Number of iterations */
  iterations: number;
  /** Concurrent users simulation */
  concurrency?: number;
}

// =============================================================================
// CHART SPECIFIC PERFORMANCE TYPES
// =============================================================================

/**
 * Chart performance metrics
 */
export interface ChartPerformanceData {
  /** Chart identifier */
  chartId: string;
  /** Render time in milliseconds */
  renderTime: number;
  /** Data points count */
  dataPoints: number;
  /** Memory usage for chart in bytes */
  memoryUsage: number;
  /** Animation frame rate */
  animationFPS: number;
  /** Interaction latency in milliseconds */
  interactionLatency: number;
  /** Chart update frequency */
  updateFrequency: number;
  /** Performance timestamp */
  timestamp: number;
}

/**
 * Visualization performance optimization
 */
export interface VisualizationOptimization {
  /** Optimization type */
  type: 'downsampling' | 'virtualization' | 'caching' | 'lazy-loading';
  /** Optimization enabled */
  enabled: boolean;
  /** Optimization parameters */
  parameters: {
    /** Sample size for downsampling */
    sampleSize?: number;
    /** Cache TTL in milliseconds */
    cacheTtl?: number;
    /** Viewport buffer size */
    bufferSize?: number;
    /** Lazy loading threshold */
    lazyThreshold?: number;
  };
  /** Performance impact */
  impact?: {
    /** Render time improvement percentage */
    renderTimeImprovement: number;
    /** Memory usage reduction percentage */
    memoryReduction: number;
    /** FPS improvement */
    fpsImprovement: number;
  };
}

// =============================================================================
// PERFORMANCE REPORT TYPES
// =============================================================================

/**
 * Performance analysis report
 */
export interface PerformanceReport {
  /** Report identifier */
  id: string;
  /** Report timestamp */
  timestamp: number;
  /** Analysis period */
  period: {
    /** Start time */
    start: number;
    /** End time */
    end: number;
    /** Duration in milliseconds */
    duration: number;
  };
  /** System metrics summary */
  systemMetrics: SystemMetrics;
  /** Memory analysis */
  memoryAnalysis: {
    /** Current status */
    status: MemoryStatus;
    /** Historical data */
    history: MemoryMetrics[];
    /** Trend analysis */
    trends: {
      /** Overall trend */
      overall: 'improving' | 'stable' | 'degrading';
      /** Short-term trend */
      shortTerm: 'improving' | 'stable' | 'degrading';
      /** Predicted future usage */
      prediction: number[];
    };
  };
  /** Performance alerts */
  alerts: PerformanceAlert[];
  /** Recommendations */
  recommendations: Array<{
    /** Recommendation type */
    type: 'optimization' | 'configuration' | 'hardware' | 'software';
    /** Priority level */
    priority: 'low' | 'medium' | 'high' | 'critical';
    /** Recommendation title */
    title: string;
    /** Detailed description */
    description: string;
    /** Expected impact */
    expectedImpact: string;
    /** Implementation effort */
    effort: 'low' | 'medium' | 'high';
  }>;
  /** Performance score */
  score: {
    /** Overall score (0-100) */
    overall: number;
    /** Memory score */
    memory: number;
    /** CPU score */
    cpu: number;
    /** UI responsiveness score */
    ui: number;
    /** Network score */
    network: number;
  };
}

// =============================================================================
// EXPORT SPECIALIZED TYPES
// =============================================================================

/**
 * Performance metric data point
 */
export interface PerformanceDataPoint {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Value unit */
  unit: string;
  /** Data point timestamp */
  timestamp: number;
  /** Metric category */
  category: 'memory' | 'cpu' | 'network' | 'ui' | 'custom';
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Optional tags */
  tags?: Record<string, string>;
}

/**
 * Performance monitoring hook configuration
 */
export interface PerformanceHookConfig {
  /** Monitoring enabled */
  enabled: boolean;
  /** Update interval in milliseconds */
  interval: number;
  /** Maximum data points to retain */
  maxDataPoints: number;
  /** Auto-start monitoring */
  autoStart: boolean;
  /** Metrics to track */
  metrics: Array<'memory' | 'cpu' | 'fps' | 'dom' | 'network'>;
  /** Alert callback */
  onAlert?: (alert: PerformanceAlert) => void;
  /** Memory leak callback */
  onMemoryLeak?: (status: MemoryStatus) => void;
  /** Performance degradation callback */
  onPerformanceDegradation?: (metrics: SystemMetrics) => void;
}

// Types are already exported as interfaces above