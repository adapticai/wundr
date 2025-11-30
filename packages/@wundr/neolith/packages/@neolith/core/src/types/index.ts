/**
 * @genesis/core - Type Definitions
 *
 * Central export for all type definitions used by the core service layer.
 *
 * @packageDocumentation
 */

// =============================================================================
// OrchestratorTypes
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

  // Input types
  CreateOrchestratorInput,
  UpdateOrchestratorInput,

  // Service account types
  ServiceAccountCredentials,
  APIKeyGenerationResult,
  APIKeyRotationResult,
  APIKeyValidationResult,
  OrchestratorServiceAccountConfig,

  // Query types
  ListOrchestratorsOptions,
  PaginatedOrchestratorResult,

  // Event types
  OrchestratorEventType,
  OrchestratorEvent,

  // Utility types
  SlugOptions,
} from './orchestrator';

export {
  // Type guards
  isOrchestratorCharter,
  isOrchestratorServiceAccountConfig,

  // Constants
  DEFAULT_ORCHESTRATOR_CHARTER,
} from './orchestrator';

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
  OrchestratorBasic,
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
  OrchestratorUnhealthyEvent,
  OrchestratorRecoveredEvent,

  // Callback types
  OnOrchestratorUnhealthyCallback,
  OnOrchestratorRecoveredCallback,
  OnDaemonRegisteredCallback,
  OnDaemonUnregisteredCallback,
} from './heartbeat';

