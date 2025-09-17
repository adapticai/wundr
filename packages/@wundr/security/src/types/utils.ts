/**
 * Security Utility Types and Helper Functions
 * Comprehensive utility types for security operations, validation, sanitization, and helper functions
 *
 * @fileoverview Complete utility type definitions for security operations across all modules
 * @author Security Types Specialist
 * @version 1.0.0
 */

// Import base types to avoid circular dependencies
import {
  SecuritySeverity,
  SecurityAlgorithm,
  ComplianceFramework
} from './base';

import type {
  SecurityId,
  SecurityTimestamp,
  SecurityAttributeValue
} from './base';

// Import enums as values since they're used in default parameters and comparisons

/**
 * Base security context interface
 */
export interface SecurityContext {
  readonly userId?: SecurityId;
  readonly sessionId?: SecurityId;
  readonly requestId: SecurityId;
  readonly timestamp: SecurityTimestamp;
  readonly source: {
    readonly application: string;
    readonly version: string;
    readonly component?: string;
  };
  readonly environment: 'production' | 'staging' | 'development' | 'test' | 'local';
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Security error information
 */
export interface SecurityError {
  readonly code: string;
  readonly message: string;
  readonly details?: {
    readonly field?: string;
    readonly value?: SecurityAttributeValue;
    readonly constraint?: string;
    readonly context?: Record<string, SecurityAttributeValue>;
  };
  readonly cause?: SecurityError;
  readonly timestamp: SecurityTimestamp;
  readonly severity: SecuritySeverity;
}

/**
 * Base security result interface
 */
export interface SecurityResult<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: SecurityError;
  readonly warnings?: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: SecuritySeverity;
    readonly recommendation?: string;
  }[];
  readonly metadata: {
    readonly processingTime: number;
    readonly version: string;
    readonly checksPerformed: readonly string[];
    readonly rulesApplied: readonly string[];
  };
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  readonly valid: boolean;
  readonly violations: readonly {
    readonly rule: string;
    readonly severity: SecuritySeverity;
    readonly message: string;
    readonly field?: string;
    readonly value?: SecurityAttributeValue;
  }[];
  readonly score?: number; // 0-100 security score
  readonly confidence?: number; // 0-1 confidence level
  readonly recommendations?: readonly string[];
}

/**
 * Security validation utilities
 */
export namespace SecurityValidation {
  /**
   * Validation rule definition
   */
  export interface ValidationRule<T = unknown> {
    readonly name: string;
    readonly description: string;
    readonly severity: SecuritySeverity;
    readonly enabled: boolean;
    readonly validator: ValidationFunction<T>;
    readonly metadata?: ValidationRuleMetadata;
  }

  /**
   * Validation function signature
   */
  export type ValidationFunction<T = unknown> = (
    value: T,
    context?: SecurityContext
  ) => ValidationRuleResult;

  /**
   * Validation rule result
   */
  export interface ValidationRuleResult {
    readonly valid: boolean;
    readonly message?: string;
    readonly details?: ValidationErrorDetails;
    readonly score?: number; // 0-100
  }

  /**
   * Validation error details
   */
  export interface ValidationErrorDetails {
    readonly field?: string;
    readonly constraint?: string;
    readonly actualValue?: SecurityAttributeValue;
    readonly expectedValue?: SecurityAttributeValue;
    readonly context?: Record<string, SecurityAttributeValue>;
  }

  /**
   * Validation rule metadata
   */
  export interface ValidationRuleMetadata {
    readonly framework?: ComplianceFramework;
    readonly category: ValidationCategory;
    readonly tags?: readonly string[];
    readonly references?: readonly string[];
    readonly author?: string;
    readonly version?: string;
  }

  /**
   * Validation categories
   */
  export enum ValidationCategory {
    INPUT_VALIDATION = 'input_validation',
    OUTPUT_ENCODING = 'output_encoding',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    SESSION_MANAGEMENT = 'session_management',
    CRYPTOGRAPHY = 'cryptography',
    ERROR_HANDLING = 'error_handling',
    LOGGING = 'logging',
    DATA_PROTECTION = 'data_protection',
    COMMUNICATION = 'communication'
  }

  /**
   * Validation configuration
   */
  export interface ValidationConfig {
    readonly rules: readonly ValidationRule[];
    readonly strictMode: boolean;
    readonly failFast: boolean;
    readonly timeout: number; // milliseconds
    readonly maxConcurrentValidations: number;
  }

