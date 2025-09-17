/**
 * API Security Types and Interfaces
 * Enterprise-grade API security with authentication, authorization, rate limiting, and CORS
 *
 * @fileoverview Complete API security type definitions for secure API management
 * @author API Security Specialist
 * @version 1.0.0
 */


import {
  AuthenticationMethod,
  AuthenticationFactor,
  JwtTokenType,
  OAuthGrantType,
  OAuthScope,
  UserAccountStatus
} from './authentication';
import {
  AuthorizationModel,
  AccessDecision,
  PermissionType,
  ActionType,
  PrincipalType
} from './authorization';
import {
  SecurityId,
  SecurityTimestamp,
  SecurityToken,
  SecurityContext,
  SecurityResult,
  SecurityError,
  SecuritySeverity,
  SecurityAlgorithm,
  SecurityAttributeValue,
  SecurityValidationResult,
  SecurityViolation,
  DeviceFingerprint,
  NetworkContext,
  GeographicLocation,
  SecurityEnforceMode
} from './base';
import {
  ResourceType,
  ComparisonOperator
} from './shared-enums';

// ===========================
// API AUTHENTICATION TYPES
// ===========================

/**
 * API authentication schemes
 */
export enum ApiAuthScheme {
  BEARER = 'Bearer',
  BASIC = 'Basic',
  DIGEST = 'Digest',
  API_KEY = 'ApiKey',
  OAUTH = 'OAuth',
  JWT = 'JWT',
  CUSTOM = 'Custom',
  NONE = 'None'
}

/**
 * API authentication configuration
 */
export interface ApiAuthConfig {
  readonly scheme: ApiAuthScheme;
  readonly enabled: boolean;
  readonly required: boolean;
  readonly methods: readonly AuthenticationMethod[];
  readonly factors?: readonly AuthenticationFactor[];
  readonly tokenConfig?: ApiTokenConfig;
  readonly oauthConfig?: ApiOAuthConfig;
  readonly customConfig?: Record<string, SecurityAttributeValue>;
  readonly fallbackSchemes?: readonly ApiAuthScheme[];
}

/**
 * API token configuration
 */
export interface ApiTokenConfig {
  readonly type: JwtTokenType;
  readonly algorithm: SecurityAlgorithm;
  readonly expirationTime: number; // seconds
  readonly refreshable: boolean;
  readonly audience: readonly string[];
  readonly issuer: string;
  readonly subject?: string;
  readonly clockTolerance?: number; // seconds
  readonly customClaims?: Record<string, SecurityAttributeValue>;
  readonly encryptionKey?: SecurityToken;
  readonly signingKey: SecurityToken;
  readonly verificationKey?: SecurityToken;
}

/**
 * API OAuth configuration
 */
export interface ApiOAuthConfig {
  readonly clientId: string;
  readonly clientSecret?: SecurityToken;
  readonly redirectUris: readonly string[];
  readonly allowedGrantTypes: readonly OAuthGrantType[];
  readonly defaultScopes: readonly OAuthScope[];
  readonly maxScopes: readonly OAuthScope[];
  readonly requirePkce: boolean;
  readonly requireState: boolean;
  readonly tokenEndpoint: string;
  readonly authorizationEndpoint: string;
  readonly introspectionEndpoint?: string;
  readonly revocationEndpoint?: string;
}

/**
 * API authentication request
 */
export interface ApiAuthRequest {
  readonly requestId: SecurityId;
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly query?: Record<string, string>;
  readonly body?: SecurityAttributeValue;
  readonly clientInfo: ApiClientInfo;
  readonly context: SecurityContext;
}

/**
 * API client information
 */
export interface ApiClientInfo {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: ApiClientType;
  readonly version?: string;
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly device?: DeviceFingerprint;
  readonly network?: NetworkContext;
  readonly location?: GeographicLocation;
  readonly trusted: boolean;
  readonly registeredAt: SecurityTimestamp;
  readonly lastSeen: SecurityTimestamp;
}

/**
 * API client types
 */
export enum ApiClientType {
  WEB_APPLICATION = 'web_application',
  MOBILE_APPLICATION = 'mobile_application',
  DESKTOP_APPLICATION = 'desktop_application',
  SERVER_APPLICATION = 'server_application',
  SERVICE = 'service',
  IOT_DEVICE = 'iot_device',
  THIRD_PARTY = 'third_party',
  INTERNAL = 'internal'
}

/**
 * API authentication result
 */
export interface ApiAuthResult extends SecurityResult<ApiAuthData> {
  readonly decision: AccessDecision;
  readonly principal?: ApiPrincipal;
  readonly token?: ApiToken;
  readonly session?: ApiSession;
  readonly challenges?: readonly ApiAuthChallenge[];
}

/**
 * API authentication data
 */
export interface ApiAuthData {
  readonly authenticated: boolean;
  readonly principal: ApiPrincipal;
  readonly permissions: readonly ApiPermission[];
  readonly token?: ApiToken;
  readonly session?: ApiSession;
  readonly metadata: ApiAuthMetadata;
}

/**
 * API principal (authenticated entity)
 */
export interface ApiPrincipal {
  readonly id: SecurityId;
  readonly type: PrincipalType;
  readonly name: string;
  readonly email?: string;
  readonly roles: readonly string[];
  readonly groups: readonly string[];
  readonly attributes: Record<string, SecurityAttributeValue>;
  readonly accountStatus: UserAccountStatus;
  readonly permissions: readonly ApiPermission[];
  readonly constraints?: ApiPrincipalConstraints;
}

/**
 * API principal constraints
 */
export interface ApiPrincipalConstraints {
  readonly ipWhitelist?: readonly string[];
  readonly ipBlacklist?: readonly string[];
  readonly timeRestrictions?: TimeRestrictions;
  readonly locationRestrictions?: LocationRestrictions;
  readonly deviceRestrictions?: DeviceRestrictions;
  readonly rateLimit?: ApiRateLimit;
}

/**
 * Time-based access restrictions
 */
export interface TimeRestrictions {
  readonly allowedHours?: readonly number[]; // 0-23
  readonly allowedDays?: readonly number[]; // 0-6, Sunday=0
  readonly timezone: string;
  readonly exceptions?: readonly TimeException[];
}

/**
 * Time restriction exceptions
 */
