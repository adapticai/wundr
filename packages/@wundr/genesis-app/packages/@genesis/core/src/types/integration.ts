/**
 * @genesis/core - Integration Types
 *
 * Type definitions for third-party service integrations and webhooks.
 * Supports providers like Slack, GitHub, Jira, and custom integrations.
 *
 * @packageDocumentation
 */

// =============================================================================
// Integration Provider Types
// =============================================================================

/**
 * Supported integration providers.
 */
export type IntegrationProvider =
  | 'slack'
  | 'teams'
  | 'github'
  | 'jira'
  | 'notion'
  | 'linear'
  | 'salesforce'
  | 'hubspot'
  | 'zapier'
  | 'custom';

/**
 * Integration connection status.
 */
export type IntegrationStatus = 'active' | 'inactive' | 'pending' | 'error' | 'revoked';

// =============================================================================
// OAuth Types
// =============================================================================

/**
 * OAuth token information for authenticated integrations.
 */
export interface OAuthToken {
  /** The access token for API calls */
  accessToken: string;

  /** Optional refresh token for token renewal */
  refreshToken?: string;

  /** Token type (e.g., 'Bearer') */
  tokenType: string;

  /** Token expiration timestamp */
  expiresAt?: Date;

  /** OAuth scopes granted */
  scope?: string[];
}

// =============================================================================
// Integration Configuration Types
// =============================================================================

/**
 * Complete integration configuration.
 */
export interface IntegrationConfig {
  /** Unique integration identifier */
  id: string;

  /** Workspace this integration belongs to */
  workspaceId: string;

  /** Integration provider type */
  provider: IntegrationProvider;

  /** Display name for the integration */
  name: string;

  /** Optional description */
  description?: string;

  /** Current connection status */
  status: IntegrationStatus;

  /** OAuth credentials (if using OAuth) */
  oauth?: OAuthToken;

  /** API key (if using API key auth) */
  apiKey?: string;

  /** Incoming webhook URL */
  webhookUrl?: string;

  /** Webhook secret for signature verification */
  webhookSecret?: string;

  /** Provider-specific settings */
  settings: IntegrationSettings;

  /** Permissions granted to this integration */
  permissions: IntegrationPermission[];

  /** User who created the integration */
  createdBy: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Last successful sync timestamp */
  lastSyncAt?: Date;

  /** Error message if status is 'error' */
  errorMessage?: string;
}

/**
 * Integration permissions defining what the integration can access.
 */
export type IntegrationPermission =
  | 'read:messages'
  | 'write:messages'
  | 'read:channels'
  | 'write:channels'
  | 'read:users'
  | 'read:files'
  | 'write:files'
  | 'webhooks:receive'
  | 'webhooks:send';

// =============================================================================
// Webhook Types
// =============================================================================

/**
 * Webhook configuration for receiving or sending events.
 */
export interface WebhookConfig {
  /** Unique webhook identifier */
  id: string;

  /** Workspace this webhook belongs to */
  workspaceId: string;

  /** Associated integration ID (optional) */
  integrationId?: string;

  /** Display name for the webhook */
  name: string;

  /** Target URL for webhook delivery */
  url: string;

  /** Secret for HMAC signature verification */
  secret: string;

  /** Events this webhook subscribes to */
  events: WebhookEvent[];

  /** Webhook status */
  status: 'active' | 'inactive' | 'failed';

  /** Custom headers to include in requests */
  headers?: Record<string, string>;

  /** Retry configuration */
  retryPolicy: WebhookRetryPolicy;

  /** User who created the webhook */
  createdBy: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Last successful trigger timestamp */
  lastTriggeredAt?: Date;

  /** Consecutive failure count */
  failureCount: number;
}

/**
 * Webhook events that can be subscribed to.
 */
