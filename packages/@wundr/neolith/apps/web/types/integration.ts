/**
 * Integration types for Genesis-App
 * Provides type definitions for third-party integrations, webhooks, and event delivery
 */

/**
 * Supported integration providers
 */
export type IntegrationProvider =
  | 'slack'
  | 'discord'
  | 'teams'
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'notion'
  | 'linear'
  | 'asana'
  | 'trello'
  | 'google_drive'
  | 'dropbox'
  | 'zapier'
  | 'custom';

/**
 * Integration status states
 */
export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending';

/**
 * Webhook event types that can be subscribed to
 */
export type WebhookEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'channel.created'
  | 'channel.updated'
  | 'channel.deleted'
  | 'member.joined'
  | 'member.left'
  | 'orchestrator.status_changed'
  | 'orchestrator.message'
  | 'task.created'
  | 'task.completed'
  | 'workflow.triggered'
  | 'workflow.completed';

/**
 * Webhook delivery status tracking
 */
export type WebhookDeliveryStatus =
  | 'success'
  | 'failed'
  | 'pending'
  | 'retrying';

/**
 * Complete integration configuration including provider settings and mappings
 */
export interface IntegrationConfig {
  id: string;
  name: string;
  description?: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
  /** ISO 8601 timestamp of last successful sync */
  lastSyncAt?: string;
  errorMessage?: string;
  config: {
    channelMappings?: Array<{
      sourceId: string;
      sourceName: string;
      targetId: string;
      targetName: string;
    }>;
    /** Permission identifiers granted to this integration */
    permissions?: string[];
    notificationPreferences?: {
      enabled: boolean;
      /** Event type identifiers to receive notifications for */
      events: WebhookEventType[];
    };
  };
}

/**
 * Webhook retry configuration for failed deliveries
 */
export interface WebhookRetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelay: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay: number;
  /** Multiplier for exponential backoff (e.g., 2.0 doubles delay each retry) */
  backoffMultiplier: number;
}

/**
 * Webhook operational status
 */
export type WebhookStatus = 'active' | 'inactive' | 'disabled';

/**
 * Filters to limit webhook event scope
 */
export interface WebhookFilters {
  /** Only trigger for events in these channels */
  channelIds?: string[];
  /** Only trigger for events involving these users */
  userIds?: string[];
  /** Only trigger for events involving these orchestrators */
  orchestratorIds?: string[];
}

/**
 * Complete webhook configuration
 */
export interface WebhookConfig {
  id: string;
  workspaceId: string;
  integrationId?: string;
  name: string;
  description?: string;
  /** Target URL for webhook deliveries */
  url: string;
  /** Secret key for HMAC signature verification */
  secret: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  retryPolicy: WebhookRetryPolicy;
  /** Custom HTTP headers to include in webhook requests */
  headers?: Record<string, string>;
  filters?: WebhookFilters;
  /** User ID who created this webhook */
  createdBy: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
  /** ISO 8601 timestamp of last delivery attempt */
  lastDeliveryAt?: string;
  /** Total number of failed delivery attempts */
  failureCount: number;
  /** Total number of successful deliveries (defaults to 0) */
  successCount: number;
}

/**
 * Legacy webhook type for backwards compatibility
 * @deprecated Use WebhookConfig instead
 */
export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  status: IntegrationStatus;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
  /** ISO 8601 timestamp of last trigger */
  lastTriggeredAt?: string;
  /** Success rate as decimal (0.0 - 1.0) */
  deliverySuccessRate: number;
  retryPolicy: {
    maxRetries: number;
    /** Retry delay in milliseconds */
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  headers?: Record<string, string>;
}

/**
 * Input parameters for creating a new webhook
 */
export interface CreateWebhookInput {
  name: string;
  description?: string;
  /** Target URL for webhook deliveries */
  url: string;
  events: WebhookEventType[];
  /** Optional integration ID to associate this webhook with */
  integrationId?: string;
  /** Partial retry policy (missing fields will use defaults) */
  retryPolicy?: Partial<WebhookRetryPolicy>;
  /** Custom HTTP headers to include in webhook requests */
  headers?: Record<string, string>;
  filters?: WebhookFilters;
}

/**
 * Input parameters for updating an existing webhook
 */
export interface UpdateWebhookInput {
  name?: string;
  description?: string;
  /** Target URL for webhook deliveries */
  url?: string;
  events?: WebhookEventType[];
  status?: WebhookStatus;
  /** Partial retry policy (only specified fields will be updated) */
  retryPolicy?: Partial<WebhookRetryPolicy>;
  /** Custom HTTP headers to include in webhook requests */
  headers?: Record<string, string>;
  filters?: WebhookFilters;
}

/**
 * Input parameters for creating a new integration
 */
export interface CreateIntegrationInput {
  provider: IntegrationProvider;
  name: string;
  description?: string;
  /** Provider-specific settings (structure varies by provider) */
  settings?: Record<string, unknown>;
}

/**
 * Input parameters for updating an existing integration
 */
export interface UpdateIntegrationInput {
  name?: string;
  description?: string;
  status?: IntegrationStatus;
  /** Provider-specific settings (structure varies by provider) */
  settings?: Record<string, unknown>;
  /** Permission identifiers to update */
  permissions?: string[];
}