export interface TimeException {
  readonly start: SecurityTimestamp;
  readonly end: SecurityTimestamp;
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Location-based access restrictions
 */
export interface LocationRestrictions {
  readonly allowedCountries?: readonly string[];
  readonly blockedCountries?: readonly string[];
  readonly allowedRegions?: readonly string[];
  readonly blockedRegions?: readonly string[];
  readonly maxDistance?: number; // kilometers from registered location
  readonly requireKnownLocation: boolean;
}

/**
 * Device-based access restrictions
 */
export interface DeviceRestrictions {
  readonly allowedDeviceTypes?: readonly string[];
  readonly blockedDeviceTypes?: readonly string[];
  readonly requireTrustedDevice: boolean;
  readonly maxConcurrentSessions?: number;
  readonly deviceFingerprinting: boolean;
}

/**
 * API token information
 */
export interface ApiToken {
  readonly value: SecurityToken;
  readonly type: JwtTokenType;
  readonly algorithm: SecurityAlgorithm;
  readonly claims: ApiTokenClaims;
  readonly metadata: ApiTokenMetadata;
}

/**
 * API token claims
 */
export interface ApiTokenClaims {
  readonly iss: string; // issuer
  readonly sub: string; // subject
  readonly aud: readonly string[]; // audience
  readonly exp: number; // expiration time
  readonly nbf?: number; // not before
  readonly iat: number; // issued at
  readonly jti: string; // JWT ID
  readonly scope?: readonly string[]; // OAuth scopes
  readonly roles?: readonly string[]; // user roles
  readonly permissions?: readonly string[]; // specific permissions
  readonly customClaims?: Record<string, SecurityAttributeValue>;
}

/**
 * API token metadata
 */
export interface ApiTokenMetadata {
  readonly createdAt: SecurityTimestamp;
  readonly expiresAt: SecurityTimestamp;
  readonly refreshable: boolean;
  readonly revokedAt?: SecurityTimestamp;
  readonly clientId: SecurityId;
  readonly sessionId?: SecurityId;
  readonly deviceId?: SecurityId;
  readonly ipAddress: string;
  readonly lastUsed?: SecurityTimestamp;
  readonly usageCount: number;
}

/**
 * API session information
 */
export interface ApiSession {
  readonly id: SecurityId;
  readonly principalId: SecurityId;
  readonly clientId: SecurityId;
  readonly createdAt: SecurityTimestamp;
  readonly lastActivity: SecurityTimestamp;
  readonly expiresAt: SecurityTimestamp;
  readonly ipAddress: string;
  readonly device: DeviceFingerprint;
  readonly mfaVerified: boolean;
  readonly riskScore: number; // 0-1
  readonly state: ApiSessionState;
  readonly attributes: Record<string, SecurityAttributeValue>;
}

/**
 * API session states
 */
export enum ApiSessionState {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  SUSPENDED = 'suspended',
  LOCKED = 'locked'
}

/**
 * API authentication challenge
 */
export interface ApiAuthChallenge {
  readonly type: ApiChallengeType;
  readonly realm?: string;
  readonly parameters: Record<string, string>;
  readonly expires?: SecurityTimestamp;
}

/**
 * API challenge types
 */
export enum ApiChallengeType {
  BASIC = 'Basic',
  DIGEST = 'Digest',
  BEARER = 'Bearer',
  MFA = 'MFA',
  CAPTCHA = 'Captcha',
  CUSTOM = 'Custom'
}

/**
 * API authentication metadata
 */
export interface ApiAuthMetadata {
  readonly processingTime: number;
  readonly authScheme: ApiAuthScheme;
  readonly mfaUsed: boolean;
  readonly riskScore: number;
  readonly trustLevel: ApiTrustLevel;
  readonly geolocation?: GeographicLocation;
  readonly deviceTrust: number; // 0-1
  readonly behaviorAnalysis?: BehaviorAnalysis;
}

/**
 * API trust levels
 */
export enum ApiTrustLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Behavior analysis for API requests
 */
export interface BehaviorAnalysis {
  readonly patterns: readonly string[];
  readonly anomalies: readonly string[];
  readonly riskFactors: readonly RiskFactor[];
  readonly confidence: number; // 0-1
  readonly recommendations: readonly string[];
}

/**
 * Risk factors for behavior analysis
 */
export interface RiskFactor {
  readonly type: string;
  readonly severity: SecuritySeverity;
  readonly score: number; // 0-1
  readonly description: string;
  readonly evidence: readonly string[];
}

// ===========================
// API AUTHORIZATION TYPES
// ===========================

/**
 * API authorization configuration
 */
export interface ApiAuthzConfig {
  readonly enabled: boolean;
  readonly model: AuthorizationModel;
  readonly enforceMode: SecurityEnforceMode;
  readonly defaultDecision: AccessDecision;
  readonly policies: readonly ApiAuthzPolicy[];
  readonly roleMapping?: Record<string, readonly string[]>;
  readonly attributeProviders?: readonly ApiAttributeProvider[];
  readonly cacheConfig?: ApiAuthzCacheConfig;
}

/**
 * API authorization policy
 */
export interface ApiAuthzPolicy {
  readonly id: SecurityId;
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly conditions: ApiPolicyConditions;
  readonly effect: PermissionType;
  readonly actions: readonly ActionType[];
  readonly resources: readonly ApiResource[];
  readonly principals?: readonly ApiPrincipalSelector[];
  readonly constraints?: ApiPolicyConstraints;
  readonly metadata?: Record<string, SecurityAttributeValue>;
}

/**
 * API policy conditions
 */
export interface ApiPolicyConditions {
  readonly timeRange?: TimeRange;
  readonly ipConditions?: IpConditions;
  readonly locationConditions?: LocationConditions;
  readonly deviceConditions?: DeviceConditions;
  readonly customConditions?: Record<string, SecurityAttributeValue>;
  readonly logicalOperator: LogicalOperator;
}

/**
 * Time range conditions
 */
export interface TimeRange {
  readonly start?: SecurityTimestamp;
  readonly end?: SecurityTimestamp;
  readonly weekdays?: readonly number[];
  readonly hours?: readonly number[];
  readonly timezone: string;
}

/**
 * IP address conditions
 */
export interface IpConditions {
  readonly allowedRanges?: readonly string[];
  readonly blockedRanges?: readonly string[];
  readonly requireKnownIp: boolean;
  readonly maxHops?: number;
}

/**
 * Location conditions
 */
export interface LocationConditions {
  readonly allowedCountries?: readonly string[];
  readonly blockedCountries?: readonly string[];
  readonly allowedRegions?: readonly string[];
  readonly blockedRegions?: readonly string[];
  readonly maxDistance?: number;
  readonly referenceLocation?: GeographicLocation;
}

/**
 * Device conditions
 */
export interface DeviceConditions {
  readonly allowedDeviceTypes?: readonly string[];
  readonly blockedDeviceTypes?: readonly string[];
  readonly requireTrustedDevice: boolean;
  readonly minTrustScore?: number;
  readonly deviceAttributes?: Record<string, SecurityAttributeValue>;
}

/**
 * Logical operators for combining conditions
 */
export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  XOR = 'xor'
}

