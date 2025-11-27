/**
 * @genesis/core
 *
 * Core service layer for Genesis App providing Orchestrator management,
 * organization, workspace, channel, discipline services,
 * service account operations, and business logic.
 *
 * @packageDocumentation
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { orchestratorService, createOrchestratorService } from '@genesis/core';
 *
 * // Use the default service instance
 * const orchestrator = await orchestratorService.createOrchestrator({
 *   name: 'Alex Chen',
 *   discipline: 'Engineering',
 *   role: 'VP of Engineering',
 *   organizationId: 'org_123',
 * });
 *
 * // Generate API key for the Orchestrator
 * const { key } = await orchestratorService.generateAPIKey(orchestrator.id);
 * console.log('API Key (save this!):', key);
 *
 * // Validate an API key
 * const result = await orchestratorService.validateAPIKey(key);
 * if (result.valid) {
 *   console.log('Orchestrator:', result.orchestrator?.user.name);
 * }
 * ```
 *
 * @example
 * Custom database instance:
 * ```typescript
 * import { createOrchestratorService } from '@genesis/core';
 * import { PrismaClient } from '@neolith/database';
 *
 * const customPrisma = new PrismaClient();
 * const service = createOrchestratorService(customPrisma);
 * ```
 */

// =============================================================================
// Service Exports
// =============================================================================

