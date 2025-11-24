/**
 * @genesis/core
 *
 * Core service layer for Genesis App providing VP management,
 * organization, workspace, channel, discipline services,
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

  // Channel Service
  ChannelServiceImpl,
  createChannelService,
  channelService,

  // Organization Service
  OrganizationServiceImpl,
  createOrganizationService,
  organizationService,

  // Workspace Service
  WorkspaceServiceImpl,
  createWorkspaceService,
  workspaceService,

  // Discipline Service
  DisciplineServiceImpl,
  createDisciplineService,
  disciplineService,

  // Presence Service
  PresenceServiceImpl,
  createPresenceService,
  getPresenceService,
  presenceService,

  // Interfaces
  type VPService,
  type ServiceAccountService,
  type MessageService,
  type ThreadService,
  type ReactionService,
  type MessageEvents,
  type ChannelService,
  type OrganizationService,
  type WorkspaceService,
  type DisciplineService,
  type PresenceService,
  type PresenceStats,

  // Message Errors
  MessageNotFoundError,
  MessageChannelNotFoundError,
  MessageValidationError,
  ReactionError,

  // Channel Errors
  ChannelNotFoundError,
  ChannelAlreadyExistsError,
  ChannelValidationError,
  ChannelMemberNotFoundError,
  ChannelWorkspaceNotFoundError,
  ChannelUserNotFoundError,

  // Organization Errors
  OrganizationAlreadyExistsError,
  OrganizationValidationError,
  OrganizationMemberNotFoundError,
  OrgUserNotFoundError,

  // Workspace Errors
  WorkspaceNotFoundError,
  WorkspaceAlreadyExistsError,
  WorkspaceValidationError,
  WorkspaceMemberNotFoundError,
  WorkspaceUserNotFoundError,

  // Discipline Errors
  DisciplineNotFoundError,
  DisciplineAlreadyExistsError,
  DisciplineValidationError,
  DisciplineVPNotFoundError,

  // Presence Errors
  PresenceError,
  RedisUnavailableError,

  // Heartbeat Service
  HeartbeatServiceImpl,
  createHeartbeatService,
  type HeartbeatService,
  type RedisClient,

  // Heartbeat Monitor
  HeartbeatMonitor,
  createHeartbeatMonitor,
  type HeartbeatMonitorService,
  type MonitorStats,

  // Heartbeat Errors
  HeartbeatError,
  DaemonNotRegisteredError,
  DaemonAlreadyRegisteredError,
  HeartbeatValidationError,

  // Image Service
  ImageServiceImpl,
  createImageService,
  imageService,
  type ImageService,

  // Image Service Errors
  ImageProcessingError,
  UnsupportedFormatError,
  ImageValidationError,
  ImageOperationError,

  // Image Upload Pipeline
  ImageUploadPipeline,
  createImageUploadPipeline,
  type S3Client,
  type ImageUploadPipelineConfig,

  // Image Upload Pipeline Errors
  ImageUploadError,
  S3UploadError,
  DatabaseRecordError,

  // Storage Service
  StorageServiceImpl,
  createStorageService,
  createStorageServiceFromEnv,
  getStorageService,
  storageService,
  type StorageService,

  // Storage Errors
  StorageError,
  FileNotFoundError,
  FileValidationError,
  FileSizeError,
  MimeTypeError,
  StorageConfigError,

  // File Record Service
  FileRecordServiceImpl,
  createFileRecordService,
  fileRecordService,
  type FileRecordService,

  // File Record Errors
  FileRecordNotFoundError,
  FileRecordValidationError,
  FileWorkspaceNotFoundError,
  FileUserNotFoundError,

  // File Record Constants
  DEFAULT_FILE_RECORD_LIST_OPTIONS,

  // LiveKit Service
  LiveKitServiceImpl,
  createLiveKitService,
  createLiveKitServiceFromEnv,
  getLiveKitService,
  liveKitService,
  type LiveKitService,

  // LiveKit Errors
  LiveKitError,
  RoomNotFoundError,
  RoomAlreadyExistsError,
  ParticipantNotFoundError,
  LiveKitConfigError,
  TokenGenerationError,
  RecordingError,

  // Call Service
  CallServiceImpl,
  createCallService,
  getCallService,
  callService,
  type CallService,

  // Call Types
  type CallType,
  type CallStatus,
  type HuddleStatus,
  type Call,
  type CallMetadata,
  type CreateCallOptions,
  type Huddle,
  type HuddleMetadata,
  type HuddleOptions,
  type JoinToken,
  type HistoryOptions,
  type PaginatedCallResult,

  // Call Errors
  CallNotFoundError,
  ActiveCallExistsError,
  HuddleNotFoundError,
  CallOperationError,

  // Integration Service
  IntegrationServiceImpl,
  createIntegrationService,
  integrationService,
  InMemoryIntegrationStorage,
  type IntegrationService,
  type WebhookService,
  type IntegrationStorage,
  type HttpClient as IntegrationHttpClient,
  type IntegrationServiceConfig,

  // Integration Errors
  IntegrationError,
  IntegrationNotFoundError,
  IntegrationAlreadyExistsError,
  IntegrationValidationError,
  OAuthRefreshError,
  WebhookNotFoundError,
  WebhookDeliveryError,
  WebhookSignatureError,
  ConnectionTestError,
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

  // Presence types
  PresenceStatus,
  DeviceType,
  UserPresence,
  PresenceMetadata,
  VPPresence,
  DaemonInfo,
  DaemonMetrics,
  ChannelPresence,
  PresenceEventType,
  BasePresenceEvent,
  UserPresenceEvent,
  VPPresenceEvent,
  ChannelPresenceEvent,
  PresenceEvent,
  PresenceCallback,
  VPPresenceCallback,
  ChannelPresenceCallback,
  UnsubscribeFunction,
  PresenceConfig,

  // Heartbeat types
  HeartbeatDaemonInfo,
  HeartbeatMetrics,
  HeartbeatRecord,
  HealthStatus,
  HealthStatusType,
  RegisterDaemonInput,
  SendHeartbeatInput,
  UnregisterDaemonInput,
  HeartbeatConfig,
  HeartbeatEventType,
  HeartbeatEvent,
  DaemonRegisteredEvent,
  DaemonUnregisteredEvent,
  VPUnhealthyEvent,
  VPRecoveredEvent,
  OnVPUnhealthyCallback,
  OnVPRecoveredCallback,
  OnDaemonRegisteredCallback,
  OnDaemonUnregisteredCallback,

  // Image types
  ImageFormat,
  ThumbnailSize,
  ResizeFit,
  ImagePosition,
  ResizeOptions,
  OptimizeOptions,
  CropOptions,
  VariantConfig,
  ImageInput,
  ImageVariant,
  ProcessedImage,
  ImageMetadata,
  ExifData,
  ImageUploadInput,
  ImageUploadResult,
  ImageValidationResult,
  ImageValidationOptions,

  // Storage types
  StorageProvider,
  StorageACL,
  StorageConfig,
  StorageCredentials,
  UploadInput,
  UploadOptions,
  BufferUploadOptions,
  UploadResult,
  FileStream,
  UrlOptions,
  SignedUrlOptions,
  SignedUploadUrl,
  FileMetadata,
  ListOptions,
  FileListResult,
  CreateFileRecordInput,
  UpdateFileRecordInput,
  FileRecordWithRelations,
  FileRecordListOptions,
  PaginatedFileRecordResult,
  KeyGenerationOptions,

  // Re-exported database types
  VP,
  User,
  Organization,
  Workspace,
  Channel,
  Message,
  Reaction,
  Session,
  File,
  FileStatus,
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

  // LiveKit types
  CreateRoomOptions,
  Room as LiveKitRoom,
  UpdateRoomOptions,
  TrackSource,
  TokenOptions,
  TokenGenerationResult,
  ParticipantState,
  TrackType,
  Track,
  Participant,
  ConnectionQuality,
  ListParticipantsOptions,
  RecordingDestination,
  RecordingOptions,
  RecordingPreset,
  S3RecordingConfig,
  GCPRecordingConfig,
  AzureRecordingConfig,
  RecordingStatus,
  Recording,
  LiveKitConfig,
  LiveKitEventType,
  BaseLiveKitEvent,
  RoomCreatedEvent,
  RoomDeletedEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  TrackPublishedEvent,
  TrackUnpublishedEvent,
  RecordingStartedEvent,
  RecordingStoppedEvent,
  LiveKitEvent,

  // Integration types
  IntegrationProvider,
  IntegrationStatus,
  IntegrationPermission,
  OAuthToken,
  IntegrationConfig,
  WebhookConfig,
  WebhookEvent,
  WebhookRetryPolicy,
  WebhookDelivery,
  WebhookAttempt,
  IntegrationEvent,
  SyncResult as IntegrationSyncResult,
  SlackIntegrationConfig,
  GitHubIntegrationConfig,
  JiraIntegrationConfig,
  CreateIntegrationInput,
  UpdateIntegrationInput,
  CreateWebhookInput,
  UpdateWebhookInput,
  ListIntegrationsOptions,
  ListWebhooksOptions,
  ListDeliveriesOptions,
  PaginatedIntegrationResult,
  PaginatedWebhookResult,
  PaginatedDeliveryResult,
  ConnectionTestResult,
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

  // Organization Type guards
  isOrganization,
  isWorkspace,
  isChannel,
  isValidCreateChannelInput,
  isValidCreateWorkspaceInput,
  isValidCreateOrgInput,

  // Organization Constants
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

  // Presence Type guards
  isPresenceStatus,
  isUserPresence,
  isVPPresence,
  isDeviceType,
  isUserPresenceEvent,
  isVPPresenceEvent,
  isChannelPresenceEvent,

  // Presence Constants
  PRESENCE_KEY_PATTERNS,
  DEFAULT_PRESENCE_CONFIG,

  // Heartbeat Type guards
  isHeartbeatDaemonInfo,
  isHeartbeatMetrics,
  isHealthStatus,

  // Heartbeat Constants
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_HEARTBEAT_METRICS,
  DEFAULT_HEALTH_STATUS,
  HEARTBEAT_REDIS_KEYS,

  // Image Type guards
  isImageFormat,
  isThumbnailSize,
  isResizeOptions,
  isOptimizeOptions,
  isCropOptions,
  isImageMetadata,
  isVariantConfig,

  // Image Constants
  THUMBNAIL_SIZES,
  DEFAULT_QUALITY,
  IMAGE_MIME_TYPES,
  MIME_TO_FORMAT,
  DEFAULT_VALIDATION_OPTIONS,
  DEFAULT_OPTIMIZE_OPTIONS,
  DEFAULT_VARIANTS,

  // Storage Type guards
  isStorageProvider,
  isStorageACL,
  isStorageConfig,
  isUploadInput,

  // Storage Constants
  DEFAULT_STORAGE_CONFIG,
  FILE_SIZE_LIMITS,
  MIME_TYPE_CATEGORIES,

  // Storage Utility functions
  getFileCategory,
  getMaxFileSizeForType,
  getExtensionFromMimeType,
  getMimeTypeFromExtension,

  // LiveKit Type guards and constants
  isTrackType,
  isParticipantState,
  isRecordingStatus,
  isTrackSource,
  isCreateRoomOptions,
  isLiveKitConfig,
  DEFAULT_LIVEKIT_CONFIG,
  DEFAULT_TOKEN_OPTIONS,
  HOST_TOKEN_OPTIONS,
  GUEST_TOKEN_OPTIONS,
  VIEWER_TOKEN_OPTIONS,
  RECORDING_PRESETS,

  // Integration Type guards
  isIntegrationProvider,
  isIntegrationStatus,
  isWebhookEvent,
  isIntegrationPermission,
  isIntegrationConfig,
  isWebhookConfig,
  isWebhookRetryPolicy,
  isValidCreateIntegrationInput,
  isValidCreateWebhookInput,

  // Integration Constants
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
  WEBHOOK_EVENTS,
  INTEGRATION_PERMISSIONS,
  DEFAULT_WEBHOOK_RETRY_POLICY,
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
// Permission Exports
// =============================================================================

export {
  // Permission enum and utilities
  Permission,
  PERMISSION_CATEGORIES,
  type PermissionCategory,
  isValidPermission,
  getPermissionResource,
  getPermissionAction,
  getPermissionsForResource,
  ALL_PERMISSIONS,

  // Role definitions
  type RoleDefinition,
  type ResolvedRole,
  ORGANIZATION_ROLES as PERM_ORGANIZATION_ROLES,
  WORKSPACE_ROLES as PERM_WORKSPACE_ROLES,
  CHANNEL_ROLES as PERM_CHANNEL_ROLES,
  resolveRolePermissions,
  getOrganizationRolePermissions,
  getWorkspaceRolePermissions,
  getChannelRolePermissions,
  roleHasPermission,
  ORGANIZATION_ROLE_HIERARCHY,
  WORKSPACE_ROLE_HIERARCHY,
  CHANNEL_ROLE_HIERARCHY,
  compareRoles,
  isAtLeastRole,

  // Permission checker
  PermissionChecker,
  permissionChecker,
  createPermissionChecker,
  type PermissionContext,
  type MembershipInfo,
  type PermissionCheckerConfig,
  validatePermissionContext,

  // Permission errors
  PermissionErrorCodes,
  type PermissionErrorCode,
  PermissionDeniedError,
  NotAuthenticatedError,
  NotOrganizationMemberError,
  NotWorkspaceMemberError,
  NotChannelMemberError,
  InsufficientRoleError,
  InvalidPermissionContextError,
  isPermissionDeniedError,
  isNotAuthenticatedError,
  isPermissionError,

  // Guards (decorators and functions)
  type AuthenticatedSession,
  type GuardResult,
  PERMISSION_METADATA_KEY,
  requireAuth,
  requirePermission,
  requireChannelMember,
  requireWorkspaceMember,
  requireOrganizationMember,
  assertAuthenticated,
  assertPermission,
  assertOrganizationMember,
  assertWorkspaceMember,
  assertChannelMember,
  checkPermission,
  checkOwnershipOrPermission,
  composeGuards,

  // Middleware
  type RequestContext,
  type AuthenticatedRequestContext,
  type ContextExtractor,
  type ApiHandler,
  type MiddlewareResult,
  withAuth,
  withPermission,
  withPermissions,
  withAnyPermission,
  withChannelAccess,
  withWorkspaceAccess,
  withOrganizationAccess,
  withOwnershipOrPermission,
  compose,
  withPermissionErrorHandler,
} from './permissions';

// =============================================================================
// Redis Exports
// =============================================================================

export {
  // Factory functions
  createRedisClient,
  createSubscriberClient,
  getRedisClient,
  getSubscriberClient,

  // Singleton
  redis,

  // Connection management
  getConnectionState,
  isRedisAvailable,
  waitForConnection,
  disconnectRedis,
  healthCheck,

  // Types
  type RedisConfig,
  type RedisConnectionState,
  type RedisClientWrapper,

  // Constants
  DEFAULT_REDIS_CONFIG,
} from './redis';

// =============================================================================
// Version
// =============================================================================

/**
 * Package version
 */
export const VERSION = '0.1.0';
