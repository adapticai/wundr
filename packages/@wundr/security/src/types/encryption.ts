/**
 * Enterprise-Grade Encryption Type Definitions
 * Comprehensive TypeScript types for AES-256-GCM, key management, and cryptographic operations
 *
 * @fileoverview Encryption types supporting enterprise security requirements
 * @author Security Encryption Module Creator
 * @version 1.0.0
 */

import { SecurityId, SecurityTimestamp, SecuritySeverity } from './base';

/**
 * Supported encryption algorithms with security parameters
 */
export enum EncryptionAlgorithm {
  AES_256_GCM = 'AES-256-GCM',
  AES_192_GCM = 'AES-192-GCM',
  AES_128_GCM = 'AES-128-GCM',
  CHACHA20_POLY1305 = 'ChaCha20-Poly1305',
  AES_256_CBC = 'AES-256-CBC',
  AES_256_CTR = 'AES-256-CTR'
}

/**
 * Key derivation function algorithms
 */
export enum KeyDerivationFunction {
  PBKDF2 = 'PBKDF2',
  SCRYPT = 'scrypt',
  ARGON2ID = 'Argon2id',
  HKDF = 'HKDF'
}

/**
 * Hash algorithms for cryptographic operations
 */
export enum HashAlgorithm {
  SHA256 = 'SHA-256',
  SHA384 = 'SHA-384',
  SHA512 = 'SHA-512',
  BLAKE2B = 'BLAKE2b',
  SHA3_256 = 'SHA3-256',
  SHA3_512 = 'SHA3-512'
}

/**
 * Encryption key types and classifications
 */
export enum EncryptionKeyType {
  MASTER_KEY = 'master_key',
  DATA_ENCRYPTION_KEY = 'data_encryption_key',
  KEY_ENCRYPTION_KEY = 'key_encryption_key',
  DERIVED_KEY = 'derived_key',
  SESSION_KEY = 'session_key',
  EPHEMERAL_KEY = 'ephemeral_key'
}

/**
 * Key strength classifications
 */
export enum KeyStrength {
  AES_128 = 128,
  AES_192 = 192,
  AES_256 = 256,
  RSA_2048 = 2048,
  RSA_4096 = 4096,
  ECC_P256 = 256,
  ECC_P384 = 384,
  ECC_P521 = 521
}

/**
 * Encryption operation modes
 */
export enum EncryptionMode {
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
  ENCRYPT_AND_SIGN = 'encrypt_and_sign',
  DECRYPT_AND_VERIFY = 'decrypt_and_verify'
}

/**
 * Encryption context for operation tracking
 */
export interface EncryptionContext {
  readonly operationId: SecurityId;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyId: SecurityId;
  readonly mode: EncryptionMode;
  readonly timestamp: SecurityTimestamp;
  readonly source: string;
  readonly purpose: string;
  readonly metadata?: EncryptionMetadata;
}

/**
 * Encryption metadata for additional context
 */
export interface EncryptionMetadata {
  readonly version: string;
  readonly compressionUsed?: boolean;
  readonly integrityCheck?: string;
  readonly customHeaders?: Record<string, string>;
  readonly complianceFlags?: readonly string[];
}

/**
 * Cryptographic key specification
 */
export interface CryptographicKey {
  readonly id: SecurityId;
  readonly type: EncryptionKeyType;
  readonly algorithm: EncryptionAlgorithm;
  readonly strength: KeyStrength;
  readonly keyMaterial: Uint8Array;
  readonly createdAt: SecurityTimestamp;
  readonly expiresAt?: SecurityTimestamp;
  readonly version: number;
  readonly metadata: KeyMetadata;
}

/**
 * Key metadata for management and auditing
 */
export interface KeyMetadata {
  readonly purpose: string;
  readonly owner: string;
  readonly source: KeySource;
  readonly rotationPolicy?: KeyRotationPolicy;
  readonly accessPolicy?: KeyAccessPolicy;
  readonly complianceLabels?: readonly string[];
  readonly customAttributes?: Record<string, string>;
}

/**
 * Key source information
 */
export interface KeySource {
  readonly type: KeySourceType;
  readonly provider?: string;
  readonly location?: string;
  readonly hsm?: boolean;
  readonly certified?: boolean;
}

/**
 * Key source types
 */
export enum KeySourceType {
  GENERATED = 'generated',
  IMPORTED = 'imported',
  DERIVED = 'derived',
  HSM = 'hsm',
  KMS = 'kms',
  EXTERNAL = 'external'
}

/**
 * Key rotation policy configuration
 */