// Backward compatibility aliases for heartbeat callbacks
export type {
  OnOrchestratorUnhealthyCallback as OnVPUnhealthyCallback,
  OnOrchestratorRecoveredCallback as OnVPRecoveredCallback,
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
  OrchestratorPresence,
  DaemonInfo,
  DaemonMetrics,
  ChannelPresence,

  // Event types
  PresenceEventType,
  BasePresenceEvent,
  UserPresenceEvent,
  OrchestratorPresenceEvent,
  ChannelPresenceEvent,
  PresenceEvent,

  // Callback types
  PresenceCallback,
  OrchestratorPresenceCallback,
  ChannelPresenceCallback,
  UnsubscribeFunction,

  // Configuration types
  PresenceConfig,

  // Backward compatibility aliases
  VPPresenceCallback,
  VPPresenceEvent,
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
// Image Types
// =============================================================================

export type {
  // Core image types
  ImageFormat,
  ThumbnailSize,
  ResizeFit,
  ImagePosition,

  // Option types
  ResizeOptions,
  OptimizeOptions,
  CropOptions,
  VariantConfig,

  // Input/Output types
  ImageInput,
  ImageVariant,
  ProcessedImage,

  // Metadata types
  ImageMetadata,
  ExifData,

  // Upload pipeline types
  ImageUploadInput,
  ImageUploadResult,

  // Validation types
  ImageValidationResult,
  ImageValidationOptions,
} from './image';

export {
  // Type guards
  isImageFormat,
  isThumbnailSize,
  isResizeOptions,
  isOptimizeOptions,
  isCropOptions,
  isImageMetadata,
  isVariantConfig,

  // Constants
  THUMBNAIL_SIZES,
  DEFAULT_QUALITY,
  IMAGE_MIME_TYPES,
  MIME_TO_FORMAT,
  DEFAULT_VALIDATION_OPTIONS,
  DEFAULT_OPTIMIZE_OPTIONS,
  DEFAULT_VARIANTS,
} from './image';

// =============================================================================
// Storage Types
// =============================================================================

export type {
  // Provider types
  StorageProvider,
  StorageACL,

  // Configuration types
  StorageConfig,
  StorageCredentials,

  // Upload types
  UploadInput,
  UploadOptions,
  BufferUploadOptions,
  UploadResult,

  // Download types
  FileStream,
  UrlOptions,
  SignedUrlOptions,
  SignedUploadUrl,

  // Metadata types
  FileMetadata,
  ListOptions,
  FileListResult,

  // File record types
  CreateFileRecordInput,
  UpdateFileRecordInput,
  FileRecordWithRelations,
  FileRecordListOptions,
  PaginatedFileRecordResult,

  // Key generation types
  KeyGenerationOptions,
} from './storage';

export {
  // Type guards
  isStorageProvider,
  isStorageACL,
  isStorageConfig,
  isUploadInput,

  // Constants
  DEFAULT_STORAGE_CONFIG,
  FILE_SIZE_LIMITS,
  MIME_TYPE_CATEGORIES,

  // Utility functions
  getFileCategory,
  getMaxFileSizeForType,
  getExtensionFromMimeType,
  getMimeTypeFromExtension,
} from './storage';

// =============================================================================
// LiveKit Types
// =============================================================================

export type {
  // Room types
  CreateRoomOptions,
  Room,
  UpdateRoomOptions,

  // Token types
  TrackSource,
  TokenOptions,
  TokenGenerationResult,

  // Participant types
  ParticipantState,
  TrackType,
  Track,
  Participant,
  ConnectionQuality,
  ListParticipantsOptions,

  // Recording types
  RecordingDestination,
  RecordingOptions,
  RecordingPreset,
  S3RecordingConfig,
  GCPRecordingConfig,
  AzureRecordingConfig,
  RecordingStatus,
  Recording,

  // Configuration types
  LiveKitConfig,

  // Event types
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
} from './livekit';

export {
  // Type guards
  isTrackType,
  isParticipantState,
  isRecordingStatus,
  isTrackSource,
  isCreateRoomOptions,
  isLiveKitConfig,

  // Constants
  DEFAULT_LIVEKIT_CONFIG,
  DEFAULT_TOKEN_OPTIONS,
  HOST_TOKEN_OPTIONS,
  GUEST_TOKEN_OPTIONS,
  VIEWER_TOKEN_OPTIONS,
  RECORDING_PRESETS,
} from './livekit';

// =============================================================================
// Notification Types
// =============================================================================

export type {
  // Core notification types
  DevicePlatform,
  NotificationType,
  NotificationPriority,
  DigestFrequency,
  DeliveryStatus,

  // Push notification types
  NotificationAction,
  PushNotification,
  PushSendResult,
  BatchResult,

  // Device types
  DeviceRegistration,
  Device,

  // Preference types
  QuietHours,
  NotificationPreferences,
  UpdatePreferencesInput,

  // In-app notification types
  Notification,
  CreateNotificationInput,
  NotificationListOptions,
  PaginatedNotificationResult,

  // Event types
  NotificationEventType,
  BaseNotificationEvent,
  NotificationCreatedEvent,
  NotificationReadEvent,
  PushSentEvent,
  NotificationEvent,

  // Callback types
  OnNotificationCreatedCallback,
  OnNotificationReadCallback,
  OnPushSentCallback,

  // Configuration types
  WebPushConfig,
  FCMConfig,
  NotificationServiceConfig,
} from './notification';

export {
  // Type guards
  isDevicePlatform,
  isNotificationType,
  isDigestFrequency,
  isNotificationPreferences,
  isDeviceRegistration,
  isPushNotification,
  isCreateNotificationInput,

  // Constants
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_LIST_OPTIONS,
  MAX_NOTIFICATION_LIMIT,
  DEFAULT_PUSH_TTL,
  MAX_DEVICES_PER_USER,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_TO_PREFERENCE,
} from './notification';

// =============================================================================
// Re-export Database Types
// =============================================================================

// Re-export commonly used database types for convenience
export type {
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
} from '@neolith/database';

// =============================================================================
// Offline Types
// =============================================================================

export type {
  // Action types
  ActionType,
  QueuedActionStatus,
  ActionPriority,

  // Payload types
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

  // Queue types
  QueuedAction,
  QueueStatus,
  SyncResult as OfflineSyncResult,
  SyncFailure,

  // Action result types
  SendMessageResult,
  EditMessageResult,
  DeleteMessageResult,
  AddReactionResult as OfflineAddReactionResult,
  RemoveReactionResult,
  UpdateStatusResult,
  JoinChannelResult,
  LeaveChannelResult,
  UploadFileResult,
  CreateThreadResult,
  UpdateProfileResult,
  MarkReadResult,
  ActionResult as OfflineActionResult,

  // Sync data types
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
  NotificationPreferences as OfflineNotificationPreferences,
  PrivacyPreferences,
  SyncChange,
  SyncDeletion,
  SyncEntityType,
  SyncEntityData,
  SyncEntityDataType,

  // Conflict types
  SyncConflict,
  ConflictType,
  ConflictResolution,
  ResolutionStrategy,

  // Sync state types
  SyncState,
  SyncStatus,
  StaleEntity,

  // Storage types
  StorageMetadata,
  StoredItem,
  StorageOptions,
  StorageStats,
  PruneResult,

  // Event types
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

  // Callback types
  OnActionQueuedCallback,
  OnActionCompletedCallback,
  OnActionFailedCallback,
  OnSyncCompletedCallback,
  OnConflictDetectedCallback,
  OnOnlineStatusChangedCallback,

  // Configuration types
  OfflineQueueConfig,
  SyncConfig,
  LocalStorageConfig,
} from './offline';

export {
  // Type guards
  isQueuedAction,
  isSyncConflict,
  isActionType,
  isSyncStatus,
  isSendMessagePayload,

  // Utility functions
  calculateRetryDelay,
  isOrderDependentAction,
  getDefaultPriority,

  // Default configurations
  DEFAULT_OFFLINE_QUEUE_CONFIG,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_LOCAL_STORAGE_CONFIG,
} from './offline';

// =============================================================================
// Audit Types
// =============================================================================

export type {
  // Core audit types
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditLogEntry,
  AuditChange,

  // Query types
  AuditLogFilter,
  AuditLogPagination,
  AuditLogSort,
  AuditLogResponse,

  // Export types
  AuditLogExport,

  // Stats types
  AuditLogStats,

  // Context types
  AuditContext,
} from './audit';

export {
  // Type guards
  isAuditAction,
  isAuditSeverity,
  isAuditCategory,
  isAuditLogEntry,

  // Constants
  CRITICAL_ACTIONS,
  WARNING_ACTIONS,
  DEFAULT_AUDIT_RETENTION_DAYS,
  DEFAULT_AUDIT_BATCH_SIZE,
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,
} from './audit';

// =============================================================================
// Retention Types
// =============================================================================

export type {
  // Core retention types
  RetentionPolicy,
  RetentionRule,
  RetentionResourceType,
  RetentionAction,
  RetentionCondition,

  // Job types
  RetentionJob,
  RetentionJobStatus,
  RetentionError,

  // Statistics types
  RetentionStats,
  RetentionSchedule,

  // Legal hold types
  LegalHold,
  LegalHoldScope,

  // Data export types
  DataExport,
  DataExportScope,

  // Input types
  CreateRetentionPolicyInput,
  UpdateRetentionPolicyInput,
  CreateLegalHoldInput,
  RequestDataExportInput,
} from './retention';

export {
  // Type guards
  isRetentionResourceType,
  isRetentionAction,
  isRetentionJobStatus,
  isRetentionPolicy,
  isLegalHold,

  // Constants
  DEFAULT_RETENTION_CONFIG,
  RETENTION_RESOURCE_NAMES,
  RETENTION_ACTION_NAMES,
} from './retention';

// =============================================================================
// Search Types
// =============================================================================

export type {
  // Query types
  SearchQuery,
  SearchFilters,
  SearchPagination,
  SearchSort,

  // Result types
  SearchResultType,
  SearchResult,
  SearchHighlight,
  SearchResultData,
  MessageSearchResult,
  FileSearchResult,
  ChannelSearchResult,
  UserSearchResult,
  OrchestratorSearchResult,

  // Response types
  SearchResponse,
  SearchFacets,
  FacetBucket,

  // Index types
  SearchIndexDocument,
  SearchSuggestion,
} from './search';

export {
  // Type guards
  isMessageSearchResult,
  isFileSearchResult,
  isChannelSearchResult,
  isUserSearchResult,
  isVPSearchResult,
  isSearchResultType,
  isValidSearchQuery,

  // Constants
  DEFAULT_SEARCH_PAGINATION,
  MAX_SEARCH_LIMIT,
  DEFAULT_SEARCH_SORT,
  SEARCH_RESULT_TYPES,
  SEARCH_CACHE_TTL,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
} from './search';

// =============================================================================
// Daemon Types
// =============================================================================

export type {
  // Scope types
  DaemonScope,

  // Token types
  DaemonTokenType,
  DaemonToken,
  DaemonTokenPair,
  DaemonTokenPayload,

  // Credential types
  DaemonCredentials,
  DaemonMetadata,
  DaemonAuthResult,
  DaemonRegistration,
  DaemonRegistrationCredentials,
  DaemonCredentialsWithoutSecret,

  // Auth request/response types
  DaemonAuthRequest,
  DaemonAuthResponse,
  DaemonRefreshRequest,

  // Session types
  DaemonSessionStatus,
  DaemonSession,
  DaemonConnectionStatus,
  DaemonHeartbeat,

  // Event types
  DaemonEventType,
  DaemonEvent,

  // Config types
  DaemonConfig,

  // Metrics types (note: DaemonMetrics is exported from presence types above)

  // Error types
  DaemonAuthErrorCode,
} from './daemon';

export {
  // Type guards
  isDaemonScope,
  isDaemonToken,
  isDaemonSession,
  isDaemonEvent,

  // Constants
  DAEMON_SCOPE_SETS,
  DAEMON_TOKEN_EXPIRY,
  DAEMON_REDIS_KEYS,
} from './daemon';

// =============================================================================
// Analytics Types
// =============================================================================

export type {
  // Core analytics types
  AnalyticsEvent,
  AnalyticsEventType,
  UsageMetrics,
  MessageMetrics,
  UserMetrics,
  ChannelMetrics,
  FileMetrics,
  CallMetrics,
  OrchestratorMetrics,

  // Query types
  AnalyticsPeriod,
  AnalyticsQuery,

  // Dashboard types
  DashboardWidget,
  WidgetType,
  WidgetConfig,
  AnalyticsDashboard,

  // Trend types
  TrendData,

  // Insight types
  InsightReport,
  InsightHighlight,
  InsightRecommendation,
} from './analytics';

export {
  // Type guards
  isAnalyticsEventType,
  isAnalyticsPeriod,
  isTrendData,
  isAnalyticsQuery,

  // Constants
  DEFAULT_ANALYTICS_QUERY,
  ANALYTICS_REDIS_KEYS,
  DEFAULT_ANALYTICS_BATCH_SIZE,
  DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_REDIS_TTL_SECONDS,
  ANALYTICS_EVENT_CATEGORIES,
} from './analytics';

// =============================================================================
// Integration Types
// =============================================================================

export type {
  // Provider types
  IntegrationProvider,
  IntegrationStatus,
  IntegrationPermission,

  // OAuth types
  OAuthToken,

  // Configuration types
  IntegrationConfig,
  IntegrationSettings,
  KnownIntegrationSettings,
  CustomIntegrationConfig,

  // Webhook types
  WebhookConfig,
  WebhookEvent,
  WebhookRetryPolicy,
  WebhookDelivery,
  WebhookAttempt,

  // Webhook payload types
  BaseWebhookPayload,
  MessageWebhookPayload,
  ChannelWebhookPayload,
  MemberWebhookPayload,
  FileWebhookPayload,
  CallWebhookPayload,
  OrchestratorWebhookPayload,
  WebhookPayload,

  // Integration event types
  IntegrationEvent,
  SyncResult as IntegrationSyncResult,
  BaseIntegrationEventPayload,
  SlackEventPayload,
  GitHubEventPayload,
  JiraEventPayload,
  GenericIntegrationEventPayload,
  IntegrationEventPayload,

  // Provider-specific configs
  SlackIntegrationConfig,
  GitHubIntegrationConfig,
  JiraIntegrationConfig,

  // Input types
  CreateIntegrationInput,
  UpdateIntegrationInput,
  CreateWebhookInput,
  UpdateWebhookInput,

  // List options types
  ListIntegrationsOptions,
  ListWebhooksOptions,
  ListDeliveriesOptions,

  // Paginated result types
  PaginatedIntegrationResult,
  PaginatedWebhookResult,
  PaginatedDeliveryResult,

  // Connection test types
  ConnectionTestResult,
  ConnectionTestDetails,
} from './integration';

export {
  // Type guards
  isIntegrationProvider,
  isIntegrationStatus,
  isWebhookEvent,
  isIntegrationPermission,
  isIntegrationConfig,
  isWebhookConfig,
  isWebhookRetryPolicy,
  isValidCreateIntegrationInput,
  isValidCreateWebhookInput,

  // Constants
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
  WEBHOOK_EVENTS,
  INTEGRATION_PERMISSIONS,
  DEFAULT_WEBHOOK_RETRY_POLICY,
} from './integration';

// =============================================================================
// Workflow Types
// =============================================================================

export type {
  // Core workflow types
  WorkflowStatus,
  TriggerType,
  ActionType as WorkflowActionType,
  ExecutionStatus,
  ActionResultStatus,
  TemplateCategory,

  // Trigger types
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

  // Action types
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

  // Variable types
  WorkflowVariable,

  // Main workflow types
  Workflow,
  WorkflowExecution,
  ActionResult,
  WorkflowTemplate,

  // Input types
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ListWorkflowsOptions,
  PaginatedWorkflowResult,
  ListExecutionsOptions,
  PaginatedExecutionResult,
  ExecutionContext,
} from './workflow';

export {
  // Type guards
  isWorkflowStatus,
  isTriggerType,
  isActionType as isWorkflowActionType,
  isExecutionStatus,
  isTemplateCategory,
  isWorkflow,
  isWorkflowExecution,
  isValidCreateWorkflowInput,

  // Constants
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
} from './workflow';

// =============================================================================
// Admin Types
// =============================================================================

export type {
  // Settings types
  WorkspaceSettings,
  GeneralSettings,
  SecuritySettings,
  PasswordPolicy,
  MessagingSettings,
  NotificationSettings as AdminNotificationSettings,
  IntegrationSettings as AdminIntegrationSettings,
  ComplianceSettings,
  DLPRule,
  BrandingSettings,

  // Role and permission types
  PermissionAction,
  PermissionResource,
  Permission,
  Role,
  SystemRoleName,

  // Member types
  MemberInfo,
  Invite,

  // Billing types
  PlanType,
  BillingInfo,
  PlanFeatures,

  // Admin action types
  AdminAction,
  AdminActionType,

  // Input types
  UpdateSettingsInput,
  CreateRoleInput,
  InviteMemberInput,
} from './admin';

export {
  // Default settings
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_MESSAGING_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS as ADMIN_DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_INTEGRATION_SETTINGS as ADMIN_DEFAULT_INTEGRATION_SETTINGS,
  DEFAULT_COMPLIANCE_SETTINGS,
  DEFAULT_BRANDING_SETTINGS,

  // Plan features
  PLAN_FEATURES,

  // System roles
  SYSTEM_ROLES,
} from './admin';

// =============================================================================
// i18n Types
// =============================================================================

export type {
  // Locale types
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

  // Accessibility types
  AccessibilityPreferences,
  KeyboardNavigationConfig,
  LiveRegionConfig,
} from './i18n';

export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
} from './i18n';

