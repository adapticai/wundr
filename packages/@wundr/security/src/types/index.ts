/**
 * Comprehensive Security Type Definitions
 * Enterprise-grade TypeScript types for authentication, authorization, and security scanning
 *
 * @fileoverview Core security types providing type safety across all security operations
 * @author Security Types Specialist
 * @version 1.0.0
 */

// Re-export all security type modules
export * from './authentication';
export * from './authorization';
export * from './scanning';
export * from './audit';
export * from './compliance';
export * from './encryption';
export * from './events';
export * from './api-security';
export * from './threats';
export * from './utils';

// Core security primitive types
export type SecurityId = string;
export type SecurityTimestamp = string; // ISO 8601 format
export type SecurityHash = string; // Hex-encoded hash
export type SecurityToken = string; // Base64-encoded token
export type EncryptedData = string; // Base64-encoded encrypted data

/**
 * Security severity levels following industry standards
 */
export enum SecuritySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Security operation status
 */
export enum SecurityOperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

/**
 * Base security context interface
 */
export interface SecurityContext {
  readonly userId?: SecurityId;
  readonly sessionId?: SecurityId;
  readonly requestId: SecurityId;
  readonly timestamp: SecurityTimestamp;
  readonly source: SecuritySource;
  readonly environment: SecurityEnvironment;
  readonly metadata?: SecurityContextMetadata;
}

/**
 * Security source information
 */
export interface SecuritySource {
  readonly application: string;
  readonly version: string;
  readonly component?: string;
  readonly instance?: string;
  readonly node?: string;
}

/**
 * Security environment classification
 */
export enum SecurityEnvironment {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development',
  TEST = 'test',
  LOCAL = 'local'
}

/**
 * Security context metadata
 */
export interface SecurityContextMetadata {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly location?: GeographicLocation;
  readonly device?: DeviceFingerprint;
  readonly network?: NetworkContext;
  readonly customAttributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Geographic location information
 */
export interface GeographicLocation {
  readonly country: string;
  readonly region?: string;
  readonly city?: string;
  readonly coordinates?: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly timezone?: string;
}

/**
 * Device fingerprint for security tracking
 */
export interface DeviceFingerprint {
  readonly id: SecurityId;
  readonly type: DeviceType;
  readonly platform: string;
  readonly browser?: string;
  readonly version?: string;
  readonly trusted: boolean;
  readonly lastSeen: SecurityTimestamp;
  readonly characteristics?: DeviceCharacteristics;
}

/**
 * Device types for classification
 */
export enum DeviceType {
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  SERVER = 'server',
  IOT = 'iot',
  UNKNOWN = 'unknown'
}

/**
 * Device characteristics for fingerprinting
 */
export interface DeviceCharacteristics {
  readonly screenResolution?: string;
  readonly colorDepth?: number;
  readonly timezone?: string;
  readonly language?: string;
  readonly plugins?: readonly string[];
  readonly webgl?: string;
  readonly canvas?: string;
}

/**
 * Network context for security analysis
 */
export interface NetworkContext {
  readonly ipAddress: string;
  readonly ipVersion: 4 | 6;
  readonly subnet?: string;
  readonly asn?: string;
  readonly isp?: string;
  readonly proxy?: boolean;
  readonly tor?: boolean;
  readonly vpn?: boolean;
}

/**
 * Security attribute values
 */
export type SecurityAttributeValue =
  | string
  | number
  | boolean
  | SecurityTimestamp
  | readonly SecurityAttributeValue[]
  | { readonly [key: string]: SecurityAttributeValue };

/**
 * Base security result interface
 */
export interface SecurityResult<TData = unknown> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: SecurityError;
  readonly warnings?: readonly SecurityWarning[];
  readonly metadata: SecurityResultMetadata;
}

/**
 * Security error information
 */
export interface SecurityError {
  readonly code: string;
  readonly message: string;
  readonly details?: SecurityErrorDetails;
  readonly cause?: SecurityError;
  readonly timestamp: SecurityTimestamp;
  readonly severity: SecuritySeverity;
}

/**
 * Security error details
 */
export interface SecurityErrorDetails {
  readonly field?: string;
  readonly value?: SecurityAttributeValue;
  readonly constraint?: string;
  readonly context?: Record<string, SecurityAttributeValue>;
  readonly stackTrace?: readonly string[];
}

/**
 * Security warning information
 */
