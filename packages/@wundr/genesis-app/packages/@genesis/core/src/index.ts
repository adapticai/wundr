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

  // Message Service
  MessageServiceImpl,
  createMessageService,
  messageService,

  // Interfaces
  type VPService,
  type ServiceAccountService,
  type MessageService,
  type ThreadService,
  type ReactionService,
  type MessageEvents,

  // Message Errors
  MessageNotFoundError,
  ChannelNotFoundError,
  MessageValidationError,
  ReactionError,
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

  // VP Input types
  CreateVPInput,
  UpdateVPInput,

  // Service account types
  ServiceAccountCredentials,
  APIKeyGenerationResult,
  APIKeyRotationResult,
  APIKeyValidationResult,
  VPServiceAccountConfig,

  // VP Query types
  ListVPsOptions,
  PaginatedVPResult,

  // VP Event types
  VPEventType,
  VPEvent,

  // Utility types
  SlugOptions,

  // Message types
  MessageWithAuthor,
  MessageWithRelations,
  ReactionWithUser,
  SendMessageInput,
  UpdateMessageInput,
  MessageQueryOptions,
  PaginatedMessages,
  ReactionCount,
  AddReactionResult,
  ThreadSummary,
  MessageEventType,
  BaseMessageEvent,
  MessageCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  ReactionAddedEvent,
  ReactionRemovedEvent,
  ThreadUpdatedEvent,
  MessageEvent,
  OnMessageCreatedCallback,
  OnMessageUpdatedCallback,
  OnMessageDeletedCallback,
  OnReactionAddedCallback,
  OnReactionRemovedCallback,

  // Re-exported database types
  VP,
  User,
  Organization,
  Workspace,
  Channel,
  Message,
  Reaction,
  Session,
  VPStatus,
  UserStatus,
  OrganizationRole,
  WorkspaceRole,
  ChannelRole,
  MessageType,
} from './types';

export {
  // VP Type guards
  isVPCharter,
  isVPServiceAccountConfig,

  // VP Constants
  DEFAULT_VP_CHARTER,

  // Message Type guards
  isMessageWithAuthor,
  isMessageWithRelations,
  isValidSendMessageInput,

  // Message Constants
  DEFAULT_MESSAGE_QUERY_OPTIONS,
  MAX_MESSAGE_LIMIT,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_REACTIONS_PER_MESSAGE,
  MESSAGE_TYPES,
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
