/**
 * Audit Logging and Monitoring Types
 * Enterprise-grade audit system for security event tracking, compliance, and monitoring
 *
 * @fileoverview Complete audit type definitions for comprehensive security logging and monitoring
 * @author Security Types Specialist
 * @version 1.0.0
 */

import {
  SecurityId,
  SecurityTimestamp,
  SecuritySeverity,
  SecurityAttributeValue,
  SecuritySource,
  SecurityEnvironment,
  GeographicLocation,
  DeviceFingerprint,
  NetworkContext,
  ComplianceFramework
} from './base';
import {
  ComparisonOperator,
  DataClassification,
  EvidenceType,
  ReportFormat
} from './shared-enums';

/**
 * Audit event types following industry standards
 */
export enum AuditEventType {
  // Authentication events
  LOGIN_ATTEMPT = 'auth.login_attempt',
  LOGIN_SUCCESS = 'auth.login_success',
  LOGIN_FAILURE = 'auth.login_failure',
  LOGOUT = 'auth.logout',
  SESSION_START = 'auth.session_start',
  SESSION_END = 'auth.session_end',
  SESSION_TIMEOUT = 'auth.session_timeout',
  MFA_CHALLENGE = 'auth.mfa_challenge',
  MFA_SUCCESS = 'auth.mfa_success',
  MFA_FAILURE = 'auth.mfa_failure',
  PASSWORD_CHANGE = 'auth.password_change',
  ACCOUNT_LOCK = 'auth.account_lock',
  ACCOUNT_UNLOCK = 'auth.account_unlock',

  // Authorization events
  ACCESS_GRANTED = 'authz.access_granted',
  ACCESS_DENIED = 'authz.access_denied',
  PRIVILEGE_ESCALATION = 'authz.privilege_escalation',
  ROLE_ASSIGNED = 'authz.role_assigned',
  ROLE_REMOVED = 'authz.role_removed',
  PERMISSION_GRANTED = 'authz.permission_granted',
  PERMISSION_REVOKED = 'authz.permission_revoked',
  DELEGATION_CREATED = 'authz.delegation_created',
  DELEGATION_REVOKED = 'authz.delegation_revoked',

  // Data access events
  DATA_READ = 'data.read',
  DATA_WRITE = 'data.write',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',
  DATA_IMPORT = 'data.import',
  DATA_BACKUP = 'data.backup',
  DATA_RESTORE = 'data.restore',
  DATA_ENCRYPTION = 'data.encryption',
  DATA_DECRYPTION = 'data.decryption',

  // System events
  SYSTEM_START = 'system.start',
  SYSTEM_STOP = 'system.stop',
  SYSTEM_ERROR = 'system.error',
  CONFIGURATION_CHANGE = 'system.config_change',
  SOFTWARE_UPDATE = 'system.software_update',
  CERTIFICATE_RENEWAL = 'system.cert_renewal',
  KEY_ROTATION = 'system.key_rotation',

  // Security events
  SECURITY_VIOLATION = 'security.violation',
  INTRUSION_ATTEMPT = 'security.intrusion_attempt',
  MALWARE_DETECTED = 'security.malware_detected',
  VULNERABILITY_DISCOVERED = 'security.vulnerability_discovered',
  SECURITY_SCAN = 'security.scan',
  THREAT_DETECTED = 'security.threat_detected',
  ANOMALY_DETECTED = 'security.anomaly_detected',

  // Compliance events
  COMPLIANCE_CHECK = 'compliance.check',
  COMPLIANCE_VIOLATION = 'compliance.violation',
  COMPLIANCE_REMEDIATION = 'compliance.remediation',
  POLICY_VIOLATION = 'compliance.policy_violation',
  AUDIT_REPORT = 'compliance.audit_report',

  // Administrative events
  USER_CREATED = 'admin.user_created',
  USER_UPDATED = 'admin.user_updated',
  USER_DELETED = 'admin.user_deleted',
  GROUP_CREATED = 'admin.group_created',
  GROUP_UPDATED = 'admin.group_updated',
  GROUP_DELETED = 'admin.group_deleted',
  POLICY_CREATED = 'admin.policy_created',
  POLICY_UPDATED = 'admin.policy_updated',
  POLICY_DELETED = 'admin.policy_deleted',

  // Custom events
  CUSTOM = 'custom'
}

/**
 * Audit event outcomes
 */
export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  UNKNOWN = 'unknown'
}

/**
 * Audit event categories for classification
 */
export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM_ADMINISTRATION = 'system_administration',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  PRIVACY = 'privacy',
  BUSINESS_LOGIC = 'business_logic',
  TECHNICAL = 'technical',
  CUSTOM = 'custom'
}

/**
 * Core audit event interface
 */
export interface AuditEvent {
  readonly id: SecurityId;
  readonly timestamp: SecurityTimestamp;
  readonly type: AuditEventType;
  readonly category: AuditCategory;
  readonly severity: SecuritySeverity;
  readonly outcome: AuditOutcome;
  readonly source: SecuritySource;
  readonly environment: SecurityEnvironment;
  readonly actor: AuditActor;
  readonly target: AuditTarget;
  readonly action: AuditAction;
  readonly context: AuditContext;
  readonly details: AuditEventDetails;
  readonly compliance: ComplianceInfo;
  readonly metadata?: AuditEventMetadata;
}

