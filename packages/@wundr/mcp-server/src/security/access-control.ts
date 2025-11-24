/**
 * MCP Access Controller
 *
 * Provides authorization and access control for MCP server operations.
 * Implements policy-based access control with support for role-based
 * permissions, rate limiting, and audit logging.
 *
 * @packageDocumentation
 */

import type { Logger } from '../types';
import type {
  AccessPolicy,
  AccessControllerConfig,
  AuthorizationRequest,
  AuthorizationResult,
  AuthorizationErrorCode,
  PolicyRule,
  Principal,
  TokenClaims,
  TokenValidationResult,
  AudienceVerificationOptions,
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
  RateLimitConfig,
  DEFAULT_PERMISSIVE_POLICY,
} from './types';

// =============================================================================
// Rate Limiter
// =============================================================================

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private readonly requests: Map<string, number[]> = new Map();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request should be rate limited
   *
   * @param key - Rate limit key (e.g., principal ID or IP)
   * @param toolName - Optional tool name for per-tool limits
   * @returns Whether the request is allowed
   */
  public isAllowed(key: string, toolName?: string): boolean {
    // Check if tool is exempt
    if (toolName && this.config.exemptTools?.includes(toolName)) {
      return true;
    }

    const effectiveKey =
      this.config.perTool && toolName ? `${key}:${toolName}` : key;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests and filter to current window
    const existingRequests = this.requests.get(effectiveKey) ?? [];
    const validRequests = existingRequests.filter(time => time > windowStart);

    // Check if under limit
    if (validRequests.length >= this.config.maxRequests) {
      return false;
    }

    // Record this request
    validRequests.push(now);
    this.requests.set(effectiveKey, validRequests);

    return true;
  }

  /**
   * Clear rate limit data for a key
   */
  public clear(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  public clearAll(): void {
    this.requests.clear();
  }
}

// =============================================================================
// Authorization Cache
// =============================================================================

/**
 * Cache entry for authorization decisions
 */
interface CacheEntry {
  result: AuthorizationResult;
  expiresAt: number;
}

/**
 * Simple LRU cache for authorization decisions
 */
class AuthorizationCache {
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from authorization request
   */
  private generateKey(request: AuthorizationRequest): string {
    return `${request.principal.id}:${request.resourceType}:${request.resourceName}:${request.action}`;
  }

