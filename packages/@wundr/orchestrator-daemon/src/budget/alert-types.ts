/**
 * Budget Alert System Types
 *
 * Defines alert levels, channels, configurations, and notification payloads
 * for the budget monitoring and alerting system.
 */

/**
 * Alert severity levels with escalation support
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

/**
 * Supported alert delivery channels
 */
export enum AlertChannel {
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  SLACK = 'slack',
  IN_APP = 'in_app',
  SMS = 'sms'
}

/**
 * Budget threshold that triggers an alert
 */
export interface BudgetThreshold {
  /** Percentage of budget consumed (0-100) */
  percentage: number;

  /** Alert level for this threshold */
  level: AlertLevel;

  /** Whether to auto-pause orchestrator at this threshold */
  autoPause?: boolean;

  /** Custom message template */
  messageTemplate?: string;
}

/**
 * Alert channel configuration
 */
export interface ChannelConfig {
  /** Channel type */
  type: AlertChannel;

  /** Whether this channel is enabled */
  enabled: boolean;

  /** Channel-specific configuration */
  config: WebhookConfig | EmailConfig | SlackConfig | InAppConfig | SMSConfig;

  /** Minimum alert level to trigger this channel */
  minLevel?: AlertLevel;
}

/**
 * Webhook notification configuration
 */
export interface WebhookConfig {
  /** Webhook URL */
  url: string;

  /** HTTP method (default: POST) */
  method?: 'POST' | 'PUT';

  /** Custom headers */
  headers?: Record<string, string>;

  /** Request timeout in ms */
  timeout?: number;

  /** Retry configuration */
  retries?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * Email notification configuration
 */
export interface EmailConfig {
  /** Recipient email addresses */
  recipients: string[];

  /** CC addresses */
  cc?: string[];

  /** From address */
  from: string;

  /** Email subject template */
  subjectTemplate?: string;

  /** SMTP configuration */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
}

/**
 * Slack notification configuration
 */
export interface SlackConfig {
  /** Slack webhook URL */
  webhookUrl: string;

  /** Channel to post to (e.g., #alerts) */
  channel?: string;

  /** Username for bot */
  username?: string;

  /** Emoji icon */
  iconEmoji?: string;

  /** Whether to mention @channel for critical alerts */
  mentionChannel?: boolean;
}

/**
 * In-app notification configuration
 */
export interface InAppConfig {
  /** User IDs to notify */
  userIds: string[];

  /** Whether to show desktop notification */
  desktopNotification?: boolean;

  /** Notification persistence duration in seconds */
  persistFor?: number;
}

/**
 * SMS notification configuration
 */
export interface SMSConfig {
  /** Phone numbers to notify */
  phoneNumbers: string[];

  /** SMS provider (Twilio, AWS SNS, etc.) */
  provider: 'twilio' | 'sns' | 'custom';

  /** Provider-specific configuration */
  providerConfig: Record<string, unknown>;
}

/**
 * Rate limiting configuration for alerts
 */
export interface RateLimitConfig {
  /** Maximum alerts per threshold per time window */
  maxAlertsPerThreshold: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Whether to allow duplicate alerts within window */
  allowDuplicates?: boolean;
}

/**
 * Complete alert configuration
 */
export interface AlertConfig {
  /** Orchestrator ID this config applies to */
  orchestratorId: string;

  /** Budget thresholds that trigger alerts */
  thresholds: BudgetThreshold[];

  /** Alert delivery channels */
  channels: ChannelConfig[];

  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;

  /** Whether alerts are globally enabled */
  enabled: boolean;

  /** Timezone for alert timestamps */
  timezone?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Budget alert record
 */
export interface Alert {
  /** Unique alert ID */
  id: string;

  /** Orchestrator ID */
  orchestratorId: string;

  /** Alert level */
  level: AlertLevel;

  /** Alert title */
  title: string;

  /** Alert message */
  message: string;

  /** Budget threshold that triggered this alert */
  threshold: BudgetThreshold;

  /** Current budget usage at time of alert */
  currentUsage: {
    tokensUsed: number;
    tokensLimit: number;
    percentageUsed: number;
    costUsed: number;
    costLimit: number;
  };