export type WebhookEvent =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'channel.created'
  | 'channel.updated'
  | 'channel.deleted'
  | 'member.joined'
  | 'member.left'
  | 'file.uploaded'
  | 'file.deleted'
  | 'call.started'
  | 'call.ended'
  | 'vp.message'
  | 'vp.action';

/**
 * Webhook retry policy configuration.
 */
export interface WebhookRetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay between retries (ms) */
  initialDelay: number;

  /** Maximum delay between retries (ms) */
  maxDelay: number;

  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Default webhook retry policy.
 */
export const DEFAULT_WEBHOOK_RETRY_POLICY: WebhookRetryPolicy = {
  maxRetries: 5,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
};

// =============================================================================
// Webhook Payload Types
// =============================================================================

/**
 * Base interface for all webhook payloads.
 */
export interface BaseWebhookPayload {
  /** Event type identifier */
  event: WebhookEvent;

  /** Timestamp when the event occurred */
  timestamp: string;

  /** Workspace ID where the event occurred */
  workspaceId: string;
}

/**
 * Payload for message-related webhook events.
 */
export interface MessageWebhookPayload extends BaseWebhookPayload {
  event: 'message.created' | 'message.updated' | 'message.deleted';
  data: {
    messageId: string;
    channelId: string;
    authorId: string;
    content?: string;
    threadId?: string;
  };
}

/**
 * Payload for channel-related webhook events.
 */
export interface ChannelWebhookPayload extends BaseWebhookPayload {
  event: 'channel.created' | 'channel.updated' | 'channel.deleted';
  data: {
    channelId: string;
    name: string;
    type: string;
  };
}

/**
 * Payload for member-related webhook events.
 */
export interface MemberWebhookPayload extends BaseWebhookPayload {
  event: 'member.joined' | 'member.left';
  data: {
    userId: string;
    channelId: string;
  };
}

/**
 * Payload for file-related webhook events.
 */
export interface FileWebhookPayload extends BaseWebhookPayload {
  event: 'file.uploaded' | 'file.deleted';
  data: {
    fileId: string;
    channelId?: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

/**
 * Payload for call-related webhook events.
 */
export interface CallWebhookPayload extends BaseWebhookPayload {
  event: 'call.started' | 'call.ended';
  data: {
    callId: string;
    channelId: string;
    participants: string[];
    duration?: number;
  };
}

/**
 * Payload for VP-related webhook events.
 */
export interface VPWebhookPayload extends BaseWebhookPayload {
  event: 'vp.message' | 'vp.action';
  data: {
    vpId: string;
    channelId?: string;
    action?: string;
    content?: string;
  };
}

/**
 * Generic webhook payload for custom or unknown events.
 */
export interface GenericWebhookPayload {
  /** Event type identifier */
  eventType?: string;
  /** Timestamp of the event */
  timestamp?: string;
  /** Source identifier */
  source?: string;
  /** Additional payload data */
  [key: string]: string | number | boolean | object | undefined;
}

/**
 * Union type for all webhook payloads.
 * Includes typed payloads for known events and a generic type for flexibility.
 */
export type WebhookPayload =
  | MessageWebhookPayload
  | ChannelWebhookPayload
  | MemberWebhookPayload
  | FileWebhookPayload
  | CallWebhookPayload
  | VPWebhookPayload
  | GenericWebhookPayload;

// =============================================================================
// Webhook Delivery Types
// =============================================================================

/**
 * Webhook delivery record tracking delivery attempts.
 */
export interface WebhookDelivery {
  /** Unique delivery identifier */
  id: string;

  /** Associated webhook ID */
  webhookId: string;

  /** Event that triggered the delivery */
  event: WebhookEvent;

  /** Payload sent to the webhook */
  payload: WebhookPayload;

  /** Current delivery status */
  status: 'pending' | 'success' | 'failed';

  /** Delivery attempt records */
  attempts: WebhookAttempt[];

  /** Creation timestamp */
  createdAt: Date;

  /** Completion timestamp */
  completedAt?: Date;
}

/**
 * Individual webhook delivery attempt.
 */
export interface WebhookAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;

  /** Attempt timestamp */
  timestamp: Date;

  /** HTTP status code from target */
  statusCode?: number;

  /** Response body (truncated if too long) */
  responseBody?: string;

  /** Error message if attempt failed */
  errorMessage?: string;

  /** Duration of the request in milliseconds */
  durationMs: number;
}

// =============================================================================
// Integration Event Types
// =============================================================================

/**
 * Base interface for integration event payloads from external providers.
 */
export interface BaseIntegrationEventPayload {
  /** Source provider identifier */
  source: IntegrationProvider;

