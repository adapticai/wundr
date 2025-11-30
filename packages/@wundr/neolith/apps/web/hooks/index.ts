/**
 * @neolith/hooks - React Hooks for Genesis Application
 *
 * This module exports all React hooks used throughout the Genesis application.
 * Hooks are organized by domain (auth, admin, chat, etc.) and provide
 * a consistent interface for state management and API interactions.
 *
 * @packageDocumentation
 * @module @neolith/hooks
 *
 * @example
 * ```typescript
 * // Import specific hooks
 * import { useAuth, useMessages, useNotifications } from '@/hooks';
 *
 * // Use in a component
 * function MyComponent() {
 *   const { user, isAuthenticated } = useAuth();
 *   const { messages, isLoading } = useMessages(channelId);
 *   const { notifications, unreadCount } = useNotifications();
 *   // ...
 * }
 * ```
 */

// =============================================================================
// Auth Hooks
// =============================================================================
export { useAuth } from './use-auth';
export type { AuthUser, UseAuthReturn } from './use-auth';

// =============================================================================
// Admin Hooks
// =============================================================================
export {
  useMembers,
  useRoles,
  useInvites,
  useWorkspaceSettings,
  useBilling,
  useAdminActivity,
} from './use-admin';
export type {
  Member,
  MemberStatus,
  Role,
  Invite,
  InviteStatus,
  WorkspaceSettings,
  WorkspaceVisibility,
  NotificationDefaults,
  BillingInfo,
  BillingPlan,
  BillingStatus,
  Invoice,
  InvoiceStatus,
  AdminAction,
  AdminActionType,
  UseMembersOptions,
  UseMembersReturn,
  UseRolesReturn,
  UseInvitesReturn,
  UseWorkspaceSettingsReturn,
  UseBillingReturn,
  UseAdminActivityOptions,
  UseAdminActivityReturn,
} from './use-admin';

// =============================================================================
// OrchestratorHooks
// =============================================================================
export { useOrchestrator, useOrchestrators, useOrchestratorMutations } from './use-orchestrator';
export type {
  UseOrchestratorReturn,
  UseOrchestratorsReturn,
  UseOrchestratorMutationsReturn,
} from './use-orchestrator';

export { useOrchestratorPresence, useMultipleOrchestratorPresence } from './use-orchestrator-presence';
export type {
  OrchestratorPresenceData,
  UseOrchestratorPresenceOptions,
  UseOrchestratorPresenceReturn,
} from './use-orchestrator-presence';

export { useOrchestratorTasks } from './use-orchestrator-tasks';
export type {
  OrchestratorTask,
  OrchestratorTaskMetrics,
  UseOrchestratorTasksOptions,
  UseOrchestratorTasksReturn,
} from './use-orchestrator-tasks';

// =============================================================================
// Budget Hooks
// =============================================================================
export {
  useBudget,
  useUsageHistory,
  useBudgetAlerts,
  useBudgetMutations,
} from './use-budget';
export type {
  BudgetLimits,
  BudgetStatus,
  UsageHistoryPoint,
  HistoryParams,
  AlertSeverity,
  BudgetAlert,
  AlertConfig,
  UseBudgetReturn,
  UseUsageHistoryReturn,
  UseBudgetAlertsReturn,
  UseBudgetMutationsReturn,
} from './use-budget';

// =============================================================================
// Chat Hooks
// =============================================================================
export {
  useMessages,
  useThread,
  useSendMessage,
  useReactions,
  useTypingIndicator,
  useChannel,
  useMentionSuggestions,
} from './use-chat';
export type {
  UseMessagesReturn,
  UseThreadReturn,
  UseSendMessageReturn,
  UseReactionsReturn,
  UseTypingIndicatorReturn,
  UseChatChannelReturn,
  UseMentionSuggestionsReturn,
} from './use-chat';

// =============================================================================
// Channel Hooks
// =============================================================================
export {
  useChannels,
  useChannel as useChannelDetails,
  useChannelMembers,
  useChannelMutations,
  useChannelPermissions,
  useDirectMessages,
  useWorkspaceUsers,
} from './use-channel';
export type {
  UseChannelsReturn,
  UseChannelReturn,
  UseChannelMembersReturn,
  UseChannelMutationsReturn,
  UseChannelPermissionsReturn,
  UseDirectMessagesReturn,
  UseWorkspaceUsersReturn,
} from './use-channel';

// =============================================================================
// Upload Hooks
// =============================================================================
export { useFileUpload, useSignedUpload, useChannelFiles } from './use-upload';
export type {
  UseFileUploadReturn,
  UseSignedUploadReturn,
  UseChannelFilesReturn,
} from './use-upload';

// =============================================================================
// Call Hooks
// =============================================================================
export { useCall, useLocalMedia, useHuddle, useCallDuration } from './use-call';
export type {
  UseCallReturn,
  UseLocalMediaReturn,
  UseHuddleReturn,
  UseCallDurationReturn,
} from './use-call';