/**
 * API resource definition
 */
export interface ApiResource {
  readonly id: SecurityId;
  readonly type: ResourceType;
  readonly identifier: string;
  readonly path?: string;
  readonly method?: string;
  readonly attributes: Record<string, SecurityAttributeValue>;
  readonly sensitivity: ResourceSensitivity;
  readonly owner?: SecurityId;
  readonly parent?: SecurityId;
  readonly children?: readonly SecurityId[];
}

/**
 * Resource sensitivity levels
 */
export enum ResourceSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

/**
 * API principal selector
 */
export interface ApiPrincipalSelector {
  readonly type: PrincipalType;
  readonly identifier?: string;
  readonly attributes?: Record<string, SecurityAttributeValue>;
  readonly roles?: readonly string[];
  readonly groups?: readonly string[];
  readonly matchType: MatchType;
}

/**
 * Matching types for selectors
 */
export enum MatchType {
  EXACT = 'exact',
  WILDCARD = 'wildcard',
  REGEX = 'regex',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with'
}

/**
 * API policy constraints
 */
export interface ApiPolicyConstraints {
  readonly maxUsage?: number;
  readonly usageWindow?: number; // seconds
  readonly requireMfa?: boolean;
  readonly minAuthLevel?: number;
  readonly dataClassification?: readonly string[];
  readonly auditRequired: boolean;
  readonly approvalRequired?: boolean;
  readonly delegationAllowed: boolean;
}

/**
 * API attribute provider
 */
export interface ApiAttributeProvider {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: AttributeProviderType;
  readonly endpoint?: string;
  readonly cacheTime?: number; // seconds
  readonly timeout?: number; // milliseconds
  readonly credentials?: SecurityToken;
  readonly attributes: readonly string[];
}

/**
 * Attribute provider types
 */
export enum AttributeProviderType {
  LDAP = 'ldap',
  DATABASE = 'database',
  REST_API = 'rest_api',
  GRAPHQL = 'graphql',
  STATIC = 'static',
  COMPUTED = 'computed'
}

/**
 * API authorization cache configuration
 */
export interface ApiAuthzCacheConfig {
  readonly enabled: boolean;
  readonly ttl: number; // seconds
  readonly maxSize: number;
  readonly strategy: CacheStrategy;
  readonly keyPrefix: string;
  readonly compression: boolean;
}

/**
 * Cache strategies
 */
export enum CacheStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  TTL = 'ttl',
  FIFO = 'fifo'
}

/**
 * API authorization request
 */
export interface ApiAuthzRequest {
  readonly requestId: SecurityId;
  readonly principal: ApiPrincipal;
  readonly action: ActionType;
  readonly resource: ApiResource;
  readonly context: ApiRequestContext;
  readonly environment: SecurityAttributeValue;
}

/**
 * API request context for authorization
 */
export interface ApiRequestContext {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly query: Record<string, string>;
  readonly body?: SecurityAttributeValue;
  readonly clientInfo: ApiClientInfo;
  readonly sessionInfo?: ApiSession;
  readonly timestamp: SecurityTimestamp;
  readonly attributes: Record<string, SecurityAttributeValue>;
}

/**
 * API authorization result
 */
export interface ApiAuthzResult extends SecurityResult<ApiAuthzData> {
  readonly decision: AccessDecision;
  readonly permissions: readonly ApiPermission[];
  readonly obligations?: readonly ApiObligation[];
  readonly advice?: readonly ApiAdvice[];
}

/**
 * API authorization data
 */
export interface ApiAuthzData {
  readonly authorized: boolean;
  readonly permissions: readonly ApiPermission[];
  readonly appliedPolicies: readonly SecurityId[];
  readonly evaluationTrace: readonly PolicyEvaluation[];
  readonly obligations: readonly ApiObligation[];
  readonly advice: readonly ApiAdvice[];
}

/**
 * API permission definition
 */
export interface ApiPermission {
  readonly id: SecurityId;
  readonly action: ActionType;
  readonly resource: string;
  readonly effect: PermissionType;
  readonly conditions?: ApiPolicyConditions;
  readonly scope?: PermissionScope;
  readonly delegation?: DelegationInfo;
  readonly expiry?: SecurityTimestamp;
}

/**
 * Permission scope definition
 */
export interface PermissionScope {
  readonly attributes?: readonly string[];
  readonly filters?: Record<string, SecurityAttributeValue>;
  readonly limits?: PermissionLimits;
}

/**
 * Permission limits
 */
export interface PermissionLimits {
  readonly maxRecords?: number;
  readonly maxSize?: number; // bytes
  readonly rateLimit?: number; // requests per second
  readonly quotas?: Record<string, number>;
}

/**
 * Delegation information
 */
export interface DelegationInfo {
  readonly delegator: SecurityId;
  readonly delegatee: SecurityId;
  readonly timestamp: SecurityTimestamp;
  readonly expiry?: SecurityTimestamp;
  readonly revocable: boolean;
  readonly transferable: boolean;
}

/**
 * Policy evaluation trace
 */
export interface PolicyEvaluation {
  readonly policyId: SecurityId;
  readonly decision: AccessDecision;
  readonly conditions: readonly ConditionEvaluation[];
  readonly processingTime: number;
  readonly errors?: readonly SecurityError[];
}

/**
 * Condition evaluation result
 */
export interface ConditionEvaluation {
  readonly condition: string;
  readonly result: boolean;
  readonly value?: SecurityAttributeValue;
  readonly operator: string;
  readonly expected?: SecurityAttributeValue;
}

