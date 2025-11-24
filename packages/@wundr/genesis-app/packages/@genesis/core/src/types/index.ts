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
// Message Types
// =============================================================================

export type {
  // Core message types
  MessageWithAuthor,
  MessageWithRelations,
  ReactionWithUser,

  // Input types
  SendMessageInput,
  UpdateMessageInput,

  // Query types
  MessageQueryOptions,
  PaginatedMessages,

  // Reaction types
  ReactionCount,
  AddReactionResult,

  // Thread types
  ThreadSummary,

  // Event types
  MessageEventType,
  BaseMessageEvent,
  MessageCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  ReactionAddedEvent,
  ReactionRemovedEvent,
  ThreadUpdatedEvent,
  MessageEvent,

  // Callback types
  OnMessageCreatedCallback,
  OnMessageUpdatedCallback,
  OnMessageDeletedCallback,
  OnReactionAddedCallback,
  OnReactionRemovedCallback,
} from './message';

export {
  // Type guards
  isMessageWithAuthor,
  isMessageWithRelations,
  isValidSendMessageInput,

  // Constants
  DEFAULT_MESSAGE_QUERY_OPTIONS,
  MAX_MESSAGE_LIMIT,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_REACTIONS_PER_MESSAGE,
  MESSAGE_TYPES,
} from './message';

// =============================================================================
// Organization Types
// =============================================================================

export type {
  // Organization types
  OrganizationWithMembers,
  OrganizationWithRelations,
  OrganizationMemberWithUser,
  CreateOrgInput,
  UpdateOrgInput,
  ListOrgsOptions,
  PaginatedOrgResult,
  OrganizationMemberRole,

  // Workspace types
  WorkspaceWithMembers,
  WorkspaceWithRelations,
  WorkspaceMemberWithUser,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  ListWorkspacesOptions,
  PaginatedWorkspaceResult,
  WorkspaceMemberRole,

  // Channel types
  ChannelWithMembers,
  ChannelWithRelations,
  ChannelMemberWithUser,
  CreateChannelInput,
  UpdateChannelInput,
  ChannelListOptions,
  PaginatedChannelResult,
  ChannelMemberRole,

  // Discipline types
  Discipline,
  DisciplineWithVPs,
  VPBasic,
  CreateDisciplineInput,
  UpdateDisciplineInput,
  ListDisciplinesOptions,
  PaginatedDisciplineResult,
} from './organization';

export {
  // Type guards
  isOrganization,
  isWorkspace,
  isChannel,
  isValidCreateChannelInput,
  isValidCreateWorkspaceInput,
  isValidCreateOrgInput,

  // Constants
  DEFAULT_ORG_LIST_OPTIONS,
  DEFAULT_WORKSPACE_LIST_OPTIONS,
  DEFAULT_CHANNEL_LIST_OPTIONS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SLUG_LENGTH,
  CHANNEL_TYPES,
  WORKSPACE_VISIBILITY_LEVELS,
  ORGANIZATION_ROLES,
  WORKSPACE_ROLES,
  CHANNEL_ROLES,
} from './organization';

// =============================================================================
// Heartbeat Types
// =============================================================================

export type {
  // Core heartbeat types
  HeartbeatDaemonInfo,
  HeartbeatMetrics,
  HeartbeatRecord,
  HealthStatus,
  HealthStatusType,

  // Input types
  RegisterDaemonInput,
  SendHeartbeatInput,
  UnregisterDaemonInput,

  // Configuration types
  HeartbeatConfig,

  // Event types
  HeartbeatEventType,
  HeartbeatEvent,
  DaemonRegisteredEvent,
  DaemonUnregisteredEvent,
  VPUnhealthyEvent,
  VPRecoveredEvent,

  // Callback types
  OnVPUnhealthyCallback,
  OnVPRecoveredCallback,
  OnDaemonRegisteredCallback,
  OnDaemonUnregisteredCallback,
} from './heartbeat';

export {
  // Type guards
  isHeartbeatDaemonInfo,
  isHeartbeatMetrics,
  isHealthStatus,

  // Constants
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_HEARTBEAT_METRICS,
  DEFAULT_HEALTH_STATUS,
  HEARTBEAT_REDIS_KEYS,
} from './heartbeat';

// =============================================================================
// Presence Types
// =============================================================================

export type {
  // Core presence types
  PresenceStatus,
  DeviceType,
  UserPresence,
  PresenceMetadata,
  VPPresence,
  DaemonInfo,
  DaemonMetrics,
  ChannelPresence,

  // Event types
  PresenceEventType,
  BasePresenceEvent,
  UserPresenceEvent,
  VPPresenceEvent,
  ChannelPresenceEvent,
  PresenceEvent,

  // Callback types
  PresenceCallback,
  VPPresenceCallback,
  ChannelPresenceCallback,
  UnsubscribeFunction,

  // Configuration types
  PresenceConfig,
} from './presence';

export {
  // Type guards
  isPresenceStatus,
  isUserPresence,
  isVPPresence,
  isDeviceType,
  isUserPresenceEvent,
  isVPPresenceEvent,
  isChannelPresenceEvent,

  // Constants
  PRESENCE_KEY_PATTERNS,
  DEFAULT_PRESENCE_CONFIG,
} from './presence';

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
  Reaction,
  Session,
  OrganizationMember,
  WorkspaceMember,
  ChannelMember,
  VPStatus,
  UserStatus,
  OrganizationRole,
  WorkspaceRole,
  ChannelRole,
  MessageType,
  ChannelType,
  WorkspaceVisibility,
} from '@genesis/database';
