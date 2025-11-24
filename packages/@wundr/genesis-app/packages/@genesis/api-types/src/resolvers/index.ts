/**
 * GraphQL Resolvers Index
 *
 * Exports all resolver modules for the Genesis API.
 * These resolvers can be used with @graphql-tools/schema or Apollo Server.
 *
 * @module @genesis/api-types/resolvers
 */

// =============================================================================
// VP RESOLVERS
// =============================================================================

export {
  vpResolvers,
  vpQueries,
  vpMutations,
  vpSubscriptions,
  VPFieldResolvers,
  VP_STATUS_CHANGED,
  VPStatus,
  type VPStatusType,
  type GraphQLContext,
  type VPService,
} from './vp-resolvers.js';

// =============================================================================
// MESSAGE RESOLVERS
// =============================================================================

export {
  messageResolvers,
  messageQueries,
  messageMutations,
  messageSubscriptions,
  MessageFieldResolvers,
  MESSAGE_CREATED,
  MESSAGE_UPDATED,
  MESSAGE_DELETED,
  REACTION_CHANGED,
  THREAD_UPDATED,
  MessageType,
  type MessageTypeValue,
  type MessageService,
} from './message-resolvers.js';

// =============================================================================
// ORGANIZATION RESOLVERS
// =============================================================================

export {
  organizationResolvers,
  organizationQueries,
  organizationMutations,
  OrganizationFieldResolvers,
  OrganizationRole,
  type OrganizationRoleType,
} from './organization-resolvers.js';

// =============================================================================
// WORKSPACE RESOLVERS
// =============================================================================

export {
  workspaceResolvers,
  workspaceQueries,
  workspaceMutations,
  WorkspaceFieldResolvers,
  WorkspaceRole,
  WorkspaceVisibility,
  type WorkspaceRoleType,
  type WorkspaceVisibilityType,
} from './workspace-resolvers.js';

// =============================================================================
// CHANNEL RESOLVERS
// =============================================================================

export {
  channelResolvers,
  channelQueries,
  channelMutations,
  channelSubscriptions,
  ChannelFieldResolvers,
  ChannelType,
  ChannelRole,
  CHANNEL_CREATED,
  CHANNEL_UPDATED,
  CHANNEL_DELETED,
  MEMBER_JOINED,
  MEMBER_LEFT,
  type ChannelTypeValue,
  type ChannelRoleType,
} from './channel-resolvers.js';

// =============================================================================
// DISCIPLINE RESOLVERS
// =============================================================================

export {
  disciplineResolvers,
  disciplineQueries,
  disciplineMutations,
  DisciplineFieldResolvers,
} from './discipline-resolvers.js';

// =============================================================================
// PRESENCE RESOLVERS
// =============================================================================

export {
  presenceResolvers,
  presenceQueries,
  presenceMutations,
  presenceSubscriptions,
  PresenceFieldResolvers,
  VPPresenceFieldResolvers,
  USER_PRESENCE_CHANGED,
  CHANNEL_PRESENCE_CHANGED,
  VP_PRESENCE_CHANGED,
  PRESENCE_JOIN,
  PRESENCE_LEAVE,
  PresenceStatus,
  VPPresenceStatus,
  type PresenceStatusType,
  type VPPresenceStatusType,
  type UserPresence,
  type VPPresence,
  type ChannelPresence,
  type PresenceService,
} from './presence-resolvers.js';

// =============================================================================
// RE-EXPORT DEFAULTS
// =============================================================================

export { default as vpResolversDefault } from './vp-resolvers.js';
export { default as messageResolversDefault } from './message-resolvers.js';
export { default as organizationResolversDefault } from './organization-resolvers.js';
export { default as workspaceResolversDefault } from './workspace-resolvers.js';
export { default as channelResolversDefault } from './channel-resolvers.js';
export { default as disciplineResolversDefault } from './discipline-resolvers.js';
export { default as presenceResolversDefault } from './presence-resolvers.js';

// =============================================================================
// FILE RESOLVERS
// =============================================================================

export {
  fileResolvers,
  fileQueries,
  fileMutations,
  fileSubscriptions,
  FileFieldResolvers,
  FILE_UPLOADED,
  UPLOAD_PROGRESS,
  FileType,
  UploadStatus,
  type FileTypeValue,
  type UploadStatusValue,
  type StorageService,
  type ImageService,
  type GraphQLContext as FileGraphQLContext,
} from './file-resolvers.js';

export { default as fileResolversDefault } from './file-resolvers.js';

// =============================================================================
// PROCESSING RESOLVERS
// =============================================================================

export {
  processingResolvers,
  processingQueries,
  processingMutations,
  processingSubscriptions,
  ProcessingJobFieldResolvers,
  PROCESSING_JOB_UPDATED,
  FILE_PROCESSING_COMPLETE,
  ProcessingStatus,
  ProcessingJobType,
  type ProcessingStatusValue,
  type ProcessingJobTypeValue,
  type ProcessingJob,
  type ProcessingResult,
  type ProcessingError,
  type QueueStats,
  type ProcessingService,
  type GraphQLContext as ProcessingGraphQLContext,
} from './processing-resolvers.js';

export { default as processingResolversDefault } from './processing-resolvers.js';

// =============================================================================
// CALL RESOLVERS
// =============================================================================