/**
 * API obligation (must be fulfilled)
 */
export interface ApiObligation {
  readonly id: SecurityId;
  readonly type: ObligationType;
  readonly action: string;
  readonly parameters: Record<string, SecurityAttributeValue>;
  readonly deadline?: SecurityTimestamp;
  readonly priority: number;
}

/**
 * Obligation types
 */
export enum ObligationType {
  LOG = 'log',
  NOTIFY = 'notify',
  ENCRYPT = 'encrypt',
  AUDIT = 'audit',
  APPROVE = 'approve',
  CUSTOM = 'custom'
}

/**
 * API advice (should be considered)
 */
export interface ApiAdvice {
  readonly id: SecurityId;
  readonly type: AdviceType;
  readonly message: string;
  readonly severity: SecuritySeverity;
  readonly recommendations: readonly string[];
}

/**
 * Advice types
 */
export enum AdviceType {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  COMPLIANCE = 'compliance',
  OPTIMIZATION = 'optimization',
  WARNING = 'warning'
}

// ===========================
// API RATE LIMITING TYPES
// ===========================

/**
 * Rate limiting configuration
 */
export interface ApiRateLimitConfig {
  readonly enabled: boolean;
  readonly globalLimits: readonly ApiRateLimit[];
  readonly userLimits: readonly ApiRateLimit[];
  readonly clientLimits: readonly ApiRateLimit[];
  readonly endpointLimits: readonly ApiEndpointRateLimit[];
  readonly quotas: readonly ApiQuota[];
  readonly enforcement: RateLimitEnforcement;
  readonly storage: RateLimitStorage;
}

/**
 * Rate limit definition
 */
export interface ApiRateLimit {
  readonly id: SecurityId;
  readonly name: string;
  readonly windowMs: number; // time window in milliseconds
  readonly maxRequests: number; // max requests per window
  readonly scope: RateLimitScope;
  readonly keyGenerator?: RateLimitKeyGenerator;
  readonly conditions?: RateLimitConditions;
  readonly actions: RateLimitActions;
  readonly metrics: RateLimitMetrics;
}

/**
 * Rate limit scope
 */
export enum RateLimitScope {
  GLOBAL = 'global',
  USER = 'user',
  CLIENT = 'client',
  IP = 'ip',
  ENDPOINT = 'endpoint',
  CUSTOM = 'custom'
}

/**
 * Rate limit key generator
 */
export interface RateLimitKeyGenerator {
  readonly type: KeyGeneratorType;
  readonly fields: readonly string[];
  readonly separator: string;
  readonly prefix: string;
  readonly hash: boolean;
}

/**
 * Key generator types
 */
export enum KeyGeneratorType {
  COMPOSITE = 'composite',
  USER_ID = 'user_id',
  CLIENT_ID = 'client_id',
  IP_ADDRESS = 'ip_address',
  API_KEY = 'api_key',
  CUSTOM = 'custom'
}

/**
 * Rate limit conditions
 */
export interface RateLimitConditions {
  readonly methods?: readonly string[];
  readonly paths?: readonly string[];
  readonly userTypes?: readonly string[];
  readonly clientTypes?: readonly ApiClientType[];
  readonly customConditions?: Record<string, SecurityAttributeValue>;
}

/**
 * Rate limit actions
 */
export interface RateLimitActions {
  readonly onExceeded: RateLimitAction;
  readonly onApproaching?: RateLimitAction;
  readonly onReset?: RateLimitAction;
  readonly customActions?: readonly CustomRateLimitAction[];
}

/**
 * Rate limit action types
 */
export enum RateLimitAction {
  BLOCK = 'block',
  THROTTLE = 'throttle',
  QUEUE = 'queue',
  WARN = 'warn',
  LOG = 'log',
  CUSTOM = 'custom'
}

/**
 * Custom rate limit action
 */
export interface CustomRateLimitAction {
  readonly name: string;
  readonly handler: string;
  readonly parameters: Record<string, SecurityAttributeValue>;
  readonly async: boolean;
}

/**
 * Rate limit metrics
 */
export interface RateLimitMetrics {
  readonly track: boolean;
  readonly metrics: readonly string[];
  readonly aggregation: MetricAggregation;
  readonly retention: number; // seconds
}

/**
 * Metric aggregation types
 */
export enum MetricAggregation {
  SUM = 'sum',
  AVERAGE = 'average',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count'
}

/**
 * Endpoint-specific rate limit
 */
export interface ApiEndpointRateLimit extends ApiRateLimit {
  readonly endpoint: string;
  readonly method: string;
  readonly pathPattern: string;
  readonly parameterLimits?: Record<string, ApiRateLimit>;
}

/**
 * API quota definition
 */
export interface ApiQuota {
  readonly id: SecurityId;
  readonly name: string;
  readonly type: QuotaType;
  readonly limit: number;
  readonly period: QuotaPeriod;
  readonly scope: RateLimitScope;
  readonly resetPolicy: QuotaResetPolicy;
  readonly overage: QuotaOverage;
  readonly tracking: QuotaTracking;
}

/**
 * Quota types
 */
export enum QuotaType {
  REQUEST_COUNT = 'request_count',
  BANDWIDTH = 'bandwidth',
  STORAGE = 'storage',
  COMPUTE_TIME = 'compute_time',
  CUSTOM = 'custom'
}

/**
 * Quota periods
 */
export enum QuotaPeriod {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

/**
 * Quota reset policies
 */
export enum QuotaResetPolicy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  ROLLING_WINDOW = 'rolling_window'
}

/**
 * Quota overage handling
 */
export interface QuotaOverage {
  readonly allowed: boolean;
  readonly maxOverage: number; // percentage
  readonly penalty: QuotaPenalty;
  readonly billing?: QuotaBilling;
}

/**
 * Quota penalty
 */
export interface QuotaPenalty {
  readonly type: QuotaPenaltyType;
  readonly duration: number; // seconds
  readonly severity: SecuritySeverity;
}

/**
 * Quota penalty types
 */
export enum QuotaPenaltyType {
  THROTTLE = 'throttle',
  SUSPEND = 'suspend',
  CHARGE = 'charge',
  WARNING = 'warning'
}

/**
 * Quota billing information
 */
export interface QuotaBilling {
  readonly enabled: boolean;
  readonly rate: number; // cost per unit
  readonly currency: string;
  readonly billing_cycle: QuotaPeriod;
}