  /** External event ID from the provider */
  externalEventId?: string;

  /** Raw data received (serialized JSON string for audit) */
  rawData?: string;
}

/**
 * Slack-specific event payload.
 */
export interface SlackEventPayload extends BaseIntegrationEventPayload {
  source: 'slack';
  teamId: string;
  channelId?: string;
  userId?: string;
  messageTs?: string;
  text?: string;
}

/**
 * GitHub-specific event payload.
 */
export interface GitHubEventPayload extends BaseIntegrationEventPayload {
  source: 'github';
  repositoryId: number;
  repositoryName: string;
  action: string;
  sender: {
    id: number;
    login: string;
  };
  pullRequest?: {
    number: number;
    title: string;
    state: string;
  };
  issue?: {
    number: number;
    title: string;
    state: string;
  };
}

/**
 * Jira-specific event payload.
 */
export interface JiraEventPayload extends BaseIntegrationEventPayload {
  source: 'jira';
  webhookEvent: string;
  issueKey?: string;
  issueId?: string;
  projectKey?: string;
  user?: {
    accountId: string;
    displayName: string;
  };
  changelog?: {
    field: string;
    fromString: string;
    toString: string;
  }[];
}

/**
 * Generic event payload for custom or other integrations.
 */
export interface GenericIntegrationEventPayload extends BaseIntegrationEventPayload {
  source: 'teams' | 'notion' | 'linear' | 'salesforce' | 'hubspot' | 'zapier' | 'custom';
  eventName: string;
  data: Record<string, string | number | boolean | null>;
}

/**
 * Empty payload for initialization or placeholder events.
 */
export interface EmptyIntegrationEventPayload {
  [key: string]: never;
}

/**
 * Union type for all integration event payloads.
 * Includes typed payloads for known providers and a generic type for flexibility.
 */
export type IntegrationEventPayload =
  | SlackEventPayload
  | GitHubEventPayload
  | JiraEventPayload
  | GenericIntegrationEventPayload
  | EmptyIntegrationEventPayload;

/**
 * Integration event for tracking data sync operations.
 */
export interface IntegrationEvent {
  /** Unique event identifier */
  id: string;

  /** Associated integration ID */
  integrationId: string;

  /** Direction of the event */
  type: 'incoming' | 'outgoing';

  /** Provider that generated/received the event */
  provider: IntegrationProvider;

  /** Provider-specific event type */
  eventType: string;

  /** Event payload */
  payload: IntegrationEventPayload;

  /** Processing status */
  status: 'pending' | 'processed' | 'failed';

  /** When the event was processed */
  processedAt?: Date;

  /** Error message if processing failed */
  errorMessage?: string;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Result of an integration sync operation.
 */
export interface SyncResult {
  /** Integration that was synced */
  integrationId: string;

  /** Provider type */
  provider: IntegrationProvider;

  /** When the sync completed */
  syncedAt: Date;

  /** Number of items successfully synced */
  itemsSynced: number;

  /** Number of items that failed to sync */
  itemsFailed: number;

  /** Error messages for failed items */
  errors: string[];

  /** Scheduled next sync time */
  nextSyncAt?: Date;
}

// =============================================================================
// Provider-Specific Configuration Types
// =============================================================================

/**
 * Slack-specific integration configuration.
 */
export interface SlackIntegrationConfig {
  /** Slack team/workspace ID */
  teamId: string;