// =============================================================================
// Notification Hooks
// =============================================================================
export {
  useNotifications,
  usePushNotifications,
  useOfflineStatus,
  useNotificationSettings,
} from './use-notifications';
export type {
  UseNotificationsReturn,
  UsePushNotificationsReturn,
  UseOfflineStatusReturn,
  UseNotificationSettingsReturn,
} from './use-notifications';

// =============================================================================
// Analytics Hooks
// =============================================================================
export { useAnalytics, useMetrics, useRealTimeStats } from './use-analytics';
export type {
  AnalyticsEvent,
  AnalyticsEventData,
  UseAnalyticsReturn,
  UsageMetrics,
  MessageMetrics,
  UserMetrics,
  ChannelMetrics,
  FileMetrics,
  OrchestratorMetrics,
  OrchestratorActivity,
  UseMetricsReturn,
  RealTimeStats,
  RealTimeStatsData,
  UseRealTimeStatsReturn,
} from './use-analytics';

// =============================================================================
// Dashboard Hooks
// =============================================================================
export { useDashboard, useDashboardStats, useDashboardActivity } from './use-dashboard';
export type {
  TimeRange,
  ActivityType,
  MemberStats,
  ChannelStats,
  MessageStats,
  WorkflowStats,
  TaskStats,
  RecentActivity,
  TopContributor,
  DashboardStats,
  DashboardStatsResponse,
  ActivityActor,
  ActivityTarget,
  ActivityEntry,
  ActivityPagination,
  WorkspaceInfo,
  DashboardActivityResponse,
  DashboardStatsOptions,
  DashboardActivityOptions,
  UseDashboardStatsReturn,
  UseDashboardActivityReturn,
  UseDashboardReturn,
} from './use-dashboard';

// =============================================================================
// Integration Hooks
// =============================================================================
export {
  useIntegrations,
  useIntegration,
  useIntegrationMutations,
  useWebhooks,
  useWebhook,
  useWebhookDeliveries,
  // Re-export types (these are already exported directly from use-integrations.ts)
  type UseIntegrationsReturn,
  type UseIntegrationReturn,
  type UseIntegrationMutationsReturn,
  type UseWebhooksReturn,
  type UseWebhookReturn,
  type UseWebhookDeliveriesReturn,
} from './use-integrations';

// =============================================================================
// Workflow Hooks
// =============================================================================
export {
  useWorkflows,
  useWorkflow,
  useWorkflowExecutions,
  useWorkflowTemplates,
  useWorkflowBuilder,
} from './use-workflows';
export type {
  UseWorkflowsReturn,
  UseWorkflowReturn,
  UseWorkflowExecutionsReturn,
  UseWorkflowTemplatesReturn,
  UseWorkflowBuilderReturn,
} from './use-workflows';

// =============================================================================
// Presence Hooks
// =============================================================================
export {
  useUserPresence,
  useMultiplePresence,
  useChannelPresence,
  useSetStatus,
  useOrchestratorHealth,
  useOrchestratorHealthList,
  usePresenceHeartbeat,
  usePresenceSubscription,
} from './use-presence';
export type {
  UserPresence,
  OrchestratorHealthStatus,
  UseUserPresenceReturn,
  UseMultiplePresenceReturn,
  UseChannelPresenceReturn,
  UseSetStatusReturn,
  UseOrchestratorHealthReturn,
  UseOrchestratorHealthListReturn,
  UsePresenceSubscriptionReturn,
} from './use-presence';

// =============================================================================
// Performance Hooks
// =============================================================================
export {
  useRenderMetrics,
  useWebVitals,
  useConnectionAware,
  useLazyLoad,
  useDeferredLoad,
  useMemoryAware,
  usePerformanceMark,
  useDebouncedValue,
  useThrottledCallback,
  useVirtualizedData,
} from './use-performance';
export type {
  RenderMetrics,
  UseWebVitalsReturn,
  UseConnectionAwareReturn,
  UseLazyLoadReturn,
  UseDeferredLoadReturn,
  UseDeferredLoadOptions,
  UseVirtualizedDataReturn,
  UseVirtualizedDataOptions,
  VirtualizedItem,
  ConnectionInfo,
  EffectiveConnectionType,
  PerformanceRating,
  CoreWebVitals,
} from './use-performance';

// =============================================================================
// i18n Hooks
// =============================================================================
export { I18nProvider, useI18n, useTranslation } from './use-i18n';
export type { UseI18nReturn, UseTranslationReturn } from './use-i18n';

// =============================================================================
// Desktop Notifications Hooks
// =============================================================================
export {
  useDesktopNotifications,
  useNotificationOnCondition,
  useNotificationBadge,
} from './use-desktop-notifications';
export type {
  NotificationPermission,
  DesktopNotificationOptions,
  UseDesktopNotificationsReturn,
} from './use-desktop-notifications';

// =============================================================================
// Re-exports from next-auth/react for convenience
// =============================================================================
export { signIn, signOut, useSession } from 'next-auth/react';
