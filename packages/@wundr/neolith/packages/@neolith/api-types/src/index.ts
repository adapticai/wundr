/**
 * @genesis/api-types
 *
 * Shared GraphQL types and TypeScript definitions for the Genesis application.
 *
 * This package provides:
 * - Generated TypeScript types from GraphQL schema
 * - Generated React Apollo hooks for GraphQL operations
 * - Manual utility types and type guards
 *
 * @example
 * ```typescript
 * import {
 *   User,
 *   Workspace,
 *   UserRole,
 *   useGetUserQuery,
 *   ApiResponse,
 *   isDefined
 * } from '@genesis/api-types';
 * ```
 */

// =============================================================================
// GENERATED TYPES (from GraphQL schema)
// =============================================================================

// Export generated types, excluding ones that are redefined elsewhere
// to avoid duplicate export errors (WorkspaceVisibility, DateTime, JSON, UUID, InputMaybe)
export {
  // Utility types
  type Maybe,
  type Exact,
  type MakeOptional,
  type MakeMaybe,
  type MakeEmpty,
  type Incremental,
  // Scalar types (BigInt only - others defined below)
  type BigInt,
  // Core entity types
  type User,
  type Workspace,
  type WorkspaceSettings,
  type WorkspaceMember,
  type PageInfo,
  type Error,
  type HealthStatus,
  type ServiceHealth,
  // Enum types (excluding WorkspaceVisibility which is defined below)
  // Export both value and type together using single export
  UserRole,
  UserStatus,
  WorkspaceMemberRole,
  ServiceStatus,
  WorkspaceMembershipEventType,
  // Input types
  type UserFilterInput,
  type CreateUserInput,
  type UpdateUserInput,
  type WorkspaceFilterInput,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type WorkspaceSettingsInput,
  type AddWorkspaceMemberInput,
  // Connection types
  type UserConnection,
  type UserEdge,
  type WorkspaceConnection,
  type WorkspaceEdge,
  type WorkspaceMemberConnection,
  type WorkspaceMemberEdge,
  // Payload types
  type CreateUserPayload,
  type UpdateUserPayload,
  type DeleteUserPayload,
  type CreateWorkspacePayload,
  type UpdateWorkspacePayload,
  type DeleteWorkspacePayload,
  type AddWorkspaceMemberPayload,
  type RemoveWorkspaceMemberPayload,
  type WorkspaceMembershipEvent,
  // Query/Mutation/Subscription types
  type Query,
  type QueryUserArgs,
  type QueryUsersArgs,
  type QueryWorkspaceArgs,
  type QueryWorkspacesArgs,
  type Mutation,
  type MutationCreateUserArgs,
  type MutationUpdateUserArgs,
  type MutationDeleteUserArgs,
  type MutationCreateWorkspaceArgs,
  type MutationUpdateWorkspaceArgs,
  type MutationDeleteWorkspaceArgs,
  type MutationAddWorkspaceMemberArgs,
  type MutationRemoveWorkspaceMemberArgs,
  type Subscription,
  type SubscriptionUserUpdatedArgs,
  type SubscriptionWorkspaceUpdatedArgs,
  type SubscriptionWorkspaceMembershipChangedArgs,
} from './generated/types.js';

// Export operation types (queries, mutations, subscriptions)
export * from './generated/operations.js';

// Export React Apollo hooks
export * from './generated/hooks.js';

// =============================================================================
// MANUAL TYPES
// =============================================================================

// Export all manual TypeScript types and utilities
export * from './manual-types.js';

// =============================================================================
// SCALAR TYPES (canonical definitions)
// =============================================================================

// Define canonical scalar types to avoid conflicts
export type DateTime = string;
export type JSON = Record<string, unknown>;
export type UUID = string;
export type InputMaybe<T> = T | null | undefined;

// =============================================================================
// VP TYPES
// =============================================================================

// Export VP-specific type definitions (canonical source for VPStatus, VPPresenceStatus)
export * from './types/vp.js';

// Export VP GraphQL input types
export * from './types/vp-inputs.js';

// =============================================================================
// MESSAGE TYPES
// =============================================================================

// Export message-specific type definitions
export * from './types/message.js';

// =============================================================================
// CALL TYPES
// =============================================================================

// Export call-specific type definitions (voice/video calls, huddles)
export * from './types/call.js';

// =============================================================================
// RESOLVERS
// =============================================================================

