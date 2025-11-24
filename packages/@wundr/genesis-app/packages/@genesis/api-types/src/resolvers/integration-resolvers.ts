/**
 * Integration and Webhook GraphQL Resolvers
 *
 * Comprehensive resolvers for integration and webhook operations including queries, mutations,
 * subscriptions, and field resolvers. Implements third-party integrations, webhook management,
 * delivery tracking, and retry mechanisms.
 *
 * @module @genesis/api-types/resolvers/integration-resolvers
 */

import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Integration provider enum
 */
export const IntegrationProvider = {
  Slack: 'SLACK',
  Teams: 'TEAMS',
  Github: 'GITHUB',
  Jira: 'JIRA',
  Notion: 'NOTION',
  Linear: 'LINEAR',
  Salesforce: 'SALESFORCE',
  Hubspot: 'HUBSPOT',
  Zapier: 'ZAPIER',
  Custom: 'CUSTOM',
} as const;

export type IntegrationProviderValue = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

/**
 * Integration status enum
 */
export const IntegrationStatus = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Pending: 'PENDING',
  Error: 'ERROR',
  Revoked: 'REVOKED',
} as const;

export type IntegrationStatusValue = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

/**
 * Integration permission enum
 */
export const IntegrationPermission = {
  Read: 'READ',
  Write: 'WRITE',
  Delete: 'DELETE',
  Admin: 'ADMIN',
  Sync: 'SYNC',
} as const;

export type IntegrationPermissionValue = (typeof IntegrationPermission)[keyof typeof IntegrationPermission];

/**
 * Webhook event enum
 */
export const WebhookEvent = {
  MessageCreated: 'MESSAGE_CREATED',
  MessageUpdated: 'MESSAGE_UPDATED',
  MessageDeleted: 'MESSAGE_DELETED',
  ChannelCreated: 'CHANNEL_CREATED',
  ChannelUpdated: 'CHANNEL_UPDATED',
  ChannelDeleted: 'CHANNEL_DELETED',
  MemberJoined: 'MEMBER_JOINED',
  MemberLeft: 'MEMBER_LEFT',
  FileUploaded: 'FILE_UPLOADED',
  FileDeleted: 'FILE_DELETED',
  CallStarted: 'CALL_STARTED',
  CallEnded: 'CALL_ENDED',
  VPMessage: 'VP_MESSAGE',
  VPAction: 'VP_ACTION',
} as const;

export type WebhookEventValue = (typeof WebhookEvent)[keyof typeof WebhookEvent];

/**
 * Webhook status enum
 */
export const WebhookStatus = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Paused: 'PAUSED',
  Failed: 'FAILED',
} as const;

export type WebhookStatusValue = (typeof WebhookStatus)[keyof typeof WebhookStatus];

/**
 * Delivery status enum
 */
export const DeliveryStatus = {
  Pending: 'PENDING',
  Delivered: 'DELIVERED',
  Failed: 'FAILED',
  Retrying: 'RETRYING',
} as const;

export type DeliveryStatusValue = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * DataLoader interface for N+1 prevention
 */
interface DataLoader<K, V> {
  load(key: K): Promise<V>;
  loadMany(keys: K[]): Promise<(V | Error)[]>;
  clear(key: K): DataLoader<K, V>;
  clearAll(): DataLoader<K, V>;
}

/**
 * Generic Prisma model interface for integration-related operations
 */
interface PrismaModel {
  findUnique: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
  count: (args: unknown) => Promise<number>;
  upsert: (args: unknown) => Promise<unknown>;
}

/**
 * Prisma client interface with integration models
 */
interface PrismaClientWithIntegrations {
  integrationConfig: PrismaModel;
  webhookConfig: PrismaModel;
  webhookDelivery: PrismaModel;
  webhookAttempt: PrismaModel;
  workspace: PrismaModel;
  user: PrismaModel;
}

/**
 * Integration Service interface for business logic operations
 */
export interface IntegrationService {
  /** Test integration connection */
  testConnection(integrationId: string): Promise<TestConnectionResult>;
  /** Sync integration data */
  syncIntegration(integrationId: string): Promise<SyncResult>;
  /** Get available providers */
  getProviders(): Promise<ProviderInfo[]>;
  /** Get webhook event types */
  getWebhookEvents(): Promise<WebhookEventInfo[]>;
  /** Trigger webhook */
  triggerWebhook(webhookId: string, event: WebhookEventValue, payload: unknown): Promise<WebhookDelivery>;
  /** Retry failed delivery */
  retryDelivery(deliveryId: string): Promise<WebhookDelivery>;
  /** Generate webhook secret */
  generateSecret(): string;
  /** Rotate webhook secret */
  rotateSecret(webhookId: string): Promise<{ secret: string; previousSecret: string | null }>;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClientWithIntegrations;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Optional integration service for business logic */
  integrationService?: IntegrationService;
  /** DataLoaders for N+1 prevention */
  dataloaders?: {
    workspace?: DataLoader<string, Workspace>;
    user?: DataLoader<string, User>;
    integration?: DataLoader<string, IntegrationConfig>;
  };
  /** Unique request identifier */
  requestId: string;
}

// =============================================================================
// ENTITY TYPES
// =============================================================================

/**
 * Workspace entity type
 */
interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User entity type
 */
interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Integration config entity type
 */
interface IntegrationConfig {
  id: string;
  workspaceId: string;
  provider: IntegrationProviderValue;
  name: string;
  description: string | null;
  status: IntegrationStatusValue;
  permissions: IntegrationPermissionValue[];
  settings: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
  errorMessage: string | null;
}

/**
 * Webhook retry policy type
 */
interface WebhookRetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Webhook config entity type
 */
interface WebhookConfig {
  id: string;
  workspaceId: string;
  integrationId: string | null;
  name: string;
  url: string;
  events: WebhookEventValue[];
  status: WebhookStatusValue;
  retryPolicy: WebhookRetryPolicy;
  headers: Record<string, string> | null;
  secret: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt: Date | null;
  failureCount: number;
}

/**
 * Webhook attempt type
 */