  /** Slack team name */
  teamName: string;

  /** Channel mappings between Slack and Genesis */
  channelMappings: Array<{
    /** Slack channel ID */
    slackChannelId: string;

    /** Genesis channel ID */
    genesisChannelId: string;

    /** Whether to sync messages bidirectionally */
    syncMessages: boolean;
  }>;
}

/**
 * GitHub-specific integration configuration.
 */
export interface GitHubIntegrationConfig {
  /** GitHub App installation ID */
  installationId: string;

  /** Repositories accessible by this integration */
  repositories: Array<{
    /** Repository ID */
    id: number;

    /** Full repository name (owner/repo) */
    fullName: string;

    /** Optional channel to post notifications */
    channelId?: string;
  }>;

  /** Events to notify on */
  notifyOn: ('push' | 'pull_request' | 'issues' | 'releases')[];
}

/**
 * Jira-specific integration configuration.
 */
export interface JiraIntegrationConfig {
  /** Atlassian Cloud ID */
  cloudId: string;

  /** Jira site URL */
  siteUrl: string;

  /** Project mappings between Jira and Genesis */
  projectMappings: Array<{
    /** Jira project key */
    jiraProjectKey: string;

    /** Genesis channel ID for notifications */
    genesisChannelId: string;
  }>;

  /** Events to notify on */
  notifyOn: ('issue_created' | 'issue_updated' | 'comment_added')[];
}

/**
 * Custom integration configuration for generic or third-party integrations.
 */
export interface CustomIntegrationConfig {
  /** Custom endpoint URL */
  endpointUrl?: string;

  /** Custom authentication headers */
  authHeaders?: Record<string, string>;

  /** Custom configuration options */
  options?: Record<string, string | number | boolean>;
}

/**
 * Union type for all known provider-specific integration settings.
 * Use this for type-safe operations with known providers.
 */
export type KnownIntegrationSettings =
  | SlackIntegrationConfig
  | GitHubIntegrationConfig
  | JiraIntegrationConfig
  | CustomIntegrationConfig;

/**
 * Base integration settings that all providers may have.
 */
export interface BaseIntegrationSettings {
  /** Whether sync is enabled */
  syncEnabled?: boolean;
  /** Sync direction */
  syncDirection?: 'bidirectional' | 'inbound' | 'outbound';
  /** Sync interval in minutes */
  syncIntervalMinutes?: number;
  /** Additional provider-specific string settings */
  [key: string]: string | number | boolean | string[] | object | undefined;
}

/**
 * Flexible integration settings type that supports both known configurations
 * and arbitrary key-value pairs for extensibility.
 *
 * For type-safe operations with known providers, use type guards or cast to
 * the specific config type (SlackIntegrationConfig, etc.).
 */
export type IntegrationSettings = BaseIntegrationSettings;

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for creating a new integration.
 */
export interface CreateIntegrationInput {
  /** Workspace to create the integration in */
  workspaceId: string;

  /** Integration provider type */
  provider: IntegrationProvider;

  /** Display name for the integration */
  name: string;

  /** Optional description */
  description?: string;

  /** Provider-specific settings */
  settings?: IntegrationSettings;

  /** Permissions to grant */
  permissions?: IntegrationPermission[];
}

/**
 * Input for updating an existing integration.
 */
export interface UpdateIntegrationInput {
  /** Updated display name */
  name?: string;

  /** Updated description */
  description?: string;

  /** Updated status */
  status?: IntegrationStatus;

  /** Updated settings */
  settings?: IntegrationSettings;

  /** Updated permissions */
  permissions?: IntegrationPermission[];
}

/**
 * Input for creating a new webhook.
 */
export interface CreateWebhookInput {
  /** Workspace to create the webhook in */
  workspaceId: string;