  /**
   * Validation context
   */
  export interface ValidationContext extends SecurityContext {
    readonly rules: readonly string[]; // Rule names to apply
    readonly skipRules?: readonly string[]; // Rule names to skip
    readonly customParams?: Record<string, SecurityAttributeValue>;
  }

  /**
   * Batch validation result
   */
  export interface BatchValidationResult {
    readonly results: Record<string, SecurityValidationResult>;
    readonly summary: ValidationSummary;
    readonly executionTime: number;
  }

  /**
   * Validation summary
   */
  export interface ValidationSummary {
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly failedChecks: number;
    readonly overallScore: number; // 0-100
    readonly severityBreakdown: Record<SecuritySeverity, number>;
  }
}

/**
 * Security sanitization utilities
 */
export namespace SecuritySanitization {
  /**
   * Sanitization options
   */
  export interface SanitizationOptions {
    readonly method: SanitizationMethod;
    readonly encoding: SanitizationEncoding;
    readonly allowList?: readonly string[];
    readonly denyList?: readonly string[];
    readonly customRules?: readonly SanitizationRule[];
    readonly strictMode: boolean;
  }

  /**
   * Sanitization methods
   */
  export enum SanitizationMethod {
    HTML_ESCAPE = 'html_escape',
    URL_ENCODE = 'url_encode',
    SQL_ESCAPE = 'sql_escape',
    LDAP_ESCAPE = 'ldap_escape',
    XML_ESCAPE = 'xml_escape',
    JSON_ESCAPE = 'json_escape',
    COMMAND_ESCAPE = 'command_escape',
    REGEX_ESCAPE = 'regex_escape',
    CUSTOM = 'custom'
  }

  /**
   * Sanitization encoding
   */
  export enum SanitizationEncoding {
    UTF8 = 'utf8',
    ASCII = 'ascii',
    BASE64 = 'base64',
    HEX = 'hex',
    URL = 'url',
    HTML = 'html'
  }

  /**
   * Sanitization rule
   */
  export interface SanitizationRule {
    readonly name: string;
    readonly pattern: string | RegExp;
    readonly replacement: string;
    readonly flags?: string;
    readonly priority: number;
  }

  /**
   * Sanitization result
   */
  export interface SanitizationResult {
    readonly sanitized: string;
    readonly original: string;
    readonly applied: readonly string[]; // Rule names applied
    readonly modified: boolean;
    readonly warnings?: readonly string[];
  }

  /**
   * Sanitization context
   */
  export interface SanitizationContext {
    readonly contentType: ContentType;
    readonly target: SanitizationTarget;
    readonly trustLevel: TrustLevel;
    readonly customContext?: Record<string, SecurityAttributeValue>;
  }

  /**
   * Content types for sanitization
   */
  export enum ContentType {
    HTML = 'html',
    XML = 'xml',
    JSON = 'json',
    SQL = 'sql',
    LDAP = 'ldap',
    COMMAND = 'command',
    URL = 'url',
    EMAIL = 'email',
    FILENAME = 'filename',
    PLAIN_TEXT = 'plain_text'
  }

  /**
   * Sanitization targets
   */
  export enum SanitizationTarget {
    DATABASE = 'database',
    FILESYSTEM = 'filesystem',
    NETWORK = 'network',
    DISPLAY = 'display',
    LOG = 'log',
    STORAGE = 'storage',
    TRANSMISSION = 'transmission'
  }

  /**
   * Trust levels for input
   */
  export enum TrustLevel {
    UNTRUSTED = 0,
    LOW = 1,
    MEDIUM = 2,
    HIGH = 3,
    TRUSTED = 4
  }
}

/**
 * Security transformation utilities
 */
export namespace SecurityTransformation {
  /**
   * Transformation operation
   */
  export interface TransformationOperation<TInput = unknown, TOutput = unknown> {
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly transform: TransformFunction<TInput, TOutput>;
    readonly reverse?: TransformFunction<TOutput, TInput>;
    readonly metadata?: TransformationMetadata;
  }

  /**
   * Transform function signature
   */
  export type TransformFunction<TInput = unknown, TOutput = unknown> = (
    input: TInput,
    options?: TransformationOptions,
    context?: SecurityContext
  ) => Promise<TransformationResult<TOutput>>;

