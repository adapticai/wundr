/**
 * Security Types for MCP Server
 *
 * Defines interfaces and types for access control, authorization,
 * and security policy enforcement in the MCP server.
 *
 * @packageDocumentation
 */

// =============================================================================
// Access Policy Types
// =============================================================================

/**
 * Permission levels for tool access
 */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

/**
 * Resource type identifiers for access control
 */
export type ResourceType = 'tool' | 'resource' | 'prompt' | 'server';

/**
 * Action types that can be performed on resources
 */
export type ActionType =
  | 'list'
  | 'read'
  | 'invoke'
  | 'create'
  | 'update'
  | 'delete'
  | 'subscribe'
  | 'unsubscribe';

/**
 * Condition operators for policy rules
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'in'
  | 'not_in';

/**
 * Policy condition for fine-grained access control
 */
export interface PolicyCondition {
  /** Field to evaluate */
  readonly field: string;
  /** Operator to apply */
  readonly operator: ConditionOperator;
  /** Value to compare against */
  readonly value: string | string[] | RegExp;
}

/**
 * Access policy rule definition
 */
export interface PolicyRule {
  /** Unique rule identifier */
  readonly id: string;
  /** Human-readable rule description */
  readonly description?: string;
  /** Whether the rule allows or denies access */
  readonly effect: 'allow' | 'deny';
  /** Resource types this rule applies to */
  readonly resourceTypes: readonly ResourceType[];
  /** Actions this rule applies to */
  readonly actions: readonly ActionType[];
  /** Optional resource name patterns (glob-style) */
  readonly resourcePatterns?: readonly string[];
  /** Optional conditions for the rule */
  readonly conditions?: readonly PolicyCondition[];
  /** Rule priority (higher = evaluated first) */
  readonly priority?: number;
}

/**
 * Complete access policy configuration
 */
export interface AccessPolicy {
  /** Policy version identifier */
  readonly version: string;
  /** Policy name */
  readonly name: string;
  /** Policy description */
  readonly description?: string;
  /** Default action when no rules match */
  readonly defaultEffect: 'allow' | 'deny';
  /** Policy rules (evaluated in priority order) */
  readonly rules: readonly PolicyRule[];
  /** Maximum rate limits per principal */
  readonly rateLimits?: RateLimitConfig;
  /** IP allowlist/blocklist configuration */
  readonly ipConfig?: IpConfig;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per time window */
  readonly maxRequests: number;
  /** Time window in milliseconds */
  readonly windowMs: number;
  /** Whether to apply rate limits per tool */
  readonly perTool?: boolean;
  /** Tools exempt from rate limiting */
  readonly exemptTools?: readonly string[];
}

/**
 * IP address filtering configuration
 */
export interface IpConfig {
  /** IP addresses that are always allowed */
  readonly allowlist?: readonly string[];
  /** IP addresses that are always blocked */
  readonly blocklist?: readonly string[];
  /** Whether to allow localhost connections */
  readonly allowLocalhost?: boolean;
}

// =============================================================================
// Authorization Types
// =============================================================================

/**
 * Principal identity information
 */
export interface Principal {
  /** Principal type (user, service, anonymous) */
  readonly type: 'user' | 'service' | 'anonymous';
  /** Principal identifier */
  readonly id: string;
  /** Principal display name */
  readonly name?: string;
  /** Roles assigned to the principal */
  readonly roles?: readonly string[];
  /** Additional attributes for policy evaluation */
  readonly attributes?: Record<string, unknown>;
}

/**
 * Authorization request context
 */
export interface AuthorizationRequest {
  /** Principal requesting access */
  readonly principal: Principal;
  /** Type of resource being accessed */
  readonly resourceType: ResourceType;
  /** Name or identifier of the resource */
  readonly resourceName: string;
  /** Action being performed */
  readonly action: ActionType;
  /** Additional context for authorization decision */
  readonly context?: AuthorizationContext;
}

/**
 * Additional context for authorization decisions
 */