export {
  // OrchestratorService
  OrchestratorServiceImpl,
  createOrchestratorService,
  orchestratorService,

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
  type OrchestratorService,
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

  // Search Service
  SearchServiceImpl,
  createSearchService,
  getSearchService,
  resetSearchService,
  type SearchService,
  type SearchServiceConfig,

  // Search Errors
  SearchError,
  SearchValidationError,
  SearchTimeoutError,

  // Analytics Service
  AnalyticsServiceImpl,
  createAnalyticsService,
  getAnalyticsService,
  resetAnalyticsService,
  type AnalyticsService,
  type AnalyticsServiceConfig,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
  type AnalyticsEventDelegate,

  // Analytics Errors
  AnalyticsError,
  AnalyticsFlushError,

  // Audit Service
  AuditServiceImpl,
  createAuditService,
  getAuditService,
  initAuditService,
  auditService,
  type AuditService,
  type AuditServiceConfig,
  type AuditDatabaseClient,
  type AuditRedisClient,
  type AuditLogDelegate,
  type AuditLogExportDelegate,
  type LogParams,

  // Audit Errors
  AuditError,
  AuditExportNotFoundError,
  AuditValidationError,

  // Retention Service
  RetentionService,
  createRetentionService,
  type RetentionServiceConfig,
  type RetentionRedisClient,

  // Retention Errors
  RetentionPolicyNotFoundError,
  LegalHoldNotFoundError,
  RetentionJobError,
  DataExportNotFoundError,

  // Notification Service
  NotificationServiceImpl,
  createNotificationService,
  createNotificationServiceFromEnv,
  getNotificationService,
  notificationService,
  type NotificationService,
  type NotificationEvents,

  // Notification Errors
  NotificationError,
  NotificationNotFoundError,
  NotificationUserNotFoundError,
  DeviceNotFoundError,
  DeviceRegistrationError,
  PushSendError,
  NotificationConfigError,
  NotificationValidationError,

  // Local Storage Service
  LocalStorageServiceImpl,
  createLocalStorageService,
  createMemoryStorageService,
  getLocalStorageService,
  localStorageService,
  type LocalStorageService,

  // Local Storage Errors
  LocalStorageError,
  StorageUnavailableError,
  StorageQuotaExceededError,
  StorageOperationError,

  // Local Storage Utilities
  generateStorageKey,
  parseStorageKey,
  createNamespacedStorage,

  // Offline Queue Service
  OfflineQueueServiceImpl,
  createOfflineQueueService,
  getOfflineQueueService,
  offlineQueueService,
  type OfflineQueueService,
  type EnqueueActionInput,
  type ActionProcessor,

  // Offline Queue Errors
  OfflineQueueError,
  QueueFullError,
  ActionNotFoundError,
  ActionProcessingError,
  ActionValidationError,

  // Sync Service
  SyncServiceImpl,
  createSyncService,
  getSyncService,
  syncService,
  type SyncService,
  type SyncDataFetcher,
  type InitialSyncOptions,
  type UploadResult as SyncUploadResult,

  // Sync Errors
  SyncError,
  SyncFailedError,
  SyncInProgressError,
  ConflictResolutionError,
  InvalidSyncTokenError,

  // Sync Utilities
  mergeObjects,
  areValuesEqual,

  // Daemon Auth Service
  DaemonAuthService,
  createDaemonAuthService,
  type DaemonAuthServiceConfig,

  // Daemon Auth Errors
  DaemonAuthError,
  InvalidCredentialsError,
  TokenExpiredError,
  TokenRevokedError,
  SessionNotFoundError,
  InsufficientScopeError,

  // Daemon API Service
  DaemonApiService,
  createDaemonApiService,
  type DaemonApiServiceConfig,
  type SendMessageParams,
  type ChannelInfo,
  type UserInfo,

  // Daemon API Errors
  DaemonApiError,

  // Workflow Service
  WorkflowServiceImpl,
  createWorkflowService,
  workflowService,
  InMemoryWorkflowStorage,
  BUILT_IN_TEMPLATES,
  type WorkflowService,
  type WorkflowStorage,
  type ActionHandler,
  type WorkflowServiceConfig,

  // Workflow Errors
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowValidationError,
  WorkflowExecutionError,
  ExecutionNotFoundError,
  ActionExecutionError,
  TemplateNotFoundError,

  // Admin Service
  AdminService,
  createAdminService,
  InMemoryAdminStorage,
  type AdminStorage,
  type MemberFilters,
  type MemberUpdates,
  type AdminActionFilters,

  // Admin Errors
  AdminError,
  SettingsNotFoundError,
  RoleNotFoundError,
  SystemRoleError,
  MemberNotFoundError,
  InviteNotFoundError,
  InviteExpiredError,

  // Performance Service
  LRUCache,
  MetricsCollector,
  memoize,
  debounce,
  throttle,
  RequestDeduplicator,
  BatchProcessor,
  observePerformance,
  PerformanceService,
  performanceService,
} from './services';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Core Orchestrator types
  OrchestratorWithUser,
  OrchestratorCharter,
  OrchestratorPersonality,
  OrchestratorCommunicationPreferences,
  OrchestratorOperationalConfig,
  OrchestratorWorkHours,
  OrchestratorEscalationConfig,

  // OrchestratorInput types
  CreateVPInput,
  UpdateVPInput,

  // Service account types
  ServiceAccountCredentials,
  APIKeyGenerationResult,
  APIKeyRotationResult,
  APIKeyValidationResult,
  OrchestratorServiceAccountConfig,

  // OrchestratorQuery types
  ListVPsOptions,
  PaginatedVPResult,

  // OrchestratorEvent types
  OrchestratorEventType,
  OrchestratorEvent,

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
  OrchestratorBasic,
  CreateDisciplineInput,
  UpdateDisciplineInput,
  ListDisciplinesOptions,
  PaginatedDisciplineResult,

  // Presence types
  PresenceStatus,
  DeviceType,
  UserPresence,
  PresenceMetadata,
  OrchestratorPresence,
  DaemonInfo,
  DaemonMetrics,
  ChannelPresence,
  PresenceEventType,
  BasePresenceEvent,
  UserPresenceEvent,
  OrchestratorPresenceEvent,
  ChannelPresenceEvent,
  PresenceEvent,
  PresenceCallback,
  OrchestratorPresenceCallback,
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
  OrchestratorUnhealthyEvent,
  OrchestratorRecoveredEvent,
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
  Orchestrator,
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
  OrchestratorStatus,
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
  IntegrationSyncResult,
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

  // Search types
  SearchQuery,
  SearchFilters,
  SearchPagination,
  SearchSort,
  SearchResultType,
  SearchResult,
  SearchHighlight,
  SearchResultData,
  SearchResponse,
  SearchFacets,
  SearchIndexDocument,
  SearchSuggestion,

  // Audit types
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditLogEntry,
  AuditChange,
  AuditLogFilter,
  AuditLogPagination,
  AuditLogSort,
  AuditLogResponse,
  AuditLogExport,
  AuditLogStats,
  AuditContext,

  // Analytics types
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsQuery,
  AnalyticsPeriod,
  UsageMetrics,
  MessageMetrics,
  UserMetrics,
  ChannelMetrics,
  FileMetrics,
  CallMetrics,
  OrchestratorMetrics,
  TrendData,
  InsightReport,
  InsightHighlight,
  InsightRecommendation,
  DashboardWidget,
  WidgetType,
  WidgetConfig,
  AnalyticsDashboard,

  // Notification types
  DevicePlatform,
  NotificationType,
  NotificationPriority,
  DigestFrequency,
  DeliveryStatus,
  NotificationAction,
  PushNotification,
  PushSendResult,
  BatchResult,
  DeviceRegistration,
  Device,
  QuietHours,
  NotificationPreferences,
  UpdatePreferencesInput,
  Notification,
  CreateNotificationInput,
  NotificationListOptions,
  PaginatedNotificationResult,
  NotificationEventType,
  BaseNotificationEvent,
  NotificationCreatedEvent,
  NotificationReadEvent,
  PushSentEvent,
  NotificationEvent,
  OnNotificationCreatedCallback,
  OnNotificationReadCallback,
  OnPushSentCallback,
  WebPushConfig,
  FCMConfig,
  NotificationServiceConfig,

  // Offline types
  ActionType,
  QueuedActionStatus,
  ActionPriority,
  BaseActionPayload,
  SendMessagePayload,
  EditMessagePayload,
  DeleteMessagePayload,
  AddReactionPayload,
  RemoveReactionPayload,
  UpdateStatusPayload,
  JoinChannelPayload,
  LeaveChannelPayload,
  UploadFilePayload,
  CreateThreadPayload,
  UpdateProfilePayload,
  MarkReadPayload,
  ActionPayload,
  QueuedAction,
  QueueStatus,
  OfflineSyncResult,
  SyncFailure,
  SendMessageResult,
  EditMessageResult,
  DeleteMessageResult,
  OfflineAddReactionResult,
  RemoveReactionResult,
  UpdateStatusResult,
  JoinChannelResult,
  LeaveChannelResult,
  UploadFileResult,
  CreateThreadResult,
  UpdateProfileResult,
  MarkReadResult,
  OfflineActionResult,
  InitialSyncData,
  IncrementalSyncData,
  SyncWorkspace,
  SyncChannel,
  SyncUser,
  SyncMessage,
  SyncReaction,
  SyncMember,
  SyncFile,
  SyncPreferences,
  OfflineNotificationPreferences,
  PrivacyPreferences,
  SyncChange,
  SyncDeletion,
  SyncEntityType,
  SyncEntityData,
  SyncEntityDataType,
  SyncConflict,
  ConflictType,
  ConflictResolution,
  ResolutionStrategy,
  SyncState,
  SyncStatus,
  StaleEntity,
  StorageMetadata,
  StoredItem,
  StorageOptions,
  StorageStats,
  PruneResult,
  OfflineEventType,
  BaseOfflineEvent,
  ActionQueuedEvent,
  ActionProcessingEvent,
  ActionCompletedEvent,
  ActionFailedEvent,
  QueueEmptyEvent,
  SyncStartedEvent,
  SyncCompletedEvent,
  SyncFailedEvent,
  ConflictDetectedEvent,
  ConflictResolvedEvent,
  OnlineStatusChangedEvent,
  StorageQuotaWarningEvent,
  OfflineEvent,
  OnActionQueuedCallback,
  OnActionCompletedCallback,
  OnActionFailedCallback,
  OnSyncCompletedCallback,
  OnConflictDetectedCallback,
  OnOnlineStatusChangedCallback,
  OfflineQueueConfig,
  SyncConfig,
  LocalStorageConfig,

  // Daemon types
  DaemonScope,
  DaemonTokenType,
  DaemonToken,
  DaemonTokenPair,
  DaemonTokenPayload,
  DaemonCredentials,
  DaemonMetadata,
  DaemonAuthResult,
  DaemonRegistration,
  DaemonRegistrationCredentials,
  DaemonCredentialsWithoutSecret,
  DaemonAuthRequest,
  DaemonAuthResponse,
  DaemonRefreshRequest,
  DaemonSessionStatus,
  DaemonSession,
  DaemonConnectionStatus,
  DaemonHeartbeat,
  DaemonEventType,
  DaemonEvent,
  DaemonConfig,
  DaemonAuthErrorCode,

  // Retention types
  RetentionPolicy,
  RetentionRule,
  RetentionResourceType,
  RetentionAction,
  RetentionCondition,
  RetentionJob,
  RetentionJobStatus,
  RetentionError,
  RetentionStats,
  RetentionSchedule,
  LegalHold,
  LegalHoldScope,
  DataExport,
  DataExportScope,
  CreateRetentionPolicyInput,
  UpdateRetentionPolicyInput,
  CreateLegalHoldInput,
  RequestDataExportInput,

  // Workflow types
  WorkflowStatus,
  TriggerType,
  WorkflowActionType,
  ExecutionStatus,
  ActionResultStatus,
  TemplateCategory,
  TriggerFilter,
  MessageTriggerConfig,
  KeywordTriggerConfig,
  ScheduledTriggerConfig,
  WebhookTriggerConfig,
  ChannelTriggerConfig,
  MemberTriggerConfig,
  FileUploadTriggerConfig,
  ReactionTriggerConfig,
  OrchestratorResponseTriggerConfig,
  ManualTriggerConfig,
  TriggerConfig,
  WorkflowTrigger,
  WorkflowAttachment,
  SendMessageConfig,
  SendDMConfig,
  CreateChannelConfig,
  ChannelMemberConfig,
  AssignRoleConfig,
  SendEmailConfig,
  WebhookActionConfig,
  InvokeVPConfig,
  DelayConfig,
  ConditionConfig,
  SetVariableConfig,
  LoopConfig,
  ActionConfig,
  WorkflowAction,
  WorkflowCondition,
  WorkflowVariable,
  Workflow,
  WorkflowExecution,
  ActionResult,
  WorkflowTemplate,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ListWorkflowsOptions,
  PaginatedWorkflowResult,
  ListExecutionsOptions,
  PaginatedExecutionResult,
  ExecutionContext,

  // Admin types
  WorkspaceSettings,
  GeneralSettings,
  SecuritySettings,
  PasswordPolicy,
  MessagingSettings,
  AdminNotificationSettings,
  AdminIntegrationSettings,
  ComplianceSettings,
  DLPRule,
  BrandingSettings,
  PermissionAction,
  PermissionResource,
  Permission as AdminPermission,
  Role,
  SystemRoleName,
  MemberInfo,
  Invite,
  PlanType,
  BillingInfo,
  PlanFeatures,
  AdminAction,
  AdminActionType,
  UpdateSettingsInput,
  CreateRoleInput,
  InviteMemberInput,

  // i18n types
  SupportedLocale,
  LocaleConfig,
  NumberFormatConfig,
  TranslationNamespace,
  TranslationKey,
  InterpolationValues,
  TranslateFunction,
  I18nContext,
  LocaleSource,
  UserLocalePreferences,
  AccessibilityPreferences,
  KeyboardNavigationConfig,
  LiveRegionConfig,

  // Performance types
  CacheConfig,
  CacheEntry,
  CacheStats,
  MetricType,
  PerformanceMetric,
  CoreWebVitals,
  PerformanceRating,
  BundleAnalysis,
  ChunkInfo,
  ModuleInfo,
  ResourceTiming,
  NavigationTiming,
  MemoryUsage,
  RenderMetrics,
  QueryMetrics,
  ApiMetrics,
  PerformanceBudget,
  OptimizationSuggestion,
  PrefetchStrategy,
  LazyLoadConfig,
  ImageOptimizationConfig,
  CodeSplittingConfig,
  CacheStrategy,
  ServiceWorkerConfig,
  RuntimeCacheRule,
  DeduplicationConfig,
  RateLimitConfig,
  VirtualizationConfig,
  MemoizationConfig,

  // Testing types
  TestEnvironment,
  TestStatus,
  TestPriority,
  TestMetadata,
  TestResult,
  TestError,
  AssertionResult,
  TestSuite,
  TestRun,
  TestSummary,
  CoverageReport,
  CoverageMetric,
  MockConfig,
  MockCall,
  MockInstance,
  Fixture,
  FactoryFunction,
  Seeder,
  TestDatabase,
  MockServer,
  MockResponse,
  MockServerVerification,
  TestPage,
  WaitOptions,
  TestLocator,
  PerformanceTestConfig,
  PerformanceThreshold,
  LoadStage,
  PerformanceTestMetrics,
  MetricSummary,
  DocCategory,
  DocPage,
  ApiDoc,
  ApiEndpoint,
  ApiParameter,
  ApiRequestBody,
  ApiMediaType,
  ApiResponse,
  ApiSchema,
  ApiSchemaRef,
  ApiExample,
  ApiAuthentication,
  OAuthFlows,
  OAuthFlow,
  CodeExample,
  ComponentDoc,
  PropDoc,
  AccessibilityDoc,
  ChangelogEntry,
} from './types';