  /**
   * Transformation options
   */
  export interface TransformationOptions {
    readonly algorithm?: SecurityAlgorithm;
    readonly parameters?: Record<string, SecurityAttributeValue>;
    readonly encoding?: string;
    readonly format?: string;
    readonly compression?: boolean;
    readonly validation?: boolean;
  }

  /**
   * Transformation result
   */
  export interface TransformationResult<T = unknown> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: SecurityError;
    readonly metadata: TransformationResultMetadata;
  }

  /**
   * Transformation result metadata
   */
  export interface TransformationResultMetadata {
    readonly operation: string;
    readonly algorithm?: SecurityAlgorithm;
    readonly inputSize: number;
    readonly outputSize: number;
    readonly processingTime: number;
    readonly checksums?: Record<string, string>;
  }

  /**
   * Transformation metadata
   */
  export interface TransformationMetadata {
    readonly category: TransformationCategory;
    readonly complexity: TransformationComplexity;
    readonly reversible: boolean;
    readonly deterministic: boolean;
    readonly threadSafe: boolean;
  }

  /**
   * Transformation categories
   */
  export enum TransformationCategory {
    ENCRYPTION = 'encryption',
    DECRYPTION = 'decryption',
    HASHING = 'hashing',
    ENCODING = 'encoding',
    COMPRESSION = 'compression',
    NORMALIZATION = 'normalization',
    TOKENIZATION = 'tokenization',
    MASKING = 'masking'
  }

  /**
   * Transformation complexity levels
   */
  export enum TransformationComplexity {
    CONSTANT = 'O(1)',
    LINEAR = 'O(n)',
    LOGARITHMIC = 'O(log n)',
    QUADRATIC = 'O(n²)',
    EXPONENTIAL = 'O(2^n)'
  }
}

/**
 * Security caching utilities
 */
export namespace SecurityCaching {
  /**
   * Cache entry
   */
  export interface CacheEntry<T = unknown> {
    readonly key: string;
    readonly value: T;
    readonly timestamp: SecurityTimestamp;
    readonly ttl: number; // Time to live in milliseconds
    readonly accessCount: number;
    readonly metadata?: CacheEntryMetadata;
  }

  /**
   * Cache entry metadata
   */
  export interface CacheEntryMetadata {
    readonly encrypted: boolean;
    readonly compressed: boolean;
    readonly checksums?: Record<string, string>;
    readonly tags?: readonly string[];
    readonly dependencies?: readonly string[];
  }

  /**
   * Cache configuration
   */
  export interface CacheConfig {
    readonly maxSize: number; // Maximum number of entries
    readonly defaultTtl: number; // Default TTL in milliseconds
    readonly evictionPolicy: EvictionPolicy;
    readonly encryption: boolean;
    readonly compression: boolean;
    readonly persistence: boolean;
  }

  /**
   * Cache eviction policies
   */
  export enum EvictionPolicy {
    LRU = 'lru', // Least Recently Used
    LFU = 'lfu', // Least Frequently Used
    FIFO = 'fifo', // First In, First Out
    TTL = 'ttl', // Time To Live
    RANDOM = 'random'
  }

  /**
   * Cache statistics
   */
  export interface CacheStatistics {
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number; // 0-1
    readonly size: number;
    readonly maxSize: number;
    readonly evictions: number;
    readonly averageAccessTime: number; // milliseconds
  }

  /**
   * Cache operation result
   */
  export interface CacheOperationResult<T = unknown> {
    readonly success: boolean;
    readonly data?: T;
    readonly hit: boolean;
    readonly executionTime: number;
    readonly error?: SecurityError;
  }
}

/**
 * Security serialization utilities
 */
export namespace SecuritySerialization {
  /**
   * Serialization format
   */
  export enum SerializationFormat {
    JSON = 'json',
    XML = 'xml',
    YAML = 'yaml',
    PROTOBUF = 'protobuf',
    MSGPACK = 'msgpack',
    AVRO = 'avro',
    BINARY = 'binary'
  }

  /**
   * Serialization options
   */
  export interface SerializationOptions {
    readonly format: SerializationFormat;
    readonly encryption?: EncryptionOptions;
    readonly compression?: CompressionOptions;
    readonly validation?: boolean;
    readonly metadata?: boolean;
  }

  /**
   * Encryption options for serialization
   */
  export interface EncryptionOptions {
    readonly algorithm: SecurityAlgorithm;
    readonly keyId: SecurityId;
    readonly iv?: string;
    readonly aad?: string; // Additional Authenticated Data
  }