export interface AuthorizationContext {
  /** Client IP address */
  readonly ipAddress?: string;
  /** Request timestamp */
  readonly timestamp?: Date;
  /** Request ID for correlation */
  readonly requestId?: string;
  /** Tool arguments (for tool invocations) */
  readonly toolArguments?: Record<string, unknown>;
  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Authorization decision result
 */
export interface AuthorizationResult {
  /** Whether access is allowed */
  readonly allowed: boolean;
  /** Rule that determined the outcome */
  readonly matchedRule?: PolicyRule;
  /** Reason for the decision */
  readonly reason: string;
  /** Error code if authorization failed */
  readonly errorCode?: AuthorizationErrorCode;
  /** Timestamp of the decision */
  readonly timestamp: Date;
  /** Time taken to evaluate (ms) */
  readonly evaluationTimeMs: number;
}

/**
 * Authorization error codes
 */
export type AuthorizationErrorCode =
  | 'ACCESS_DENIED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'INVALID_AUDIENCE'
  | 'RATE_LIMITED'
  | 'IP_BLOCKED'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_PRINCIPAL'
  | 'POLICY_EVALUATION_ERROR';

// =============================================================================
// Token Types
// =============================================================================

/**
 * Token claims for JWT-style authentication
 */
export interface TokenClaims {
  /** Token issuer */
  readonly iss?: string;
  /** Token subject (principal ID) */
  readonly sub: string;
  /** Token audience */
  readonly aud?: string | readonly string[];
  /** Token expiration time (Unix timestamp) */
  readonly exp?: number;
  /** Token not-before time (Unix timestamp) */
  readonly nbf?: number;
  /** Token issued-at time (Unix timestamp) */
  readonly iat?: number;
  /** Token ID */
  readonly jti?: string;
  /** Principal roles */
  readonly roles?: readonly string[];
  /** Principal permissions */
  readonly permissions?: readonly string[];
  /** Additional custom claims */
  readonly [key: string]: unknown;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  readonly valid: boolean;
  /** Parsed token claims (if valid) */
  readonly claims?: TokenClaims;
  /** Validation error message (if invalid) */
  readonly error?: string;
  /** Error code (if invalid) */
  readonly errorCode?: AuthorizationErrorCode;
}

/**
 * Token audience verification options
 */
export interface AudienceVerificationOptions {
  /** Expected audience values */
  readonly expectedAudiences: readonly string[];
  /** Whether to require an audience claim */
  readonly required?: boolean;
  /** Whether to allow any of the expected audiences (vs all) */
  readonly matchAny?: boolean;
}

// =============================================================================
// Security Event Types
// =============================================================================

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  /** Event type */
  readonly type: SecurityEventType;
  /** Event severity */
  readonly severity: SecurityEventSeverity;
  /** Event timestamp */
  readonly timestamp: Date;
  /** Principal involved */
  readonly principal?: Principal;
  /** Resource involved */
  readonly resource?: {
    readonly type: ResourceType;
    readonly name: string;
  };
  /** Action attempted */
  readonly action?: ActionType;
  /** Authorization result */
  readonly authorizationResult?: AuthorizationResult;
  /** Additional event details */
  readonly details?: Record<string, unknown>;
}

/**
 * Security event types
 */
export type SecurityEventType =
  | 'AUTHORIZATION_SUCCESS'
  | 'AUTHORIZATION_FAILURE'
  | 'TOKEN_VALIDATION_SUCCESS'
  | 'TOKEN_VALIDATION_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IP_BLOCKED'
  | 'POLICY_UPDATED'
  | 'SUSPICIOUS_ACTIVITY';

/**
 * Security event severity levels
 */
export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

// =============================================================================
// Access Controller Configuration
// =============================================================================

/**
 * Access controller configuration options
 */
export interface AccessControllerConfig {
  /** Access policy to enforce */
  readonly policy: AccessPolicy;
  /** Whether to enable caching of authorization decisions */
  readonly enableCache?: boolean;
  /** Cache TTL in milliseconds */
  readonly cacheTtlMs?: number;
  /** Maximum cache size */
  readonly maxCacheSize?: number;
  /** Whether to emit security events */
  readonly emitEvents?: boolean;
  /** Callback for security events */
  readonly onSecurityEvent?: (event: SecurityEvent) => void;
}

/**
 * Default access policy for permissive mode
 */
export const DEFAULT_PERMISSIVE_POLICY: AccessPolicy = {
  version: '1.0.0',
  name: 'default-permissive',
  description: 'Default permissive policy that allows all operations',
  defaultEffect: 'allow',
  rules: [],
};

/**
 * Default access policy for restrictive mode
 */
export const DEFAULT_RESTRICTIVE_POLICY: AccessPolicy = {
  version: '1.0.0',
  name: 'default-restrictive',
  description: 'Default restrictive policy that denies all operations',
  defaultEffect: 'deny',
  rules: [
    {
      id: 'allow-list-operations',
      description: 'Allow listing tools, resources, and prompts',
      effect: 'allow',
      resourceTypes: ['tool', 'resource', 'prompt'],
      actions: ['list'],
      priority: 100,
    },
  ],
};
