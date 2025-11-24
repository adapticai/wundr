/**
 * @genesis/core - Services
 *
 * Central export for all service layer implementations.
 *
 * @packageDocumentation
 */

// =============================================================================
// VP Service
// =============================================================================

export {
  // Service implementation
  VPServiceImpl,
  createVPService,
  vpService,

  // Interfaces
  type VPService,
  type ServiceAccountService,
} from './vp-service';

// =============================================================================
// Message Service
// =============================================================================

export {
  // Service implementation
  MessageServiceImpl,
  createMessageService,
  messageService,

  // Interfaces
  type MessageService,
  type ThreadService,
  type ReactionService,
  type MessageEvents,

  // Errors (legacy export from message-service)
  MessageNotFoundError,
  ChannelNotFoundError as MessageChannelNotFoundError,
  MessageValidationError,
  ReactionError,
} from './message-service';

// =============================================================================
// Channel Service
// =============================================================================

export {
  // Service implementation
  ChannelServiceImpl,
  createChannelService,
  channelService,

  // Interfaces
  type ChannelService,

  // Errors
  ChannelNotFoundError,
  ChannelAlreadyExistsError,
  ChannelValidationError,
  ChannelMemberNotFoundError,
  WorkspaceNotFoundError as ChannelWorkspaceNotFoundError,
  UserNotFoundError as ChannelUserNotFoundError,
} from './channel-service';

// =============================================================================
// Organization Service
// =============================================================================

export {
  // Service implementation
  OrganizationServiceImpl,
  createOrganizationService,
  organizationService,

  // Interfaces
  type OrganizationService,

  // Errors
  OrganizationAlreadyExistsError,
  OrganizationValidationError,
  OrganizationMemberNotFoundError,
  UserNotFoundError as OrgUserNotFoundError,
} from './organization-service';

// =============================================================================
// Workspace Service
// =============================================================================

export {
  // Service implementation
  WorkspaceServiceImpl,
  createWorkspaceService,
  workspaceService,

  // Interfaces
  type WorkspaceService,

  // Errors
  WorkspaceNotFoundError,
  WorkspaceAlreadyExistsError,
  WorkspaceValidationError,
  WorkspaceMemberNotFoundError,
  UserNotFoundError as WorkspaceUserNotFoundError,
} from './workspace-service';

// =============================================================================
// Discipline Service
// =============================================================================

export {
  // Service implementation
  DisciplineServiceImpl,
  createDisciplineService,
  disciplineService,

  // Interfaces
  type DisciplineService,

  // Errors
  DisciplineNotFoundError,
  DisciplineAlreadyExistsError,
  DisciplineValidationError,
  VPNotFoundError as DisciplineVPNotFoundError,
} from './discipline-service';

// =============================================================================
// Presence Service
// =============================================================================

export {
  // Service implementation
  PresenceServiceImpl,
  createPresenceService,
  getPresenceService,
  presenceService,

  // Interfaces
  type PresenceService,
  type PresenceStats,

  // Errors
  PresenceError,
  RedisUnavailableError,
} from './presence-service';

// =============================================================================
// Heartbeat Service
// =============================================================================

export {
  // Service implementation
  HeartbeatServiceImpl,
  createHeartbeatService,

  // Interfaces
  type HeartbeatService,
  type RedisClient,

  // Errors
  HeartbeatError,
  DaemonNotRegisteredError,
  DaemonAlreadyRegisteredError,
  HeartbeatValidationError,
} from './heartbeat-service';

// =============================================================================
// Heartbeat Monitor
// =============================================================================

export {
  // Monitor implementation
  HeartbeatMonitor,
  createHeartbeatMonitor,

  // Interfaces
  type HeartbeatMonitorService,
  type MonitorStats,
} from './heartbeat-monitor';

// =============================================================================
// Image Service
// =============================================================================

