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
  UseWorkflowsOptions,
  UseWorkflowsReturn,
  UseWorkflowReturn,
  UseWorkflowExecutionsOptions,
  UseWorkflowExecutionsReturn,
  UseWorkflowTemplatesReturn,
  UseWorkflowBuilderReturn,
} from './use-workflows';

export { useWorkflowExecution } from './use-workflow-execution';
export type {
  ExecutionProgress,
  UseWorkflowExecutionOptions,
  UseWorkflowExecutionReturn,
} from './use-workflow-execution';

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
export {
  useOrchestrator,
  useOrchestrators,
  useOrchestratorMutations,
} from './use-orchestrator';
export type {
  UseOrchestratorReturn,
  UseOrchestratorsReturn,
  UseOrchestratorMutationsReturn,
} from './use-orchestrator';

export {
  useOrchestratorPresence,
  useMultipleOrchestratorPresence,
} from './use-orchestrator-presence';
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
// Daemon Hooks
// =============================================================================
export { useDaemon, useSessionMonitor } from './use-daemon';
export type {
  UseDaemonState,
  UseDaemonActions,
  UseDaemonStreamHandlers,
  UseDaemonOptions,
  UseDaemonReturn,
} from './use-daemon';

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
  AlertSeverity as BudgetAlertSeverity,
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

// Enhanced Analytics Hooks
export { useAnalyticsData, useAnalyticsComparison } from './use-analytics-data';
export type {
  AnalyticsTimeRange,
  AnalyticsGranularity,
  TimeSeriesPoint,
  OrchestratorActivityMetrics,
  ChannelEngagementMetrics,
  TaskMetricsBreakdown,
  WorkflowMetricsBreakdown,
  AnalyticsSummary,
  AnalyticsData,
  AnalyticsQueryParams,
  AnalyticsComparison,
  UseAnalyticsDataReturn,
  UseAnalyticsComparisonReturn,
  UseAnalyticsDataOptions,
} from './use-analytics-data';

// Report Hooks
export {
  useInsightReport,
  useSummaryReport,
  useDetailedReport,
  useReportGeneration,
} from './use-reports';
export type {
  ReportType,
  ReportFormat,
  ReportPeriod,
  Insight,
  TrendDataPoint,
  TrendAnalysis,
  PerformanceMetrics,
  InsightReport,
  SummaryReport,
  DetailedReport,
  ReportGenerationOptions,
  ReportExportOptions,
  ReportGenerationStatus,
  UseInsightReportReturn,
  UseSummaryReportReturn,
  UseDetailedReportReturn,
  UseReportGenerationReturn,
} from './use-reports';

// Real-time Metrics Hooks
export {
  useRealTimeMetrics,
  useUsageMetrics,
  useHealthMetrics,
  usePerformanceMetrics,
  useCustomMetric,
} from './use-metrics-realtime';
export type {
  MetricUpdate,
  RealTimeMetrics,
  UsageMetrics as RealTimeUsageMetrics,
  HealthMetrics,
  PerformanceMetrics as RealTimePerformanceMetrics,
  CustomMetric,
  UseRealTimeMetricsReturn,
  UseUsageMetricsReturn,
  UseHealthMetricsReturn,
  UsePerformanceMetricsReturn,
  UseCustomMetricReturn,
  UseRealTimeMetricsOptions,
} from './use-metrics-realtime';