  /**
   * Compression options
   */
  export interface CompressionOptions {
    readonly algorithm: CompressionAlgorithm;
    readonly level?: number; // 1-9
    readonly threshold?: number; // Minimum size to compress
  }

  /**
   * Compression algorithms
   */
  export enum CompressionAlgorithm {
    GZIP = 'gzip',
    DEFLATE = 'deflate',
    BROTLI = 'brotli',
    LZ4 = 'lz4',
    ZSTD = 'zstd'
  }

  /**
   * Serialization result
   */
  export interface SerializationResult {
    readonly data: string | Buffer;
    readonly format: SerializationFormat;
    readonly originalSize: number;
    readonly serializedSize: number;
    readonly encrypted: boolean;
    readonly compressed: boolean;
    readonly checksum: string;
    readonly metadata?: SerializationMetadata;
  }

  /**
   * Serialization metadata
   */
  export interface SerializationMetadata {
    readonly version: string;
    readonly timestamp: SecurityTimestamp;
    readonly algorithm?: SecurityAlgorithm;
    readonly compression?: CompressionAlgorithm;
    readonly schema?: string;
  }
}

/**
 * Security rate limiting utilities
 */
export namespace SecurityRateLimiting {
  /**
   * Rate limit configuration
   */
  export interface RateLimitConfig {
    readonly windowMs: number; // Time window in milliseconds
    readonly maxRequests: number; // Maximum requests per window
    readonly algorithm: RateLimitAlgorithm;
    readonly keyGenerator: RateLimitKeyGenerator;
    readonly storage: RateLimitStorage;
    readonly skipSuccessfulRequests?: boolean;
    readonly skipFailedRequests?: boolean;
  }

  /**
   * Rate limiting algorithms
   */
  export enum RateLimitAlgorithm {
    FIXED_WINDOW = 'fixed_window',
    SLIDING_WINDOW = 'sliding_window',
    TOKEN_BUCKET = 'token_bucket',
    LEAKY_BUCKET = 'leaky_bucket'
  }

  /**
   * Rate limit key generator function
   */
  export type RateLimitKeyGenerator = (context: SecurityContext) => string;

  /**
   * Rate limit storage interface
   */
  export interface RateLimitStorage {
    get(key: string): Promise<RateLimitEntry | null>;
    set(key: string, entry: RateLimitEntry, ttl: number): Promise<void>;
    increment(key: string, ttl: number): Promise<RateLimitEntry>;
    reset(key: string): Promise<void>;
  }

  /**
   * Rate limit entry
   */
  export interface RateLimitEntry {
    readonly count: number;
    readonly resetTime: SecurityTimestamp;
    readonly firstRequest: SecurityTimestamp;
    readonly lastRequest: SecurityTimestamp;
  }

  /**
   * Rate limit result
   */
  export interface RateLimitResult {
    readonly allowed: boolean;
    readonly limit: number;
    readonly remaining: number;
    readonly resetTime: SecurityTimestamp;
    readonly retryAfter?: number; // milliseconds
  }
}

/**
 * Security monitoring utilities
 */
export namespace SecurityMonitoring {
  /**
   * Security metric definition
   */
  export interface SecurityMetricDefinition {
    readonly name: string;
    readonly description: string;
    readonly unit: MetricUnit;
    readonly type: MetricType;
    readonly aggregation: MetricAggregation;
    readonly threshold?: SecurityThreshold;
  }

  /**
   * Metric units
   */
  export enum MetricUnit {
    COUNT = 'count',
    PERCENTAGE = 'percentage',
    BYTES = 'bytes',
    MILLISECONDS = 'milliseconds',
    SECONDS = 'seconds',
    REQUESTS_PER_SECOND = 'rps',
    SCORE = 'score'
  }

  /**
   * Metric types
   */
  export enum MetricType {
    COUNTER = 'counter',
    GAUGE = 'gauge',
    HISTOGRAM = 'histogram',
    TIMER = 'timer'
  }

  /**
   * Metric aggregation methods
   */
  export enum MetricAggregation {
    SUM = 'sum',
    AVERAGE = 'average',
    MINIMUM = 'minimum',
    MAXIMUM = 'maximum',
    PERCENTILE_95 = 'p95',
    PERCENTILE_99 = 'p99'
  }

  /**
   * Security threshold definition
   */
  export interface SecurityThreshold {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
    readonly unit: MetricUnit;
  }