export {
  // Service implementation
  ImageServiceImpl,
  createImageService,
  imageService,

  // Interfaces
  type ImageService,

  // Errors
  ImageProcessingError,
  UnsupportedFormatError,
  ImageValidationError,
  ImageOperationError,
} from './image-service';

// =============================================================================
// Image Upload Pipeline
// =============================================================================

export {
  // Pipeline implementation
  ImageUploadPipeline,
  createImageUploadPipeline,

  // Interfaces
  type S3Client,
  type ImageUploadPipelineConfig,

  // Errors
  ImageUploadError,
  S3UploadError,
  DatabaseRecordError,
} from './image-upload-pipeline';

// =============================================================================
// Storage Service
// =============================================================================

export {
  // Service implementation
  StorageServiceImpl,
  createStorageService,
  createStorageServiceFromEnv,
  getStorageService,
  storageService,

  // Interfaces
  type StorageService,

  // Errors
  StorageError,
  FileNotFoundError,
  FileValidationError,
  FileSizeError,
  MimeTypeError,
  StorageConfigError,
} from './storage-service';

// =============================================================================
// File Record Service
// =============================================================================

export {
  // Service implementation
  FileRecordServiceImpl,
  createFileRecordService,
  fileRecordService,

  // Interfaces
  type FileRecordService,

  // Errors
  FileRecordNotFoundError,
  FileRecordValidationError,
  WorkspaceNotFoundError as FileWorkspaceNotFoundError,
  UserNotFoundError as FileUserNotFoundError,

  // Constants
  DEFAULT_FILE_RECORD_LIST_OPTIONS,
} from './file-record-service';

// =============================================================================
// LiveKit Service
// =============================================================================

export {
  // Service implementation
  LiveKitServiceImpl,
  createLiveKitService,
  createLiveKitServiceFromEnv,
  getLiveKitService,
  liveKitService,

  // Interfaces
  type LiveKitService,

  // Errors
  LiveKitError,
  RoomNotFoundError,
  RoomAlreadyExistsError,
  ParticipantNotFoundError,
  LiveKitConfigError,
  TokenGenerationError,
  RecordingError,
} from './livekit-service';

// =============================================================================
// Call Service
// =============================================================================

export {
  // Service implementation
  CallServiceImpl,
  createCallService,
  getCallService,
  callService,

  // Interfaces
  type CallService,

  // Types
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

  // Errors
  CallNotFoundError,
  ActiveCallExistsError,
  HuddleNotFoundError,
  CallOperationError,
} from './call-service';

// =============================================================================
// Notification Service
// =============================================================================

export {
  // Service implementation
  NotificationServiceImpl,
  createNotificationService,
  createNotificationServiceFromEnv,
  getNotificationService,
  notificationService,

  // Interfaces
  type NotificationService,
  type NotificationEvents,

  // Errors
  NotificationError,
  NotificationNotFoundError,
  UserNotFoundError as NotificationUserNotFoundError,
  DeviceNotFoundError,
  DeviceRegistrationError,
  PushSendError,
  NotificationConfigError,
  NotificationValidationError,
} from './notification-service';

// =============================================================================
// Local Storage Service
// =============================================================================

export {
  // Service implementation
  LocalStorageServiceImpl,
  createLocalStorageService,
  createMemoryStorageService,
  getLocalStorageService,
  localStorageService,

  // Interfaces
  type LocalStorageService,

  // Errors
  LocalStorageError,
  StorageUnavailableError,
  StorageQuotaExceededError,
  StorageOperationError,

  // Utility functions
  generateStorageKey,
  parseStorageKey,
  createNamespacedStorage,
} from './local-storage-service';

// =============================================================================
// Offline Queue Service
// =============================================================================

export {
  // Service implementation
  OfflineQueueServiceImpl,
  createOfflineQueueService,
  getOfflineQueueService,
  offlineQueueService,

  // Interfaces
  type OfflineQueueService,
  type EnqueueActionInput,
  type ActionProcessor,

  // Errors
  OfflineQueueError,
  QueueFullError,
  ActionNotFoundError,
  ActionProcessingError,
  ActionValidationError,
} from './offline-service';