// =============================================================================
// Dashboard Hooks
// =============================================================================
export {
  useDashboard,
  useDashboardStats,
  useDashboardActivity,
} from './use-dashboard';
export type {
  TimeRange as DashboardTimeRange,
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
// Presence Hooks
// =============================================================================
export {
  useUserPresence,
  useMultiplePresence,
  useChannelPresence,
  useSetStatus,
  useOrchestratorHealth,
  useWorkspaceOrchestratorHealthList,
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
  UseWorkspaceOrchestratorHealthListReturn,
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
// Health Dashboard Hooks
// =============================================================================
export {
  useHealthDashboard,
  useOrchestratorHealthList,
  useMetricsChart,
  useHealthAlerts,
} from './use-health-dashboard';
export type {
  HealthStatus,
  HealthAlertSeverity,
  HealthTimeRange,
  SystemHealthOverview,
  OrchestratorHealth,
  PaginationMetadata,
  OrchestratorHealthFilters,
  MetricDataPoint,
  ChartDataPoint,
  HealthAlert,
  UseHealthDashboardReturn,
  UseOrchestratorHealthListReturn,
  UseMetricsChartReturn,
  UseHealthAlertsReturn,
} from './use-health-dashboard';

// =============================================================================
// Security Hooks
// =============================================================================
export { useSessions } from './use-sessions';
export type { UseSessionsReturn } from './use-sessions';

export { useConnectedAccounts } from './use-connected-accounts';
export type {
  ConnectedAccount,
  UseConnectedAccountsReturn,
} from './use-connected-accounts';

export { useLoginHistory } from './use-login-history';
export type { UseLoginHistoryReturn } from './use-login-history';

export { useSecurityAudit } from './use-security-audit';
export type { UseSecurityAuditReturn } from './use-security-audit';

export { useSecurityQuestions } from './use-security-questions';
export type { UseSecurityQuestionsReturn } from './use-security-questions';

export { useRecoveryOptions } from './use-recovery-options';
export type { UseRecoveryOptionsReturn } from './use-recovery-options';

// =============================================================================
// AI Assistant Hooks
// =============================================================================
export { useAIChat } from './use-ai-chat';
export type {
  AIError,
  AIProvider,
  MessageStatus,
  LocalAIMessage,
  TokenUsage,
  ChatSession,
  UseAIChatOptions,
  UseAIChatReturn,
} from './use-ai-chat';

export { useAIStream } from './use-ai-stream';
export type {
  StreamStatus,
  StreamEventType,
  StreamEvent,
  StreamChunk,
  StreamError,
  UseAIStreamOptions,
  UseAIStreamReturn,
} from './use-ai-stream';

export { useAISuggestions } from './use-ai-suggestions';
export type {
  SuggestionSource,
  SuggestionPriority,
  Suggestion,
  SuggestionCategory,
  SuggestionContext,
  UseAISuggestionsOptions,
  UseAISuggestionsReturn,
} from './use-ai-suggestions';

export { useAIHistory } from './use-ai-history';
export type {
  Conversation,
  HistoryFilters,
  PaginationOptions,
  ExportFormat,
  ExportedConversation,
  UseAIHistoryOptions,
  UseAIHistoryReturn,
} from './use-ai-history';

export { useAIContext } from './use-ai-context';
export type {
  ContextSource,
  ContextPriority,
  ContextItem,
  InjectionStrategy,
  ContextConfig,
  WorkspaceContext,
  UserContext,
  SessionContext,
  UseAIContextOptions,
  UseAIContextReturn,
} from './use-ai-context';

export { useAIWizardChat } from './use-ai-wizard-chat';

// =============================================================================
// Settings Hooks
// =============================================================================
export {
  useUserSettings,
  useSettingsUpdate,
  useNotificationPreferences,
  useThemeSettings,
  usePrivacySettings,
  useAccessibilitySettings,
  useSecuritySettings,
  useBillingInfo,
  useSettingsSync,
  useSettingsValidation,
} from './settings';
export type {
  UseUserSettingsOptions,
  UseUserSettingsReturn,
  UseSettingsUpdateOptions,
  UseSettingsUpdateReturn,
  UseNotificationPreferencesReturn,
  UseThemeSettingsReturn,
  ResolvedTheme,
  UsePrivacySettingsReturn,
  UseAccessibilitySettingsReturn,
  UseSecuritySettingsReturn,
  SessionInfo,
  TwoFactorStatus,
  SecuritySettings,
  UseBillingInfoReturn,
  SubscriptionPlan,
  SubscriptionStatus,
  PaymentMethod,
  Invoice as BillingInvoice,
  SubscriptionInfo,
  BillingInfo as UserBillingInfo,
  UseSettingsSyncOptions,
  UseSettingsSyncReturn,
  UseSettingsValidationOptions,
  UseSettingsValidationReturn,
  ValidationError,
  ValidationResult,
} from './settings';

// =============================================================================
// Re-exports from next-auth/react for convenience
// =============================================================================
export { signIn, signOut, useSession } from 'next-auth/react';