// Export GraphQL resolvers for server-side use
// Note: VPStatus, VPPresenceStatus, and WorkspaceVisibility are excluded here
// as they are already exported from ./types/vp.js and defined locally below
export {
  // VP Resolvers
  vpResolvers,
  vpQueries,
  vpMutations,
  vpSubscriptions,
  VPFieldResolvers,
  VP_STATUS_CHANGED,
  // VPStatus is already exported from ./types/vp.js
  type VPStatusType,
  type GraphQLContext,
  type VPService,
  vpResolversDefault,
  // Message Resolvers
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
  messageResolversDefault,
  // Organization Resolvers
  organizationResolvers,
  organizationQueries,
  organizationMutations,
  OrganizationFieldResolvers,
  OrganizationRole,
  type OrganizationRoleType,
  organizationResolversDefault,
  // Workspace Resolvers
  workspaceResolvers,
  workspaceQueries,
  workspaceMutations,
  WorkspaceFieldResolvers,
  WorkspaceRole,
  // WorkspaceVisibility is defined locally below
  type WorkspaceRoleType,
  type WorkspaceVisibilityType,
  workspaceResolversDefault,
  // Channel Resolvers
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
  channelResolversDefault,
  // Discipline Resolvers
  disciplineResolvers,
  disciplineQueries,
  disciplineMutations,
  DisciplineFieldResolvers,
  disciplineResolversDefault,
  // Presence Resolvers
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
  // VPPresenceStatus is already exported from ./types/vp.js
  type PresenceStatusType,
  type VPPresenceStatusType,
  type UserPresence,
  type VPPresence,
  type ChannelPresence,
  type PresenceService,
  presenceResolversDefault,
  // File Resolvers
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
  type FileGraphQLContext,
  fileResolversDefault,
  // Processing Resolvers
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
  type ProcessingGraphQLContext,
  processingResolversDefault,
  // Call Resolvers
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
  type CallGraphQLContext,
  callResolversDefault,
  // Notification Resolvers
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
  type NotificationGraphQLContext,
  notificationResolversDefault,
  // Search Resolvers
  searchResolvers,
  searchQueries,
  SearchResultFieldResolvers,
  searchTypeDefs,
  SearchResultType,
  type SearchResultTypeValue,
  type SearchGraphQLContext,
  searchResolversDefault,
  // Audit Resolvers
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
  auditResolversDefault,
  // Retention Resolvers
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
  retentionResolversDefault,
  // Daemon Resolvers
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
  daemonResolversDefault,
  // Analytics Resolvers
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
  analyticsResolversDefault,
  // Integration Resolvers
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
  type IntegrationGraphQLContext,
  integrationResolversDefault,
  // Workflow Resolvers
  workflowResolvers,
  workflowQueries,
  workflowMutations,
  workflowSubscriptions,
  WorkflowFieldResolvers,
  WorkflowExecutionFieldResolvers,
  WorkflowTemplateFieldResolvers,
  workflowTypeDefs,
  createWorkflowResolvers,
  WorkflowStatus,
  TriggerType,
  ActionType,
  ExecutionStatus,
  ActionResultStatus,
  ErrorBehavior,
  TemplateCategory,
  WORKFLOW_EXECUTION_UPDATED,
  WORKFLOW_STATUS_CHANGED,
  type WorkflowStatusValue,
  type TriggerTypeValue,
  type ActionTypeValue,
  type ExecutionStatusValue,
  type ActionResultStatusValue,
  type ErrorBehaviorValue,
  type TemplateCategoryValue,
  type WorkflowService,
  type WorkflowGraphQLContext,
  workflowResolversDefault,
  // Admin Resolvers
  adminResolvers,
  adminQueries,
  adminMutations,
  adminSubscriptions,
  RoleFieldResolvers,
  MemberInfoFieldResolvers,
  InviteFieldResolvers,
  AdminActionFieldResolvers,
  adminTypeDefs,
  createAdminResolvers,
  MemberStatus,
  InviteStatus,
  PlanType,
  BillingStatus,
  PermissionResource,
  PermissionAction,
  AdminActionType,
  MEMBER_STATUS_CHANGED,
  SETTINGS_UPDATED,
  type MemberStatusType,
  type InviteStatusType,
  type PlanTypeValue,
  type BillingStatusValue,
  type PermissionResourceType,
  type PermissionActionType,
  type AdminActionTypeValue,
  type AdminGraphQLContext,
  adminResolversDefault,
} from './resolvers/index.js';

// =============================================================================
// WORKSPACE VISIBILITY (canonical definition)
// =============================================================================

// Export canonical WorkspaceVisibility to avoid conflicts with generated types
export const WorkspaceVisibility = {
  Public: 'PUBLIC',
  Private: 'PRIVATE',
  Restricted: 'RESTRICTED',
} as const;

export type WorkspaceVisibility = (typeof WorkspaceVisibility)[keyof typeof WorkspaceVisibility];