export {
  // OrchestratorType guards
  isVPCharter,
  isOrchestratorServiceAccountConfig,

  // OrchestratorConstants
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

  // Search Type guards
  isSearchResultType,
  isValidSearchQuery,
  isMessageSearchResult,
  isFileSearchResult,
  isChannelSearchResult,
  isUserSearchResult,
  isVPSearchResult,

  // Search Constants
  DEFAULT_SEARCH_PAGINATION,
  MAX_SEARCH_LIMIT,
  DEFAULT_SEARCH_SORT,
  SEARCH_RESULT_TYPES,
  SEARCH_CACHE_TTL,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,

  // Notification Type guards
  isDevicePlatform,
  isNotificationType,
  isDigestFrequency,
  isNotificationPreferences,
  isDeviceRegistration,
  isPushNotification,
  isCreateNotificationInput,

  // Notification Constants
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_LIST_OPTIONS,
  MAX_NOTIFICATION_LIMIT,
  DEFAULT_PUSH_TTL,
  MAX_DEVICES_PER_USER,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_TO_PREFERENCE,

  // Offline Type guards
  isQueuedAction,
  isSyncConflict,
  isActionType,
  isSyncStatus,
  isSendMessagePayload,

  // Offline utilities
  calculateRetryDelay,
  isOrderDependentAction,
  getDefaultPriority,

  // Offline Constants
  DEFAULT_OFFLINE_QUEUE_CONFIG,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_LOCAL_STORAGE_CONFIG,

  // Daemon Type guards
  isDaemonScope,
  isDaemonToken,
  isDaemonSession,
  isDaemonEvent,

  // Daemon Constants
  DAEMON_SCOPE_SETS,
  DAEMON_TOKEN_EXPIRY,
  DAEMON_REDIS_KEYS,

  // Audit Type guards
  isAuditAction,
  isAuditSeverity,
  isAuditCategory,
  isAuditLogEntry,

  // Audit Constants
  CRITICAL_ACTIONS,
  WARNING_ACTIONS,
  DEFAULT_AUDIT_RETENTION_DAYS,
  DEFAULT_AUDIT_BATCH_SIZE,
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,

  // Retention Type guards
  isRetentionResourceType,
  isRetentionAction,
  isRetentionJobStatus,
  isRetentionPolicy,
  isLegalHold,

  // Retention Constants
  DEFAULT_RETENTION_CONFIG,
  RETENTION_RESOURCE_NAMES,
  RETENTION_ACTION_NAMES,

  // Analytics Type guards
  isAnalyticsEventType,
  isAnalyticsPeriod,
  isTrendData,
  isAnalyticsQuery,

  // Analytics Constants
  DEFAULT_ANALYTICS_QUERY,
  ANALYTICS_REDIS_KEYS,
  DEFAULT_ANALYTICS_BATCH_SIZE,
  DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_REDIS_TTL_SECONDS,
  ANALYTICS_EVENT_CATEGORIES,

  // Workflow Type guards
  isWorkflowStatus,
  isTriggerType,
  isWorkflowActionType,
  isExecutionStatus,
  isTemplateCategory,
  isWorkflow,
  isWorkflowExecution,
  isValidCreateWorkflowInput,

  // Workflow Constants
  DEFAULT_WORKFLOW_LIST_OPTIONS,
  DEFAULT_EXECUTION_LIST_OPTIONS,
  MAX_WORKFLOW_NAME_LENGTH,
  MAX_WORKFLOW_DESCRIPTION_LENGTH,
  MAX_ACTIONS_PER_WORKFLOW,
  DEFAULT_MAX_LOOP_ITERATIONS,
  DEFAULT_DELAY_DURATION_MS,
  MAX_WEBHOOK_TIMEOUT_MS,
  TRIGGER_TYPES,
  ACTION_TYPES,
  TEMPLATE_CATEGORIES,

  // Admin Constants
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_MESSAGING_SETTINGS,
  ADMIN_DEFAULT_NOTIFICATION_SETTINGS,
  ADMIN_DEFAULT_INTEGRATION_SETTINGS,
  DEFAULT_COMPLIANCE_SETTINGS,
  DEFAULT_BRANDING_SETTINGS,
  PLAN_FEATURES,
  SYSTEM_ROLES,

  // i18n Constants
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_ACCESSIBILITY_PREFERENCES,

  // Performance Constants
  WEB_VITALS_THRESHOLDS,
  DEFAULT_PERFORMANCE_BUDGETS,

  // Testing Constants
  DEFAULT_TEST_TIMEOUT,
  DEFAULT_TEST_RETRIES,
  DEFAULT_COVERAGE_THRESHOLDS,
  DEFAULT_PERFORMANCE_THRESHOLDS,
} from './types';

// =============================================================================
// Error Exports
// =============================================================================

export {
  // Base error
  GenesisError,

  // Orchestrator errors
  OrchestratorNotFoundError,
  OrchestratorAlreadyExistsError,
  OrchestratorValidationError,
  OrchestratorOperationNotPermittedError,
  OrchestratorInvalidStateError,

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
  generateOrchestratorEmail,

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
  // Permission enum and utilities (Permission is already exported as RolePermission above)
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
// Testing Utilities
// =============================================================================

export {
  // Mock utilities
  createMock,
  createSpy,
  createFixture,
  createFactory,
  generateMany,
  createSeeder,

  // Test factories
  userFactory,
  workspaceFactory,
  channelFactory,
  messageFactory,
  vpFactory,

  // Async utilities
  waitFor,
  wait,

  // Mock servers and databases
  createMockServer,
  createTestDatabase,

  // Assertion utilities
  assert,

  // Test context
  createTestContext,
  cleanupTestContext,
  type TestContext,
} from './testing';

// =============================================================================
// Version
// =============================================================================

/**
 * Package version
 */
export const VERSION = '0.1.0';