/**
 * Audit actor (who performed the action)
 */
export interface AuditActor {
  readonly type: ActorType;
  readonly id: SecurityId;
  readonly name?: string;
  readonly roles?: readonly string[];
  readonly session?: SessionInfo;
  readonly device?: DeviceFingerprint;
  readonly location?: GeographicLocation;
  readonly network?: NetworkContext;
  readonly impersonating?: ImpersonationInfo;
}

/**
 * Actor types
 */
export enum ActorType {
  USER = 'user',
  SERVICE_ACCOUNT = 'service_account',
  SYSTEM = 'system',
  APPLICATION = 'application',
  API_CLIENT = 'api_client',
  BATCH_JOB = 'batch_job',
  AUTOMATED_PROCESS = 'automated_process',
  UNKNOWN = 'unknown'
}

/**
 * Session information for audit context
 */
export interface SessionInfo {
  readonly id: SecurityId;
  readonly duration: number; // milliseconds
  readonly mfaVerified: boolean;
  readonly riskScore: number; // 0-1
  readonly authMethod: string;
  readonly lastActivity: SecurityTimestamp;
}

/**
 * Impersonation information
 */
export interface ImpersonationInfo {
  readonly originalActor: SecurityId;
  readonly reason: string;
  readonly authorizedBy: SecurityId;
  readonly startTime: SecurityTimestamp;
  readonly endTime?: SecurityTimestamp;
}

/**
 * Audit target (what was acted upon)
 */
export interface AuditTarget {
  readonly type: TargetType;
  readonly id?: SecurityId;
  readonly name?: string;
  readonly path?: string;
  readonly classification?: DataClassification;
  readonly owner?: SecurityId;
  readonly attributes?: TargetAttributes;
  readonly parent?: AuditTarget;
  readonly children?: readonly AuditTarget[];
}

/**
 * Target types for audit events
 */
export enum TargetType {
  FILE = 'file',
  DIRECTORY = 'directory',
  DATABASE = 'database',
  TABLE = 'table',
  RECORD = 'record',
  USER_ACCOUNT = 'user_account',
  GROUP = 'group',
  ROLE = 'role',
  PERMISSION = 'permission',
  POLICY = 'policy',
  SYSTEM = 'system',
  APPLICATION = 'application',
  SERVICE = 'service',
  API_ENDPOINT = 'api_endpoint',
  NETWORK_RESOURCE = 'network_resource',
  CERTIFICATE = 'certificate',
  KEY = 'key',
  CUSTOM = 'custom'
}

// DataClassification is now imported from shared-enums

/**
 * Target attributes for detailed context
 */
export interface TargetAttributes {
  readonly size?: number;
  readonly version?: string;
  readonly checksum?: string;
  readonly created?: SecurityTimestamp;
  readonly modified?: SecurityTimestamp;
  readonly accessed?: SecurityTimestamp;
  readonly tags?: readonly string[];
  readonly customAttributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Audit action details
 */
export interface AuditAction {
  readonly name: string;
  readonly description?: string;
  readonly method?: string; // HTTP method, API call, etc.
  readonly parameters?: ActionParameters;
  readonly previousValues?: Record<string, SecurityAttributeValue>;
  readonly newValues?: Record<string, SecurityAttributeValue>;
  readonly changes?: ChangeDetails;
}

/**
 * Action parameters
 */
export interface ActionParameters {
  readonly query?: Record<string, SecurityAttributeValue>;
  readonly headers?: Record<string, string>;
  readonly body?: SecurityAttributeValue;
  readonly filters?: Record<string, SecurityAttributeValue>;
  readonly options?: Record<string, SecurityAttributeValue>;
  readonly customParameters?: Record<string, SecurityAttributeValue>;
}

/**
 * Change details for data modification events
 */
export interface ChangeDetails {
  readonly fields: readonly FieldChange[];
  readonly summary: string;
  readonly impact: ChangeImpact;
  readonly reversible: boolean;
  readonly backupRequired: boolean;
}

/**
 * Field change information
 */
export interface FieldChange {
  readonly field: string;
  readonly oldValue?: SecurityAttributeValue;
  readonly newValue?: SecurityAttributeValue;
  readonly changeType: ChangeType;
  readonly sensitive: boolean;
}

/**
 * Change types
 */
export enum ChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  MOVE = 'move',
  COPY = 'copy',
  RENAME = 'rename',
  PERMISSION_CHANGE = 'permission_change'
}

/**
 * Change impact assessment
 */
export interface ChangeImpact {
  readonly scope: ImpactScope;
  readonly severity: SecuritySeverity;
  readonly affectedUsers: number;
  readonly affectedSystems: readonly string[];
  readonly businessImpact: string;
  readonly technicalImpact: string;
}

/**
 * Impact scope
 */
export enum ImpactScope {
  SINGLE_USER = 'single_user',
  MULTIPLE_USERS = 'multiple_users',
  DEPARTMENT = 'department',
  ORGANIZATION = 'organization',
  EXTERNAL = 'external',
  GLOBAL = 'global'
}

/**
 * Audit context for additional information
 */
