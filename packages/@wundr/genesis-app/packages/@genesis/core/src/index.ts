/**
 * @genesis/core
 *
 * Core service layer for Genesis App providing VP management,
 * service account operations, and business logic.
 *
 * @packageDocumentation
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { vpService, createVPService } from '@genesis/core';
 *
 * // Use the default service instance
 * const vp = await vpService.createVP({
 *   name: 'Alex Chen',
 *   discipline: 'Engineering',
 *   role: 'VP of Engineering',
 *   organizationId: 'org_123',
 * });
 *
 * // Generate API key for the VP
 * const { key } = await vpService.generateAPIKey(vp.id);
 * console.log('API Key (save this!):', key);
 *
 * // Validate an API key
 * const result = await vpService.validateAPIKey(key);
 * if (result.valid) {
 *   console.log('VP:', result.vp?.user.name);
 * }
 * ```
 *
 * @example
 * Custom database instance:
 * ```typescript
 * import { createVPService } from '@genesis/core';
 * import { PrismaClient } from '@genesis/database';
 *
 * const customPrisma = new PrismaClient();
 * const service = createVPService(customPrisma);
 * ```
 */

// =============================================================================
// Service Exports
// =============================================================================

export {
  // VP Service
  VPServiceImpl,
  createVPService,
  vpService,

  // Interfaces
  type VPService,
  type ServiceAccountService,
} from './services';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Core VP types
  VPWithUser,
  VPCharter,
  VPPersonality,
  VPCommunicationPreferences,
  VPOperationalConfig,
  VPWorkHours,
  VPEscalationConfig,

  // Input types
  CreateVPInput,
  UpdateVPInput,

  // Service account types
  ServiceAccountCredentials,
  APIKeyGenerationResult,
  APIKeyRotationResult,
  APIKeyValidationResult,
  VPServiceAccountConfig,

  // Query types
  ListVPsOptions,
  PaginatedVPResult,

  // Event types
  VPEventType,
  VPEvent,

  // Utility types
  SlugOptions,

  // Re-exported database types
  VP,
  User,
  Organization,
  Workspace,
  Channel,
  Message,
  Session,
  VPStatus,
  UserStatus,
  OrganizationRole,
  WorkspaceRole,
  ChannelRole,
} from './types';

export {
  // Type guards
  isVPCharter,
  isVPServiceAccountConfig,

  // Constants
  DEFAULT_VP_CHARTER,
} from './types';

// =============================================================================
// Error Exports
// =============================================================================

export {
  // Base error
  GenesisError,

  // VP errors
  VPNotFoundError,
  VPAlreadyExistsError,
  VPValidationError,
  VPOperationNotPermittedError,
  VPInvalidStateError,

  // API key errors
  APIKeyError,
  InvalidAPIKeyError,
  APIKeyGenerationError,

  // Organization errors
  OrganizationNotFoundError,

  // Database errors
  DatabaseError,
  TransactionError,

  // Type guards
  isGenesisError,
  isVPError,
  isAPIKeyError,

  // Utilities
  wrapError,
} from './errors';

// =============================================================================
// Utility Exports
// =============================================================================

export {
  // Slug generation
  generateSlug,
  generateVPEmail,

  // ID generation
  generateShortId,
  generateCUID,

  // API key utilities
  generateAPIKey,
  hashAPIKey,
  extractKeyPrefix,
  isValidAPIKeyFormat,
  verifyAPIKey,

  // Date utilities
  isExpired,
  createExpirationDate,

  // Validation utilities
  isValidEmail,
  isValidSlug,

  // Object utilities
  deepMerge,
  safeGet,
} from './utils';

// =============================================================================
// Version
// =============================================================================

/**
 * Package version
 */
export const VERSION = '0.1.0';