  /** Channels this alert was sent to */
  channels: AlertChannel[];

  /** Alert creation timestamp */
  createdAt: Date;

  /** Whether alert has been acknowledged */
  acknowledged: boolean;

  /** User who acknowledged the alert */
  acknowledgedBy?: string;

  /** Acknowledgment timestamp */
  acknowledgedAt?: Date;

  /** Whether auto-pause was triggered */
  autoPauseTriggered?: boolean;

  /** Additional alert metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Alert acknowledgment request
 */
export interface AlertAcknowledgment {
  /** Alert ID */
  alertId: string;

  /** User acknowledging the alert */
  userId: string;

  /** Optional acknowledgment note */
  note?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Webhook notification payload
 */
export interface WebhookPayload {
  /** Event type */
  event: 'budget.alert';

  /** Alert data */
  alert: Alert;

  /** Orchestrator details */
  orchestrator: {
    id: string;
    name?: string;
  };

  /** Timestamp */
  timestamp: string;

  /** Webhook signature for verification */
  signature?: string;
}

/**
 * Email notification payload
 */
export interface EmailPayload {
  /** Email subject */
  subject: string;

  /** HTML email body */
  html: string;

  /** Plain text email body */
  text: string;

  /** Alert data for templating */
  alert: Alert;
}

/**
 * Slack notification payload
 */
export interface SlackPayload {
  /** Message text */
  text: string;

  /** Rich message blocks */
  blocks?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
    fields?: Array<{
      type: string;
      text: string;
    }>;
  }>;

  /** Message attachments */
  attachments?: Array<{
    color: string;
    title: string;
    text: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
    footer?: string;
    ts?: number;
  }>;

  /** Channel override */
  channel?: string;

  /** Username override */
  username?: string;

  /** Icon emoji override */
  icon_emoji?: string;
}

/**
 * In-app notification payload
 */
export interface InAppPayload {
  /** Notification ID */
  id: string;

  /** User IDs to notify */
  userIds: string[];

  /** Notification title */
  title: string;

  /** Notification message */
  message: string;

  /** Alert level for styling */
  level: AlertLevel;

  /** Action buttons */
  actions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;

  /** Notification icon */
  icon?: string;

  /** Whether to show desktop notification */
  desktop?: boolean;

  /** Expiration timestamp */
  expiresAt?: Date;

  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * SMS notification payload
 */
export interface SMSPayload {
  /** Phone numbers */
  to: string[];

  /** SMS message body (max 160 chars for single SMS) */
  body: string;

  /** Optional sender ID */
  from?: string;
}

/**
 * Alert delivery result
 */
export interface AlertDeliveryResult {
  /** Alert ID */
  alertId: string;

  /** Channel delivery results */
  results: Array<{
    channel: AlertChannel;
    success: boolean;
    error?: string;
    deliveredAt?: Date;
    metadata?: Record<string, unknown>;
  }>;

  /** Overall delivery status */
  status: 'success' | 'partial' | 'failed';

  /** Total channels attempted */
  attempted: number;

  /** Successful deliveries */
  succeeded: number;

  /** Failed deliveries */
  failed: number;
}

/**
 * Alert history query filters
 */
export interface AlertHistoryFilter {
  /** Filter by orchestrator ID */
  orchestratorId?: string;

  /** Filter by alert level */
  level?: AlertLevel;

  /** Filter by acknowledged status */
  acknowledged?: boolean;

  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort order */
  sortBy?: 'createdAt' | 'level' | 'percentageUsed';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Alert statistics
 */
export interface AlertStats {
  /** Orchestrator ID */
  orchestratorId: string;

  /** Total alerts sent */
  totalAlerts: number;

  /** Alerts by level */
  byLevel: Record<AlertLevel, number>;

  /** Alerts by channel */
  byChannel: Record<AlertChannel, number>;

  /** Acknowledged alerts */
  acknowledged: number;

  /** Unacknowledged alerts */
  unacknowledged: number;

  /** Auto-pause triggered count */
  autoPauseCount: number;

  /** Average acknowledgment time in ms */
  avgAckTimeMs?: number;

  /** Time range for these stats */
  timeRange: {
    start: Date;
    end: Date;
  };
}