export interface AuditContext {
  readonly requestId?: SecurityId;
  readonly traceId?: SecurityId;
  readonly correlationId?: SecurityId;
  readonly userAgent?: string;
  readonly referrer?: string;
  readonly clientIp?: string;
  readonly serverIp?: string;
  readonly protocol?: string;
  readonly port?: number;
  readonly customContext?: Record<string, SecurityAttributeValue>;
}

/**
 * Detailed audit event information
 */
export interface AuditEventDetails {
  readonly message: string;
  readonly reason?: string;
  readonly evidence?: Evidence;
  readonly metrics?: EventMetrics;
  readonly warnings?: readonly string[];
  readonly errors?: readonly AuditError[];
  readonly recommendations?: readonly string[];
  readonly customDetails?: Record<string, SecurityAttributeValue>;
}

/**
 * Evidence for audit events
 */
export interface Evidence {
  readonly type: EvidenceType;
  readonly content: string;
  readonly format: string;
  readonly checksum: string;
  readonly signature?: string;
  readonly timestamp: SecurityTimestamp;
  readonly source: SecuritySource;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

// EvidenceType is now imported from shared-enums

/**
 * Event metrics for performance tracking
 */
export interface EventMetrics {
  readonly duration?: number; // milliseconds
  readonly dataSize?: number; // bytes
  readonly recordCount?: number;
  readonly networkLatency?: number; // milliseconds
  readonly cpuUsage?: number; // percentage
  readonly memoryUsage?: number; // bytes
  readonly customMetrics?: Record<string, number>;
}

/**
 * Audit-specific error information
 */
export interface AuditError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
  readonly stackTrace?: readonly string[];
  readonly remediation?: string;
}

/**
 * Compliance information for audit events
 */
export interface ComplianceInfo {
  readonly frameworks: readonly ComplianceFramework[];
  readonly requirements: readonly ComplianceRequirement[];
  readonly retention: RetentionInfo;
  readonly sensitivity: SensitivityInfo;
  readonly jurisdiction: JurisdictionInfo;
}

/**
 * Compliance requirement details
 */
export interface ComplianceRequirement {
  readonly framework: ComplianceFramework;
  readonly control: string;
  readonly description: string;
  readonly mandatory: boolean;
  readonly evidence: readonly string[];
}

/**
 * Retention information for compliance
 */
export interface RetentionInfo {
  readonly period: number; // milliseconds
  readonly policy: string;
  readonly reason: string;
  readonly jurisdiction: readonly string[];
  readonly destructionDate?: SecurityTimestamp;
  readonly archivalDate?: SecurityTimestamp;
}

/**
 * Data sensitivity information
 */
export interface SensitivityInfo {
  readonly level: DataSensitivityLevel;
  readonly categories: readonly DataCategory[];
  readonly personalData: boolean;
  readonly healthData: boolean;
  readonly financialData: boolean;
  readonly intellectualProperty: boolean;
  readonly customSensitivity?: Record<string, boolean>;
}

/**
 * Data sensitivity levels
 */
export enum DataSensitivityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  SENSITIVE = 'sensitive',
  HIGHLY_SENSITIVE = 'highly_sensitive',
  CRITICAL = 'critical'
}

/**
 * Data categories for privacy compliance
 */
export enum DataCategory {
  PERSONAL_IDENTITY = 'personal_identity',
  CONTACT_INFO = 'contact_info',
  FINANCIAL = 'financial',
  HEALTH = 'health',
  BIOMETRIC = 'biometric',
  LOCATION = 'location',
  BEHAVIORAL = 'behavioral',
  TECHNICAL = 'technical',
  PROFESSIONAL = 'professional',
  CUSTOM = 'custom'
}

/**
 * Jurisdiction information
 */
export interface JurisdictionInfo {
  readonly primary: string; // Primary jurisdiction (country code)
  readonly additional: readonly string[]; // Additional applicable jurisdictions
  readonly dataLocation: readonly string[]; // Where data is stored/processed
  readonly lawfulBasis?: string; // Legal basis for processing (GDPR, etc.)
  readonly crossBorderTransfer: boolean;
}

/**
 * Audit event metadata
 */