  /** Optional associated integration ID */
  integrationId?: string;

  /** Display name for the webhook */
  name: string;

  /** Target URL for delivery */
  url: string;

  /** Events to subscribe to */
  events: WebhookEvent[];

  /** Custom headers to include */
  headers?: Record<string, string>;

  /** Retry policy (uses defaults if not provided) */
  retryPolicy?: Partial<WebhookRetryPolicy>;
}

/**
 * Input for updating an existing webhook.
 */
export interface UpdateWebhookInput {
  /** Updated display name */
  name?: string;

  /** Updated target URL */
  url?: string;

  /** Updated events */
  events?: WebhookEvent[];

  /** Updated status */
  status?: 'active' | 'inactive';

  /** Updated headers */
  headers?: Record<string, string>;

  /** Updated retry policy */
  retryPolicy?: Partial<WebhookRetryPolicy>;
}

// =============================================================================
// List Options Types
// =============================================================================

/**
 * Options for listing integrations.
 */
export interface ListIntegrationsOptions {
  /** Filter by provider */
  provider?: IntegrationProvider;

  /** Filter by status */
  status?: IntegrationStatus;

  /** Include inactive integrations */
  includeInactive?: boolean;

  /** Pagination: skip count */
  skip?: number;

  /** Pagination: take count */
  take?: number;

  /** Order by field */
  orderBy?: 'createdAt' | 'name' | 'provider' | 'status';

  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Options for listing webhooks.
 */
export interface ListWebhooksOptions {
  /** Filter by integration ID */
  integrationId?: string;

  /** Filter by status */
  status?: 'active' | 'inactive' | 'failed';

  /** Filter by event subscription */
  event?: WebhookEvent;

  /** Pagination: skip count */
  skip?: number;

  /** Pagination: take count */
  take?: number;
}

/**
 * Options for listing webhook deliveries.
 */
export interface ListDeliveriesOptions {
  /** Filter by status */
  status?: 'pending' | 'success' | 'failed';

  /** Filter by event type */
  event?: WebhookEvent;

  /** Filter deliveries after this date */
  after?: Date;

  /** Filter deliveries before this date */
  before?: Date;

  /** Pagination: skip count */
  skip?: number;

  /** Pagination: take count */
  take?: number;
}

// =============================================================================
// Paginated Result Types
// =============================================================================

/**
 * Paginated integration list result.
 */
export interface PaginatedIntegrationResult {
  /** List of integrations */
  data: IntegrationConfig[];

  /** Total count */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Cursor for next page */
  nextCursor?: string;
}

/**
 * Paginated webhook list result.
 */
export interface PaginatedWebhookResult {
  /** List of webhooks */
  data: WebhookConfig[];

  /** Total count */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Cursor for next page */
  nextCursor?: string;
}

/**
 * Paginated webhook delivery list result.
 */
export interface PaginatedDeliveryResult {
  /** List of deliveries */
  data: WebhookDelivery[];

  /** Total count */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// Connection Test Types
// =============================================================================

/**
 * Connection test details containing diagnostic information.
 */
export interface ConnectionTestDetails {
  /** HTTP status code from the test request */
  statusCode?: number;

  /** Human-readable message about the connection test */
  message?: string;

  /** API version detected */
  apiVersion?: string;

  /** Server or service name */
  serverName?: string;

  /** Available scopes or permissions */
  scopes?: string[];

  /** Rate limit information */
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt?: string;
  };

  /** Authentication method used */
  authMethod?: 'oauth' | 'api_key' | 'basic' | 'bearer';

  /** HTTP response headers (relevant ones) */
  responseHeaders?: Record<string, string>;

  /** Provider-specific diagnostic data */
  providerInfo?: {
    name: string;
    version?: string;
    region?: string;
    tier?: string;
  };
}

/**
 * Result of testing an integration connection.
 */
export interface ConnectionTestResult {
  /** Whether the connection is successful */
  success: boolean;

