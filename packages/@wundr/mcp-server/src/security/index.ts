/**
 * Security Module Exports
 *
 * Provides access control, authorization, and security policy
 * enforcement for MCP server operations.
 *
 * @packageDocumentation
 */

// Types
export {
  // Permission and resource types
  PermissionLevel,
  ResourceType,
  ActionType,
  ConditionOperator,

  // Policy types
  PolicyCondition,
  PolicyRule,
  AccessPolicy,
  RateLimitConfig,
  IpConfig,

  // Authorization types
  Principal,
  AuthorizationRequest,
  AuthorizationContext,
  AuthorizationResult,
  AuthorizationErrorCode,

  // Token types
  TokenClaims,
  TokenValidationResult,
  AudienceVerificationOptions,

  // Security event types
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,

  // Configuration
  AccessControllerConfig,

  // Default policies
  DEFAULT_PERMISSIVE_POLICY,
  DEFAULT_RESTRICTIVE_POLICY,
} from './types';

// Access Controller
export {
  MCPAccessController,
  createPermissiveAccessController,
  createRestrictiveAccessController,
} from './access-control';