export interface AuditEventMetadata {
  readonly version: string;
  readonly schema: string;
  readonly producer: SecuritySource;
  readonly ingested: SecurityTimestamp;
  readonly processed: SecurityTimestamp;
  readonly indexed: SecurityTimestamp;
  readonly enriched: boolean;
  readonly validated: boolean;
  readonly tags: readonly string[];
  readonly customMetadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Audit log configuration
 */
/**
 * Missing audit interface definitions
 */
export interface AuditTransmission {
  readonly enabled: boolean;
  readonly encryption: boolean;
  readonly compression: boolean;
  readonly authentication: boolean;
  readonly retry: TransmissionRetry;
  readonly destinations: readonly TransmissionDestination[];
}

export interface TransmissionRetry {
  readonly enabled: boolean;
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly timeoutMs: number;
}

export interface TransmissionDestination {
  readonly type: string;
  readonly endpoint: string;
  readonly credentials?: Record<string, string>;
  readonly headers?: Record<string, string>;
}

export interface AuditRetention {
  readonly policy: string;
  readonly period: number; // milliseconds
  readonly archival: boolean;
  readonly destruction: boolean;
  readonly jurisdiction: readonly string[];
}

export interface AuditSecurity {
  readonly encryption: boolean;
  readonly signing: boolean;
  readonly integrity: boolean;
  readonly nonRepudiation: boolean;
  readonly accessControl: boolean;
}

export interface AuditComplianceConfig {
  readonly frameworks: readonly ComplianceFramework[];
  readonly requirements: readonly string[];
  readonly reporting: boolean;
  readonly validation: boolean;
  readonly certification: boolean;
}

export interface AuditPerformanceConfig {
  readonly batchSize: number;
  readonly flushInterval: number; // milliseconds
  readonly maxMemory: number; // bytes
  readonly compressionLevel: number;
  readonly parallelism: number;
}

export interface AuditMonitoringConfig {
  readonly enabled: boolean;
  readonly metrics: readonly string[];
  readonly alerting: boolean;
  readonly healthChecks: boolean;
  readonly dashboards: boolean;
}

// Add missing type alias for ComparisonOperator to resolve conflict
export type ConditionOperator = ComparisonOperator;

export interface AuditLogConfig {
  readonly enabled: boolean;
  readonly level: AuditLevel;
  readonly categories: readonly AuditCategory[];
  readonly targets: AuditTargets;
  readonly format: AuditFormat;
  readonly storage: AuditStorage;
  readonly transmission: AuditTransmission;
  readonly retention: AuditRetention;
  readonly security: AuditSecurity;
  readonly compliance: AuditComplianceConfig;
  readonly performance: AuditPerformanceConfig;
  readonly monitoring: AuditMonitoringConfig;
}

/**
 * Audit levels for filtering
 */
export enum AuditLevel {
  MINIMAL = 'minimal',     // Only critical security events
  STANDARD = 'standard',   // Standard security and compliance events
  DETAILED = 'detailed',   // Detailed logging including data access
  VERBOSE = 'verbose',     // All events including debug information
  CUSTOM = 'custom'        // Custom filtering rules
}

/**
 * Audit targets configuration
 */
export interface AuditTargets {
  readonly includeUsers: readonly SecurityId[];
  readonly excludeUsers: readonly SecurityId[];
  readonly includeRoles: readonly string[];
  readonly excludeRoles: readonly string[];
  readonly includeResources: readonly string[];
  readonly excludeResources: readonly string[];
  readonly includeActions: readonly string[];
  readonly excludeActions: readonly string[];
  readonly customFilters?: readonly AuditFilter[];
}

/**
 * Audit filter for custom targeting
 */
export interface AuditFilter {
  readonly name: string;
  readonly description: string;
  readonly conditions: readonly AuditCondition[];
  readonly action: FilterAction;
  readonly priority: number;
}

/**
 * Audit condition for filtering
 */
export interface AuditCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: SecurityAttributeValue;
  readonly caseSensitive?: boolean;
}

// ConditionOperator uses ComparisonOperator from shared-enums

/**
 * Filter actions
 */
export enum FilterAction {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
  ENHANCE = 'enhance',  // Add additional metadata
  REDACT = 'redact',    // Remove sensitive information
  ALERT = 'alert'       // Trigger alert
}

/**
 * Audit format configuration
 */
export interface AuditFormat {
  readonly primary: AuditFormatType;
  readonly alternatives: readonly AuditFormatType[];
  readonly structure: FormatStructure;
  readonly compression: CompressionConfig;
  readonly encryption: EncryptionConfig;
  readonly signing: SigningConfig;
}

/**
 * Audit format types
 */
export enum AuditFormatType {
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  SYSLOG = 'syslog',
  CEF = 'cef',          // Common Event Format
  LEEF = 'leef',        // Log Event Extended Format
  STIX = 'stix',        // Structured Threat Information eXpression
  PROTOBUF = 'protobuf',
  AVRO = 'avro',
  CUSTOM = 'custom'
}

/**
 * Format structure configuration
 */
export interface FormatStructure {
  readonly fields: readonly FieldConfig[];
  readonly nested: boolean;
  readonly flattened: boolean;
  readonly normalized: boolean;
  readonly customStructure?: Record<string, unknown>;
}

/**
 * Field configuration for audit format
 */
export interface FieldConfig {
  readonly name: string;
  readonly type: FieldType;
  readonly required: boolean;
  readonly sensitive: boolean;
  readonly encrypted: boolean;
  readonly masked: boolean;
  readonly format?: string;
  readonly validation?: FieldValidation;
}

/**
 * Field types
 */
export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATETIME = 'datetime',
  UUID = 'uuid',
  IP_ADDRESS = 'ip_address',
  EMAIL = 'email',
  URL = 'url',
  JSON = 'json',
  BINARY = 'binary',
  CUSTOM = 'custom'
}

/**
 * Field validation configuration
 */
export interface FieldValidation {
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly allowedValues?: readonly SecurityAttributeValue[];
  readonly customValidation?: string;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  readonly enabled: boolean;
  readonly algorithm: CompressionAlgorithm;
  readonly level: number; // 1-9
  readonly threshold: number; // Minimum size in bytes to compress
}

/**
 * Compression algorithms
 */
export enum CompressionAlgorithm {
  GZIP = 'gzip',
  ZLIB = 'zlib',
  DEFLATE = 'deflate',
  LZ4 = 'lz4',
  ZSTD = 'zstd',
  BROTLI = 'brotli'
}

/**
 * Encryption configuration for audit logs
 */