export {
  callResolvers,
  callQueries,
  callMutations,
  callSubscriptions,
  CallFieldResolvers,
  HuddleFieldResolvers,
  CALL_STARTED,
  CALL_ENDED,
  PARTICIPANT_JOINED,
  PARTICIPANT_LEFT,
  PARTICIPANT_UPDATED,
  HUDDLE_UPDATED,
  RECORDING_STATUS_CHANGED,
  type CallService,
  type GraphQLContext as CallGraphQLContext,
} from './call-resolvers.js';

export { default as callResolversDefault } from './call-resolvers.js';

// =============================================================================
// NOTIFICATION RESOLVERS
// =============================================================================

export {
  notificationResolvers,
  notificationQueries,
  notificationMutations,
  notificationSubscriptions,
  NotificationFieldResolvers,
  PushDeviceFieldResolvers,
  NOTIFICATION_RECEIVED,
  SYNC_REQUIRED,
  NotificationType,
  DevicePlatform,
  SyncType,
  ConflictResolution,
  QueuedActionStatus,
  type NotificationTypeValue,
  type DevicePlatformType,
  type SyncTypeValue,
  type ConflictResolutionType,
  type QueuedActionStatusType,
  type NotificationService,
  type GraphQLContext as NotificationGraphQLContext,
} from './notification-resolvers.js';

export { default as notificationResolversDefault } from './notification-resolvers.js';

// =============================================================================
// SEARCH RESOLVERS
// =============================================================================

export {
  searchResolvers,
  searchQueries,
  SearchResultFieldResolvers,
  searchTypeDefs,
  SearchResultType,
  type SearchResultTypeValue,
  type SearchGraphQLContext,
} from './search-resolvers.js';

export { default as searchResolversDefault } from './search-resolvers.js';

// =============================================================================
// AUDIT RESOLVERS
// =============================================================================

export {
  auditResolvers,
  auditQueries,
  auditMutations,
  AuditLogEntryFieldResolvers,
  auditTypeDefs,
  AuditCategory,
  AuditSeverity,
  ExportStatus,
  type AuditCategoryValue,
  type AuditSeverityValue,
  type ExportStatusValue,
  type AuditGraphQLContext,
} from './audit-resolvers.js';

export { default as auditResolversDefault } from './audit-resolvers.js';

// =============================================================================
// RETENTION RESOLVERS
// =============================================================================

export {
  retentionResolvers,
  retentionQueries,
  retentionMutations,
  RetentionPolicyFieldResolvers,
  LegalHoldFieldResolvers,
  retentionTypeDefs,
  RetentionResourceType,
  RetentionAction,
  RetentionJobStatus,
  type RetentionResourceTypeValue,
  type RetentionActionValue,
  type RetentionJobStatusValue,
  type RetentionGraphQLContext,
} from './retention-resolvers.js';

export { default as retentionResolversDefault } from './retention-resolvers.js';

// =============================================================================
// DAEMON RESOLVERS
// =============================================================================

export {
  daemonResolvers,
  daemonQueries,
  daemonMutations,
  daemonSubscriptions,
  DaemonCredentialFieldResolvers,
  daemonTypeDefs,
  createDaemonResolvers,
  DaemonStatus,
  DAEMON_STATUS_CHANGED,
  DAEMON_METRICS_UPDATED,
  type DaemonStatusType,
  type DaemonResolverContext,
} from './daemon-resolvers.js';

export { default as daemonResolversDefault } from './daemon-resolvers.js';

// =============================================================================
// ANALYTICS RESOLVERS
// =============================================================================

export {
  analyticsResolvers,
  analyticsQueries,
  analyticsMutations,
  analyticsSubscriptions,
  UsageMetricsFieldResolvers,
  InsightReportFieldResolvers,
  TrendDataFieldResolvers,
  InsightHighlightFieldResolvers,
  InsightRecommendationFieldResolvers,
  analyticsTypeDefs,
  createAnalyticsResolvers,
  AnalyticsPeriod,
  TrendDirection,
  HighlightType,
  RecommendationPriority,
  type AnalyticsPeriodValue,
  type TrendDirectionValue,
  type HighlightTypeValue,
  type RecommendationPriorityValue,
  type AnalyticsResolverContext,
  type AnalyticsGraphQLContext,
  type AnalyticsServiceInterface,
} from './analytics-resolvers.js';

export { default as analyticsResolversDefault } from './analytics-resolvers.js';

// =============================================================================
// INTEGRATION RESOLVERS
// =============================================================================

export {
  integrationResolvers,
  integrationQueries,
  integrationMutations,
  integrationSubscriptions,
  IntegrationConfigFieldResolvers,
  WebhookConfigFieldResolvers,
  WebhookDeliveryFieldResolvers,
  integrationTypeDefs,
  createIntegrationResolvers,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationPermission,
  WebhookEvent,
  WebhookStatus,
  DeliveryStatus,
  INTEGRATION_STATUS_CHANGED,
  WEBHOOK_DELIVERED,
  type IntegrationProviderValue,
  type IntegrationStatusValue,
  type IntegrationPermissionValue,
  type WebhookEventValue,
  type WebhookStatusValue,
  type DeliveryStatusValue,
  type IntegrationService,
  type GraphQLContext as IntegrationGraphQLContext,
} from './integration-resolvers.js';

export { default as integrationResolversDefault } from './integration-resolvers.js';