  /**
   * Monitoring alert
   */
  export interface SecurityAlert {
    readonly id: SecurityId;
    readonly name: string;
    readonly severity: SecuritySeverity;
    readonly metric: string;
    readonly value: number;
    readonly threshold: number;
    readonly timestamp: SecurityTimestamp;
    readonly context: SecurityContext;
    readonly actions?: readonly AlertAction[];
  }

  /**
   * Alert actions
   */
  export interface AlertAction {
    readonly type: AlertActionType;
    readonly parameters: Record<string, SecurityAttributeValue>;
    readonly automatic: boolean;
    readonly delay?: number; // milliseconds
  }

  /**
   * Alert action types
   */
  export enum AlertActionType {
    NOTIFICATION = 'notification',
    BLOCK_IP = 'block_ip',
    LOCK_ACCOUNT = 'lock_account',
    ESCALATE = 'escalate',
    REMEDIATE = 'remediate',
    LOG = 'log'
  }
}

/**
 * Security utility helper functions
 */
export namespace SecurityHelpers {
  /**
   * Type guard utilities
   */
  export const isSecurityError = (value: unknown): value is SecurityError => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      'message' in value &&
      'severity' in value &&
      'timestamp' in value
    );
  };

  export const isSecurityToken = (value: unknown): value is string => {
    return typeof value === 'string' && value.length > 0;
  };

  export const isValidSecurityLevel = (level: unknown): level is SecuritySeverity => {
    return Object.values(SecuritySeverity).includes(level as SecuritySeverity);
  };

  /**
   * Utility functions for common operations
   */
  export const generateSecureRandom = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  export const hashString = async (input: string, algorithm: SecurityAlgorithm = SecurityAlgorithm.SHA256): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    let hashAlgorithm: string;
    switch (algorithm) {
      case SecurityAlgorithm.SHA256:
        hashAlgorithm = 'SHA-256';
        break;
      case SecurityAlgorithm.SHA384:
        hashAlgorithm = 'SHA-384';
        break;
      case SecurityAlgorithm.SHA512:
        hashAlgorithm = 'SHA-512';
        break;
      default:
        hashAlgorithm = 'SHA-256';
    }

    const hashBuffer = await crypto.subtle.digest(hashAlgorithm, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  export const constantTimeCompare = (a: string, b: string): boolean => {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  };

  export const sanitizeForLog = (input: string): string => {
    return input
      .replace(/\r\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[^\x20-\x7E]/g, '?'); // Replace non-printable characters
  };

  export const maskSensitiveData = (input: string, maskChar: string = '*'): string => {
    if (input.length <= 4) {
      return maskChar.repeat(input.length);
    }

    const visibleStart = Math.min(2, Math.floor(input.length * 0.2));
    const visibleEnd = Math.min(2, Math.floor(input.length * 0.2));
    const maskedLength = input.length - visibleStart - visibleEnd;

    return input.substring(0, visibleStart) +
           maskChar.repeat(maskedLength) +
           input.substring(input.length - visibleEnd);
  };

  export const validateTimeWindow = (
    timestamp: SecurityTimestamp,
    windowMs: number,
    clockSkewMs: number = 30000
  ): boolean => {
    const now = Date.now();
    const eventTime = new Date(timestamp).getTime();
    const timeDiff = Math.abs(now - eventTime);

    return timeDiff <= (windowMs + clockSkewMs);
  };

  export const calculateRiskScore = (
    factors: Record<string, number>,
    weights?: Record<string, number>
  ): number => {
    const defaultWeights = weights || {};
    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, score] of Object.entries(factors)) {
      const weight = defaultWeights[factor] || 1;
      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(Math.max(totalScore / totalWeight, 0), 1) : 0;
  };

  export const createSecurityFingerprint = async (context: SecurityContext): Promise<string> => {
    const fingerprintData = {
      source: context.source,
      environment: context.environment,
      metadata: context.metadata
    };

    return hashString(JSON.stringify(fingerprintData), SecurityAlgorithm.SHA256);
  };
}

/**
 * Security configuration utilities
 */
export namespace SecurityConfig {
  /**
   * Security policy configuration
   */
  export interface PolicyConfig {
    readonly authentication: AuthenticationPolicyConfig;
    readonly authorization: AuthorizationPolicyConfig;
    readonly session: SessionPolicyConfig;
    readonly password: PasswordPolicyConfig;
    readonly rateLimit: RateLimitPolicyConfig;
    readonly audit: AuditPolicyConfig;
  }

