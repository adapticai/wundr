/**
 * Performance & Optimization Types for Genesis-App
 * Caching, metrics, and optimization configurations
 */

/** Cache configuration */
export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum entries
  staleWhileRevalidate?: number; // Grace period for stale data
  tags?: string[]; // Cache tags for invalidation
}

/** Cache entry */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  tags: string[];
  hits: number;
  lastAccessed: number;
}

/** Cache statistics */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  hitRate: number;
  avgTtl: number;
}

/** Performance metric types */
export type MetricType =
  | 'timing'
  | 'counter'
  | 'gauge'
  | 'histogram';

/**
 * Typed context for performance metrics.
 */
export interface PerformanceMetricContext {
  /** Component name if component-related */
  componentName?: string;
  /** Route path if navigation-related */
  routePath?: string;
  /** API endpoint if request-related */
  endpoint?: string;
  /** User ID for user-specific metrics */
  userId?: string;
  /** Session ID for session tracking */
  sessionId?: string;
  /** Request ID for request tracing */
  requestId?: string;
  /** Error message if error-related */
  errorMessage?: string;
  /** Additional string context values */
  [key: string]: string | number | boolean | undefined;
}

/** Performance metric */
export interface PerformanceMetric {
  name: string;
  type: MetricType;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
  context?: PerformanceMetricContext;
}

/** Core Web Vitals */
export interface CoreWebVitals {
  /** Largest Contentful Paint (ms) */
  lcp: number | null;
  /** First Input Delay (ms) */
  fid: number | null;
  /** Cumulative Layout Shift (score) */
  cls: number | null;
  /** First Contentful Paint (ms) */
  fcp: number | null;
  /** Time to First Byte (ms) */
  ttfb: number | null;
  /** Interaction to Next Paint (ms) */
  inp: number | null;
}

/** Web Vitals thresholds */
export const WEB_VITALS_THRESHOLDS = {
  lcp: { good: 2500, needsImprovement: 4000 },
  fid: { good: 100, needsImprovement: 300 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  fcp: { good: 1800, needsImprovement: 3000 },
  ttfb: { good: 800, needsImprovement: 1800 },
  inp: { good: 200, needsImprovement: 500 },
} as const;

/** Performance rating */
export type PerformanceRating = 'good' | 'needs-improvement' | 'poor';

/** Bundle analysis */
export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkInfo[];
  modules: ModuleInfo[];
  treeshakingPotential: number;
  unusedExports: string[];
}

/** Chunk info */
export interface ChunkInfo {
  name: string;
  size: number;
  gzippedSize: number;
  modules: number;
  isAsync: boolean;
  isEntry: boolean;
}

/** Module info */
export interface ModuleInfo {
  name: string;
  size: number;
  dependencies: string[];
  dependents: string[];
  isTreeShakeable: boolean;
}

/** Resource timing */
export interface ResourceTiming {
  name: string;
  entryType: 'resource';
  startTime: number;
  duration: number;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

/** Navigation timing */
export interface NavigationTiming {
  redirectTime: number;
  dnsLookupTime: number;
  tcpConnectTime: number;
  tlsNegotiationTime: number;
  requestTime: number;
  responseTime: number;
  domProcessingTime: number;
  domInteractiveTime: number;
  loadCompleteTime: number;
}

/** Memory usage */
export interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  utilizationPercentage: number;
}

/** Render metrics */
export interface RenderMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  avgRenderTime: number;
  lastRenderTime: number;
  maxRenderTime: number;
}

/** Database query metrics */
export interface QueryMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  rowsScanned: number;
  indexUsed: boolean;
  cacheHit: boolean;
  timestamp: number;
}

/** API metrics */
export interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: number;
  userId?: string;
}

/** Performance budget */
export interface PerformanceBudget {
  metric: keyof CoreWebVitals | 'bundleSize' | 'imageSize' | 'scriptSize';
  budget: number;
  unit: 'ms' | 'bytes' | 'score';
  warning: number; // Warning threshold percentage
}

/** Default performance budgets */
export const DEFAULT_PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  { metric: 'lcp', budget: 2500, unit: 'ms', warning: 80 },
  { metric: 'fid', budget: 100, unit: 'ms', warning: 80 },
  { metric: 'cls', budget: 0.1, unit: 'score', warning: 80 },
  { metric: 'bundleSize', budget: 500000, unit: 'bytes', warning: 80 },
  { metric: 'imageSize', budget: 200000, unit: 'bytes', warning: 80 },
  { metric: 'scriptSize', budget: 300000, unit: 'bytes', warning: 80 },
];

/** Optimization suggestion */
export interface OptimizationSuggestion {
  id: string;
  category: 'images' | 'scripts' | 'styles' | 'fonts' | 'caching' | 'rendering' | 'network';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  code?: string;
}

/** Prefetch strategy */
export type PrefetchStrategy = 'hover' | 'visible' | 'idle' | 'immediate';

/** Lazy loading config */
export interface LazyLoadConfig {
  rootMargin: string;
  threshold: number | number[];
  placeholder?: string;
  errorFallback?: string;
}

/** Image optimization config */
export interface ImageOptimizationConfig {
  quality: number;
  formats: ('webp' | 'avif' | 'png' | 'jpg')[];
  sizes: number[];
  lazyLoad: boolean;
  blur: boolean;
  priority: boolean;
}

/** Code splitting config */
export interface CodeSplittingConfig {
  routes: boolean;
  components: boolean;
  vendors: boolean;
  minSize: number;
  maxSize: number;
  maxAsyncRequests: number;
}

/** Service worker cache strategy */
export type CacheStrategy =
  | 'cache-first'
  | 'network-first'
  | 'stale-while-revalidate'
  | 'network-only'
  | 'cache-only';

/** Service worker config */
export interface ServiceWorkerConfig {
  enabled: boolean;
  precache: string[];
  runtimeCache: RuntimeCacheRule[];
  offlineFallback: string;
  skipWaiting: boolean;
  clientsClaim: boolean;
}

/** Runtime cache rule */
export interface RuntimeCacheRule {
  urlPattern: string | RegExp;
  handler: CacheStrategy;
  options: {
    cacheName: string;
    expiration?: {
      maxEntries: number;
      maxAgeSeconds: number;
    };
    networkTimeoutSeconds?: number;
  };
}

/** Base request info for deduplication and rate limiting */
export interface BaseRequestInfo {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | null;
}

/** Request deduplication config */
export interface DeduplicationConfig<TRequest extends BaseRequestInfo = BaseRequestInfo> {
  enabled: boolean;
  windowMs: number;
  keyGenerator: (request: TRequest) => string;
}

/** Rate limiting config */
export interface RateLimitConfig<TRequest extends BaseRequestInfo = BaseRequestInfo> {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: TRequest) => string;
  onRateLimited: (key: string) => void;
}

/** Virtualization config */
export interface VirtualizationConfig {
  itemHeight: number | ((index: number) => number);
  overscan: number;
  scrollingDelay: number;
  estimatedItemSize?: number;
}

/**
 * Typed arguments for memoization key generation.
 * Supports common serializable types.
 */
export type MemoizationArg = string | number | boolean | null | undefined | MemoizationArg[];

/**
 * Generic arguments type for memoization - allows any function arguments
 * since the memoize utility needs to work with arbitrary functions.
 */
export type MemoizationArgs = readonly unknown[];

/** Memoization config */
export interface MemoizationConfig {
  maxSize: number;
  ttl: number;
  /** Key generator function that receives the original function arguments */
  keyGenerator?: (...args: MemoizationArgs) => string;
}