export interface EncryptionConfig {
  readonly enabled: boolean;
  readonly algorithm: string;
  readonly keySize: number;
  readonly keyRotation: KeyRotationConfig;
  readonly fields: readonly string[]; // Fields to encrypt
}

/**
 * Key rotation configuration
 */
export interface KeyRotationConfig {
  readonly enabled: boolean;
  readonly interval: number; // milliseconds
  readonly keyVersions: number; // Number of key versions to keep
  readonly autoRotate: boolean;
}

/**
 * Signing configuration for integrity
 */
export interface SigningConfig {
  readonly enabled: boolean;
  readonly algorithm: string;
  readonly keyId: string;
  readonly batchSize: number; // Number of events to sign together
  readonly timestamping: boolean;
}

/**
 * Audit storage configuration
 */
export interface AuditStorage {
  readonly primary: StorageConfig;
  readonly backup?: StorageConfig;
  readonly archive?: StorageConfig;
  readonly replication: ReplicationConfig;
  readonly indexing: IndexingConfig;
  readonly partitioning: PartitioningConfig;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  readonly type: StorageType;
  readonly location: string;
  readonly credentials?: Record<string, string>;
  readonly capacity: StorageCapacity;
  readonly performance: StoragePerformance;
  readonly durability: StorageDurability;
  readonly customConfig?: Record<string, SecurityAttributeValue>;
}

/**
 * Storage types
 */
export enum StorageType {
  FILE_SYSTEM = 'file_system',
  DATABASE = 'database',
  ELASTICSEARCH = 'elasticsearch',
  S3 = 's3',
  AZURE_BLOB = 'azure_blob',
  GCS = 'gcs',
  HDFS = 'hdfs',
  KAFKA = 'kafka',
  SPLUNK = 'splunk',
  SIEM = 'siem',
  CUSTOM = 'custom'
}

/**
 * Storage capacity configuration
 */
export interface StorageCapacity {
  readonly maxSize: number; // bytes
  readonly maxFiles: number;
  readonly maxEvents: number;
  readonly growthRate: number; // percentage
  readonly alertThresholds: CapacityThresholds;
}

/**
 * Capacity thresholds for alerting
 */
export interface CapacityThresholds {
  readonly warning: number; // percentage
  readonly critical: number; // percentage
  readonly full: number; // percentage
}

/**
 * Storage performance configuration
 */
export interface StoragePerformance {
  readonly throughput: ThroughputConfig;
  readonly latency: LatencyConfig;
  readonly consistency: ConsistencyLevel;
  readonly availability: AvailabilityConfig;
}

/**
 * Throughput configuration
 */
export interface ThroughputConfig {
  readonly reads: number; // operations per second
  readonly writes: number; // operations per second
  readonly bandwidth: number; // bytes per second
  readonly burst: BurstConfig;
}

/**
 * Burst configuration for throughput
 */
export interface BurstConfig {
  readonly enabled: boolean;
  readonly duration: number; // milliseconds
  readonly multiplier: number; // burst multiplier
}

/**
 * Latency configuration
 */
export interface LatencyConfig {
  readonly read: number; // milliseconds
  readonly write: number; // milliseconds
  readonly search: number; // milliseconds
  readonly tolerance: number; // acceptable variance
}

/**
 * Consistency levels
 */
export enum ConsistencyLevel {
  EVENTUAL = 'eventual',
  STRONG = 'strong',
  MONOTONIC = 'monotonic',
  CAUSAL = 'causal',
  SEQUENTIAL = 'sequential'
}

/**
 * Availability configuration
 */
export interface AvailabilityConfig {
  readonly target: number; // percentage (99.9%, 99.99%, etc.)
  readonly redundancy: RedundancyConfig;
  readonly failover: FailoverConfig;
  readonly monitoring: AvailabilityMonitoring;
}

/**
 * Redundancy configuration
 */
export interface RedundancyConfig {
  readonly replicas: number;
  readonly zones: number;
  readonly regions: number;
  readonly backups: BackupConfig;
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  readonly enabled: boolean;
  readonly frequency: number; // milliseconds
  readonly retention: number; // milliseconds
  readonly offsite: boolean;
  readonly encryption: boolean;
  readonly compression: boolean;
}

/**
 * Failover configuration
 */
export interface FailoverConfig {
  readonly automatic: boolean;
  readonly timeout: number; // milliseconds
  readonly retries: number;
  readonly backoff: BackoffConfig;
}

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  readonly strategy: BackoffStrategy;
  readonly initialDelay: number; // milliseconds
  readonly maxDelay: number; // milliseconds
  readonly multiplier: number;
}

/**
 * Backoff strategies
 */
export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  POLYNOMIAL = 'polynomial',
  CUSTOM = 'custom'
}

/**
 * Availability monitoring
 */
export interface AvailabilityMonitoring {
  readonly enabled: boolean;
  readonly checks: readonly HealthCheck[];
  readonly alerting: AlertingConfig;
  readonly reporting: ReportingConfig;
}

/**
 * Health check configuration
 */
export interface HealthCheck {
  readonly name: string;
  readonly type: HealthCheckType;
  readonly interval: number; // milliseconds
  readonly timeout: number; // milliseconds
  readonly threshold: HealthThreshold;
  readonly dependencies: readonly string[];
}

/**
 * Health check types
 */