export interface KeyRotationPolicy {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly maxUsage?: number;
  readonly autoRotate: boolean;
  readonly notificationThresholdMs?: number;
  readonly retainPreviousVersions: number;
}

/**
 * Key access policy configuration
 */
export interface KeyAccessPolicy {
  readonly allowedOperations: readonly EncryptionMode[];
  readonly authorizedUsers?: readonly string[];
  readonly authorizedRoles?: readonly string[];
  readonly timeRestrictions?: TimeRestriction[];
  readonly geographicRestrictions?: readonly string[];
  readonly requireMfa: boolean;
}

/**
 * Time-based access restrictions
 */
export interface TimeRestriction {
  readonly startTime?: string; // HH:MM format
  readonly endTime?: string;   // HH:MM format
  readonly daysOfWeek?: readonly number[]; // 0-6, Sunday=0
  readonly timezone?: string;
}

/**
 * Encryption parameters for AES-256-GCM operations
 */
export interface AESGCMParameters {
  readonly algorithm: EncryptionAlgorithm.AES_256_GCM;
  readonly keySize: 256;
  readonly ivSize: 96;  // 12 bytes for GCM
  readonly tagSize: 128; // 16 bytes authentication tag
  readonly additionalData?: Uint8Array;
}

/**
 * ChaCha20-Poly1305 parameters
 */
export interface ChaCha20Poly1305Parameters {
  readonly algorithm: EncryptionAlgorithm.CHACHA20_POLY1305;
  readonly keySize: 256;
  readonly nonceSize: 96; // 12 bytes
  readonly tagSize: 128;  // 16 bytes
  readonly additionalData?: Uint8Array;
}

/**
 * Generic encryption parameters
 */
export type EncryptionParameters =
  | AESGCMParameters
  | ChaCha20Poly1305Parameters
  | CustomEncryptionParameters;

/**
 * Custom encryption parameters for extensibility
 */
export interface CustomEncryptionParameters {
  readonly algorithm: EncryptionAlgorithm;
  readonly keySize: number;
  readonly ivSize?: number;
  readonly nonceSize?: number;
  readonly tagSize?: number;
  readonly additionalData?: Uint8Array;
  readonly customOptions?: Record<string, unknown>;
}

/**
 * Encryption operation input
 */
export interface EncryptionInput {
  readonly data: Uint8Array;
  readonly key: CryptographicKey;
  readonly parameters: EncryptionParameters;
  readonly context: EncryptionContext;
  readonly additionalData?: Uint8Array;
}

/**
 * Encryption operation output
 */
export interface EncryptionOutput {
  readonly encryptedData: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyId: SecurityId;
  readonly metadata: EncryptionResultMetadata;
}

/**
 * Decryption operation input
 */
export interface DecryptionInput {
  readonly encryptedData: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
  readonly key: CryptographicKey;
  readonly parameters: EncryptionParameters;
  readonly context: EncryptionContext;
  readonly additionalData?: Uint8Array;
}

/**
 * Decryption operation output
 */
export interface DecryptionOutput {
  readonly decryptedData: Uint8Array;
  readonly verified: boolean;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyId: SecurityId;
  readonly metadata: EncryptionResultMetadata;
}

/**
 * Encryption result metadata
 */
export interface EncryptionResultMetadata {
  readonly operationId: SecurityId;
  readonly timestamp: SecurityTimestamp;
  readonly processingTimeMs: number;
  readonly dataSize: number;
  readonly encryptedSize: number;
  readonly compressionRatio?: number;
  readonly performance: PerformanceMetrics;
}

/**
 * Performance metrics for encryption operations
 */
export interface PerformanceMetrics {
  readonly throughputBytesPerSecond: number;
  readonly cpuTimeMs: number;
  readonly memoryUsageBytes: number;
  readonly cacheHitRate?: number;
}

/**
 * Key derivation configuration
 */
export interface KeyDerivationConfig {
  readonly function: KeyDerivationFunction;
  readonly salt: Uint8Array;
  readonly iterations?: number;  // For PBKDF2
  readonly memory?: number;      // For scrypt/Argon2
  readonly parallelism?: number; // For Argon2
  readonly outputLength: number;
  readonly info?: Uint8Array;    // For HKDF
}

/**
 * Derived key result
 */
export interface DerivedKeyResult {
  readonly derivedKey: Uint8Array;
  readonly salt: Uint8Array;
  readonly config: KeyDerivationConfig;
  readonly derivationTime: number;
  readonly keyId: SecurityId;
}

/**
 * Symmetric encryption configuration
 */