  /** Connection latency in milliseconds */
  latencyMs?: number;

  /** Error message if connection failed */
  errorMessage?: string;

  /** Additional details about the connection */
  details?: ConnectionTestDetails;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Valid integration providers for type checking.
 */
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  'slack',
  'teams',
  'github',
  'jira',
  'notion',
  'linear',
  'salesforce',
  'hubspot',
  'zapier',
  'custom',
];

/**
 * Valid integration statuses for type checking.
 */
export const INTEGRATION_STATUSES: IntegrationStatus[] = [
  'active',
  'inactive',
  'pending',
  'error',
  'revoked',
];

/**
 * Valid webhook events for type checking.
 */
export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'message.created',
  'message.updated',
  'message.deleted',
  'channel.created',
  'channel.updated',
  'channel.deleted',
  'member.joined',
  'member.left',
  'file.uploaded',
  'file.deleted',
  'call.started',
  'call.ended',
  'vp.message',
  'vp.action',
];

/**
 * Valid integration permissions for type checking.
 */
export const INTEGRATION_PERMISSIONS: IntegrationPermission[] = [
  'read:messages',
  'write:messages',
  'read:channels',
  'write:channels',
  'read:users',
  'read:files',
  'write:files',
  'webhooks:receive',
  'webhooks:send',
];

/**
 * Type guard for IntegrationProvider.
 */
export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return typeof value === 'string' && INTEGRATION_PROVIDERS.includes(value as IntegrationProvider);
}

/**
 * Type guard for IntegrationStatus.
 */
export function isIntegrationStatus(value: unknown): value is IntegrationStatus {
  return typeof value === 'string' && INTEGRATION_STATUSES.includes(value as IntegrationStatus);
}

/**
 * Type guard for WebhookEvent.
 */
export function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === 'string' && WEBHOOK_EVENTS.includes(value as WebhookEvent);
}

/**
 * Type guard for IntegrationPermission.
 */
export function isIntegrationPermission(value: unknown): value is IntegrationPermission {
  return typeof value === 'string' && INTEGRATION_PERMISSIONS.includes(value as IntegrationPermission);
}

/**
 * Type guard for IntegrationConfig.
 */
export function isIntegrationConfig(value: unknown): value is IntegrationConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.workspaceId === 'string' &&
    isIntegrationProvider(obj.provider) &&
    typeof obj.name === 'string' &&
    isIntegrationStatus(obj.status)
  );
}

/**
 * Type guard for WebhookConfig.
 */
export function isWebhookConfig(value: unknown): value is WebhookConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.workspaceId === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.secret === 'string' &&
    Array.isArray(obj.events)
  );
}

/**
 * Type guard for WebhookRetryPolicy.
 */
export function isWebhookRetryPolicy(value: unknown): value is WebhookRetryPolicy {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.maxRetries === 'number' &&
    typeof obj.initialDelay === 'number' &&
    typeof obj.maxDelay === 'number' &&
    typeof obj.backoffMultiplier === 'number'
  );
}

/**
 * Validates CreateIntegrationInput.
 */
export function isValidCreateIntegrationInput(value: unknown): value is CreateIntegrationInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.workspaceId === 'string' &&
    obj.workspaceId.length > 0 &&
    isIntegrationProvider(obj.provider) &&
    typeof obj.name === 'string' &&
    obj.name.length > 0
  );
}

/**
 * Validates CreateWebhookInput.
 */
export function isValidCreateWebhookInput(value: unknown): value is CreateWebhookInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.workspaceId === 'string' &&
    obj.workspaceId.length > 0 &&
    typeof obj.name === 'string' &&
    obj.name.length > 0 &&
    typeof obj.url === 'string' &&
    obj.url.length > 0 &&
    Array.isArray(obj.events) &&
    obj.events.length > 0 &&
    (obj.events as unknown[]).every(isWebhookEvent)
  );
}