export enum HealthCheckType {
  PING = 'ping',
  TCP_CONNECT = 'tcp_connect',
  HTTP_GET = 'http_get',
  DATABASE_QUERY = 'database_query',
  DISK_SPACE = 'disk_space',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  CUSTOM = 'custom'
}

/**
 * Health threshold configuration
 */
export interface HealthThreshold {
  readonly healthy: number;
  readonly degraded: number;
  readonly unhealthy: number;
  readonly critical: number;
}

/**
 * Alerting configuration
 */
export interface AlertingConfig {
  readonly enabled: boolean;
  readonly channels: readonly AlertChannel[];
  readonly rules: readonly AlertRule[];
  readonly throttling: AlertThrottling;
  readonly escalation: EscalationConfig;
}

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  readonly name: string;
  readonly type: AlertChannelType;
  readonly destination: string;
  readonly severity: readonly SecuritySeverity[];
  readonly template: string;
  readonly enabled: boolean;
}

/**
 * Alert channel types
 */
export enum AlertChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  PAGERDUTY = 'pagerduty',
  JIRA = 'jira',
  CUSTOM = 'custom'
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  readonly name: string;
  readonly description: string;
  readonly condition: AlertCondition;
  readonly severity: SecuritySeverity;
  readonly enabled: boolean;
  readonly channels: readonly string[];
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  readonly metric: string;
  readonly operator: ComparisonOperator;
  readonly threshold: number;
  readonly duration: number; // milliseconds
  readonly aggregation: AggregationFunction;
}

// ComparisonOperator is imported from shared-enums

/**
 * Aggregation functions for metrics
 */
export enum AggregationFunction {
  COUNT = 'count',
  SUM = 'sum',
  AVERAGE = 'average',
  MINIMUM = 'minimum',
  MAXIMUM = 'maximum',
  MEDIAN = 'median',
  PERCENTILE = 'percentile',
  STANDARD_DEVIATION = 'standard_deviation'
}

/**
 * Alert throttling configuration
 */
export interface AlertThrottling {
  readonly enabled: boolean;
  readonly window: number; // milliseconds
  readonly maxAlerts: number;
  readonly cooldown: number; // milliseconds
  readonly grouping: AlertGrouping;
}

/**
 * Alert grouping configuration
 */
export interface AlertGrouping {
  readonly enabled: boolean;
  readonly fields: readonly string[];
  readonly window: number; // milliseconds
  readonly maxGroups: number;
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  readonly enabled: boolean;
  readonly levels: readonly EscalationLevel[];
  readonly timeout: number; // milliseconds
  readonly maxRetries: number;
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  readonly level: number;
  readonly delay: number; // milliseconds
  readonly channels: readonly string[];
  readonly condition: EscalationCondition;
}

/**
 * Escalation condition
 */
export interface EscalationCondition {
  readonly unacknowledged: boolean;
  readonly severity: readonly SecuritySeverity[];
  readonly duration: number; // milliseconds
}

/**
 * Reporting configuration
 */
export interface ReportingConfig {
  readonly enabled: boolean;
  readonly frequency: ReportingFrequency;
  readonly recipients: readonly string[];
  readonly format: readonly ReportFormat[];
  readonly content: ReportContent;
  readonly delivery: ReportDelivery;
}

/**
 * Reporting frequency
 */
export enum ReportingFrequency {
  REAL_TIME = 'real_time',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  CUSTOM = 'custom'
}

// ReportFormat is imported from shared-enums

/**
 * Report content configuration
 */
export interface ReportContent {
  readonly summary: boolean;
  readonly details: boolean;
  readonly trends: boolean;
  readonly comparisons: boolean;
  readonly recommendations: boolean;
  readonly rawData: boolean;
  readonly charts: boolean;
  readonly customSections?: readonly ReportSection[];
}

/**
 * Report section
 */
export interface ReportSection {
  readonly name: string;
  readonly description: string;
  readonly queries: readonly string[];
  readonly visualizations: readonly VisualizationType[];
}

/**
 * Visualization types
 */
export enum VisualizationType {
  TABLE = 'table',
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  HEATMAP = 'heatmap',
  SCATTER_PLOT = 'scatter_plot',
  HISTOGRAM = 'histogram',
  CUSTOM = 'custom'
}

/**
 * Report delivery configuration
 */
export interface ReportDelivery {
  readonly methods: readonly DeliveryMethod[];
  readonly security: DeliverySecurity;
  readonly retention: DeliveryRetention;
}

/**
 * Delivery methods
 */
export enum DeliveryMethod {
  EMAIL = 'email',
  FILE_SHARE = 'file_share',
  S3_BUCKET = 's3_bucket',
  FTP = 'ftp',
  WEBHOOK = 'webhook',
  API = 'api',
  CUSTOM = 'custom'
}

/**
 * Delivery security
 */
export interface DeliverySecurity {
  readonly encryption: boolean;
  readonly signing: boolean;
  readonly authentication: boolean;
  readonly authorization: boolean;
}

/**
 * Delivery retention
 */
export interface DeliveryRetention {
  readonly period: number; // milliseconds
  readonly location: string;
  readonly encryption: boolean;
  readonly access: readonly SecurityId[];
}

/**
 * Storage durability configuration
 */