export interface SymmetricEncryptionConfig {
  readonly algorithm: EncryptionAlgorithm;
  readonly keySize: KeyStrength;
  readonly ivGeneration: IVGenerationStrategy;
  readonly paddingScheme?: PaddingScheme;
  readonly authenticationRequired: boolean;
  readonly compressionEnabled?: boolean;
}

/**
 * IV generation strategies
 */
export enum IVGenerationStrategy {
  RANDOM = 'random',
  COUNTER = 'counter',
  TIMESTAMP_BASED = 'timestamp_based',
  DERIVED = 'derived'
}

/**
 * Padding schemes for block ciphers
 */
export enum PaddingScheme {
  PKCS7 = 'PKCS#7',
  ANSI_X923 = 'ANSI_X9.23',
  ISO_10126 = 'ISO_10126',
  ZERO_PADDING = 'zero_padding',
  NONE = 'none'
}

/**
 * Encryption service interface
 */
export interface EncryptionService {
  /**
   * Encrypt data using specified algorithm and key
   */
  encrypt(input: EncryptionInput): Promise<EncryptionOutput>;

  /**
   * Decrypt data using specified algorithm and key
   */
  decrypt(input: DecryptionInput): Promise<DecryptionOutput>;

  /**
   * Generate a new cryptographic key
   */
  generateKey(
    type: EncryptionKeyType,
    algorithm: EncryptionAlgorithm,
    strength: KeyStrength
  ): Promise<CryptographicKey>;

  /**
   * Derive key from password or another key
   */
  deriveKey(
    sourceKey: Uint8Array,
    config: KeyDerivationConfig
  ): Promise<DerivedKeyResult>;

  /**
   * Validate encryption parameters
   */
  validateParameters(parameters: EncryptionParameters): Promise<ValidationResult>;

  /**
   * Get supported algorithms
   */
  getSupportedAlgorithms(): readonly EncryptionAlgorithm[];
}

/**
 * Key management service interface
 */
export interface KeyManagementService {
  /**
   * Store a cryptographic key securely
   */
  storeKey(key: CryptographicKey): Promise<SecurityId>;

  /**
   * Retrieve a cryptographic key by ID
   */
  getKey(keyId: SecurityId): Promise<CryptographicKey | null>;

  /**
   * List all available keys (metadata only)
   */
  listKeys(filter?: KeyFilter): Promise<readonly KeyMetadata[]>;

  /**
   * Rotate a key according to its policy
   */
  rotateKey(keyId: SecurityId): Promise<CryptographicKey>;

  /**
   * Delete a key (if policy allows)
   */
  deleteKey(keyId: SecurityId): Promise<void>;

  /**
   * Update key metadata
   */
  updateKeyMetadata(keyId: SecurityId, metadata: Partial<KeyMetadata>): Promise<void>;

  /**
   * Check key expiration status
   */
  checkKeyExpiration(keyId: SecurityId): Promise<KeyExpirationStatus>;
}

/**
 * Key filter for listing operations
 */
export interface KeyFilter {
  readonly type?: EncryptionKeyType;
  readonly algorithm?: EncryptionAlgorithm;
  readonly owner?: string;
  readonly purpose?: string;
  readonly expiringBefore?: SecurityTimestamp;
  readonly createdAfter?: SecurityTimestamp;
  readonly tags?: readonly string[];
}

/**
 * Key expiration status
 */
export interface KeyExpirationStatus {
  readonly keyId: SecurityId;
  readonly isExpired: boolean;
  readonly isExpiringSoon: boolean;
  readonly expiresAt?: SecurityTimestamp;
  readonly daysUntilExpiration?: number;
  readonly recommendedAction: KeyAction;
}

/**
 * Recommended key actions
 */
export enum KeyAction {
  NONE = 'none',
  ROTATE_SOON = 'rotate_soon',
  ROTATE_NOW = 'rotate_now',
  REPLACE = 'replace',
  DELETE = 'delete',
  ARCHIVE = 'archive'
}

/**
 * Validation result for encryption operations
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly EncryptionError[];
  readonly warnings: readonly EncryptionWarning[];
  readonly recommendations?: readonly string[];
}

/**
 * Encryption-specific error information
 */
export interface EncryptionError {
  readonly code: EncryptionErrorCode;
  readonly message: string;
  readonly severity: SecuritySeverity;
  readonly field?: string;
  readonly details?: EncryptionErrorDetails;
}

/**
 * Encryption error codes
 */
