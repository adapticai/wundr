/**
 * Auth module public API.
 *
 * Re-exports every type and class that downstream modules need.
 */

// Types and schemas
export {
  AuthConfigSchema,
  JwtPayloadSchema,
  AuthenticatedMessageSchema,
} from './types';

export type {
  AuthConfig,
  JwtPayload,
  ClientIdentity,
  AuthResult,
  AuthenticatedMessage,
  RateLimitEntry,
} from './types';

// JWT utilities
export { signJwt, verifyJwt, createToken } from './jwt';
export type { JwtVerifyResult } from './jwt';

// Rate limiter
export { RateLimiter } from './rate-limiter';
export type { RateLimiterConfig } from './rate-limiter';

// Core authenticator
export { Authenticator } from './authenticator';

// Middleware (the primary integration point)
export { AuthMiddleware } from './middleware';
export type { AuthenticatedWebSocket } from './middleware';