export interface StorageDurability {
  readonly target: number; // percentage (99.999999999% for "eleven 9s")
  readonly checksums: boolean;
  readonly repair: boolean;
  readonly versioning: boolean;
  readonly immutable: boolean;
}

/**
 * Replication configuration
 */
export interface ReplicationConfig {
  readonly enabled: boolean;
  readonly strategy: ReplicationStrategy;
  readonly replicas: number;
  readonly consistency: ConsistencyLevel;
  readonly locations: readonly ReplicationLocation[];
}

/**
 * Replication strategies
 */
export enum ReplicationStrategy {
  SYNCHRONOUS = 'synchronous',
  ASYNCHRONOUS = 'asynchronous',
  SEMI_SYNCHRONOUS = 'semi_synchronous',
  MASTER_SLAVE = 'master_slave',
  MASTER_MASTER = 'master_master',
  CUSTOM = 'custom'
}

/**
 * Replication location
 */
export interface ReplicationLocation {
  readonly id: string;
  readonly type: LocationType;
  readonly region: string;
  readonly zone: string;
  readonly priority: number;
  readonly lag: number; // milliseconds
}

/**
 * Location types
 */
export enum LocationType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  ARCHIVE = 'archive',
  BACKUP = 'backup',
  DISASTER_RECOVERY = 'disaster_recovery'
}

/**
 * Indexing configuration
 */
export interface IndexingConfig {
  readonly enabled: boolean;
  readonly strategy: IndexingStrategy;
  readonly fields: readonly IndexField[];
  readonly performance: IndexPerformance;
  readonly maintenance: IndexMaintenance;
}

/**
 * Indexing strategies
 */
export enum IndexingStrategy {
  REAL_TIME = 'real_time',
  NEAR_REAL_TIME = 'near_real_time',
  BATCH = 'batch',
  SCHEDULED = 'scheduled',
  ON_DEMAND = 'on_demand'
}

/**
 * Index field configuration
 */
export interface IndexField {
  readonly name: string;
  readonly type: IndexFieldType;
  readonly analyzer?: string;
  readonly boost?: number;
  readonly store: boolean;
  readonly index: boolean;
}

/**
 * Index field types
 */
export enum IndexFieldType {
  TEXT = 'text',
  KEYWORD = 'keyword',
  DATE = 'date',
  LONG = 'long',
  DOUBLE = 'double',
  BOOLEAN = 'boolean',
  IP = 'ip',
  GEO_POINT = 'geo_point',
  NESTED = 'nested',
  OBJECT = 'object'
}

/**
 * Index performance configuration
 */
export interface IndexPerformance {
  readonly shards: number;
  readonly replicas: number;
  readonly refreshInterval: number; // milliseconds
  readonly bufferSize: number; // bytes
  readonly batchSize: number;
}

/**
 * Index maintenance configuration
 */
export interface IndexMaintenance {
  readonly optimization: OptimizationConfig;
  readonly cleanup: CleanupConfig;
  readonly monitoring: MaintenanceMonitoring;
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  readonly enabled: boolean;
  readonly schedule: string; // cron expression
  readonly threshold: number; // fragmentation threshold
  readonly maxSegments: number;
}

/**
 * Cleanup configuration
 */
export interface CleanupConfig {
  readonly enabled: boolean;
  readonly schedule: string; // cron expression
  readonly retention: number; // milliseconds
  readonly archival: boolean;
}

/**
 * Maintenance monitoring
 */
export interface MaintenanceMonitoring {
  readonly enabled: boolean;
  readonly metrics: readonly MaintenanceMetric[];
  readonly alerting: boolean;
}

/**
 * Maintenance metrics
 */
export enum MaintenanceMetric {
  INDEX_SIZE = 'index_size',
  SEARCH_LATENCY = 'search_latency',
  INDEXING_RATE = 'indexing_rate',
  FRAGMENTATION = 'fragmentation',
  CACHE_HIT_RATE = 'cache_hit_rate',
  ERROR_RATE = 'error_rate'
}

/**
 * Partitioning configuration
 */
export interface PartitioningConfig {
  readonly enabled: boolean;
  readonly strategy: PartitioningStrategy;
  readonly field: string;
  readonly size: PartitionSize;
  readonly retention: PartitionRetention;
  readonly lifecycle: PartitionLifecycle;
}

/**
 * Partitioning strategies
 */
export enum PartitioningStrategy {
  TIME_BASED = 'time_based',
  SIZE_BASED = 'size_based',
  HASH_BASED = 'hash_based',
  RANGE_BASED = 'range_based',
  CUSTOM = 'custom'
}

/**
 * Partition size configuration
 */
export interface PartitionSize {
  readonly maxEvents: number;
  readonly maxSize: number; // bytes
  readonly maxAge: number; // milliseconds
}

/**
 * Partition retention configuration
 */
export interface PartitionRetention {
  readonly policy: RetentionPolicy;
  readonly duration: number; // milliseconds
  readonly action: RetentionAction;
}

/**
 * Retention policies
 */
export enum RetentionPolicy {
  DELETE = 'delete',
  ARCHIVE = 'archive',
  COMPRESS = 'compress',
  MIGRATE = 'migrate',
  CUSTOM = 'custom'
}

/**
 * Retention actions
 */