export enum EncryptionErrorCode {
  INVALID_KEY = 'INVALID_KEY',
  KEY_EXPIRED = 'KEY_EXPIRED',
  ALGORITHM_NOT_SUPPORTED = 'ALGORITHM_NOT_SUPPORTED',
  INVALID_IV_SIZE = 'INVALID_IV_SIZE',
  INVALID_KEY_SIZE = 'INVALID_KEY_SIZE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  INSUFFICIENT_ENTROPY = 'INSUFFICIENT_ENTROPY',
  PARAMETER_VALIDATION_FAILED = 'PARAMETER_VALIDATION_FAILED',
  OPERATION_NOT_PERMITTED = 'OPERATION_NOT_PERMITTED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}

/**
 * Encryption error details
 */
export interface EncryptionErrorDetails {
  readonly expectedValue?: unknown;
  readonly actualValue?: unknown;
  readonly constraint?: string;
  readonly keyId?: SecurityId;
  readonly algorithm?: EncryptionAlgorithm;
  readonly operation?: EncryptionMode;
}

/**
 * Encryption warning information
 */
export interface EncryptionWarning {
  readonly code: EncryptionWarningCode;
  readonly message: string;
  readonly severity: SecuritySeverity;
  readonly recommendation?: string;
}

/**
 * Encryption warning codes
 */
export enum EncryptionWarningCode {
  WEAK_KEY = 'WEAK_KEY',
  KEY_EXPIRING_SOON = 'KEY_EXPIRING_SOON',
  DEPRECATED_ALGORITHM = 'DEPRECATED_ALGORITHM',
  PERFORMANCE_DEGRADATION = 'PERFORMANCE_DEGRADATION',
  HIGH_MEMORY_USAGE = 'HIGH_MEMORY_USAGE',
  COMPLIANCE_CONCERN = 'COMPLIANCE_CONCERN'
}

/**
 * Encrypted credential structure for backward compatibility
 */
export interface EncryptedCredential {
  readonly id: SecurityId;
  readonly service: string;
  readonly account: string;
  readonly encryptedPassword: string;
  readonly iv: string;
  readonly authTag: string;
  readonly encryptionVersion: number;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyId: SecurityId;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: SecurityTimestamp;
  readonly updatedAt: SecurityTimestamp;
  readonly expiresAt?: SecurityTimestamp;
  readonly rotationInterval?: number;
  readonly lastRotated?: SecurityTimestamp;
}

/**
 * Encryption audit log entry
 */
export interface EncryptionAuditEntry {
  readonly id: SecurityId;
  readonly operation: EncryptionMode;
  readonly keyId: SecurityId;
  readonly algorithm: EncryptionAlgorithm;
  readonly dataSize: number;
  readonly success: boolean;
  readonly error?: EncryptionError;
  readonly context: EncryptionContext;
  readonly timestamp: SecurityTimestamp;
  readonly user?: string;
  readonly source: string;
}

/**
 * Encryption configuration for services
 */
export interface EncryptionServiceConfig {
  readonly defaultAlgorithm: EncryptionAlgorithm;
  readonly keyRotationIntervalMs: number;
  readonly maxKeyAge: number;
  readonly enableAuditLogging: boolean;
  readonly performanceOptimizations: PerformanceOptimizationConfig;
  readonly complianceSettings: ComplianceConfig;
  readonly hardwareAcceleration: HardwareAccelerationConfig;
}

/**
 * Performance optimization configuration
 */
export interface PerformanceOptimizationConfig {
  readonly enableCaching: boolean;
  readonly cacheSize: number;
  readonly threadPoolSize?: number;
  readonly batchOperations: boolean;
  readonly compressionThreshold?: number;
}

/**
 * Compliance configuration for encryption
 */
export interface ComplianceConfig {
  readonly requiredStandards: readonly string[];
  readonly fipsMode: boolean;
  readonly keyEscrowRequired: boolean;
  readonly auditRetentionDays: number;
  readonly cryptographicModuleValidation: boolean;
}

/**
 * Hardware acceleration configuration
 */
export interface HardwareAccelerationConfig {
  readonly enabled: boolean;
  readonly preferredProvider?: string;
  readonly fallbackToSoftware: boolean;
  readonly benchmarkOnStartup: boolean;
}

/**
 * Utility functions for encryption types
 */

/**
 * Check if an algorithm is authenticated encryption
 */
export const isAuthenticatedEncryption = (algorithm: EncryptionAlgorithm): boolean => {
  return [
    EncryptionAlgorithm.AES_256_GCM,
    EncryptionAlgorithm.AES_192_GCM,
    EncryptionAlgorithm.AES_128_GCM,
    EncryptionAlgorithm.CHACHA20_POLY1305
  ].includes(algorithm);
};

/**
 * Get required IV size for algorithm
 */
export const getIVSize = (algorithm: EncryptionAlgorithm): number => {
  switch (algorithm) {
    case EncryptionAlgorithm.AES_256_GCM:
    case EncryptionAlgorithm.AES_192_GCM:
    case EncryptionAlgorithm.AES_128_GCM:
    case EncryptionAlgorithm.CHACHA20_POLY1305:
      return 12; // 96 bits
    case EncryptionAlgorithm.AES_256_CBC:
    case EncryptionAlgorithm.AES_256_CTR:
      return 16; // 128 bits
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
};

/**
 * Get required key size for algorithm
 */
export const getKeySize = (algorithm: EncryptionAlgorithm): KeyStrength => {
  switch (algorithm) {
    case EncryptionAlgorithm.AES_256_GCM:
    case EncryptionAlgorithm.AES_256_CBC:
    case EncryptionAlgorithm.AES_256_CTR:
    case EncryptionAlgorithm.CHACHA20_POLY1305:
      return KeyStrength.AES_256;
    case EncryptionAlgorithm.AES_192_GCM:
      return KeyStrength.AES_192;
    case EncryptionAlgorithm.AES_128_GCM:
      return KeyStrength.AES_128;
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
};

/**
 * Get authentication tag size for authenticated algorithms
 */
export const getAuthTagSize = (algorithm: EncryptionAlgorithm): number => {
  if (!isAuthenticatedEncryption(algorithm)) {
    throw new Error(`Algorithm ${algorithm} does not provide authentication`);
  }
  return 16; // 128 bits for GCM and Poly1305
};

/**
 * Type guards for encryption types
 */
export const isEncryptionKey = (value: unknown): value is CryptographicKey => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'keyMaterial' in value &&
    value.keyMaterial instanceof Uint8Array
  );
};

export const isEncryptionOutput = (value: unknown): value is EncryptionOutput => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'encryptedData' in value &&
    'iv' in value &&
    'authTag' in value &&
    value.encryptedData instanceof Uint8Array
  );
};

