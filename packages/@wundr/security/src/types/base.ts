/**
 * Base Security Types
 * Core foundational types used across all security modules
 *
 * @fileoverview Base types for security operations
 * @author Security Types Specialist
 * @version 1.0.0
 */

// Core security primitive types
export type SecurityId = string;
export type SecurityTimestamp = string; // ISO 8601 format
export type SecurityHash = string; // Hex-encoded hash
export type SecurityToken = string; // Base64-encoded token
export type EncryptedData = string; // Base64-encoded encrypted data

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
  readonly details?: Record<string, unknown>;
  readonly cause?: SecurityError;
  readonly timestamp: SecurityTimestamp;
  readonly severity: SecuritySeverity;
}

/**
 * Security warning information
 */
export interface SecurityWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: SecuritySeverity;
  readonly recommendation?: string;
  readonly metadata?: Record<string, unknown>;
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
  readonly debugInfo?: Record<string, unknown>;
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
  readonly remediation?: string;
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
  details?: Record<string, unknown>
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