  /**
   * Get cached authorization result
   */
  public get(request: AuthorizationRequest): AuthorizationResult | null {
    const key = this.generateKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  /**
   * Store authorization result in cache
   */
  public set(request: AuthorizationRequest, result: AuthorizationResult): void {
    const key = this.generateKey(request);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear all cached entries
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// =============================================================================
// MCP Access Controller
// =============================================================================

/**
 * MCP Access Controller
 *
 * Handles authorization decisions for MCP server operations.
 * Supports policy-based access control, rate limiting, and audit logging.
 *
 * @example
 * ```typescript
 * const controller = new MCPAccessController({
 *   policy: myPolicy,
 *   enableCache: true,
 *   cacheTtlMs: 60000,
 * });
 *
 * const result = controller.authorize({
 *   principal: { type: 'user', id: 'user-123' },
 *   resourceType: 'tool',
 *   resourceName: 'my-tool',
 *   action: 'invoke',
 * });
 *
 * if (result.allowed) {
 *   // Proceed with operation
 * }
 * ```
 */
export class MCPAccessController {
  private readonly policy: AccessPolicy;
  private readonly cache: AuthorizationCache | null;
  private readonly rateLimiter: RateLimiter | null;
  private readonly emitEvents: boolean;
  private readonly onSecurityEvent?: (event: SecurityEvent) => void;
  private logger?: Logger;

  /**
   * Create a new MCP Access Controller
   *
   * @param config - Controller configuration
   */
  constructor(config: AccessControllerConfig) {
    this.policy = config.policy;
    this.emitEvents = config.emitEvents ?? false;
    this.onSecurityEvent = config.onSecurityEvent;

    // Initialize cache if enabled
    if (config.enableCache) {
      this.cache = new AuthorizationCache(
        config.maxCacheSize ?? 1000,
        config.cacheTtlMs ?? 60000,
      );
    } else {
      this.cache = null;
    }

    // Initialize rate limiter if configured
    if (config.policy.rateLimits) {
      this.rateLimiter = new RateLimiter(config.policy.rateLimits);
    } else {
      this.rateLimiter = null;
    }
  }

  /**
   * Set the logger instance
   *
   * @param logger - Logger to use for access control logging
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Authorize an operation
   *
   * Evaluates the access policy against the authorization request
   * and returns whether the operation is allowed.
   *
   * @param request - Authorization request to evaluate
   * @returns Authorization result indicating whether access is allowed
   */
  public authorize(request: AuthorizationRequest): AuthorizationResult {
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.cache) {
        const cachedResult = this.cache.get(request);
        if (cachedResult) {
          this.logger?.debug('Authorization cache hit', {
            principal: request.principal.id,
            resource: request.resourceName,
          });
          return cachedResult;
        }
      }

      // Check rate limits
      if (this.rateLimiter) {
        const rateLimitKey = request.principal.id;
        const toolName =
          request.resourceType === 'tool' ? request.resourceName : undefined;

        if (!this.rateLimiter.isAllowed(rateLimitKey, toolName)) {
          const result = this.createResult(
            false,
            'Rate limit exceeded',
            'RATE_LIMITED',
            undefined,
            startTime,
          );
          this.emitSecurityEvent(
            'RATE_LIMIT_EXCEEDED',
            'medium',
            request,
            result,
          );
          return result;
        }
      }

      // Check IP restrictions
      if (this.policy.ipConfig && request.context?.ipAddress) {
        const ipResult = this.checkIpRestrictions(request.context.ipAddress);
        if (!ipResult.allowed) {
          const result = this.createResult(
            false,
            ipResult.reason,
            'IP_BLOCKED',
            undefined,
            startTime,
          );
          this.emitSecurityEvent('IP_BLOCKED', 'high', request, result);
          return result;
        }
      }

      // Evaluate policy rules
      const result = this.evaluatePolicy(request, startTime);

      // Cache the result
      if (this.cache) {
        this.cache.set(request, result);
      }

      // Emit security event
      const eventType: SecurityEventType = result.allowed
        ? 'AUTHORIZATION_SUCCESS'
        : 'AUTHORIZATION_FAILURE';
      const severity: SecurityEventSeverity = result.allowed ? 'low' : 'medium';
      this.emitSecurityEvent(eventType, severity, request, result);

      return result;
    } catch (error) {
      this.logger?.error('Policy evaluation error', error);

      const result = this.createResult(
        false,
        `Policy evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'POLICY_EVALUATION_ERROR',
        undefined,
        startTime,
      );

      this.emitSecurityEvent('AUTHORIZATION_FAILURE', 'high', request, result);
      return result;
    }
  }

  /**
   * Verify token audience
   *
   * Validates that a token's audience claim matches expected values.
   *
   * @param claims - Token claims to verify
   * @param options - Audience verification options
   * @returns Whether the audience is valid
   */
  public verifyTokenAudience(
    claims: TokenClaims,
    options: AudienceVerificationOptions,
  ): TokenValidationResult {
    const audience = claims.aud;

    // Check if audience is required
    if (!audience) {
      if (options.required) {
        return {
          valid: false,
          error: 'Token missing required audience claim',
          errorCode: 'INVALID_AUDIENCE',
        };
      }
      return { valid: true, claims };
    }

    // Normalize audience to array
    const audiences = Array.isArray(audience) ? audience : [audience];
    const expectedAudiences = options.expectedAudiences;

    // Check audience match
    if (options.matchAny) {
      // At least one expected audience must match
      const hasMatch = expectedAudiences.some(expected =>
        audiences.includes(expected),
      );
      if (!hasMatch) {
        return {
          valid: false,
          error: `Token audience does not match any expected values. Got: ${audiences.join(', ')}`,
          errorCode: 'INVALID_AUDIENCE',
        };
      }
    } else {
      // All expected audiences must be present
      const allMatch = expectedAudiences.every(expected =>
        audiences.includes(expected),
      );
      if (!allMatch) {
        return {
          valid: false,
          error: `Token audience does not match all expected values. Got: ${audiences.join(', ')}`,
          errorCode: 'INVALID_AUDIENCE',
        };
      }
    }

    return { valid: true, claims };
  }

  /**
   * Validate a token's temporal claims
   *
   * @param claims - Token claims to validate
   * @param clockSkewMs - Allowed clock skew in milliseconds
   * @returns Validation result
   */
  public validateTokenTiming(
    claims: TokenClaims,
    clockSkewMs = 60000,
  ): TokenValidationResult {
    const now = Math.floor(Date.now() / 1000);
    const skewSeconds = Math.floor(clockSkewMs / 1000);

    // Check expiration
    if (claims.exp !== undefined && claims.exp < now - skewSeconds) {
      return {
        valid: false,
        error: 'Token has expired',
        errorCode: 'TOKEN_EXPIRED',
      };
    }

    // Check not-before
    if (claims.nbf !== undefined && claims.nbf > now + skewSeconds) {
      return {
        valid: false,
        error: 'Token is not yet valid',
        errorCode: 'INVALID_TOKEN',
      };
    }

    return { valid: true, claims };
  }

  /**
   * Create a principal from token claims
   *
   * @param claims - Token claims
   * @returns Principal object
   */
  public createPrincipalFromClaims(claims: TokenClaims): Principal {
    return {
      type: 'user',
      id: claims.sub,
      name: claims.name as string | undefined,
      roles: claims.roles ? [...claims.roles] : undefined,
      attributes: {
        iss: claims.iss,
        permissions: claims.permissions,
      },
    };
  }

  /**
   * Get the current policy
   */
  public getPolicy(): AccessPolicy {
    return this.policy;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number } | null {
    return this.cache?.getStats() ?? null;
  }

  /**
   * Clear the authorization cache
   */
  public clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Clear rate limit data for a principal
   */
  public clearRateLimit(principalId: string): void {
    this.rateLimiter?.clear(principalId);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Evaluate policy rules against a request
   */
  private evaluatePolicy(
    request: AuthorizationRequest,
    startTime: number,
  ): AuthorizationResult {
    // Sort rules by priority (higher first)
    const sortedRules = [...this.policy.rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );

    // Evaluate each rule
    for (const rule of sortedRules) {
      const matches = this.ruleMatches(rule, request);

      if (matches) {
        const allowed = rule.effect === 'allow';
        return this.createResult(
          allowed,
          `${allowed ? 'Allowed' : 'Denied'} by rule: ${rule.id}`,
          allowed ? undefined : 'ACCESS_DENIED',
          rule,
          startTime,
        );
      }
    }

    // No rules matched, use default effect
    const allowed = this.policy.defaultEffect === 'allow';
    return this.createResult(
      allowed,
      `${allowed ? 'Allowed' : 'Denied'} by default policy`,
      allowed ? undefined : 'ACCESS_DENIED',
      undefined,
      startTime,
    );
  }

  /**
   * Check if a rule matches a request
   */
  private ruleMatches(
    rule: PolicyRule,
    request: AuthorizationRequest,
  ): boolean {
    // Check resource type
    if (!rule.resourceTypes.includes(request.resourceType)) {
      return false;
    }

    // Check action
    if (!rule.actions.includes(request.action)) {
      return false;
    }

    // Check resource patterns
    if (rule.resourcePatterns && rule.resourcePatterns.length > 0) {
      const matchesPattern = rule.resourcePatterns.some(pattern =>
        this.matchesGlobPattern(request.resourceName, pattern),
      );
      if (!matchesPattern) {
        return false;
      }
    }

    // Check conditions
    if (rule.conditions && rule.conditions.length > 0) {
      const allConditionsMet = rule.conditions.every(condition =>
        this.evaluateCondition(condition, request),
      );
      if (!allConditionsMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * Match a resource name against a glob pattern
   */
  private matchesGlobPattern(name: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.'); // Convert ? to .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
  }

  /**
   * Evaluate a policy condition
   */
  private evaluateCondition(
    condition: {
      field: string;
      operator: string;
      value: string | string[] | RegExp;
    },
    request: AuthorizationRequest,
  ): boolean {
    // Get field value from request
    const fieldValue = this.getFieldValue(condition.field, request);

    if (fieldValue === undefined) {
      return false;
    }

    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          fieldValue.includes(conditionValue as string)
        );
      case 'starts_with':
        return (
          typeof fieldValue === 'string' &&
          fieldValue.startsWith(conditionValue as string)
        );
      case 'ends_with':
        return (
          typeof fieldValue === 'string' &&
          fieldValue.endsWith(conditionValue as string)
        );
      case 'matches':
        if (conditionValue instanceof RegExp) {
          return conditionValue.test(fieldValue as string);
        }
        return new RegExp(conditionValue as string).test(fieldValue as string);
      case 'in':
        return (
          Array.isArray(conditionValue) &&
          conditionValue.includes(fieldValue as string)
        );
      case 'not_in':
        return (
          Array.isArray(conditionValue) &&
          !conditionValue.includes(fieldValue as string)
        );
      default:
        return false;
    }
  }

  /**
   * Get a field value from the request for condition evaluation
   */
  private getFieldValue(field: string, request: AuthorizationRequest): unknown {
    const parts = field.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = request;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Check IP restrictions
   */
  private checkIpRestrictions(ipAddress: string): {
    allowed: boolean;
    reason: string;
  } {
    const ipConfig = this.policy.ipConfig;

    if (!ipConfig) {
      return { allowed: true, reason: 'No IP restrictions configured' };
    }

    // Check blocklist first
    if (ipConfig.blocklist?.includes(ipAddress)) {
      return { allowed: false, reason: `IP address ${ipAddress} is blocked` };
    }

    // Check allowlist
    if (ipConfig.allowlist && ipConfig.allowlist.length > 0) {
      if (!ipConfig.allowlist.includes(ipAddress)) {
        // Check localhost exception
        if (
          ipConfig.allowLocalhost &&
          (ipAddress === '127.0.0.1' ||
            ipAddress === '::1' ||
            ipAddress === 'localhost')
        ) {
          return { allowed: true, reason: 'Localhost access allowed' };
        }
        return {
          allowed: false,
          reason: `IP address ${ipAddress} is not in allowlist`,
        };
      }
    }

    return { allowed: true, reason: 'IP address allowed' };
  }

  /**
   * Create an authorization result
   */
  private createResult(
    allowed: boolean,
    reason: string,
    errorCode: AuthorizationErrorCode | undefined,
    matchedRule: PolicyRule | undefined,
    startTime: number,
  ): AuthorizationResult {
    return {
      allowed,
      reason,
      errorCode,
      matchedRule,
      timestamp: new Date(),
      evaluationTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Emit a security event
   */
  private emitSecurityEvent(
    type: SecurityEventType,
    severity: SecurityEventSeverity,
    request: AuthorizationRequest,
    result: AuthorizationResult,
  ): void {
    if (!this.emitEvents || !this.onSecurityEvent) {
      return;
    }

    const event: SecurityEvent = {
      type,
      severity,
      timestamp: new Date(),
      principal: request.principal,
      resource: {
        type: request.resourceType,
        name: request.resourceName,
      },
      action: request.action,
      authorizationResult: result,
      details: request.context?.metadata,
    };

    try {
      this.onSecurityEvent(event);
    } catch (error) {
      this.logger?.error('Error emitting security event', error);
    }
  }
}

/**
 * Create a default permissive access controller
 *
 * @returns Access controller with permissive default policy
 */
export function createPermissiveAccessController(): MCPAccessController {
  const { DEFAULT_PERMISSIVE_POLICY } = require('./types');
  return new MCPAccessController({
    policy: DEFAULT_PERMISSIVE_POLICY,
  });
}

/**
 * Create a default restrictive access controller
 *
 * @returns Access controller with restrictive default policy
 */
export function createRestrictiveAccessController(): MCPAccessController {
  const { DEFAULT_RESTRICTIVE_POLICY } = require('./types');
  return new MCPAccessController({
    policy: DEFAULT_RESTRICTIVE_POLICY,
  });
}