export const isValidKeySize = (algorithm: EncryptionAlgorithm, keySize: number): boolean => {
  try {
    return getKeySize(algorithm) === keySize;
  } catch {
    return false;
  }
};

/**
 * Factory functions for creating encryption types
 */
export const createEncryptionContext = (
  algorithm: EncryptionAlgorithm,
  keyId: SecurityId,
  mode: EncryptionMode,
  source: string,
  purpose: string
): EncryptionContext => ({
  operationId: `enc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  algorithm,
  keyId,
  mode,
  timestamp: new Date().toISOString(),
  source,
  purpose
});

export const createAESGCMParameters = (
  additionalData?: Uint8Array
): AESGCMParameters => ({
  algorithm: EncryptionAlgorithm.AES_256_GCM,
  keySize: 256,
  ivSize: 96,
  tagSize: 128,
  additionalData
});

export const createKeyDerivationConfig = (
  func: KeyDerivationFunction,
  salt: Uint8Array,
  outputLength: number,
  options?: {
    iterations?: number;
    memory?: number;
    parallelism?: number;
    info?: Uint8Array;
  }
): KeyDerivationConfig => ({
  function: func,
  salt,
  outputLength,
  iterations: options?.iterations || 100000,
  memory: options?.memory,
  parallelism: options?.parallelism,
  info: options?.info
});

/**
 * Constants for encryption operations
 */
export const ENCRYPTION_CONSTANTS = {
  DEFAULT_KEY_SIZE: KeyStrength.AES_256,
  DEFAULT_ALGORITHM: EncryptionAlgorithm.AES_256_GCM,
  DEFAULT_KDF: KeyDerivationFunction.PBKDF2,
  DEFAULT_PBKDF2_ITERATIONS: 100000,
  DEFAULT_SCRYPT_N: 32768,
  DEFAULT_SCRYPT_R: 8,
  DEFAULT_SCRYPT_P: 1,
  MIN_SALT_SIZE: 16,
  MAX_SALT_SIZE: 64,
  MIN_IV_SIZE: 12,
  MAX_IV_SIZE: 16,
  MIN_KEY_ROTATION_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  DEFAULT_KEY_ROTATION_INTERVAL: 30 * 24 * 60 * 60 * 1000, // 30 days
  MAX_ENCRYPTION_SIZE: 64 * 1024 * 1024, // 64 MB
  CACHE_TTL_MS: 15 * 60 * 1000 // 15 minutes
} as const;