// =============================================================================
// Performance Types
// =============================================================================

export type {
  // Cache types
  CacheConfig,
  CacheEntry,
  CacheStats,

  // Metric types
  MetricType,
  PerformanceMetric,
  CoreWebVitals,
  PerformanceRating,

  // Bundle types
  BundleAnalysis,
  ChunkInfo,
  ModuleInfo,

  // Timing types
  ResourceTiming,
  NavigationTiming,
  MemoryUsage,

  // Component metrics
  RenderMetrics,
  QueryMetrics,
  ApiMetrics,

  // Budget types
  PerformanceBudget,
  OptimizationSuggestion,

  // Strategy types
  PrefetchStrategy,
  LazyLoadConfig,
  ImageOptimizationConfig,
  CodeSplittingConfig,
  CacheStrategy,
  ServiceWorkerConfig,
  RuntimeCacheRule,

  // Config types
  DeduplicationConfig,
  RateLimitConfig,
  VirtualizationConfig,
  MemoizationConfig,
} from './performance';

export {
  WEB_VITALS_THRESHOLDS,
  DEFAULT_PERFORMANCE_BUDGETS,
} from './performance';

// =============================================================================
// Testing Types
// =============================================================================

export type {
  // Environment types
  TestEnvironment,
  TestStatus,
  TestPriority,

  // Test metadata
  TestMetadata,
  TestResult,
  TestError,
  AssertionResult,
  TestSuite,
  TestRun,
  TestSummary,

  // Coverage types
  CoverageReport,
  CoverageMetric,

  // Mock types
  MockConfig,
  MockCall,
  MockInstance,
  Fixture,
  FactoryFunction,
  Seeder,

  // Database types
  TestDatabase,
  MockServer,
  MockResponse,
  MockServerVerification,

  // E2E types
  TestPage,
  WaitOptions,
  TestLocator,

  // Performance test types
  PerformanceTestConfig,
  PerformanceThreshold,
  LoadStage,
  PerformanceTestMetrics,
  MetricSummary,

  // Documentation types
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
} from './testing';