  /**
   * Authentication policy configuration
   */
  export interface AuthenticationPolicyConfig {
    readonly maxLoginAttempts: number;
    readonly lockoutDuration: number; // milliseconds
    readonly requireMfa: boolean;
    readonly allowedMethods: readonly string[];
    readonly sessionTimeout: number; // milliseconds
  }

  /**
   * Authorization policy configuration
   */
  export interface AuthorizationPolicyConfig {
    readonly defaultDeny: boolean;
    readonly inheritanceEnabled: boolean;
    readonly cacheTimeout: number; // milliseconds
    readonly auditDecisions: boolean;
  }

  /**
   * Session policy configuration
   */
  export interface SessionPolicyConfig {
    readonly maxDuration: number; // milliseconds
    readonly renewalThreshold: number; // milliseconds before expiry
    readonly maxConcurrentSessions: number;
    readonly requireSecureCookies: boolean;
    readonly sameSitePolicy: 'strict' | 'lax' | 'none';
  }

  /**
   * Password policy configuration
   */
  export interface PasswordPolicyConfig {
    readonly minLength: number;
    readonly maxLength: number;
    readonly requireUppercase: boolean;
    readonly requireLowercase: boolean;
    readonly requireNumbers: boolean;
    readonly requireSpecialChars: boolean;
    readonly preventReuse: number; // Number of previous passwords to check
    readonly maxAge: number; // milliseconds
  }

  /**
   * Rate limit policy configuration
   */
  export interface RateLimitPolicyConfig {
    readonly globalLimit: number;
    readonly perUserLimit: number;
    readonly perIpLimit: number;
    readonly windowMs: number;
    readonly blockDuration: number; // milliseconds
  }

  /**
   * Audit policy configuration
   */
  export interface AuditPolicyConfig {
    readonly enabled: boolean;
    readonly logLevel: SecuritySeverity;
    readonly retention: number; // milliseconds
    readonly encryption: boolean;
    readonly realtime: boolean;
  }

  /**
   * Environment-specific configuration
   */
  export interface EnvironmentConfig {
    readonly development: Partial<PolicyConfig>;
    readonly staging: Partial<PolicyConfig>;
    readonly production: PolicyConfig;
  }
}

/**
 * Export all utility namespaces
 * Note: These are exported as namespaces, not types, to avoid conflicts
 */

/**
 * Utility type for creating partial security configurations
 */
export type PartialSecurityConfig<T> = {
  readonly [P in keyof T]?: T[P] extends readonly (infer U)[]
    ? readonly U[]
    : T[P] extends object
    ? PartialSecurityConfig<T[P]>
    : T[P];
};

/**
 * Utility type for making security configurations mutable for construction
 */
export type MutableSecurityConfig<T> = {
  -readonly [P in keyof T]: T[P] extends readonly (infer U)[]
    ? U[]
    : T[P] extends object
    ? MutableSecurityConfig<T[P]>
    : T[P];
};

/**
 * Utility type for extracting security operation types
 */
export type SecurityOperationType<T> = T extends SecurityResult<infer U> ? U : never;

/**
 * Utility type for security event handlers
 */
export type SecurityEventHandler<T = unknown> = (
  event: T,
  context: SecurityContext
) => Promise<void> | void;

/**
 * Utility type for security middleware
 */
export type SecurityMiddleware<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: SecurityContext,
  next: () => Promise<TOutput>
) => Promise<TOutput>;

/**
 * Common security operation patterns
 */
export const SECURITY_PATTERNS = {
  // Regular expressions for common validation
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  JWT: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,

  // Common injection patterns to detect
  SQL_INJECTION: /(union|select|insert|update|delete|drop|exec|script)/i,
  XSS: /<script|javascript:|vbscript:|onload|onerror|onclick/i,
  LDAP_INJECTION: /(\*|\(|\)|\\|\/|\||\&)/,

  // Safe character sets
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
  SAFE_PATH: /^[a-zA-Z0-9\/._-]+$/
} as const;

/**
 * Security defaults and constants
 */
export const SECURITY_DEFAULTS = {
  TOKEN_LENGTH: 32,
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
  PASSWORD_MIN_LENGTH: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  HASH_ITERATIONS: 100000,
  SALT_LENGTH: 32,
  IV_LENGTH: 16,
  KEY_LENGTH: 32
} as const;