// =============================================================================
// Sync Service
// =============================================================================

export {
  // Service implementation
  SyncServiceImpl,
  createSyncService,
  getSyncService,
  syncService,

  // Interfaces
  type SyncService,
  type SyncDataFetcher,
  type InitialSyncOptions,
  type UploadResult,

  // Errors
  SyncError,
  SyncFailedError,
  SyncInProgressError,
  ConflictResolutionError,
  InvalidSyncTokenError,

  // Utility functions
  mergeObjects,
  areValuesEqual,
} from './sync-service';

// =============================================================================
// Audit Service
// =============================================================================

export {
  // Service implementation
  AuditServiceImpl,
  createAuditService,
  getAuditService,
  initAuditService,
  auditService,

  // Interfaces
  type AuditService,
  type AuditServiceConfig,
  type AuditDatabaseClient,
  type AuditRedisClient,
  type AuditLogDelegate,
  type AuditLogExportDelegate,
  type LogParams,

  // Errors
  AuditError,
  AuditExportNotFoundError,
  AuditValidationError,
} from './audit-service';

// =============================================================================
// Search Service
// =============================================================================

export {
  // Service implementation
  SearchServiceImpl,
  createSearchService,
  getSearchService,
  resetSearchService,

  // Interfaces
  type SearchService,
  type SearchServiceConfig,

  // Errors
  SearchError,
  SearchValidationError,
  SearchTimeoutError,
} from './search-service';

// =============================================================================
// Retention Service
// =============================================================================

export {
  // Service implementation
  RetentionService,
  createRetentionService,

  // Interfaces
  type RetentionServiceConfig,
  type RedisClient as RetentionRedisClient,

  // Errors
  RetentionPolicyNotFoundError,
  LegalHoldNotFoundError,
  RetentionJobError,
  DataExportNotFoundError,
} from './retention-service';

// =============================================================================
// Daemon Auth Service
// =============================================================================

export {
  // Service implementation
  DaemonAuthService,
  createDaemonAuthService,

  // Interfaces
  type DaemonAuthServiceConfig,

  // Errors
  DaemonAuthError,
  InvalidCredentialsError,
  TokenExpiredError,
  TokenRevokedError,
  SessionNotFoundError,
  InsufficientScopeError,
} from './daemon-auth-service';

// =============================================================================
// Daemon API Service
// =============================================================================

export {
  // Service implementation
  DaemonApiService,
  createDaemonApiService,

  // Interfaces
  type DaemonApiServiceConfig,
  type SendMessageParams,
  type ChannelInfo,
  type UserInfo,

  // Errors
  DaemonApiError,
} from './daemon-api-service';

// =============================================================================
// Analytics Service
// =============================================================================

export {
  // Service implementation
  AnalyticsServiceImpl,
  createAnalyticsService,
  getAnalyticsService,
  resetAnalyticsService,

  // Interfaces
  type AnalyticsService,
  type AnalyticsServiceConfig,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
  type AnalyticsEventDelegate,

  // Errors
  AnalyticsError,
  AnalyticsFlushError,
} from './analytics-service';

// =============================================================================
// Integration Service
// =============================================================================

export {
  // Service implementation
  IntegrationServiceImpl,
  createIntegrationService,
  integrationService,

  // Storage implementations
  InMemoryIntegrationStorage,

  // Interfaces
  type IntegrationService,
  type WebhookService,
  type IntegrationStorage,
  type HttpClient,
  type IntegrationServiceConfig,

  // Errors
  IntegrationError,
  IntegrationNotFoundError,
  IntegrationAlreadyExistsError,
  IntegrationValidationError,
  OAuthRefreshError,
  WebhookNotFoundError,
  WebhookDeliveryError,
  WebhookSignatureError,
  ConnectionTestError,
} from './integration-service';
