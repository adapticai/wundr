/**
 * @fileoverview Analytics types for usage tracking and insights
 */

/**
 * Analytics event data that can contain various typed properties.
 * Use specific typed fields for known data structures.
 */
export interface AnalyticsEventData {
  /** Message ID for message-related events */
  messageId?: string;
  /** Channel ID for channel-related events */
  channelId?: string;
  /** User ID for user-related events */
  userId?: string;
  /** File ID for file-related events */
  fileId?: string;
  /** Call ID for call-related events */
  callId?: string;
  /** OrchestratorID for VP-related events */
  vpId?: string;
  /** Search query for search events */
  query?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** File size in bytes */
  fileSize?: number;
  /** MIME type */
  mimeType?: string;
  /** Reaction emoji */
  emoji?: string;
  /** Thread ID for thread-related events */
  threadId?: string;
  /** Number of participants */
  participantCount?: number;
  /** Additional string properties */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Analytics event metadata containing client information.
 */
export interface AnalyticsEventMetadata {
  /** Browser/client user agent string */
  userAgent?: string;
  /** Client IP address (anonymized if applicable) */
  ipAddress?: string;
  /** Platform identifier (web, ios, android, desktop) */
  platform?: 'web' | 'ios' | 'android' | 'desktop' | string;
  /** Application version string */
  version?: string;
  /** Device type */
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  /** Operating system */
  os?: string;
  /** Browser name */
  browser?: string;
  /** Screen resolution */
  screenResolution?: string;
  /** Timezone offset in minutes */
  timezoneOffset?: number;
}

/**
 * Analytics event representing a tracked user or system action.
 */
export interface AnalyticsEvent {
  /** Unique event identifier */
  id: string;
  /** Workspace where the event occurred */
  workspaceId: string;
  /** User who triggered the event (if applicable) */
  userId?: string;
  /** Orchestrator that triggered the event (if applicable) */
  orchestratorId?: string;
  /** Type of analytics event */
  eventType: AnalyticsEventType;
  /** Event-specific data with typed properties */
  eventData: AnalyticsEventData;
  /** Session identifier for grouping related events */
  sessionId?: string;
  /** When the event occurred */
  timestamp: Date;
  /** Client metadata */
  metadata?: AnalyticsEventMetadata;
}

export type AnalyticsEventType =
  | 'message.sent'
  | 'message.received'
  | 'message.edited'
  | 'message.deleted'
  | 'reaction.added'
  | 'thread.created'
  | 'file.uploaded'
  | 'file.downloaded'
  | 'channel.created'
  | 'channel.joined'
  | 'channel.left'
  | 'call.started'
  | 'call.joined'
  | 'call.ended'
  | 'vp.message.sent'
  | 'vp.message.received'
  | 'vp.task.completed'
  | 'search.performed'
  | 'user.active'
  | 'user.login'
  | 'user.logout';

export interface UsageMetrics {
  workspaceId: string;
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;
  messages: MessageMetrics;
  users: UserMetrics;
  channels: ChannelMetrics;
  files: FileMetrics;
  calls: CallMetrics;
  orchestrator: OrchestratorMetrics;
}

export interface MessageMetrics {
  total: number;
  byDay: Array<{ date: string; count: number }>;
  byChannel: Array<{ channelId: string; channelName: string; count: number }>;
  byUser: Array<{ userId: string; userName: string; count: number }>;
  averagePerDay: number;
  threadsCreated: number;
  reactionsAdded: number;
}

export interface UserMetrics {
  totalMembers: number;
  activeUsers: number;
  newUsers: number;
  dailyActiveUsers: Array<{ date: string; count: number }>;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  topContributors: Array<{ userId: string; userName: string; messageCount: number }>;
}

export interface ChannelMetrics {
  total: number;
  public: number;
  private: number;
  newChannels: number;
  mostActive: Array<{ channelId: string; channelName: string; messageCount: number; memberCount: number }>;
  averageMessagesPerChannel: number;
}

export interface FileMetrics {
  totalUploaded: number;
  totalSize: number;
  byType: Array<{ type: string; count: number; size: number }>;
  topUploaders: Array<{ userId: string; userName: string; count: number; size: number }>;
  averageSizeBytes: number;
}

export interface CallMetrics {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  averageParticipants: number;
  byDay: Array<{ date: string; count: number; duration: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

export interface OrchestratorMetrics {
  totalOrchestrators: number;
  activeOrchestrators: number;
  messagesSent: number;
  messagesReceived: number;
  tasksCompleted: number;
  averageResponseTime: number;
  byOrchestrator: Array<{
    orchestratorId: string;
    orchestratorName: string;
    discipline: string;
    messagesSent: number;
    tasksCompleted: number;
  }>;
}

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface AnalyticsQuery {
  workspaceId: string;
  period: AnalyticsPeriod;
  startDate?: Date;
  endDate?: Date;
  metrics?: string[];
  groupBy?: 'day' | 'week' | 'month';
  filters?: {
    channelIds?: string[];
    userIds?: string[];
    orchestratorIds?: string[];
    eventTypes?: AnalyticsEventType[];
  };
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: { x: number; y: number; w: number; h: number };
}

export type WidgetType =
  | 'metric_card'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'table'
  | 'leaderboard'
  | 'activity_feed';

/**
 * Widget filter configuration for dashboard widgets.
 */
export interface WidgetFilters {
  /** Filter by channel IDs */
  channelIds?: string[];
  /** Filter by user IDs */
  userIds?: string[];
  /** Filter by OrchestratorIDs */
  orchestratorIds?: string[];
  /** Filter by event types */
  eventTypes?: AnalyticsEventType[];
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Include only specific message types */
  messageTypes?: string[];
  /** Include only specific file types */
  fileTypes?: string[];
}

/**
 * Configuration for a dashboard widget.
 */
export interface WidgetConfig {
  /** Primary metric to display */
  metric?: string;
  /** Comparison period for trend analysis */
  comparison?: 'previous_period' | 'previous_year';
  /** Field to group results by */
  groupBy?: string;
  /** Maximum number of items to display */
  limit?: number;
  /** Widget-specific filters */
  filters?: WidgetFilters;
}

export interface AnalyticsDashboard {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface InsightReport {
  id: string;
  workspaceId: string;
  period: AnalyticsPeriod;
  generatedAt: Date;
  highlights: InsightHighlight[];
  recommendations: InsightRecommendation[];
}

export interface InsightHighlight {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  metric: string;
  value: number;
  change?: TrendData;
}

export interface InsightRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionUrl?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if value is a valid AnalyticsEventType
 */
export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  const validTypes: AnalyticsEventType[] = [
    'message.sent',
    'message.received',
    'message.edited',
    'message.deleted',
    'reaction.added',
    'thread.created',
    'file.uploaded',
    'file.downloaded',
    'channel.created',
    'channel.joined',
    'channel.left',
    'call.started',
    'call.joined',
    'call.ended',
    'vp.message.sent',
    'vp.message.received',
    'vp.task.completed',
    'search.performed',
    'user.active',
    'user.login',
    'user.logout',
  ];
  return typeof value === 'string' && validTypes.includes(value as AnalyticsEventType);
}

/**
 * Type guard to check if value is a valid AnalyticsPeriod
 */
export function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
  const validPeriods: AnalyticsPeriod[] = ['day', 'week', 'month', 'quarter', 'year', 'custom'];
  return typeof value === 'string' && validPeriods.includes(value as AnalyticsPeriod);
}

/**
 * Type guard to check if value is a valid TrendData
 */
export function isTrendData(value: unknown): value is TrendData {
  if (typeof value !== 'object' || value === null) {
return false;
}
  const t = value as TrendData;
  return (
    typeof t.current === 'number' &&
    typeof t.previous === 'number' &&
    typeof t.change === 'number' &&
    typeof t.changePercent === 'number' &&
    ['up', 'down', 'stable'].includes(t.trend)
  );
}

/**
 * Type guard to check if value is a valid AnalyticsQuery
 */
export function isAnalyticsQuery(value: unknown): value is AnalyticsQuery {
  if (typeof value !== 'object' || value === null) {
return false;
}
  const q = value as AnalyticsQuery;
  return typeof q.workspaceId === 'string' && isAnalyticsPeriod(q.period);
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default analytics query configuration
 */
export const DEFAULT_ANALYTICS_QUERY: Partial<AnalyticsQuery> = {
  period: 'week',
  groupBy: 'day',
};

/**
 * Redis key patterns for analytics data
 */
export const ANALYTICS_REDIS_KEYS = {
  dailyEvents: (workspaceId: string, date: string) => `analytics:${workspaceId}:daily:${date}`,
  hourlyEvents: (workspaceId: string, date: string, hour: number) =>
    `analytics:${workspaceId}:hourly:${date}:${hour}`,
  activeUsers: (workspaceId: string, date: string) => `analytics:${workspaceId}:active:${date}`,
  realTimeStats: (workspaceId: string) => `analytics:${workspaceId}:realtime`,
} as const;

/**
 * Maximum number of events in a batch before flushing
 */
export const DEFAULT_ANALYTICS_BATCH_SIZE = 100;

/**
 * Default interval for flushing analytics events (in milliseconds)
 */
export const DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS = 5000;

/**
 * TTL for Redis analytics keys (7 days in seconds)
 */
export const ANALYTICS_REDIS_TTL_SECONDS = 86400 * 7;

/**
 * Event categories for grouping analytics
 */
export const ANALYTICS_EVENT_CATEGORIES = {
  messaging: ['message.sent', 'message.received', 'message.edited', 'message.deleted', 'reaction.added', 'thread.created'],
  files: ['file.uploaded', 'file.downloaded'],
  channels: ['channel.created', 'channel.joined', 'channel.left'],
  calls: ['call.started', 'call.joined', 'call.ended'],
  vp: ['vp.message.sent', 'vp.message.received', 'vp.task.completed'],
  users: ['user.active', 'user.login', 'user.logout'],
  search: ['search.performed'],
} as const;
