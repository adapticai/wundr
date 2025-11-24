/**
 * @genesis/core - Type Definitions
 *
 * Central export for all type definitions used by the core service layer.
 *
 * @packageDocumentation
 */

// =============================================================================
// VP Types
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
} from './vp';

export {
  // Type guards
  isVPCharter,
  isVPServiceAccountConfig,

  // Constants
  DEFAULT_VP_CHARTER,
} from './vp';

// =============================================================================
// Re-export Database Types
// =============================================================================

// Re-export commonly used database types for convenience
export type {
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
} from '@genesis/database';