/**
 * Quota tracking configuration
 */
export interface QuotaTracking {
  readonly enabled: boolean;
  readonly precision: QuotaPrecision;
  readonly storage: RateLimitStorage;
  readonly alerts: readonly QuotaAlert[];
}

/**
 * Quota precision levels
 */
export enum QuotaPrecision {
  EXACT = 'exact',
  APPROXIMATE = 'approximate',
  BEST_EFFORT = 'best_effort'
}

/**
 * Quota alert configuration
 */
export interface QuotaAlert {
  readonly threshold: number; // percentage
  readonly channels: readonly string[];
  readonly message: string;
  readonly frequency: number; // seconds between alerts
}

/**
 * Rate limit enforcement
 */
export interface RateLimitEnforcement {
  readonly strategy: EnforcementStrategy;
  readonly backoff: BackoffStrategy;
  readonly circuitBreaker?: CircuitBreakerConfig;
  readonly failureHandling: FailureHandling;
}

/**
 * Enforcement strategies
 */
export enum EnforcementStrategy {
  STRICT = 'strict',
  GRACEFUL = 'graceful',
  ADAPTIVE = 'adaptive',
  PREDICTIVE = 'predictive'
}

/**
 * Backoff strategies
 */
export interface BackoffStrategy {
  readonly type: BackoffType;
  readonly baseDelay: number; // milliseconds
  readonly maxDelay: number; // milliseconds
  readonly multiplier: number;
  readonly jitter: boolean;
}

/**
 * Backoff types
 */
export enum BackoffType {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIBONACCI = 'fibonacci'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  readonly enabled: boolean;
  readonly failureThreshold: number;
  readonly recoveryTimeout: number; // milliseconds
  readonly halfOpenMaxRequests: number;
  readonly minRequestThreshold: number;
}

/**
 * Failure handling configuration
 */
export interface FailureHandling {
  readonly retryPolicy: RetryPolicy;
  readonly fallbackPolicy: FallbackPolicy;
  readonly alertPolicy: AlertPolicy;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  readonly enabled: boolean;
  readonly maxAttempts: number;
  readonly backoff: BackoffStrategy;
  readonly conditions: readonly RetryCondition[];
}

/**
 * Retry conditions
 */
export interface RetryCondition {
  readonly errorCodes: readonly string[];
  readonly statusCodes: readonly number[];
  readonly exceptions: readonly string[];
}

/**
 * Fallback policy
 */
export interface FallbackPolicy {
  readonly enabled: boolean;
  readonly response: FallbackResponse;
  readonly cachePolicy?: CachePolicy;
}

/**
 * Fallback response
 */
export interface FallbackResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: SecurityAttributeValue;
  readonly cached: boolean;
}

/**
 * Cache policy for fallback
 */
export interface CachePolicy {
  readonly enabled: boolean;
  readonly ttl: number; // seconds
  readonly maxSize: number;
  readonly strategy: CacheStrategy;
}

/**
 * Alert policy
 */
export interface AlertPolicy {
  readonly enabled: boolean;
  readonly channels: readonly string[];
  readonly thresholds: readonly AlertThreshold[];
  readonly aggregation: AlertAggregation;
}

/**
 * Alert threshold
 */
export interface AlertThreshold {
  readonly metric: string;
  readonly operator: ComparisonOperator;
  readonly value: number;
  readonly severity: SecuritySeverity;
}

// ComparisonOperator is imported from shared-enums via index

/**
 * Alert aggregation
 */
export interface AlertAggregation {
  readonly window: number; // seconds
  readonly function: MetricAggregation;
  readonly groupBy: readonly string[];
}

/**
 * Rate limit storage configuration
 */
export interface RateLimitStorage {
  readonly type: StorageType;
  readonly connection: string;
  readonly keyspace?: string;
  readonly replication?: number;
  readonly clustering?: boolean;
  readonly persistence: boolean;
}

/**
 * Storage types for rate limiting
 */
export enum StorageType {
  MEMORY = 'memory',
  REDIS = 'redis',
  MEMCACHED = 'memcached',
  DATABASE = 'database',
  DISTRIBUTED = 'distributed'
}

/**
 * Rate limit state
 */
export interface ApiRateLimitState {
  readonly key: string;
  readonly windowStart: SecurityTimestamp;
  readonly windowEnd: SecurityTimestamp;
  readonly requestCount: number;
  readonly maxRequests: number;
  readonly remaining: number;
  readonly resetTime: SecurityTimestamp;
  readonly blocked: boolean;
  readonly lastRequest: SecurityTimestamp;
}

/**
 * Rate limit violation
 */
export interface ApiRateLimitViolation extends SecurityViolation {
  readonly limitId: SecurityId;
  readonly key: string;
  readonly requestCount: number;
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly clientInfo: ApiClientInfo;
  readonly retryAfter: number; // seconds
}

// ===========================
// API CORS TYPES
// ===========================

/**
 * CORS configuration
 */
export interface ApiCorsConfig {
  readonly enabled: boolean;
  readonly allowedOrigins: CorsOriginConfig;
  readonly allowedMethods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly exposedHeaders: readonly string[];
  readonly allowCredentials: boolean;
  readonly maxAge: number; // seconds
  readonly preflightContinue: boolean;
  readonly optionsSuccessStatus: number;
  readonly dynamicOrigin?: CorsDynamicOrigin;
  readonly enforcement: CorsEnforcement;
}

/**
 * CORS origin configuration
 */
export interface CorsOriginConfig {
  readonly type: CorsOriginType;
  readonly values: readonly string[];
  readonly patterns?: readonly string[];
  readonly validation?: CorsOriginValidation;
}

/**
 * CORS origin types
 */
export enum CorsOriginType {
  STATIC = 'static',
  WILDCARD = 'wildcard',
  PATTERN = 'pattern',
  DYNAMIC = 'dynamic',
  FUNCTION = 'function'
}

/**
 * CORS origin validation
 */
export interface CorsOriginValidation {
  readonly enabled: boolean;
  readonly allowSubdomains: boolean;
  readonly allowedSchemes: readonly string[];
  readonly portRange?: PortRange;
  readonly ipValidation?: IpValidation;
}

/**
 * Port range validation
 */
export interface PortRange {
  readonly min: number;
  readonly max: number;
  readonly exclude?: readonly number[];
}