export {
  DEFAULT_TEST_TIMEOUT,
  DEFAULT_TEST_RETRIES,
  DEFAULT_COVERAGE_THRESHOLDS,
  DEFAULT_PERFORMANCE_THRESHOLDS,
} from './testing';

// =============================================================================
// Agent Enums
// =============================================================================

export type {
  AgentStatus,
  AgentScope,
} from './agent-enums';

export {
  isAgentStatus,
  isAgentScope,
} from './agent-enums';

// =============================================================================
// Session Manager Types
// =============================================================================

export type {
  // Core Session Manager types
  SessionManager,
  SessionManagerWithRelations,
  SessionManagerLimits,
  SessionManagerGlobalConfig,
  SessionManagerWorktreeConfig,

  // Input types
  CreateSessionManagerInput,
  UpdateSessionManagerInput,

  // Query types
  ListSessionManagersOptions,
  PaginatedSessionManagerResult,

  // Re-export enums from session-manager (for backward compatibility)
  AgentStatus as SessionManagerAgentStatus,
  AgentScope as SessionManagerAgentScope,
} from './session-manager';

export {
  // Type guards
  isSessionManager,
} from './session-manager';

// =============================================================================
// Subagent Types
// =============================================================================

export type {
  // Core Subagent types
  Subagent,
  SubagentWithRelations,

  // CRUD Input types
  CreateSubagentInput,
  UpdateSubagentInput,
  ListSubagentsOptions,
  PaginatedSubagentResult,
} from './subagent';

export {
  // Type guards
  isSubagent,

  // Constants
  UNIVERSAL_SUBAGENTS,
} from './subagent';

// =============================================================================
// Charter Types
// =============================================================================

export type {
  // Core charter types
  OrchestratorCapability,
  CharterIdentity,
  CharterResourceLimits,
  CharterObjectives,
  CharterConstraints,
  GovernanceCharter,

  // Charter versioning types
  CharterVersion,
  CreateCharterVersionInput,
  CharterDiff,
} from './charter';

export {
  // Default constants
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_OBJECTIVES,
  DEFAULT_CONSTRAINTS,
} from './charter';

// =============================================================================
// Health Dashboard Types
// =============================================================================

export type {
  // System overview types
  SystemOverview,
  TokenUsageOverview,

  // Orchestrator status types
  OrchestratorHealthStatus,

  // Metrics types
  TimeSeriesMetric,
  LatencyMetrics,
  MetricsChartData,

  // Alert types
  HealthAlertType,
  AlertSeverity,
  HealthAlert,

  // Dashboard state types
  DashboardConfig,
  HealthDashboardState,

  // Health check types
  HealthCheckResult,

  // Query types
  MetricsPeriod,
  MetricsQuery,
} from './health-dashboard';