export enum RetentionAction {
  DELETE_IMMEDIATELY = 'delete_immediately',
  MOVE_TO_ARCHIVE = 'move_to_archive',
  COMPRESS_IN_PLACE = 'compress_in_place',
  MIGRATE_TO_COLD = 'migrate_to_cold',
  CUSTOM_ACTION = 'custom_action'
}

/**
 * Partition lifecycle configuration
 */
export interface PartitionLifecycle {
  readonly stages: readonly LifecycleStage[];
  readonly automation: boolean;
  readonly monitoring: boolean;
}

/**
 * Lifecycle stage
 */
export interface LifecycleStage {
  readonly name: string;
  readonly condition: LifecycleCondition;
  readonly action: LifecycleAction;
  readonly duration?: number; // milliseconds
}

/**
 * Lifecycle condition
 */
export interface LifecycleCondition {
  readonly type: ConditionType;
  readonly threshold: number;
  readonly operator: ComparisonOperator;
}

/**
 * Condition types for lifecycle
 */
export enum ConditionType {
  AGE = 'age',
  SIZE = 'size',
  EVENT_COUNT = 'event_count',
  ACCESS_FREQUENCY = 'access_frequency',
  CUSTOM = 'custom'
}

/**
 * Lifecycle actions
 */
export enum LifecycleAction {
  HOT_TO_WARM = 'hot_to_warm',
  WARM_TO_COLD = 'warm_to_cold',
  COLD_TO_FROZEN = 'cold_to_frozen',
  COMPRESS = 'compress',
  DELETE = 'delete',
  CUSTOM = 'custom'
}

/**
 * Type guards for audit types
 */
export const isAuditEvent = (value: unknown): value is AuditEvent => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'timestamp' in value &&
    'type' in value &&
    'actor' in value &&
    'target' in value &&
    'action' in value &&
    Object.values(AuditEventType).includes((value as AuditEvent).type)
  );
};

export const isAuditActor = (value: unknown): value is AuditActor => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'id' in value &&
    Object.values(ActorType).includes((value as AuditActor).type)
  );
};

export const isAuditTarget = (value: unknown): value is AuditTarget => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    Object.values(TargetType).includes((value as AuditTarget).type)
  );
};

export const isAuditLogConfig = (value: unknown): value is AuditLogConfig => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enabled' in value &&
    'level' in value &&
    'targets' in value &&
    'format' in value &&
    'storage' in value &&
    typeof (value as AuditLogConfig).enabled === 'boolean' &&
    Object.values(AuditLevel).includes((value as AuditLogConfig).level)
  );
};

/**
 * Utility functions for audit operations
 */
export const createAuditEvent = (
  type: AuditEventType,
  actor: AuditActor,
  target: AuditTarget,
  action: AuditAction,
  outcome: AuditOutcome = AuditOutcome.SUCCESS,
  severity: SecuritySeverity = SecuritySeverity.INFO
): Partial<AuditEvent> => ({
  id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
  timestamp: new Date().toISOString(),
  type,
  category: inferAuditCategory(type),
  severity,
  outcome,
  actor,
  target,
  action,
  context: {},
  details: {
    message: `${actor.name || actor.id} ${action.name} ${target.name || target.id}`,
  },
  compliance: {
    frameworks: [],
    requirements: [],
    retention: {
      period: 365 * 24 * 60 * 60 * 1000, // 1 year default
      policy: 'default',
      reason: 'compliance requirement',
      jurisdiction: ['US']
    },
    sensitivity: {
      level: DataSensitivityLevel.INTERNAL,
      categories: [],
      personalData: false,
      healthData: false,
      financialData: false,
      intellectualProperty: false
    },
    jurisdiction: {
      primary: 'US',
      additional: [],
      dataLocation: ['US'],
      crossBorderTransfer: false
    }
  }
});

const inferAuditCategory = (type: AuditEventType): AuditCategory => {
  if (type.startsWith('auth.')) return AuditCategory.AUTHENTICATION;
  if (type.startsWith('authz.')) return AuditCategory.AUTHORIZATION;
  if (type.startsWith('data.')) return AuditCategory.DATA_ACCESS;
  if (type.startsWith('system.')) return AuditCategory.SYSTEM_ADMINISTRATION;
  if (type.startsWith('security.')) return AuditCategory.SECURITY;
  if (type.startsWith('compliance.')) return AuditCategory.COMPLIANCE;
  if (type.startsWith('admin.')) return AuditCategory.SYSTEM_ADMINISTRATION;
  return AuditCategory.TECHNICAL;
};

export const maskSensitiveData = (
  data: SecurityAttributeValue,
  sensitiveFields: readonly string[]
): SecurityAttributeValue => {
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(item => maskSensitiveData(item, sensitiveFields));

  const masked: Record<string, SecurityAttributeValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveFields.includes(key)) {
      masked[key] = typeof value === 'string' ? '*'.repeat(Math.min(value.length, 8)) : '***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, sensitiveFields);
    } else {
      masked[key] = value;
    }
  }
  return masked;
};

export const calculateRetentionDate = (
  event: AuditEvent,
  policy?: RetentionPolicy
): SecurityTimestamp => {
  const eventDate = new Date(event.timestamp);
  const retentionPeriod = event.compliance.retention.period;
  const retentionDate = new Date(eventDate.getTime() + retentionPeriod);
  return retentionDate.toISOString();
};