/**
 * IP validation for CORS
 */
export interface IpValidation {
  readonly enabled: boolean;
  readonly allowedRanges?: readonly string[];
  readonly blockedRanges?: readonly string[];
  readonly allowPrivate: boolean;
  readonly allowLoopback: boolean;
}

/**
 * Dynamic CORS origin handler
 */
export interface CorsDynamicOrigin {
  readonly handler: string;
  readonly cacheEnabled: boolean;
  readonly cacheTtl?: number; // seconds
  readonly fallback: CorsOriginFallback;
}

/**
 * CORS origin fallback
 */
export interface CorsOriginFallback {
  readonly allow: boolean;
  readonly origins?: readonly string[];
  readonly logViolations: boolean;
}

/**
 * CORS enforcement configuration
 */
export interface CorsEnforcement {
  readonly strictMode: boolean;
  readonly enforceCredentials: boolean;
  readonly enforceSecureOrigins: boolean;
  readonly violations: CorsViolationHandling;
  readonly monitoring: CorsMonitoring;
}

/**
 * CORS violation handling
 */
export interface CorsViolationHandling {
  readonly logViolations: boolean;
  readonly blockRequests: boolean;
  readonly alertOnViolations: boolean;
  readonly customResponse?: CorsCustomResponse;
}

/**
 * CORS custom response
 */
export interface CorsCustomResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/**
 * CORS monitoring configuration
 */
export interface CorsMonitoring {
  readonly enabled: boolean;
  readonly trackOrigins: boolean;
  readonly trackViolations: boolean;
  readonly metricsRetention: number; // seconds
  readonly alertThresholds: CorsAlertThresholds;
}

/**
 * CORS alert thresholds
 */
export interface CorsAlertThresholds {
  readonly violationRate: number; // violations per minute
  readonly newOrigins: number; // new origins per hour
  readonly suspiciousPatterns: number; // suspicious requests per minute
}

/**
 * CORS request information
 */
export interface CorsRequest {
  readonly origin?: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly requestedHeaders?: readonly string[];
  readonly isPreflight: boolean;
  readonly clientInfo: ApiClientInfo;
}

/**
 * CORS validation result
 */
export interface CorsValidationResult extends SecurityValidationResult {
  readonly allowed: boolean;
  readonly origin?: string;
  readonly headers: Record<string, string>;
  readonly exposedHeaders: readonly string[];
  readonly maxAge?: number;
  readonly violations: readonly CorsViolation[];
}

/**
 * CORS violation
 */
export interface CorsViolation extends SecurityViolation {
  readonly origin?: string;
  readonly requestedMethod?: string;
  readonly requestedHeaders?: readonly string[];
  readonly violationType: CorsViolationType;
}

/**
 * CORS violation types
 */
export enum CorsViolationType {
  INVALID_ORIGIN = 'invalid_origin',
  DISALLOWED_METHOD = 'disallowed_method',
  DISALLOWED_HEADER = 'disallowed_header',
  CREDENTIALS_NOT_ALLOWED = 'credentials_not_allowed',
  PREFLIGHT_FAILED = 'preflight_failed',
  MISSING_ORIGIN = 'missing_origin'
}

// ===========================
// API SECURITY MIDDLEWARE
// ===========================

/**
 * API security middleware configuration
 */
export interface ApiSecurityMiddleware {
  readonly authentication: ApiAuthConfig;
  readonly authorization: ApiAuthzConfig;
  readonly rateLimit: ApiRateLimitConfig;
  readonly cors: ApiCorsConfig;
  readonly validation: ApiValidationConfig;
  readonly monitoring: ApiMonitoringConfig;
  readonly logging: ApiLoggingConfig;
}

/**
 * API validation configuration
 */
export interface ApiValidationConfig {
  readonly enabled: boolean;
  readonly requestValidation: RequestValidationConfig;
  readonly responseValidation: ResponseValidationConfig;
  readonly schemaValidation: SchemaValidationConfig;
  readonly sanitization: SanitizationConfig;
}

/**
 * Request validation configuration
 */
export interface RequestValidationConfig {
  readonly headers: boolean;
  readonly query: boolean;
  readonly body: boolean;
  readonly parameters: boolean;
  readonly strictMode: boolean;
  readonly maxSize: number; // bytes
  readonly allowedContentTypes: readonly string[];
}

/**
 * Response validation configuration
 */
export interface ResponseValidationConfig {
  readonly enabled: boolean;
  readonly validateSchema: boolean;
  readonly sanitizeHeaders: boolean;
  readonly securityHeaders: SecurityHeadersConfig;
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  readonly contentSecurityPolicy?: string;
  readonly strictTransportSecurity?: string;
  readonly xFrameOptions?: string;
  readonly xContentTypeOptions?: string;
  readonly referrerPolicy?: string;
  readonly permissionsPolicy?: string;
  readonly crossOriginEmbedderPolicy?: string;
  readonly customHeaders?: Record<string, string>;
}

/**
 * Schema validation configuration
 */
export interface SchemaValidationConfig {
  readonly enabled: boolean;
  readonly schemaFormat: SchemaFormat;
  readonly strictMode: boolean;
  readonly coerceTypes: boolean;
  readonly removeAdditional: boolean;
  readonly cacheSchemas: boolean;
}

/**
 * Schema formats
 */
export enum SchemaFormat {
  JSON_SCHEMA = 'json_schema',
  OPENAPI = 'openapi',
  GRAPHQL = 'graphql',
  PROTOBUF = 'protobuf'
}

/**
 * Sanitization configuration
 */
export interface SanitizationConfig {
  readonly enabled: boolean;
  readonly htmlSanitization: boolean;
  readonly sqlInjectionPrevention: boolean;
  readonly xssProtection: boolean;
  readonly pathTraversalPrevention: boolean;
  readonly customSanitizers: readonly CustomSanitizer[];
}

/**
 * Custom sanitizer
 */
export interface CustomSanitizer {
  readonly name: string;
  readonly pattern: string;
  readonly replacement: string;
  readonly global: boolean;
}

/**
 * API monitoring configuration
 */
export interface ApiMonitoringConfig {
  readonly enabled: boolean;
  readonly metricsCollection: MetricsCollectionConfig;
  readonly healthChecks: HealthCheckConfig;
  readonly alerting: AlertingConfig;
  readonly tracing: TracingConfig;
}