export interface SecurityWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: SecuritySeverity;
  readonly recommendation?: string;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Security result metadata
 */
export interface SecurityResultMetadata {
  readonly processingTime: number; // milliseconds
  readonly version: string;
  readonly checksPerformed: readonly string[];
  readonly rulesApplied: readonly string[];
  readonly cacheHit?: boolean;
  readonly debugInfo?: Record<string, SecurityAttributeValue>;
}

/**
 * Security configuration base interface
 */
export interface SecurityConfigBase {
  readonly enabled: boolean;
  readonly version: string;
  readonly lastUpdated: SecurityTimestamp;
  readonly environment: SecurityEnvironment;
  readonly enforceMode: SecurityEnforceMode;
}

/**
 * Security enforcement modes
 */
export enum SecurityEnforceMode {
  STRICT = 'strict',        // Fail on any violation
  PERMISSIVE = 'permissive', // Log violations but continue
  DISABLED = 'disabled',     // No enforcement
  AUDIT_ONLY = 'audit_only' // Only audit, no blocking
}

/**
 * Security metric interface
 */
export interface SecurityMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly timestamp: SecurityTimestamp;
  readonly tags?: Record<string, string>;
  readonly threshold?: SecurityThreshold;
}

/**
 * Security threshold definition
 */
export interface SecurityThreshold {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

/**
 * Security event base interface
 */
export interface SecurityEventBase {
  readonly id: SecurityId;
  readonly type: string;
  readonly severity: SecuritySeverity;
  readonly timestamp: SecurityTimestamp;
  readonly source: SecuritySource;
  readonly context: SecurityContext;
  readonly description: string;
  readonly tags?: readonly string[];
}

/**
 * Security policy base interface
 */
export interface SecurityPolicyBase {
  readonly id: SecurityId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly enforceMode: SecurityEnforceMode;
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly metadata?: SecurityPolicyMetadata;
}

/**
 * Security policy metadata
 */
export interface SecurityPolicyMetadata {
  readonly author: string;
  readonly framework?: string;
  readonly compliance?: readonly string[];
  readonly tags?: readonly string[];
  readonly customFields?: Record<string, SecurityAttributeValue>;
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  readonly valid: boolean;
  readonly violations: readonly SecurityViolation[];
  readonly score?: number; // 0-100 security score
  readonly confidence?: number; // 0-1 confidence level
  readonly recommendations?: readonly string[];
}

/**
 * Security violation information
 */
export interface SecurityViolation {
  readonly rule: string;
  readonly severity: SecuritySeverity;
  readonly message: string;
  readonly field?: string;
  readonly value?: SecurityAttributeValue;
  readonly remediation?: SecurityRemediation;
}

/**
 * Security remediation information
 */
export interface SecurityRemediation {
  readonly action: string;
  readonly description: string;
  readonly automated: boolean;
  readonly effort: SecurityEffort;
  readonly impact: SecurityImpact;
}

/**
 * Security effort estimation
 */
export enum SecurityEffort {
  MINIMAL = 'minimal',     // < 1 hour
  LOW = 'low',            // 1-4 hours
  MEDIUM = 'medium',      // 1-2 days
  HIGH = 'high',          // 1-5 days
  CRITICAL = 'critical'   // > 1 week
}

/**
 * Security impact assessment
 */
export enum SecurityImpact {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Security rate limiting information
 */
export interface SecurityRateLimit {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly remaining: number;
  readonly resetTime: SecurityTimestamp;
  readonly blocked: boolean;
}

/**
 * Security session information
 */
export interface SecuritySession {
  readonly id: SecurityId;
  readonly userId: SecurityId;
  readonly createdAt: SecurityTimestamp;
  readonly expiresAt: SecurityTimestamp;
  readonly lastActivity: SecurityTimestamp;
  readonly ipAddress: string;
  readonly device: DeviceFingerprint;
  readonly mfaVerified: boolean;
  readonly riskScore: number; // 0-1
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Type guards for security types
 */
export const isSecurityId = (value: unknown): value is SecurityId => {
  return typeof value === 'string' && value.length > 0;
};

export const isSecurityTimestamp = (value: unknown): value is SecurityTimestamp => {
  if (typeof value !== 'string') return false;
  try {
    return !isNaN(Date.parse(value));
  } catch {
    return false;
  }
};

export const isSecurityContext = (value: unknown): value is SecurityContext => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requestId' in value &&
    'timestamp' in value &&
    'source' in value &&
    'environment' in value &&
    isSecurityId((value as SecurityContext).requestId) &&
    isSecurityTimestamp((value as SecurityContext).timestamp)
  );
};

export const isSecurityResult = <T>(value: unknown): value is SecurityResult<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'metadata' in value &&
    typeof (value as SecurityResult).success === 'boolean'
  );
};