interface WebhookAttempt {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  error: string | null;
  durationMs: number;
  createdAt: Date;
}

/**
 * Webhook delivery entity type
 */
interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventValue;
  payload: unknown;
  status: DeliveryStatusValue;
  attempts: WebhookAttempt[];
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Sync result type
 */
interface SyncResult {
  integrationId: string;
  provider: IntegrationProviderValue;
  syncedAt: Date;
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
  nextSyncAt: Date | null;
}

/**
 * Test connection result type
 */
interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

/**
 * Provider info type
 */
interface ProviderInfo {
  provider: IntegrationProviderValue;
  name: string;
  description: string;
  iconUrl: string;
  docsUrl: string;
  permissions: IntegrationPermissionValue[];
  authType: 'OAUTH' | 'API_KEY' | 'WEBHOOK';
}

/**
 * Webhook event info type
 */
interface WebhookEventInfo {
  event: WebhookEventValue;
  name: string;
  description: string;
  payloadSchema: unknown;
}

/**
 * Webhook secret result type
 */
interface WebhookSecretResult {
  webhook: WebhookConfig;
  secret: string;
  previousSecret: string | null;
}

/**
 * Webhook create result type
 */
interface WebhookCreateResult {
  webhook: WebhookConfig;
  secret: string;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating an integration
 */
interface CreateIntegrationInput {
  provider: IntegrationProviderValue;
  name: string;
  description?: string | null;
  settings?: Record<string, unknown> | null;
  permissions?: IntegrationPermissionValue[] | null;
}

/**
 * Input for updating an integration
 */
interface UpdateIntegrationInput {
  name?: string | null;
  description?: string | null;
  status?: IntegrationStatusValue | null;
  settings?: Record<string, unknown> | null;
  permissions?: IntegrationPermissionValue[] | null;
}

/**
 * Input for webhook retry policy
 */
interface WebhookRetryPolicyInput {
  maxAttempts?: number | null;
  initialDelayMs?: number | null;
  maxDelayMs?: number | null;
  backoffMultiplier?: number | null;
}

/**
 * Input for creating a webhook
 */
interface CreateWebhookInput {
  integrationId?: string | null;
  name: string;
  url: string;
  events: WebhookEventValue[];
  headers?: Record<string, string> | null;
  retryPolicy?: WebhookRetryPolicyInput | null;
}

/**
 * Input for updating a webhook
 */
interface UpdateWebhookInput {
  name?: string | null;
  url?: string | null;
  events?: WebhookEventValue[] | null;
  status?: WebhookStatusValue | null;
  headers?: Record<string, string> | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface IntegrationQueryArgs {
  id: string;
}

interface IntegrationsQueryArgs {
  workspaceId: string;
  provider?: IntegrationProviderValue | null;
  status?: IntegrationStatusValue | null;
}

interface WebhookQueryArgs {
  id: string;
}

interface WebhooksQueryArgs {
  workspaceId: string;
  integrationId?: string | null;
  status?: WebhookStatusValue | null;
}

interface WebhookDeliveriesQueryArgs {
  webhookId: string;
  status?: DeliveryStatusValue | null;
  limit?: number | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateIntegrationArgs {
  workspaceId: string;
  input: CreateIntegrationInput;
}

interface UpdateIntegrationArgs {
  id: string;
  input: UpdateIntegrationInput;
}

interface DeleteIntegrationArgs {
  id: string;
}

interface TestIntegrationArgs {
  id: string;
}

interface SyncIntegrationArgs {
  id: string;
}

interface CreateWebhookArgs {
  workspaceId: string;
  input: CreateWebhookInput;
}

interface UpdateWebhookArgs {
  id: string;
  input: UpdateWebhookInput;
}

interface DeleteWebhookArgs {
  id: string;
}

interface TestWebhookArgs {
  id: string;
}

interface RotateWebhookSecretArgs {
  id: string;
}

interface RetryDeliveryArgs {
  deliveryId: string;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface IntegrationStatusChangedArgs {
  workspaceId: string;
}

interface WebhookDeliveredArgs {
  workspaceId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

// Payload types for future use with error handling patterns
interface _IntegrationPayload {
  integration: IntegrationConfig | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface _WebhookPayload {
  webhook: WebhookConfig | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for integration status changes */
export const INTEGRATION_STATUS_CHANGED = 'INTEGRATION_STATUS_CHANGED';

/** Event name for webhook deliveries */
export const WEBHOOK_DELIVERED = 'WEBHOOK_DELIVERED';

// =============================================================================
// TYPE DEFINITIONS (GraphQL SDL)
// =============================================================================

/**
 * GraphQL type definitions for integrations
 */
export const integrationTypeDefs = `#graphql
  type IntegrationConfig {
    id: ID!
    workspaceId: ID!
    provider: IntegrationProvider!
    name: String!
    description: String
    status: IntegrationStatus!
    permissions: [IntegrationPermission!]!
    settings: JSON
    createdBy: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastSyncAt: DateTime
    errorMessage: String
    workspace: Workspace!
    creator: User!
  }

  type WebhookConfig {
    id: ID!
    workspaceId: ID!
    integrationId: ID
    name: String!
    url: String!
    events: [WebhookEvent!]!
    status: WebhookStatus!
    retryPolicy: WebhookRetryPolicy!
    headers: JSON
    createdBy: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastTriggeredAt: DateTime
    failureCount: Int!
    workspace: Workspace!
    integration: IntegrationConfig
    recentDeliveries: [WebhookDelivery!]!
    successRate: Float!
  }

  type WebhookRetryPolicy {
    maxAttempts: Int!
    initialDelayMs: Int!
    maxDelayMs: Int!
    backoffMultiplier: Float!
  }

  type WebhookDelivery {
    id: ID!
    webhookId: ID!
    event: WebhookEvent!
    payload: JSON!
    status: DeliveryStatus!
    attempts: [WebhookAttempt!]!
    createdAt: DateTime!
    completedAt: DateTime
  }

  type WebhookAttempt {
    id: ID!
    deliveryId: ID!
    attemptNumber: Int!
    requestHeaders: JSON!
    requestBody: String!
    responseStatus: Int
    responseHeaders: JSON
    responseBody: String
    error: String
    durationMs: Int!
    createdAt: DateTime!
  }

  type SyncResult {
    integrationId: ID!
    provider: IntegrationProvider!
    syncedAt: DateTime!
    itemsSynced: Int!
    itemsFailed: Int!
    errors: [String!]!
    nextSyncAt: DateTime
  }

  type TestConnectionResult {
    success: Boolean!
    message: String!
    latencyMs: Int!
  }

  type ProviderInfo {
    provider: IntegrationProvider!
    name: String!
    description: String!
    iconUrl: String!
    docsUrl: String!
    permissions: [IntegrationPermission!]!
    authType: String!
  }

  type WebhookEventInfo {
    event: WebhookEvent!
    name: String!
    description: String!
    payloadSchema: JSON
  }

  type WebhookSecretResult {
    webhook: WebhookConfig!
    secret: String!
    previousSecret: String
  }

  type WebhookCreateResult {
    webhook: WebhookConfig!
    secret: String!
  }

  enum IntegrationProvider {
    SLACK
    TEAMS
    GITHUB
    JIRA
    NOTION
    LINEAR
    SALESFORCE
    HUBSPOT
    ZAPIER
    CUSTOM
  }

  enum IntegrationStatus {
    ACTIVE
    INACTIVE
    PENDING
    ERROR
    REVOKED
  }

  enum IntegrationPermission {
    READ
    WRITE
    DELETE
    ADMIN
    SYNC
  }

  enum WebhookEvent {
    MESSAGE_CREATED
    MESSAGE_UPDATED
    MESSAGE_DELETED
    CHANNEL_CREATED
    CHANNEL_UPDATED
    CHANNEL_DELETED
    MEMBER_JOINED
    MEMBER_LEFT
    FILE_UPLOADED
    FILE_DELETED
    CALL_STARTED
    CALL_ENDED
    VP_MESSAGE
    VP_ACTION
  }

  enum WebhookStatus {
    ACTIVE
    INACTIVE
    PAUSED
    FAILED
  }

  enum DeliveryStatus {
    PENDING
    DELIVERED
    FAILED
    RETRYING
  }

  input CreateIntegrationInput {
    provider: IntegrationProvider!
    name: String!
    description: String
    settings: JSON
    permissions: [IntegrationPermission!]
  }

  input UpdateIntegrationInput {
    name: String
    description: String
    status: IntegrationStatus
    settings: JSON
    permissions: [IntegrationPermission!]
  }

  input WebhookRetryPolicyInput {
    maxAttempts: Int
    initialDelayMs: Int
    maxDelayMs: Int
    backoffMultiplier: Float
  }

  input CreateWebhookInput {
    integrationId: ID
    name: String!
    url: String!
    events: [WebhookEvent!]!
    headers: JSON
    retryPolicy: WebhookRetryPolicyInput
  }

  input UpdateWebhookInput {
    name: String
    url: String
    events: [WebhookEvent!]
    status: WebhookStatus
    headers: JSON
  }

  extend type Query {
    integration(id: ID!): IntegrationConfig
    integrations(workspaceId: ID!, provider: IntegrationProvider, status: IntegrationStatus): [IntegrationConfig!]!
    webhook(id: ID!): WebhookConfig
    webhooks(workspaceId: ID!, integrationId: ID, status: WebhookStatus): [WebhookConfig!]!
    webhookDeliveries(webhookId: ID!, status: DeliveryStatus, limit: Int): [WebhookDelivery!]!
    availableProviders: [ProviderInfo!]!
    webhookEvents: [WebhookEventInfo!]!
  }

  extend type Mutation {
    createIntegration(workspaceId: ID!, input: CreateIntegrationInput!): IntegrationConfig!
    updateIntegration(id: ID!, input: UpdateIntegrationInput!): IntegrationConfig!
    deleteIntegration(id: ID!): Boolean!
    testIntegration(id: ID!): TestConnectionResult!
    syncIntegration(id: ID!): SyncResult!
    createWebhook(workspaceId: ID!, input: CreateWebhookInput!): WebhookCreateResult!
    updateWebhook(id: ID!, input: UpdateWebhookInput!): WebhookConfig!
    deleteWebhook(id: ID!): Boolean!
    testWebhook(id: ID!): WebhookDelivery!
    rotateWebhookSecret(id: ID!): WebhookSecretResult!
    retryDelivery(deliveryId: ID!): WebhookDelivery!
  }

  extend type Subscription {
    integrationStatusChanged(workspaceId: ID!): IntegrationConfig!
    webhookDelivered(workspaceId: ID!): WebhookDelivery!
  }
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext,
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Generate a random webhook secret
 */
function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get default retry policy
 */
function getDefaultRetryPolicy(): WebhookRetryPolicy {
  return {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  };
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate webhook events
 */
function isValidWebhookEvents(events: WebhookEventValue[]): boolean {
  const validEvents = Object.values(WebhookEvent);
  return events.length > 0 && events.every(e => validEvents.includes(e));
}

/**
 * Calculate success rate from recent deliveries
 */
function calculateSuccessRate(deliveries: WebhookDelivery[]): number {
  if (deliveries.length === 0) {
return 100;
}
  const successful = deliveries.filter(d => d.status === 'DELIVERED').length;
  return Math.round((successful / deliveries.length) * 10000) / 100;
}

/**
 * Get available provider information
 */
function getProviderInfo(): ProviderInfo[] {
  return [
    {
      provider: 'SLACK',
      name: 'Slack',
      description: 'Connect with Slack workspaces for messaging and notifications',
      iconUrl: 'https://cdn.genesis.app/icons/slack.svg',
      docsUrl: 'https://docs.genesis.app/integrations/slack',
      permissions: ['READ', 'WRITE', 'SYNC'],
      authType: 'OAUTH',
    },
    {
      provider: 'TEAMS',
      name: 'Microsoft Teams',
      description: 'Integrate with Microsoft Teams for collaboration',
      iconUrl: 'https://cdn.genesis.app/icons/teams.svg',
      docsUrl: 'https://docs.genesis.app/integrations/teams',
      permissions: ['READ', 'WRITE', 'SYNC'],
      authType: 'OAUTH',
    },
    {
      provider: 'GITHUB',
      name: 'GitHub',
      description: 'Connect repositories for code updates and PR notifications',
      iconUrl: 'https://cdn.genesis.app/icons/github.svg',
      docsUrl: 'https://docs.genesis.app/integrations/github',
      permissions: ['READ', 'WRITE', 'ADMIN'],
      authType: 'OAUTH',
    },
    {
      provider: 'JIRA',
      name: 'Jira',
      description: 'Sync issues and projects with Atlassian Jira',
      iconUrl: 'https://cdn.genesis.app/icons/jira.svg',
      docsUrl: 'https://docs.genesis.app/integrations/jira',
      permissions: ['READ', 'WRITE', 'SYNC'],
      authType: 'OAUTH',
    },
    {
      provider: 'NOTION',
      name: 'Notion',
      description: 'Connect Notion workspaces for document sync',
      iconUrl: 'https://cdn.genesis.app/icons/notion.svg',
      docsUrl: 'https://docs.genesis.app/integrations/notion',
      permissions: ['READ', 'WRITE'],
      authType: 'OAUTH',
    },
    {
      provider: 'LINEAR',
      name: 'Linear',
      description: 'Integrate with Linear for issue tracking',
      iconUrl: 'https://cdn.genesis.app/icons/linear.svg',
      docsUrl: 'https://docs.genesis.app/integrations/linear',
      permissions: ['READ', 'WRITE', 'SYNC'],
      authType: 'OAUTH',
    },
    {
      provider: 'SALESFORCE',
      name: 'Salesforce',
      description: 'Connect Salesforce CRM for customer data',
      iconUrl: 'https://cdn.genesis.app/icons/salesforce.svg',
      docsUrl: 'https://docs.genesis.app/integrations/salesforce',
      permissions: ['READ', 'WRITE', 'SYNC', 'ADMIN'],
      authType: 'OAUTH',
    },
    {
      provider: 'HUBSPOT',
      name: 'HubSpot',
      description: 'Integrate HubSpot for marketing and sales',
      iconUrl: 'https://cdn.genesis.app/icons/hubspot.svg',
      docsUrl: 'https://docs.genesis.app/integrations/hubspot',
      permissions: ['READ', 'WRITE', 'SYNC'],
      authType: 'API_KEY',
    },
    {
      provider: 'ZAPIER',
      name: 'Zapier',
      description: 'Connect thousands of apps via Zapier',
      iconUrl: 'https://cdn.genesis.app/icons/zapier.svg',
      docsUrl: 'https://docs.genesis.app/integrations/zapier',
      permissions: ['READ', 'WRITE'],
      authType: 'WEBHOOK',
    },
    {
      provider: 'CUSTOM',
      name: 'Custom Integration',
      description: 'Build custom integrations with the API',
      iconUrl: 'https://cdn.genesis.app/icons/custom.svg',
      docsUrl: 'https://docs.genesis.app/integrations/custom',
      permissions: ['READ', 'WRITE', 'DELETE', 'ADMIN', 'SYNC'],
      authType: 'API_KEY',
    },
  ];
}

/**
 * Get webhook event information
 */
function getWebhookEventInfo(): WebhookEventInfo[] {
  return [
    {
      event: 'MESSAGE_CREATED',
      name: 'Message Created',
      description: 'Triggered when a new message is created',
      payloadSchema: { type: 'object', properties: { messageId: { type: 'string' } } },
    },
    {
      event: 'MESSAGE_UPDATED',
      name: 'Message Updated',
      description: 'Triggered when a message is edited',
      payloadSchema: { type: 'object', properties: { messageId: { type: 'string' } } },
    },
    {
      event: 'MESSAGE_DELETED',
      name: 'Message Deleted',
      description: 'Triggered when a message is deleted',
      payloadSchema: { type: 'object', properties: { messageId: { type: 'string' } } },
    },
    {
      event: 'CHANNEL_CREATED',
      name: 'Channel Created',
      description: 'Triggered when a new channel is created',
      payloadSchema: { type: 'object', properties: { channelId: { type: 'string' } } },
    },
    {
      event: 'CHANNEL_UPDATED',
      name: 'Channel Updated',
      description: 'Triggered when a channel is updated',
      payloadSchema: { type: 'object', properties: { channelId: { type: 'string' } } },
    },
    {
      event: 'CHANNEL_DELETED',
      name: 'Channel Deleted',
      description: 'Triggered when a channel is deleted',
      payloadSchema: { type: 'object', properties: { channelId: { type: 'string' } } },
    },
    {
      event: 'MEMBER_JOINED',
      name: 'Member Joined',
      description: 'Triggered when a user joins a channel',
      payloadSchema: { type: 'object', properties: { userId: { type: 'string' }, channelId: { type: 'string' } } },
    },
    {
      event: 'MEMBER_LEFT',
      name: 'Member Left',
      description: 'Triggered when a user leaves a channel',
      payloadSchema: { type: 'object', properties: { userId: { type: 'string' }, channelId: { type: 'string' } } },
    },
    {
      event: 'FILE_UPLOADED',
      name: 'File Uploaded',
      description: 'Triggered when a file is uploaded',
      payloadSchema: { type: 'object', properties: { fileId: { type: 'string' } } },
    },
    {
      event: 'FILE_DELETED',
      name: 'File Deleted',
      description: 'Triggered when a file is deleted',
      payloadSchema: { type: 'object', properties: { fileId: { type: 'string' } } },
    },
    {
      event: 'CALL_STARTED',
      name: 'Call Started',
      description: 'Triggered when a call begins',
      payloadSchema: { type: 'object', properties: { callId: { type: 'string' } } },
    },
    {
      event: 'CALL_ENDED',
      name: 'Call Ended',
      description: 'Triggered when a call ends',
      payloadSchema: { type: 'object', properties: { callId: { type: 'string' }, duration: { type: 'number' } } },
    },
    {
      event: 'VP_MESSAGE',
      name: 'VP Message',
      description: 'Triggered when a VP sends a message',
      payloadSchema: { type: 'object', properties: { vpId: { type: 'string' }, messageId: { type: 'string' } } },
    },
    {
      event: 'VP_ACTION',
      name: 'VP Action',
      description: 'Triggered when a VP performs an action',
      payloadSchema: { type: 'object', properties: { vpId: { type: 'string' }, actionType: { type: 'string' } } },
    },
  ];
}

// =============================================================================
// INTEGRATION QUERY RESOLVERS
// =============================================================================

/**
 * Integration Query resolvers
 */
export const integrationQueries = {
  /**
   * Get a single integration by ID
   */
  integration: async (
    _parent: unknown,
    args: IntegrationQueryArgs,
    context: GraphQLContext,
  ): Promise<IntegrationConfig | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const integration = await context.prisma.integrationConfig.findUnique({
      where: { id: args.id },
    }) as IntegrationConfig | null;

    return integration;
  },

  /**
   * Get all integrations for a workspace
   */
  integrations: async (
    _parent: unknown,
    args: IntegrationsQueryArgs,
    context: GraphQLContext,
  ): Promise<IntegrationConfig[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const where: Record<string, unknown> = {
      workspaceId: args.workspaceId,
    };

    if (args.provider) {
      where.provider = args.provider;
    }

    if (args.status) {
      where.status = args.status;
    }

    const integrations = await context.prisma.integrationConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return integrations as IntegrationConfig[];
  },

  /**
   * Get a single webhook by ID
   */
  webhook: async (
    _parent: unknown,
    args: WebhookQueryArgs,
    context: GraphQLContext,
  ): Promise<WebhookConfig | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const webhook = await context.prisma.webhookConfig.findUnique({
      where: { id: args.id },
    }) as WebhookConfig | null;

    return webhook;
  },

  /**
   * Get all webhooks for a workspace
   */
  webhooks: async (
    _parent: unknown,
    args: WebhooksQueryArgs,
    context: GraphQLContext,
  ): Promise<WebhookConfig[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const where: Record<string, unknown> = {
      workspaceId: args.workspaceId,
    };

    if (args.integrationId) {
      where.integrationId = args.integrationId;
    }

    if (args.status) {
      where.status = args.status;
    }

    const webhooks = await context.prisma.webhookConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return webhooks as WebhookConfig[];
  },

  /**
   * Get webhook deliveries
   */
  webhookDeliveries: async (
    _parent: unknown,
    args: WebhookDeliveriesQueryArgs,
    context: GraphQLContext,
  ): Promise<WebhookDelivery[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const where: Record<string, unknown> = {
      webhookId: args.webhookId,
    };

    if (args.status) {
      where.status = args.status;
    }

    const deliveries = await context.prisma.webhookDelivery.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { attempts: true },
    });

    return deliveries as unknown as WebhookDelivery[];
  },

  /**
   * Get available integration providers
   */
  availableProviders: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext,
  ): Promise<ProviderInfo[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (context.integrationService) {
      return context.integrationService.getProviders();
    }

    return getProviderInfo();
  },

  /**
   * Get available webhook events
   */
  webhookEvents: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext,
  ): Promise<WebhookEventInfo[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (context.integrationService) {
      return context.integrationService.getWebhookEvents();
    }

    return getWebhookEventInfo();
  },
};

// =============================================================================
// INTEGRATION MUTATION RESOLVERS
// =============================================================================

/**
 * Integration Mutation resolvers
 */
export const integrationMutations = {
  /**
   * Create a new integration
   */
  createIntegration: async (
    _parent: unknown,
    args: CreateIntegrationArgs,
    context: GraphQLContext,
  ): Promise<IntegrationConfig> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, input } = args;

    // Validate workspace exists
    const workspace = await context.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Create the integration
    const integration = await context.prisma.integrationConfig.create({
      data: {
        workspaceId,
        provider: input.provider,
        name: input.name,
        description: input.description ?? null,
        status: 'PENDING',
        permissions: input.permissions ?? ['READ'],
        settings: input.settings ?? {},
        createdBy: context.user.id,
      },
    }) as IntegrationConfig;

    // Publish status change event
    await context.pubsub.publish(`${INTEGRATION_STATUS_CHANGED}_${workspaceId}`, {
      integrationStatusChanged: integration,
    });

    return integration;
  },

  /**
   * Update an existing integration
   */
  updateIntegration: async (
    _parent: unknown,
    args: UpdateIntegrationArgs,
    context: GraphQLContext,
  ): Promise<IntegrationConfig> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Verify integration exists
    const existing = await context.prisma.integrationConfig.findUnique({
      where: { id },
    }) as IntegrationConfig | null;

    if (!existing) {
      throw new GraphQLError('Integration not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== null) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.status !== undefined && input.status !== null) {
      updateData.status = input.status;
    }
    if (input.settings !== undefined && input.settings !== null) {
      updateData.settings = input.settings;
    }
    if (input.permissions !== undefined && input.permissions !== null) {
      updateData.permissions = input.permissions;
    }

    const integration = await context.prisma.integrationConfig.update({
      where: { id },
      data: updateData,
    }) as IntegrationConfig;

    // Publish status change event if status changed
    if (input.status && input.status !== existing.status) {
      await context.pubsub.publish(`${INTEGRATION_STATUS_CHANGED}_${existing.workspaceId}`, {
        integrationStatusChanged: integration,
      });
    }

    return integration;
  },

  /**
   * Delete an integration
   */
  deleteIntegration: async (
    _parent: unknown,
    args: DeleteIntegrationArgs,
    context: GraphQLContext,
  ): Promise<boolean> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.integrationConfig.findUnique({
      where: { id: args.id },
    }) as IntegrationConfig | null;

    if (!existing) {
      throw new GraphQLError('Integration not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Delete associated webhooks first
    await context.prisma.webhookConfig.deleteMany({
      where: { integrationId: args.id },
    });

    // Delete the integration
    await context.prisma.integrationConfig.delete({
      where: { id: args.id },
    });

    return true;
  },

  /**
   * Test an integration connection
   */
  testIntegration: async (
    _parent: unknown,
    args: TestIntegrationArgs,
    context: GraphQLContext,
  ): Promise<TestConnectionResult> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.integrationConfig.findUnique({
      where: { id: args.id },
    }) as IntegrationConfig | null;

    if (!existing) {
      throw new GraphQLError('Integration not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Use integration service if available
    if (context.integrationService) {
      return context.integrationService.testConnection(args.id);
    }

    // Default mock implementation
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 100));
    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      message: 'Connection successful',
      latencyMs,
    };
  },

  /**
   * Sync integration data
   */
  syncIntegration: async (
    _parent: unknown,
    args: SyncIntegrationArgs,
    context: GraphQLContext,
  ): Promise<SyncResult> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.integrationConfig.findUnique({
      where: { id: args.id },
    }) as IntegrationConfig | null;

    if (!existing) {
      throw new GraphQLError('Integration not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existing.status !== 'ACTIVE') {
      throw new GraphQLError('Integration must be active to sync', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Use integration service if available
    if (context.integrationService) {
      const result = await context.integrationService.syncIntegration(args.id);

      // Update last sync time
      await context.prisma.integrationConfig.update({
        where: { id: args.id },
        data: { lastSyncAt: result.syncedAt },
      });

      return result;
    }

    // Default mock implementation
    const syncedAt = new Date();
    await context.prisma.integrationConfig.update({
      where: { id: args.id },
      data: { lastSyncAt: syncedAt },
    });

    return {
      integrationId: args.id,
      provider: existing.provider,
      syncedAt,
      itemsSynced: 0,
      itemsFailed: 0,
      errors: [],
      nextSyncAt: new Date(Date.now() + 3600000), // 1 hour from now
    };
  },

  /**
   * Create a new webhook
   */
  createWebhook: async (
    _parent: unknown,
    args: CreateWebhookArgs,
    context: GraphQLContext,
  ): Promise<WebhookCreateResult> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, input } = args;

    // Validate URL
    if (!isValidUrl(input.url)) {
      throw new GraphQLError('Invalid webhook URL', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate events
    if (!isValidWebhookEvents(input.events)) {
      throw new GraphQLError('Invalid webhook events', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate workspace exists
    const workspace = await context.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Validate integration if provided
    if (input.integrationId) {
      const integration = await context.prisma.integrationConfig.findUnique({
        where: { id: input.integrationId },
      });

      if (!integration) {
        throw new GraphQLError('Integration not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
    }

    // Generate secret
    const secret = context.integrationService?.generateSecret() ?? generateWebhookSecret();

    // Merge retry policy with defaults
    const retryPolicy: WebhookRetryPolicy = {
      ...getDefaultRetryPolicy(),
      ...(input.retryPolicy?.maxAttempts && { maxAttempts: input.retryPolicy.maxAttempts }),
      ...(input.retryPolicy?.initialDelayMs && { initialDelayMs: input.retryPolicy.initialDelayMs }),
      ...(input.retryPolicy?.maxDelayMs && { maxDelayMs: input.retryPolicy.maxDelayMs }),
      ...(input.retryPolicy?.backoffMultiplier && { backoffMultiplier: input.retryPolicy.backoffMultiplier }),
    };

    // Create the webhook
    const webhook = await context.prisma.webhookConfig.create({
      data: {
        workspaceId,
        integrationId: input.integrationId ?? null,
        name: input.name,
        url: input.url,
        events: input.events,
        status: 'ACTIVE',
        retryPolicy,
        headers: input.headers ?? null,
        secret,
        createdBy: context.user.id,
        failureCount: 0,
      },
    }) as WebhookConfig;

    return {
      webhook,
      secret,
    };
  },

  /**
   * Update an existing webhook
   */
  updateWebhook: async (
    _parent: unknown,
    args: UpdateWebhookArgs,
    context: GraphQLContext,
  ): Promise<WebhookConfig> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Verify webhook exists
    const existing = await context.prisma.webhookConfig.findUnique({
      where: { id },
    }) as WebhookConfig | null;

    if (!existing) {
      throw new GraphQLError('Webhook not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Validate URL if provided
    if (input.url && !isValidUrl(input.url)) {
      throw new GraphQLError('Invalid webhook URL', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate events if provided
    if (input.events && !isValidWebhookEvents(input.events)) {
      throw new GraphQLError('Invalid webhook events', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== null) {
      updateData.name = input.name;
    }
    if (input.url !== undefined && input.url !== null) {
      updateData.url = input.url;
    }
    if (input.events !== undefined && input.events !== null) {
      updateData.events = input.events;
    }
    if (input.status !== undefined && input.status !== null) {
      updateData.status = input.status;
      // Reset failure count when reactivating
      if (input.status === 'ACTIVE') {
        updateData.failureCount = 0;
      }
    }
    if (input.headers !== undefined) {
      updateData.headers = input.headers;
    }

    const webhook = await context.prisma.webhookConfig.update({
      where: { id },
      data: updateData,
    }) as WebhookConfig;

    return webhook;
  },

  /**
   * Delete a webhook
   */
  deleteWebhook: async (
    _parent: unknown,
    args: DeleteWebhookArgs,
    context: GraphQLContext,
  ): Promise<boolean> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.webhookConfig.findUnique({
      where: { id: args.id },
    }) as WebhookConfig | null;

    if (!existing) {
      throw new GraphQLError('Webhook not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Delete associated deliveries first
    await context.prisma.webhookDelivery.deleteMany({
      where: { webhookId: args.id },
    });

    // Delete the webhook
    await context.prisma.webhookConfig.delete({
      where: { id: args.id },
    });

    return true;
  },

  /**
   * Test a webhook by sending a test event
   */
  testWebhook: async (
    _parent: unknown,
    args: TestWebhookArgs,
    context: GraphQLContext,
  ): Promise<WebhookDelivery> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.webhookConfig.findUnique({
      where: { id: args.id },
    }) as WebhookConfig | null;

    if (!existing) {
      throw new GraphQLError('Webhook not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Use integration service if available
    if (context.integrationService) {
      const delivery = await context.integrationService.triggerWebhook(
        args.id,
        'MESSAGE_CREATED',
        { test: true, timestamp: new Date().toISOString() },
      );

      // Publish webhook delivered event
      await context.pubsub.publish(`${WEBHOOK_DELIVERED}_${existing.workspaceId}`, {
        webhookDelivered: delivery,
      });

      return delivery;
    }

    // Default mock implementation
    const delivery: WebhookDelivery = {
      id: `del_${Date.now()}`,
      webhookId: args.id,
      event: 'MESSAGE_CREATED',
      payload: { test: true, timestamp: new Date().toISOString() },
      status: 'DELIVERED',
      attempts: [
        {
          id: `att_${Date.now()}`,
          deliveryId: `del_${Date.now()}`,
          attemptNumber: 1,
          requestHeaders: { 'Content-Type': 'application/json' },
          requestBody: JSON.stringify({ test: true }),
          responseStatus: 200,
          responseHeaders: {},
          responseBody: '{"success": true}',
          error: null,
          durationMs: 150,
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      completedAt: new Date(),
    };

    // Update last triggered timestamp
    await context.prisma.webhookConfig.update({
      where: { id: args.id },
      data: { lastTriggeredAt: new Date() },
    });

    return delivery;
  },

  /**
   * Rotate webhook secret
   */
  rotateWebhookSecret: async (
    _parent: unknown,
    args: RotateWebhookSecretArgs,
    context: GraphQLContext,
  ): Promise<WebhookSecretResult> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.webhookConfig.findUnique({
      where: { id: args.id },
    }) as WebhookConfig | null;

    if (!existing) {
      throw new GraphQLError('Webhook not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    let newSecret: string;
    let previousSecret: string | null = existing.secret;

    if (context.integrationService) {
      const result = await context.integrationService.rotateSecret(args.id);
      newSecret = result.secret;
      previousSecret = result.previousSecret;
    } else {
      newSecret = generateWebhookSecret();
    }

    const webhook = await context.prisma.webhookConfig.update({
      where: { id: args.id },
      data: { secret: newSecret },
    }) as WebhookConfig;

    return {
      webhook,
      secret: newSecret,
      previousSecret,
    };
  },

  /**
   * Retry a failed delivery
   */
  retryDelivery: async (
    _parent: unknown,
    args: RetryDeliveryArgs,
    context: GraphQLContext,
  ): Promise<WebhookDelivery> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = await context.prisma.webhookDelivery.findUnique({
      where: { id: args.deliveryId },
      include: { attempts: true },
    }) as unknown as WebhookDelivery | null;

    if (!existing) {
      throw new GraphQLError('Delivery not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existing.status === 'DELIVERED') {
      throw new GraphQLError('Delivery already succeeded', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Use integration service if available
    if (context.integrationService) {
      return context.integrationService.retryDelivery(args.deliveryId);
    }

    // Update delivery status to retrying
    const delivery = await context.prisma.webhookDelivery.update({
      where: { id: args.deliveryId },
      data: { status: 'RETRYING' },
      include: { attempts: true },
    }) as unknown as WebhookDelivery;

    return delivery;
  },
};

// =============================================================================
// INTEGRATION SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Integration Subscription resolvers
 */
export const integrationSubscriptions = {
  /**
   * Subscribe to integration status changes
   */
  integrationStatusChanged: {
    subscribe: async (
      _parent: unknown,
      args: IntegrationStatusChangedArgs,
      context: GraphQLContext,
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(`${INTEGRATION_STATUS_CHANGED}_${args.workspaceId}`);
    },
  },

  /**
   * Subscribe to webhook delivery events
   */
  webhookDelivered: {
    subscribe: async (
      _parent: unknown,
      args: WebhookDeliveredArgs,
      context: GraphQLContext,
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(`${WEBHOOK_DELIVERED}_${args.workspaceId}`);
    },
  },
};

// =============================================================================
// INTEGRATION FIELD RESOLVERS
// =============================================================================

/**
 * IntegrationConfig field resolvers for nested types
 */
export const IntegrationConfigFieldResolvers = {
  /**
   * Resolve the workspace for an integration
   */
  workspace: async (
    parent: IntegrationConfig,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<Workspace | null> => {
    // Use dataloader if available
    if (context.dataloaders?.workspace) {
      return context.dataloaders.workspace.load(parent.workspaceId);
    }

    const workspace = await context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });

    return workspace as Workspace | null;
  },

  /**
   * Resolve the creator for an integration
   */
  creator: async (
    parent: IntegrationConfig,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<User | null> => {
    // Use dataloader if available
    if (context.dataloaders?.user) {
      return context.dataloaders.user.load(parent.createdBy);
    }

    const user = await context.prisma.user.findUnique({
      where: { id: parent.createdBy },
    });

    return user as User | null;
  },

  /**
   * Parse settings JSON
   */
  settings: (parent: IntegrationConfig): Record<string, unknown> | null => {
    if (!parent.settings) {
      return null;
    }
    return parent.settings as Record<string, unknown>;
  },
};

/**
 * WebhookConfig field resolvers for nested types
 */
export const WebhookConfigFieldResolvers = {
  /**
   * Resolve the workspace for a webhook
   */
  workspace: async (
    parent: WebhookConfig,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<Workspace | null> => {
    // Use dataloader if available
    if (context.dataloaders?.workspace) {
      return context.dataloaders.workspace.load(parent.workspaceId);
    }

    const workspace = await context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });

    return workspace as Workspace | null;
  },

  /**
   * Resolve the integration for a webhook (if any)
   */
  integration: async (
    parent: WebhookConfig,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<IntegrationConfig | null> => {
    if (!parent.integrationId) {
      return null;
    }

    // Use dataloader if available
    if (context.dataloaders?.integration) {
      return context.dataloaders.integration.load(parent.integrationId);
    }

    const integration = await context.prisma.integrationConfig.findUnique({
      where: { id: parent.integrationId },
    });

    return integration as IntegrationConfig | null;
  },

  /**
   * Resolve recent deliveries for a webhook
   */
  recentDeliveries: async (
    parent: WebhookConfig,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<WebhookDelivery[]> => {
    const deliveries = await context.prisma.webhookDelivery.findMany({
      where: { webhookId: parent.id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { attempts: true },
    });

    return deliveries as unknown as WebhookDelivery[];
  },

  /**
   * Calculate success rate from recent deliveries
   */
  successRate: async (
    parent: WebhookConfig,
    _args: unknown,
    context: GraphQLContext,
  ): Promise<number> => {
    const deliveries = await context.prisma.webhookDelivery.findMany({
      where: { webhookId: parent.id },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    return calculateSuccessRate(deliveries as unknown as WebhookDelivery[]);
  },

  /**
   * Parse headers JSON
   */
  headers: (parent: WebhookConfig): Record<string, string> | null => {
    if (!parent.headers) {
      return null;
    }
    return parent.headers as Record<string, string>;
  },
};

/**
 * WebhookDelivery field resolvers
 */
export const WebhookDeliveryFieldResolvers = {
  /**
   * Parse payload JSON
   */
  payload: (parent: WebhookDelivery): Record<string, unknown> => {
    if (!parent.payload) {
      return {};
    }
    return parent.payload as Record<string, unknown>;
  },
};

// =============================================================================
// COMBINED INTEGRATION RESOLVERS
// =============================================================================

/**
 * Combined integration resolvers object for use with graphql-tools
 */
export const integrationResolvers = {
  Query: integrationQueries,
  Mutation: integrationMutations,
  Subscription: integrationSubscriptions,
  IntegrationConfig: IntegrationConfigFieldResolvers,
  WebhookConfig: WebhookConfigFieldResolvers,
  WebhookDelivery: WebhookDeliveryFieldResolvers,
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create integration resolvers with injected context
 *
 * @param baseContext - The base context with required services
 * @returns Configured integration resolvers
 *
 * @example
 * ```typescript
 * const resolvers = createIntegrationResolvers({
 *   prisma: prismaClient,
 *   pubsub: pubsubInstance,
 *   integrationService: integrationServiceInstance,
 * });
 * ```
 */
export function createIntegrationResolvers(
  baseContext: Pick<GraphQLContext, 'prisma' | 'pubsub' | 'integrationService' | 'dataloaders'>,
) {
  const createContext = (user: ContextUser): GraphQLContext => ({
    ...baseContext,
    user,
    requestId: `req_${Date.now()}`,
  });

  return {
    Query: {
      integration: (_: unknown, args: IntegrationQueryArgs, ctx: { user: ContextUser }) =>
        integrationQueries.integration(_, args, createContext(ctx.user)),
      integrations: (_: unknown, args: IntegrationsQueryArgs, ctx: { user: ContextUser }) =>
        integrationQueries.integrations(_, args, createContext(ctx.user)),
      webhook: (_: unknown, args: WebhookQueryArgs, ctx: { user: ContextUser }) =>
        integrationQueries.webhook(_, args, createContext(ctx.user)),
      webhooks: (_: unknown, args: WebhooksQueryArgs, ctx: { user: ContextUser }) =>
        integrationQueries.webhooks(_, args, createContext(ctx.user)),
      webhookDeliveries: (_: unknown, args: WebhookDeliveriesQueryArgs, ctx: { user: ContextUser }) =>
        integrationQueries.webhookDeliveries(_, args, createContext(ctx.user)),
      availableProviders: (_: unknown, args: Record<string, never>, ctx: { user: ContextUser }) =>
        integrationQueries.availableProviders(_, args, createContext(ctx.user)),
      webhookEvents: (_: unknown, args: Record<string, never>, ctx: { user: ContextUser }) =>
        integrationQueries.webhookEvents(_, args, createContext(ctx.user)),
    },
    Mutation: {
      createIntegration: (_: unknown, args: CreateIntegrationArgs, ctx: { user: ContextUser }) =>
        integrationMutations.createIntegration(_, args, createContext(ctx.user)),
      updateIntegration: (_: unknown, args: UpdateIntegrationArgs, ctx: { user: ContextUser }) =>
        integrationMutations.updateIntegration(_, args, createContext(ctx.user)),
      deleteIntegration: (_: unknown, args: DeleteIntegrationArgs, ctx: { user: ContextUser }) =>
        integrationMutations.deleteIntegration(_, args, createContext(ctx.user)),
      testIntegration: (_: unknown, args: TestIntegrationArgs, ctx: { user: ContextUser }) =>
        integrationMutations.testIntegration(_, args, createContext(ctx.user)),
      syncIntegration: (_: unknown, args: SyncIntegrationArgs, ctx: { user: ContextUser }) =>
        integrationMutations.syncIntegration(_, args, createContext(ctx.user)),
      createWebhook: (_: unknown, args: CreateWebhookArgs, ctx: { user: ContextUser }) =>
        integrationMutations.createWebhook(_, args, createContext(ctx.user)),
      updateWebhook: (_: unknown, args: UpdateWebhookArgs, ctx: { user: ContextUser }) =>
        integrationMutations.updateWebhook(_, args, createContext(ctx.user)),
      deleteWebhook: (_: unknown, args: DeleteWebhookArgs, ctx: { user: ContextUser }) =>
        integrationMutations.deleteWebhook(_, args, createContext(ctx.user)),
      testWebhook: (_: unknown, args: TestWebhookArgs, ctx: { user: ContextUser }) =>
        integrationMutations.testWebhook(_, args, createContext(ctx.user)),
      rotateWebhookSecret: (_: unknown, args: RotateWebhookSecretArgs, ctx: { user: ContextUser }) =>
        integrationMutations.rotateWebhookSecret(_, args, createContext(ctx.user)),
      retryDelivery: (_: unknown, args: RetryDeliveryArgs, ctx: { user: ContextUser }) =>
        integrationMutations.retryDelivery(_, args, createContext(ctx.user)),
    },
    Subscription: integrationSubscriptions,
    IntegrationConfig: IntegrationConfigFieldResolvers,
    WebhookConfig: WebhookConfigFieldResolvers,
    WebhookDelivery: WebhookDeliveryFieldResolvers,
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default integrationResolvers;