/**
 * Metrics collection configuration
 */
export interface MetricsCollectionConfig {
  readonly enabled: boolean;
  readonly interval: number; // seconds
  readonly retention: number; // seconds
  readonly metrics: readonly string[];
  readonly labels: readonly string[];
  readonly aggregation: MetricAggregation;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  readonly enabled: boolean;
  readonly interval: number; // seconds
  readonly timeout: number; // milliseconds
  readonly checks: readonly HealthCheck[];
  readonly dependencies: readonly DependencyCheck[];
}

/**
 * Health check definition
 */
export interface HealthCheck {
  readonly name: string;
  readonly type: HealthCheckType;
  readonly endpoint?: string;
  readonly expected: SecurityAttributeValue;
  readonly timeout: number; // milliseconds
}

/**
 * Health check types
 */
export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  DATABASE = 'database',
  CUSTOM = 'custom'
}

/**
 * Dependency check
 */
export interface DependencyCheck {
  readonly name: string;
  readonly url: string;
  readonly timeout: number; // milliseconds
  readonly retries: number;
  readonly critical: boolean;
}

/**
 * Alerting configuration
 */
export interface AlertingConfig {
  readonly enabled: boolean;
  readonly channels: readonly AlertChannel[];
  readonly rules: readonly AlertRule[];
  readonly suppressionRules: readonly SuppressionRule[];
}

/**
 * Alert channel
 */
export interface AlertChannel {
  readonly name: string;
  readonly type: AlertChannelType;
  readonly endpoint: string;
  readonly credentials?: SecurityToken;
  readonly timeout: number; // milliseconds
}

/**
 * Alert channel types
 */
export enum AlertChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PAGERDUTY = 'pagerduty'
}

/**
 * Alert rule
 */
export interface AlertRule {
  readonly name: string;
  readonly condition: AlertCondition;
  readonly severity: SecuritySeverity;
  readonly channels: readonly string[];
  readonly throttle: number; // seconds
  readonly enabled: boolean;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  readonly metric: string;
  readonly operator: ComparisonOperator;
  readonly threshold: number;
  readonly window: number; // seconds
  readonly aggregation: MetricAggregation;
}

/**
 * Suppression rule
 */
export interface SuppressionRule {
  readonly name: string;
  readonly pattern: string;
  readonly duration: number; // seconds
  readonly enabled: boolean;
}

/**
 * Tracing configuration
 */
export interface TracingConfig {
  readonly enabled: boolean;
  readonly sampleRate: number; // 0-1
  readonly exporter: TracingExporter;
  readonly tags: readonly string[];
  readonly sensitiveFields: readonly string[];
}

/**
 * Tracing exporter
 */
export interface TracingExporter {
  readonly type: TracingExporterType;
  readonly endpoint: string;
  readonly headers?: Record<string, string>;
  readonly timeout: number; // milliseconds
}

/**
 * Tracing exporter types
 */
export enum TracingExporterType {
  JAEGER = 'jaeger',
  ZIPKIN = 'zipkin',
  OPENTELEMETRY = 'opentelemetry',
  DATADOG = 'datadog'
}

/**
 * API logging configuration
 */
export interface ApiLoggingConfig {
  readonly enabled: boolean;
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly output: LogOutput;
  readonly fields: readonly string[];
  readonly sensitiveFields: readonly string[];
  readonly sampling: LogSampling;
}

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Log formats
 */
export enum LogFormat {
  JSON = 'json',
  TEXT = 'text',
  STRUCTURED = 'structured'
}

/**
 * Log output configuration
 */
export interface LogOutput {
  readonly type: LogOutputType;
  readonly destination: string;
  readonly rotation?: LogRotation;
  readonly compression: boolean;
  readonly encryption?: LogEncryption;
}

/**
 * Log output types
 */
export enum LogOutputType {
  CONSOLE = 'console',
  FILE = 'file',
  SYSLOG = 'syslog',
  NETWORK = 'network',
  DATABASE = 'database'
}

/**
 * Log rotation configuration
 */
export interface LogRotation {
  readonly enabled: boolean;
  readonly maxSize: number; // bytes
  readonly maxFiles: number;
  readonly maxAge: number; // days
  readonly compress: boolean;
}

/**
 * Log encryption configuration
 */
export interface LogEncryption {
  readonly enabled: boolean;
  readonly algorithm: SecurityAlgorithm;
  readonly keyId: SecurityId;
  readonly fields: readonly string[];
}

/**
 * Log sampling configuration
 */
export interface LogSampling {
  readonly enabled: boolean;
  readonly rate: number; // 0-1
  readonly rules: readonly SamplingRule[];
}

/**
 * Sampling rule
 */
export interface SamplingRule {
  readonly condition: string;
  readonly rate: number; // 0-1
  readonly priority: number;
}

// ===========================
// API SECURITY EVENTS
// ===========================

/**
 * API security event
 */
export interface ApiSecurityEvent {
  readonly id: SecurityId;
  readonly type: ApiSecurityEventType;
  readonly severity: SecuritySeverity;
  readonly timestamp: SecurityTimestamp;
  readonly source: ApiEventSource;
  readonly target?: ApiEventTarget;
  readonly context: ApiRequestContext;
  readonly details: ApiEventDetails;
  readonly metadata: ApiEventMetadata;
}

/**
 * API security event types
 */
export enum ApiSecurityEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTHZ_DENIED = 'authz_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CORS_VIOLATION = 'cors_violation',
  VALIDATION_FAILED = 'validation_failed',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  THREAT_DETECTED = 'threat_detected',
  POLICY_VIOLATION = 'policy_violation',
  QUOTA_EXCEEDED = 'quota_exceeded'
}

/**
 * API event source
 */
export interface ApiEventSource {
  readonly type: ApiEventSourceType;
  readonly id: SecurityId;
  readonly name: string;
  readonly version?: string;
  readonly instance?: string;
}

/**
 * API event source types
 */
export enum ApiEventSourceType {
  API_GATEWAY = 'api_gateway',
  LOAD_BALANCER = 'load_balancer',
  MIDDLEWARE = 'middleware',
  SERVICE = 'service',
  APPLICATION = 'application'
}

/**
 * API event target
 */
export interface ApiEventTarget {
  readonly type: ApiEventTargetType;
  readonly id: SecurityId;
  readonly resource: string;
  readonly action: string;
}

