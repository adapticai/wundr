/**
 * @fileoverview Analytics types for usage tracking and insights
 */

export interface AnalyticsEvent {
  id: string;
  workspaceId: string;
  userId?: string;
  vpId?: string;
  eventType: AnalyticsEventType;
  eventData: Record<string, unknown>;
  sessionId?: string;
  timestamp: Date;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    platform?: string;
    version?: string;
  };
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
  vp: VPMetrics;
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

export interface VPMetrics {
  totalVPs: number;
  activeVPs: number;
  messagesSent: number;
  messagesReceived: number;
  tasksCompleted: number;
  averageResponseTime: number;
  byVP: Array<{
    vpId: string;
    vpName: string;
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
    vpIds?: string[];
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

export interface WidgetConfig {
  metric?: string;
  comparison?: 'previous_period' | 'previous_year';
  groupBy?: string;
  limit?: number;
  filters?: Record<string, unknown>;
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