/**
 * Utility functions for security types
 */
export const createSecurityId = (): SecurityId => {
  return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createSecurityTimestamp = (date?: Date): SecurityTimestamp => {
  return (date || new Date()).toISOString();
};

export const createSecurityContext = (
  source: SecuritySource,
  environment: SecurityEnvironment,
  options?: Partial<SecurityContext>
): SecurityContext => ({
  requestId: createSecurityId(),
  timestamp: createSecurityTimestamp(),
  source,
  environment,
  ...options
});

export const createSecurityError = (
  code: string,
  message: string,
  severity: SecuritySeverity = SecuritySeverity.HIGH,
  details?: SecurityErrorDetails
): SecurityError => ({
  code,
  message,
  severity,
  details,
  timestamp: createSecurityTimestamp()
});

export const createSecurityResult = <T>(
  success: boolean,
  data?: T,
  error?: SecurityError,
  processingTime: number = 0,
  checksPerformed: readonly string[] = [],
  rulesApplied: readonly string[] = []
): SecurityResult<T> => ({
  success,
  data,
  error,
  metadata: {
    processingTime,
    version: '1.0.0',
    checksPerformed,
    rulesApplied
  }
});

/**
 * Common security constants
 */
export const SECURITY_CONSTANTS = {
  DEFAULT_SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
  DEFAULT_TOKEN_EXPIRY: 15 * 60 * 1000, // 15 minutes
  DEFAULT_REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
  MAX_LOGIN_ATTEMPTS: 5,
  PASSWORD_MIN_LENGTH: 12,
  MFA_CODE_LENGTH: 6,
  CRYPTO_KEY_SIZE: 256,
  HASH_ITERATIONS: 100000
} as const;

/**
 * Security event types enum
 */
export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'auth.success',
  AUTHENTICATION_FAILURE = 'auth.failure',
  AUTHORIZATION_GRANTED = 'authz.granted',
  AUTHORIZATION_DENIED = 'authz.denied',
  SESSION_CREATED = 'session.created',
  SESSION_EXPIRED = 'session.expired',
  PASSWORD_CHANGED = 'password.changed',
  ACCOUNT_LOCKED = 'account.locked',
  PRIVILEGE_ESCALATION = 'privilege.escalation',
  DATA_ACCESS = 'data.access',
  DATA_MODIFICATION = 'data.modification',
  SECURITY_VIOLATION = 'security.violation',
  THREAT_DETECTED = 'threat.detected',
  VULNERABILITY_FOUND = 'vulnerability.found',
  COMPLIANCE_VIOLATION = 'compliance.violation'
}

/**
 * Security algorithm types
 */
export enum SecurityAlgorithm {
  // Symmetric encryption
  AES_256_GCM = 'AES-256-GCM',
  AES_192_GCM = 'AES-192-GCM',
  AES_128_GCM = 'AES-128-GCM',
  CHACHA20_POLY1305 = 'ChaCha20-Poly1305',

  // Asymmetric encryption
  RSA_4096 = 'RSA-4096',
  RSA_2048 = 'RSA-2048',
  ECDSA_P256 = 'ECDSA-P256',
  ECDSA_P384 = 'ECDSA-P384',
  ED25519 = 'Ed25519',

  // Hashing
  SHA256 = 'SHA-256',
  SHA384 = 'SHA-384',
  SHA512 = 'SHA-512',
  BLAKE2B = 'BLAKE2b',
  ARGON2ID = 'Argon2id',
  PBKDF2 = 'PBKDF2',
  SCRYPT = 'scrypt'
}

/**
 * Security compliance frameworks
 */
export enum ComplianceFramework {
  SOC2_TYPE1 = 'SOC2-Type1',
  SOC2_TYPE2 = 'SOC2-Type2',
  ISO27001 = 'ISO27001',
  PCI_DSS = 'PCI-DSS',
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  CCPA = 'CCPA',
  NIST_CSF = 'NIST-CSF',
  CIS_CONTROLS = 'CIS-Controls',
  OWASP_TOP10 = 'OWASP-Top10'
}