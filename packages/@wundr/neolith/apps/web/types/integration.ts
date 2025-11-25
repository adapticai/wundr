// Integration types for Genesis-App

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

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending';

export type WebhookEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'channel.created'
  | 'channel.updated'
  | 'channel.deleted'
  | 'member.joined'
  | 'member.left'
  | 'vp.status_changed'
  | 'vp.message'
  | 'task.created'
  | 'task.completed'
  | 'workflow.triggered'
  | 'workflow.completed';

export type WebhookDeliveryStatus = 'success' | 'failed' | 'pending' | 'retrying';

export interface IntegrationConfig {
  id: string;
  name: string;
  description?: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  errorMessage?: string;
  config: {
    channelMappings?: Array<{
      sourceId: string;
      sourceName: string;
      targetId: string;
      targetName: string;
    }>;
    permissions?: string[];
    notificationPreferences?: {
      enabled: boolean;
      events: string[];
    };
  };
}

export interface WebhookRetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export type WebhookStatus = 'active' | 'inactive' | 'disabled';

export interface WebhookFilters {
  channelIds?: string[];
  userIds?: string[];
  vpIds?: string[];
}

export interface WebhookConfig {
  id: string;
  workspaceId: string;
  integrationId?: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  status: WebhookStatus;
  retryPolicy: WebhookRetryPolicy;
  headers?: Record<string, string>;
  filters?: WebhookFilters;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date;
  failureCount: number;
  successCount?: number;
}

// Legacy Webhook type for backwards compatibility
export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  status: IntegrationStatus;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  deliverySuccessRate: number;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  headers?: Record<string, string>;
}

export interface CreateWebhookInput {
  name: string;
  description?: string;
  url: string;
  events: WebhookEventType[];
  integrationId?: string;
  retryPolicy?: Partial<WebhookRetryPolicy>;
  headers?: Record<string, string>;
  filters?: WebhookFilters;
}

export interface UpdateWebhookInput {
  name?: string;
  description?: string;
  url?: string;
  events?: WebhookEventType[];
  status?: WebhookStatus;
  retryPolicy?: Partial<WebhookRetryPolicy>;
  headers?: Record<string, string>;
  filters?: WebhookFilters;
}

export interface CreateIntegrationInput {
  provider: IntegrationProvider;
  name: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateIntegrationInput {
  name?: string;
  description?: string;
  status?: IntegrationStatus;
  settings?: Record<string, unknown>;
  permissions?: string[];
}

export interface IntegrationOAuthResponse {
  authUrl: string;
  state: string;
}

export interface IntegrationFilters {
  provider?: IntegrationProvider;
  status?: IntegrationStatus;
  search?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  status: WebhookDeliveryStatus;
  timestamp: string;
  duration?: number;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  };
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
  error?: string;
  retryCount: number;
  nextRetryAt?: string;
}

export const INTEGRATION_PROVIDERS: Record<IntegrationProvider, { name: string; description: string; icon: string }> = {
  slack: { name: 'Slack', description: 'Connect with Slack workspaces', icon: 'SL' },
  discord: { name: 'Discord', description: 'Connect with Discord servers', icon: 'DS' },
  teams: { name: 'Microsoft Teams', description: 'Connect with Microsoft Teams', icon: 'MT' },
  github: { name: 'GitHub', description: 'Connect with GitHub repositories', icon: 'GH' },
  gitlab: { name: 'GitLab', description: 'Connect with GitLab projects', icon: 'GL' },
  jira: { name: 'Jira', description: 'Connect with Jira projects', icon: 'JI' },
  notion: { name: 'Notion', description: 'Connect with Notion workspaces', icon: 'NO' },
  linear: { name: 'Linear', description: 'Connect with Linear teams', icon: 'LI' },
  asana: { name: 'Asana', description: 'Connect with Asana workspaces', icon: 'AS' },
  trello: { name: 'Trello', description: 'Connect with Trello boards', icon: 'TR' },
  google_drive: { name: 'Google Drive', description: 'Connect with Google Drive', icon: 'GD' },
  dropbox: { name: 'Dropbox', description: 'Connect with Dropbox', icon: 'DB' },
  zapier: { name: 'Zapier', description: 'Connect with Zapier automations', icon: 'ZA' },
  custom: { name: 'Custom', description: 'Create a custom integration', icon: 'CU' },
};

export const WEBHOOK_EVENTS: Record<WebhookEventType, { label: string; description: string }> = {
  'message.created': { label: 'Message Created', description: 'Triggered when a new message is sent' },
  'message.updated': { label: 'Message Updated', description: 'Triggered when a message is edited' },
  'message.deleted': { label: 'Message Deleted', description: 'Triggered when a message is deleted' },
  'channel.created': { label: 'Channel Created', description: 'Triggered when a new channel is created' },
  'channel.updated': { label: 'Channel Updated', description: 'Triggered when a channel is updated' },
  'channel.deleted': { label: 'Channel Deleted', description: 'Triggered when a channel is deleted' },
  'member.joined': { label: 'Member Joined', description: 'Triggered when a member joins' },
  'member.left': { label: 'Member Left', description: 'Triggered when a member leaves' },
  'vp.status_changed': { label: 'VP Status Changed', description: 'Triggered when a VP status changes' },
  'vp.message': { label: 'VP Message', description: 'Triggered when a VP sends a message' },
  'task.created': { label: 'Task Created', description: 'Triggered when a task is created' },
  'task.completed': { label: 'Task Completed', description: 'Triggered when a task is completed' },
  'workflow.triggered': { label: 'Workflow Triggered', description: 'Triggered when a workflow starts' },
  'workflow.completed': { label: 'Workflow Completed', description: 'Triggered when a workflow completes' },
};

export const INTEGRATION_STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-500/10' },
  inactive: { label: 'Inactive', color: 'text-gray-600', bgColor: 'bg-gray-500/10' },
  error: { label: 'Error', color: 'text-red-600', bgColor: 'bg-red-500/10' },
  pending: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-500/10' },
};