/**
 * API event target types
 */
export enum ApiEventTargetType {
  ENDPOINT = 'endpoint',
  SERVICE = 'service',
  RESOURCE = 'resource',
  USER = 'user'
}

/**
 * API event details
 */
export interface ApiEventDetails {
  readonly message: string;
  readonly errorCode?: string;
  readonly errorDetails?: SecurityAttributeValue;
  readonly userAgent?: string;
  readonly ipAddress: string;
  readonly geolocation?: GeographicLocation;
  readonly requestSize?: number;
  readonly responseSize?: number;
  readonly processingTime: number;
  readonly customFields?: Record<string, SecurityAttributeValue>;
}

/**
 * API event metadata
 */
export interface ApiEventMetadata {
  readonly correlationId: SecurityId;
  readonly traceId?: SecurityId;
  readonly spanId?: SecurityId;
  readonly sessionId?: SecurityId;
  readonly userId?: SecurityId;
  readonly clientId?: SecurityId;
  readonly tags?: readonly string[];
  readonly labels?: Record<string, string>;
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Type guards for API security types
 */
export const isApiAuthRequest = (value: unknown): value is ApiAuthRequest => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requestId' in value &&
    'method' in value &&
    'path' in value &&
    'headers' in value &&
    'clientInfo' in value &&
    'context' in value
  );
};

export const isApiAuthzRequest = (value: unknown): value is ApiAuthzRequest => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requestId' in value &&
    'principal' in value &&
    'action' in value &&
    'resource' in value &&
    'context' in value
  );
};

export const isApiRateLimitState = (value: unknown): value is ApiRateLimitState => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    'windowStart' in value &&
    'windowEnd' in value &&
    'requestCount' in value &&
    'maxRequests' in value
  );
};

export const isCorsRequest = (value: unknown): value is CorsRequest => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'method' in value &&
    'headers' in value &&
    'isPreflight' in value &&
    'clientInfo' in value
  );
};

/**
 * Utility functions for API security
 */
export const createApiSecurityContext = (
  request: ApiAuthRequest
): SecurityContext => ({
  requestId: request.requestId,
  timestamp: request.context.timestamp,
  source: request.context.source,
  environment: request.context.environment,
  userId: request.context.userId,
  sessionId: request.context.sessionId,
  metadata: {
    ipAddress: request.clientInfo.ipAddress,
    userAgent: request.clientInfo.userAgent,
    device: request.clientInfo.device,
    network: request.clientInfo.network,
    location: request.clientInfo.location
  }
});

export const generateRateLimitKey = (
  keyGen: RateLimitKeyGenerator,
  request: ApiAuthRequest
): string => {
  const parts: string[] = [keyGen.prefix];

  for (const field of keyGen.fields) {
    switch (field) {
      case 'user_id':
        if (request.context.userId) {
          parts.push(request.context.userId);
        }
        break;
      case 'client_id':
        parts.push(request.clientInfo.id);
        break;
      case 'ip_address':
        parts.push(request.clientInfo.ipAddress);
        break;
      case 'method':
        parts.push(request.method);
        break;
      case 'path':
        parts.push(request.path);
        break;
      default:
        // Custom field from headers, query, etc.
        const value = request.headers[field] || request.query?.[field];
        if (value) {
          parts.push(String(value));
        }
    }
  }

  const key = parts.join(keyGen.separator);

  if (keyGen.hash) {
    // In a real implementation, you'd use a proper hash function
    return `${keyGen.prefix}:hash:${btoa(key).slice(0, 16)}`;
  }

  return key;
};

export const validateCorsOrigin = (
  origin: string,
  config: CorsOriginConfig
): boolean => {
  if (config.type === CorsOriginType.WILDCARD && config.values.includes('*')) {
    return true;
  }

  if (config.type === CorsOriginType.STATIC) {
    return config.values.includes(origin);
  }

  if (config.type === CorsOriginType.PATTERN && config.patterns) {
    return config.patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(origin);
    });
  }

  return false;
};

export const calculateRiskScore = (
  request: ApiAuthRequest,
  principal?: ApiPrincipal
): number => {
  let score = 0;

  // Base risk factors
  if (!principal) score += 0.5;
  if (!request.clientInfo.trusted) score += 0.2;
  if (request.clientInfo.network?.proxy) score += 0.1;
  if (request.clientInfo.network?.tor) score += 0.3;
  if (request.clientInfo.network?.vpn) score += 0.1;

  // Geographic risk
  if (request.clientInfo.location?.country === 'Unknown') score += 0.1;

  // Device risk
  if (request.clientInfo.device?.trusted === false) score += 0.2;

  // Time-based risk (outside business hours)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) score += 0.1;

  return Math.min(score, 1.0);
};

/**
 * Constants for API security
 */
export const API_SECURITY_CONSTANTS = {
  DEFAULT_RATE_LIMIT: 1000, // requests per hour
  DEFAULT_CORS_MAX_AGE: 86400, // 24 hours
  DEFAULT_TOKEN_EXPIRY: 3600, // 1 hour
  DEFAULT_SESSION_TIMEOUT: 28800, // 8 hours
  MIN_PASSWORD_STRENGTH: 8,
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_RESPONSE_SIZE: 50 * 1024 * 1024, // 50MB
  HEALTH_CHECK_INTERVAL: 30, // seconds
  METRICS_RETENTION: 7 * 24 * 3600, // 7 days
  LOG_ROTATION_SIZE: 100 * 1024 * 1024 // 100MB
} as const;

/**
 * Default security headers
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  contentSecurityPolicy: "default-src 'self'",
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  crossOriginEmbedderPolicy: 'require-corp'
};

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: ApiCorsConfig = {
  enabled: false,
  allowedOrigins: {
    type: CorsOriginType.STATIC,
    values: []
  },
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  allowCredentials: false,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  enforcement: {
    strictMode: true,
    enforceCredentials: true,
    enforceSecureOrigins: true,
    violations: {
      logViolations: true,
      blockRequests: true,
      alertOnViolations: false
    },
    monitoring: {
      enabled: true,
      trackOrigins: true,
      trackViolations: true,
      metricsRetention: 86400,
      alertThresholds: {
        violationRate: 10,
        newOrigins: 5,
        suspiciousPatterns: 20
      }
    }
  }
};