/**
 * OAuth flow initiation response
 */
export interface IntegrationOAuthResponse {
  /** OAuth authorization URL to redirect user to */
  authUrl: string;
  /** CSRF protection state parameter */
  state: string;
}

/**
 * Filters for querying integrations
 */
export interface IntegrationFilters {
  /** Filter by specific provider */
  provider?: IntegrationProvider;
  /** Filter by status */
  status?: IntegrationStatus;
  /** Search term for name/description */
  search?: string;
}

/**
 * Detailed webhook delivery record with request/response data
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  status: WebhookDeliveryStatus;
  /** ISO 8601 timestamp of delivery attempt */
  timestamp: string;
  /** Request duration in milliseconds */
  duration?: number;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    /** Serialized request body */
    body: string;
  };
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    /** Response body (may be truncated) */
    body: string;
  };
  /** Error message if delivery failed */
  error?: string;
  /** Number of retry attempts made */
  retryCount: number;
  /** ISO 8601 timestamp of next scheduled retry */
  nextRetryAt?: string;
}

/**
 * Integration provider metadata and display information
 */
export const INTEGRATION_PROVIDERS: Record<
  IntegrationProvider,
  { name: string; description: string; icon: string }
> = {
  slack: {
    name: 'Slack',
    description: 'Connect with Slack workspaces',
    icon: 'SL',
  },
  discord: {
    name: 'Discord',
    description: 'Connect with Discord servers',
    icon: 'DS',
  },
  teams: {
    name: 'Microsoft Teams',
    description: 'Connect with Microsoft Teams',
    icon: 'MT',
  },
  github: {
    name: 'GitHub',
    description: 'Connect with GitHub repositories',
    icon: 'GH',
  },
  gitlab: {
    name: 'GitLab',
    description: 'Connect with GitLab projects',
    icon: 'GL',
  },
  jira: { name: 'Jira', description: 'Connect with Jira projects', icon: 'JI' },
  notion: {
    name: 'Notion',
    description: 'Connect with Notion workspaces',
    icon: 'NO',
  },
  linear: {
    name: 'Linear',
    description: 'Connect with Linear teams',
    icon: 'LI',
  },
  asana: {
    name: 'Asana',
    description: 'Connect with Asana workspaces',
    icon: 'AS',
  },
  trello: {
    name: 'Trello',
    description: 'Connect with Trello boards',
    icon: 'TR',
  },
  google_drive: {
    name: 'Google Drive',
    description: 'Connect with Google Drive',
    icon: 'GD',
  },
  dropbox: { name: 'Dropbox', description: 'Connect with Dropbox', icon: 'DB' },
  zapier: {
    name: 'Zapier',
    description: 'Connect with Zapier automations',
    icon: 'ZA',
  },
  custom: {
    name: 'Custom',
    description: 'Create a custom integration',
    icon: 'CU',
  },
} as const;

/**
 * Webhook event type metadata and descriptions
 */
export const WEBHOOK_EVENTS: Record<
  WebhookEventType,
  { label: string; description: string }
> = {
  'message.created': {
    label: 'Message Created',
    description: 'Triggered when a new message is sent',
  },
  'message.updated': {
    label: 'Message Updated',
    description: 'Triggered when a message is edited',
  },
  'message.deleted': {
    label: 'Message Deleted',
    description: 'Triggered when a message is deleted',
  },
  'channel.created': {
    label: 'Channel Created',
    description: 'Triggered when a new channel is created',
  },
  'channel.updated': {
    label: 'Channel Updated',
    description: 'Triggered when a channel is updated',
  },
  'channel.deleted': {
    label: 'Channel Deleted',
    description: 'Triggered when a channel is deleted',
  },
  'member.joined': {
    label: 'Member Joined',
    description: 'Triggered when a member joins',
  },
  'member.left': {
    label: 'Member Left',
    description: 'Triggered when a member leaves',
  },
  'orchestrator.status_changed': {
    label: 'Orchestrator Status Changed',
    description: 'Triggered when an Orchestrator status changes',
  },
  'orchestrator.message': {
    label: 'Orchestrator Message',
    description: 'Triggered when an Orchestrator sends a message',
  },
  'task.created': {
    label: 'Task Created',
    description: 'Triggered when a task is created',
  },
  'task.completed': {
    label: 'Task Completed',
    description: 'Triggered when a task is completed',
  },
  'workflow.triggered': {
    label: 'Workflow Triggered',
    description: 'Triggered when a workflow starts',
  },
  'workflow.completed': {
    label: 'Workflow Completed',
    description: 'Triggered when a workflow completes',
  },
} as const;

/**
 * Integration status display configuration with Tailwind CSS classes
 */
export const INTEGRATION_STATUS_CONFIG: Record<
  IntegrationStatus,
  { label: string; color: string; bgColor: string }
> = {
  active: {
    label: 'Active',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-gray-600',
    bgColor: 'bg-gray-500/10',
  },
  error: { label: 'Error', color: 'text-red-600', bgColor: 'bg-red-500/10' },
  pending: {
    label: 'Pending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
  },
} as const;

/**
 * Default webhook retry policy configuration
 */
export const DEFAULT_WEBHOOK_RETRY_POLICY: WebhookRetryPolicy = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 60000, // 1 minute
  backoffMultiplier: 2.0,
} as const;
