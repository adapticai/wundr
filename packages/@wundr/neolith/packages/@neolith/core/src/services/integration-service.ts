/**
 * @genesis/core - Integration Service
 *
 * Service layer for managing third-party integrations and webhooks.
 * Handles OAuth flows, webhook delivery with retry logic, and signature verification.
 *
 * @packageDocumentation
 */

import * as crypto from 'crypto';

import { GenesisError } from '../errors';
import { DEFAULT_WEBHOOK_RETRY_POLICY } from '../types/integration';
import { generateShortId, generateCUID } from '../utils';

import type {
  IntegrationConfig,
  IntegrationProvider,
  OAuthToken,
  WebhookConfig,
  WebhookEvent,
  WebhookDelivery,
  WebhookAttempt,
  WebhookPayload,
  IntegrationEvent,
  SyncResult,
  CreateIntegrationInput,
  UpdateIntegrationInput,
  CreateWebhookInput,
  UpdateWebhookInput,
  ListIntegrationsOptions,
  ListWebhooksOptions,
  ListDeliveriesOptions,
  PaginatedIntegrationResult,
  PaginatedWebhookResult,
  PaginatedDeliveryResult,
  ConnectionTestResult,
} from '../types/integration';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base error for integration operations.
 */
export class IntegrationError extends GenesisError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, statusCode, metadata);
    this.name = 'IntegrationError';
  }
}

/**
 * Error thrown when an integration is not found.
 */
export class IntegrationNotFoundError extends GenesisError {
  constructor(id: string) {
    super(`Integration not found: ${id}`, 'INTEGRATION_NOT_FOUND', 404, { id });
    this.name = 'IntegrationNotFoundError';
  }
}

/**
 * Error thrown when an integration already exists.
 */
export class IntegrationAlreadyExistsError extends GenesisError {
  constructor(name: string, workspaceId: string) {
    super(
      `Integration '${name}' already exists in workspace ${workspaceId}`,
      'INTEGRATION_ALREADY_EXISTS',
      409,
      { name, workspaceId }
    );
    this.name = 'IntegrationAlreadyExistsError';
  }
}

/**
 * Error thrown when integration validation fails.
 */
export class IntegrationValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'INTEGRATION_VALIDATION_ERROR', 400, { errors });
    this.name = 'IntegrationValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when OAuth token refresh fails.
 */
export class OAuthRefreshError extends GenesisError {
  constructor(integrationId: string, reason: string) {
    super(
      `Failed to refresh OAuth token for integration ${integrationId}: ${reason}`,
      'OAUTH_REFRESH_ERROR',
      401,
      { integrationId, reason }
    );
    this.name = 'OAuthRefreshError';
  }
}

/**
 * Error thrown when a webhook is not found.
 */
export class WebhookNotFoundError extends GenesisError {
  constructor(id: string) {
    super(`Webhook not found: ${id}`, 'WEBHOOK_NOT_FOUND', 404, { id });
    this.name = 'WebhookNotFoundError';
  }
}

/**
 * Error thrown when webhook delivery fails.
 */
export class WebhookDeliveryError extends GenesisError {
  constructor(webhookId: string, reason: string) {
    super(
      `Webhook delivery failed for ${webhookId}: ${reason}`,
      'WEBHOOK_DELIVERY_ERROR',
      500,
      { webhookId, reason }
    );
    this.name = 'WebhookDeliveryError';
  }
}

/**
 * Error thrown when webhook signature verification fails.
 */
export class WebhookSignatureError extends GenesisError {
  constructor(reason: string) {
    super(
      `Webhook signature verification failed: ${reason}`,
      'WEBHOOK_SIGNATURE_ERROR',
      401,
      { reason }
    );
    this.name = 'WebhookSignatureError';
  }
}

/**
 * Error thrown when connection test fails.
 */
export class ConnectionTestError extends GenesisError {
  constructor(integrationId: string, reason: string) {
    super(
      `Connection test failed for integration ${integrationId}: ${reason}`,
      'CONNECTION_TEST_ERROR',
      503,
      { integrationId, reason }
    );
    this.name = 'ConnectionTestError';
  }
}

// =============================================================================
// Storage Interface
// =============================================================================

/**
 * Interface for integration storage operations.
 * Implementations can use database, in-memory, or other storage backends.
 */
export interface IntegrationStorage {
  // Integration operations
  getIntegration(id: string): Promise<IntegrationConfig | null>;
  listIntegrations(
    workspaceId: string,
    options?: ListIntegrationsOptions
  ): Promise<PaginatedIntegrationResult>;
  createIntegration(integration: IntegrationConfig): Promise<IntegrationConfig>;
  updateIntegration(
    id: string,
    updates: Partial<IntegrationConfig>
  ): Promise<IntegrationConfig>;
  deleteIntegration(id: string): Promise<void>;

  // Webhook operations
  getWebhook(id: string): Promise<WebhookConfig | null>;
  listWebhooks(
    workspaceId: string,
    options?: ListWebhooksOptions
  ): Promise<PaginatedWebhookResult>;
  createWebhook(webhook: WebhookConfig): Promise<WebhookConfig>;
  updateWebhook(
    id: string,
    updates: Partial<WebhookConfig>
  ): Promise<WebhookConfig>;
  deleteWebhook(id: string): Promise<void>;

  // Delivery operations
  getDelivery(id: string): Promise<WebhookDelivery | null>;
  listDeliveries(
    webhookId: string,
    options?: ListDeliveriesOptions
  ): Promise<PaginatedDeliveryResult>;
  createDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  updateDelivery(
    id: string,
    updates: Partial<WebhookDelivery>
  ): Promise<WebhookDelivery>;

  // Integration event operations
  createEvent(event: IntegrationEvent): Promise<IntegrationEvent>;
  updateEvent(
    id: string,
    updates: Partial<IntegrationEvent>
  ): Promise<IntegrationEvent>;
}

// =============================================================================
// HTTP Client Interface
// =============================================================================

/**
 * HTTP request options for configuring headers and timeout.
 */
export interface HttpRequestOptions {
  /** Custom headers to include in the request */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP response structure from client operations.
 */
export interface HttpResponse {
  /** HTTP status code */
  status: number;
  /** Response body as string */
  body: string;
}

/**
 * JSON-serializable value type for HTTP request bodies.
 * Supports primitives, arrays, and nested objects.
 */
export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };

/**
 * Interface for HTTP client operations.
 * Used for webhook delivery and provider API calls.
 */
export interface HttpClient {
  /**
   * Sends a POST request with a JSON body.
   *
   * @param url - Target URL
   * @param body - JSON-serializable request body
   * @param options - Optional request configuration
   * @returns Response with status code and body
   */
  post(
    url: string,
    body: JsonSerializable | WebhookPayload,
    options?: HttpRequestOptions
  ): Promise<HttpResponse>;

  /**
   * Sends a GET request.
   *
   * @param url - Target URL
   * @param options - Optional request configuration
   * @returns Response with status code and body
   */
  get(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}

// =============================================================================
// Integration Service Interface
// =============================================================================

/**
 * Interface for integration operations.
 */
export interface IntegrationService {
  // Integration CRUD
  createIntegration(
    input: CreateIntegrationInput,
    createdBy: string
  ): Promise<IntegrationConfig>;
  getIntegration(id: string): Promise<IntegrationConfig | null>;
  listIntegrations(
    workspaceId: string,
    options?: ListIntegrationsOptions
  ): Promise<PaginatedIntegrationResult>;
  updateIntegration(
    id: string,
    updates: UpdateIntegrationInput
  ): Promise<IntegrationConfig>;
  deleteIntegration(id: string): Promise<void>;

  // OAuth operations
  setOAuthToken(
    integrationId: string,
    token: OAuthToken
  ): Promise<IntegrationConfig>;
  refreshOAuthToken(integrationId: string): Promise<IntegrationConfig>;

  // Connection testing
  testConnection(integrationId: string): Promise<ConnectionTestResult>;

  // Sync operations
  syncIntegration(integrationId: string): Promise<SyncResult>;
}

/**
 * Interface for webhook operations.
 */
export interface WebhookService {
  // Webhook CRUD
  createWebhook(
    input: CreateWebhookInput,
    createdBy: string
  ): Promise<WebhookConfig>;
  getWebhook(id: string): Promise<WebhookConfig | null>;
  listWebhooks(
    workspaceId: string,
    options?: ListWebhooksOptions
  ): Promise<PaginatedWebhookResult>;
  updateWebhook(
    id: string,
    updates: UpdateWebhookInput
  ): Promise<WebhookConfig>;
  deleteWebhook(id: string): Promise<void>;

  // Delivery operations
  triggerWebhook(
    webhookId: string,
    event: WebhookEvent,
    payload: WebhookPayload
  ): Promise<WebhookDelivery>;
  deliverWithRetry(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  getDeliveryHistory(
    webhookId: string,
    options?: ListDeliveriesOptions
  ): Promise<PaginatedDeliveryResult>;

  // Signature operations
  generateSignature(payload: string, secret: string): string;
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean;
}

// =============================================================================
// In-Memory Storage Implementation
// =============================================================================

/**
 * In-memory implementation of IntegrationStorage for testing.
 */
export class InMemoryIntegrationStorage implements IntegrationStorage {
  private integrations: Map<string, IntegrationConfig> = new Map();
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private events: Map<string, IntegrationEvent> = new Map();

  async getIntegration(id: string): Promise<IntegrationConfig | null> {
    return this.integrations.get(id) ?? null;
  }

  async listIntegrations(
    workspaceId: string,
    options: ListIntegrationsOptions = {}
  ): Promise<PaginatedIntegrationResult> {
    let results = Array.from(this.integrations.values()).filter(
      i => i.workspaceId === workspaceId
    );

    if (options.provider) {
      results = results.filter(i => i.provider === options.provider);
    }

    if (options.status) {
      results = results.filter(i => i.status === options.status);
    }

    if (!options.includeInactive) {
      results = results.filter(i => i.status !== 'inactive');
    }

    const total = results.length;
    const skip = options.skip ?? 0;
    const take = options.take ?? 20;

    results = results.slice(skip, skip + take);

    return {
      data: results,
      total,
      hasMore: skip + results.length < total,
      nextCursor:
        results.length > 0 ? results[results.length - 1]?.id : undefined,
    };
  }

  async createIntegration(
    integration: IntegrationConfig
  ): Promise<IntegrationConfig> {
    this.integrations.set(integration.id, integration);
    return integration;
  }

  async updateIntegration(
    id: string,
    updates: Partial<IntegrationConfig>
  ): Promise<IntegrationConfig> {
    const existing = this.integrations.get(id);
    if (!existing) {
      throw new IntegrationNotFoundError(id);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.integrations.set(id, updated);
    return updated;
  }

  async deleteIntegration(id: string): Promise<void> {
    this.integrations.delete(id);
  }

  async getWebhook(id: string): Promise<WebhookConfig | null> {
    return this.webhooks.get(id) ?? null;
  }

  async listWebhooks(
    workspaceId: string,
    options: ListWebhooksOptions = {}
  ): Promise<PaginatedWebhookResult> {
    let results = Array.from(this.webhooks.values()).filter(
      w => w.workspaceId === workspaceId
    );

    if (options.integrationId) {
      results = results.filter(w => w.integrationId === options.integrationId);
    }

    if (options.status) {
      results = results.filter(w => w.status === options.status);
    }

    if (options.event) {
      results = results.filter(w => w.events.includes(options.event!));
    }

    const total = results.length;
    const skip = options.skip ?? 0;
    const take = options.take ?? 20;

    results = results.slice(skip, skip + take);

    return {
      data: results,
      total,
      hasMore: skip + results.length < total,
      nextCursor:
        results.length > 0 ? results[results.length - 1]?.id : undefined,
    };
  }

  async createWebhook(webhook: WebhookConfig): Promise<WebhookConfig> {
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async updateWebhook(
    id: string,
    updates: Partial<WebhookConfig>
  ): Promise<WebhookConfig> {
    const existing = this.webhooks.get(id);
    if (!existing) {
      throw new WebhookNotFoundError(id);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.webhooks.set(id, updated);
    return updated;
  }

  async deleteWebhook(id: string): Promise<void> {
    this.webhooks.delete(id);
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(id) ?? null;
  }

  async listDeliveries(
    webhookId: string,
    options: ListDeliveriesOptions = {}
  ): Promise<PaginatedDeliveryResult> {
    let results = Array.from(this.deliveries.values()).filter(
      d => d.webhookId === webhookId
    );

    if (options.status) {
      results = results.filter(d => d.status === options.status);
    }

    if (options.event) {
      results = results.filter(d => d.event === options.event);
    }

    if (options.after) {
      results = results.filter(d => d.createdAt >= options.after!);
    }

    if (options.before) {
      results = results.filter(d => d.createdAt <= options.before!);
    }

    const total = results.length;
    const skip = options.skip ?? 0;
    const take = options.take ?? 20;

    results = results.slice(skip, skip + take);

    return {
      data: results,
      total,
      hasMore: skip + results.length < total,
      nextCursor:
        results.length > 0 ? results[results.length - 1]?.id : undefined,
    };
  }

  async createDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  async updateDelivery(
    id: string,
    updates: Partial<WebhookDelivery>
  ): Promise<WebhookDelivery> {
    const existing = this.deliveries.get(id);
    if (!existing) {
      throw new IntegrationError(
        `Delivery not found: ${id}`,
        'DELIVERY_NOT_FOUND',
        404
      );
    }

    const updated = { ...existing, ...updates };
    this.deliveries.set(id, updated);
    return updated;
  }

  async createEvent(event: IntegrationEvent): Promise<IntegrationEvent> {
    this.events.set(event.id, event);
    return event;
  }

  async updateEvent(
    id: string,
    updates: Partial<IntegrationEvent>
  ): Promise<IntegrationEvent> {
    const existing = this.events.get(id);
    if (!existing) {
      throw new IntegrationError(
        `Event not found: ${id}`,
        'EVENT_NOT_FOUND',
        404
      );
    }

    const updated = { ...existing, ...updates };
    this.events.set(id, updated);
    return updated;
  }

  // Helper methods for testing
  clear(): void {
    this.integrations.clear();
    this.webhooks.clear();
    this.deliveries.clear();
    this.events.clear();
  }
}

// =============================================================================
// Integration Service Implementation
// =============================================================================

/**
 * Configuration for the Integration Service.
 */
export interface IntegrationServiceConfig {
  /** Storage backend */
  storage: IntegrationStorage;

  /** HTTP client for webhook delivery */
  httpClient?: HttpClient;

  /** Default webhook timeout in ms */
  webhookTimeout?: number;

  /** Maximum payload size for webhooks (bytes) */
  maxPayloadSize?: number;
}

/**
 * Default HTTP client implementation using fetch.
 * Provides JSON-based HTTP communication for webhook delivery and API calls.
 */
class DefaultHttpClient implements HttpClient {
  /**
   * Sends a POST request with a JSON body.
   *
   * @param url - Target URL
   * @param body - JSON-serializable request body
   * @param options - Optional request configuration
   * @returns Response with status code and body
   */
  async post(
    url: string,
    body: JsonSerializable | WebhookPayload,
    options?: HttpRequestOptions
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout ?? 30000
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const responseBody = await response.text();
      return { status: response.status, body: responseBody };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sends a GET request.
   *
   * @param url - Target URL
   * @param options - Optional request configuration
   * @returns Response with status code and body
   */
  async get(url: string, options?: HttpRequestOptions): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout ?? 30000
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: options?.headers,
        signal: controller.signal,
      });

      const responseBody = await response.text();
      return { status: response.status, body: responseBody };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Combined Integration and Webhook Service implementation.
 */
export class IntegrationServiceImpl
  implements IntegrationService, WebhookService
{
  private readonly storage: IntegrationStorage;
  private readonly httpClient: HttpClient;
  private readonly webhookTimeout: number;
  private readonly maxPayloadSize: number;

  constructor(config: IntegrationServiceConfig) {
    this.storage = config.storage;
    this.httpClient = config.httpClient ?? new DefaultHttpClient();
    this.webhookTimeout = config.webhookTimeout ?? 30000;
    this.maxPayloadSize = config.maxPayloadSize ?? 1024 * 1024; // 1MB default
  }

  // ===========================================================================
  // Integration CRUD Operations
  // ===========================================================================

  async createIntegration(
    input: CreateIntegrationInput,
    createdBy: string
  ): Promise<IntegrationConfig> {
    this.validateCreateIntegrationInput(input);

    const now = new Date();
    const integration: IntegrationConfig = {
      id: generateCUID(),
      workspaceId: input.workspaceId,
      provider: input.provider,
      name: input.name,
      description: input.description,
      status: 'pending',
      settings: input.settings ?? {},
      permissions: input.permissions ?? [],
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    return this.storage.createIntegration(integration);
  }

  async getIntegration(id: string): Promise<IntegrationConfig | null> {
    return this.storage.getIntegration(id);
  }

  async listIntegrations(
    workspaceId: string,
    options?: ListIntegrationsOptions
  ): Promise<PaginatedIntegrationResult> {
    return this.storage.listIntegrations(workspaceId, options);
  }

  async updateIntegration(
    id: string,
    updates: UpdateIntegrationInput
  ): Promise<IntegrationConfig> {
    const existing = await this.storage.getIntegration(id);
    if (!existing) {
      throw new IntegrationNotFoundError(id);
    }

    const updateData: Partial<IntegrationConfig> = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.settings !== undefined) {
      updateData.settings = { ...existing.settings, ...updates.settings };
    }

    if (updates.permissions !== undefined) {
      updateData.permissions = updates.permissions;
    }

    return this.storage.updateIntegration(id, updateData);
  }

  async deleteIntegration(id: string): Promise<void> {
    const existing = await this.storage.getIntegration(id);
    if (!existing) {
      throw new IntegrationNotFoundError(id);
    }

    // Delete associated webhooks first
    const webhooks = await this.storage.listWebhooks(existing.workspaceId, {
      integrationId: id,
    });
    for (const webhook of webhooks.data) {
      await this.storage.deleteWebhook(webhook.id);
    }

    await this.storage.deleteIntegration(id);
  }

  // ===========================================================================
  // OAuth Operations
  // ===========================================================================

  async setOAuthToken(
    integrationId: string,
    token: OAuthToken
  ): Promise<IntegrationConfig> {
    const existing = await this.storage.getIntegration(integrationId);
    if (!existing) {
      throw new IntegrationNotFoundError(integrationId);
    }

    return this.storage.updateIntegration(integrationId, {
      oauth: token,
      status: 'active',
    });
  }

  async refreshOAuthToken(integrationId: string): Promise<IntegrationConfig> {
    const existing = await this.storage.getIntegration(integrationId);
    if (!existing) {
      throw new IntegrationNotFoundError(integrationId);
    }

    if (!existing.oauth?.refreshToken) {
      throw new OAuthRefreshError(integrationId, 'No refresh token available');
    }

    // In a real implementation, this would call the provider's token refresh endpoint
    // For now, we just validate the token exists and update the timestamp
    const refreshedToken: OAuthToken = {
      ...existing.oauth,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    };

    return this.storage.updateIntegration(integrationId, {
      oauth: refreshedToken,
      status: 'active',
    });
  }

  // ===========================================================================
  // Connection Testing
  // ===========================================================================

  async testConnection(integrationId: string): Promise<ConnectionTestResult> {
    const integration = await this.storage.getIntegration(integrationId);
    if (!integration) {
      throw new IntegrationNotFoundError(integrationId);
    }

    const startTime = Date.now();

    try {
      // Provider-specific connection testing would go here
      // For now, we simulate a simple health check
      const testUrl = this.getProviderTestUrl(integration.provider);

      if (testUrl) {
        const response = await this.httpClient.get(testUrl, {
          headers: integration.oauth
            ? { Authorization: `Bearer ${integration.oauth.accessToken}` }
            : undefined,
          timeout: 10000,
        });

        const latencyMs = Date.now() - startTime;

        if (response.status >= 200 && response.status < 300) {
          // Update integration status to active
          await this.storage.updateIntegration(integrationId, {
            status: 'active',
          });

          return {
            success: true,
            latencyMs,
            details: { statusCode: response.status },
          };
        }

        // Update integration status to error
        await this.storage.updateIntegration(integrationId, {
          status: 'error',
          errorMessage: `HTTP ${response.status}`,
        });

        return {
          success: false,
          latencyMs,
          errorMessage: `HTTP ${response.status}: ${response.body}`,
        };
      }

      // No test URL available, return simulated success
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        details: { message: 'No test endpoint configured' },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update integration status to error
      await this.storage.updateIntegration(integrationId, {
        status: 'error',
        errorMessage,
      });

      return {
        success: false,
        latencyMs,
        errorMessage,
      };
    }
  }

  // ===========================================================================
  // Sync Operations
  // ===========================================================================

  async syncIntegration(integrationId: string): Promise<SyncResult> {
    const integration = await this.storage.getIntegration(integrationId);
    if (!integration) {
      throw new IntegrationNotFoundError(integrationId);
    }

    const syncedAt = new Date();

    // Create sync event
    const eventId = generateCUID();
    await this.storage.createEvent({
      id: eventId,
      integrationId,
      type: 'outgoing',
      provider: integration.provider,
      eventType: 'sync',
      payload: {},
      status: 'pending',
      createdAt: syncedAt,
    });

    try {
      // Provider-specific sync logic would go here
      // For now, we simulate a successful sync

      await this.storage.updateEvent(eventId, {
        status: 'processed',
        processedAt: new Date(),
      });

      await this.storage.updateIntegration(integrationId, {
        lastSyncAt: syncedAt,
        status: 'active',
      });

      return {
        integrationId,
        provider: integration.provider,
        syncedAt,
        itemsSynced: 0,
        itemsFailed: 0,
        errors: [],
        nextSyncAt: new Date(syncedAt.getTime() + 3600 * 1000), // 1 hour from now
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.storage.updateEvent(eventId, {
        status: 'failed',
        errorMessage,
      });

      await this.storage.updateIntegration(integrationId, {
        status: 'error',
        errorMessage,
      });

      return {
        integrationId,
        provider: integration.provider,
        syncedAt,
        itemsSynced: 0,
        itemsFailed: 1,
        errors: [errorMessage],
      };
    }
  }

  // ===========================================================================
  // Webhook CRUD Operations
  // ===========================================================================

  async createWebhook(
    input: CreateWebhookInput,
    createdBy: string
  ): Promise<WebhookConfig> {
    this.validateCreateWebhookInput(input);

    const now = new Date();
    const secret = this.generateWebhookSecret();

    const webhook: WebhookConfig = {
      id: generateCUID(),
      workspaceId: input.workspaceId,
      integrationId: input.integrationId,
      name: input.name,
      url: input.url,
      secret,
      events: input.events,
      status: 'active',
      headers: input.headers,
      retryPolicy: {
        ...DEFAULT_WEBHOOK_RETRY_POLICY,
        ...input.retryPolicy,
      },
      createdBy,
      createdAt: now,
      updatedAt: now,
      failureCount: 0,
    };

    return this.storage.createWebhook(webhook);
  }

  async getWebhook(id: string): Promise<WebhookConfig | null> {
    return this.storage.getWebhook(id);
  }

  async listWebhooks(
    workspaceId: string,
    options?: ListWebhooksOptions
  ): Promise<PaginatedWebhookResult> {
    return this.storage.listWebhooks(workspaceId, options);
  }

  async updateWebhook(
    id: string,
    updates: UpdateWebhookInput
  ): Promise<WebhookConfig> {
    const existing = await this.storage.getWebhook(id);
    if (!existing) {
      throw new WebhookNotFoundError(id);
    }

    const updateData: Partial<WebhookConfig> = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.url !== undefined) {
      updateData.url = updates.url;
    }

    if (updates.events !== undefined) {
      updateData.events = updates.events;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.headers !== undefined) {
      updateData.headers = updates.headers;
    }

    if (updates.retryPolicy !== undefined) {
      updateData.retryPolicy = {
        ...existing.retryPolicy,
        ...updates.retryPolicy,
      };
    }

    return this.storage.updateWebhook(id, updateData);
  }

  async deleteWebhook(id: string): Promise<void> {
    const existing = await this.storage.getWebhook(id);
    if (!existing) {
      throw new WebhookNotFoundError(id);
    }

    await this.storage.deleteWebhook(id);
  }

  // ===========================================================================
  // Webhook Delivery Operations
  // ===========================================================================

  async triggerWebhook(
    webhookId: string,
    event: WebhookEvent,
    payload: WebhookPayload
  ): Promise<WebhookDelivery> {
    const webhook = await this.storage.getWebhook(webhookId);
    if (!webhook) {
      throw new WebhookNotFoundError(webhookId);
    }

    if (webhook.status !== 'active') {
      throw new WebhookDeliveryError(webhookId, `Webhook is ${webhook.status}`);
    }

    if (!webhook.events.includes(event)) {
      throw new WebhookDeliveryError(
        webhookId,
        `Webhook is not subscribed to event: ${event}`
      );
    }

    const delivery: WebhookDelivery = {
      id: generateCUID(),
      webhookId,
      event,
      payload,
      status: 'pending',
      attempts: [],
      createdAt: new Date(),
    };

    await this.storage.createDelivery(delivery);

    // Start delivery with retry
    return this.deliverWithRetry(delivery);
  }

  async deliverWithRetry(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    const webhook = await this.storage.getWebhook(delivery.webhookId);
    if (!webhook) {
      throw new WebhookNotFoundError(delivery.webhookId);
    }

    const { maxRetries, initialDelay, maxDelay, backoffMultiplier } =
      webhook.retryPolicy;

    let currentDelay = initialDelay;
    let updatedDelivery = delivery;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const attemptRecord = await this.attemptDelivery(
        webhook,
        delivery.payload,
        attempt
      );
      updatedDelivery.attempts.push(attemptRecord);

      if (
        attemptRecord.statusCode &&
        attemptRecord.statusCode >= 200 &&
        attemptRecord.statusCode < 300
      ) {
        // Success
        updatedDelivery = await this.storage.updateDelivery(delivery.id, {
          status: 'success',
          attempts: updatedDelivery.attempts,
          completedAt: new Date(),
        });

        // Reset webhook failure count
        await this.storage.updateWebhook(webhook.id, {
          failureCount: 0,
          lastTriggeredAt: new Date(),
        });

        return updatedDelivery;
      }

      // Failed attempt
      if (attempt <= maxRetries) {
        // Wait before retry with exponential backoff
        await this.sleep(currentDelay);
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
      }
    }

    // All retries exhausted
    updatedDelivery = await this.storage.updateDelivery(delivery.id, {
      status: 'failed',
      attempts: updatedDelivery.attempts,
      completedAt: new Date(),
    });

    // Update webhook failure count
    const newFailureCount = webhook.failureCount + 1;
    await this.storage.updateWebhook(webhook.id, {
      failureCount: newFailureCount,
      status: newFailureCount >= 5 ? 'failed' : webhook.status,
      lastTriggeredAt: new Date(),
    });

    return updatedDelivery;
  }

  async getDeliveryHistory(
    webhookId: string,
    options?: ListDeliveriesOptions
  ): Promise<PaginatedDeliveryResult> {
    const webhook = await this.storage.getWebhook(webhookId);
    if (!webhook) {
      throw new WebhookNotFoundError(webhookId);
    }

    return this.storage.listDeliveries(webhookId, options);
  }

  // ===========================================================================
  // Signature Operations
  // ===========================================================================

  generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !payload || !secret) {
      return false;
    }

    const expectedSignature = this.generateSignature(payload, secret);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private validateCreateIntegrationInput(input: CreateIntegrationInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.workspaceId || input.workspaceId.trim().length === 0) {
      errors.workspaceId = ['Workspace ID is required'];
    }

    if (!input.provider) {
      errors.provider = ['Provider is required'];
    }

    if (!input.name || input.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (input.name.length > 100) {
      errors.name = ['Name must be 100 characters or less'];
    }

    if (Object.keys(errors).length > 0) {
      throw new IntegrationValidationError(
        'Integration validation failed',
        errors
      );
    }
  }

  private validateCreateWebhookInput(input: CreateWebhookInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.workspaceId || input.workspaceId.trim().length === 0) {
      errors.workspaceId = ['Workspace ID is required'];
    }

    if (!input.name || input.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (input.name.length > 100) {
      errors.name = ['Name must be 100 characters or less'];
    }

    if (!input.url || input.url.trim().length === 0) {
      errors.url = ['URL is required'];
    } else {
      try {
        new URL(input.url);
      } catch {
        errors.url = ['Invalid URL format'];
      }
    }

    if (!input.events || input.events.length === 0) {
      errors.events = ['At least one event is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new IntegrationValidationError('Webhook validation failed', errors);
    }
  }

  private generateWebhookSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('base64url')}`;
  }

  private getProviderTestUrl(provider: IntegrationProvider): string | null {
    const testUrls: Record<IntegrationProvider, string | null> = {
      slack: 'https://slack.com/api/api.test',
      teams: null, // Would need specific endpoint
      github: 'https://api.github.com/zen',
      jira: null, // Would need cloud ID
      notion: 'https://api.notion.com/v1/users/me',
      linear: 'https://api.linear.app/graphql',
      salesforce: null, // Would need instance URL
      hubspot: 'https://api.hubapi.com/health/v1/ping',
      zapier: null,
      custom: null,
    };

    return testUrls[provider];
  }

  private async attemptDelivery(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    attemptNumber: number
  ): Promise<WebhookAttempt> {
    const startTime = Date.now();
    const payloadString = JSON.stringify(payload);

    // Check payload size
    if (Buffer.byteLength(payloadString) > this.maxPayloadSize) {
      return {
        attemptNumber,
        timestamp: new Date(),
        errorMessage: 'Payload exceeds maximum size',
        durationMs: Date.now() - startTime,
      };
    }

    const signature = this.generateSignature(payloadString, webhook.secret);

    // Safely extract event and deliveryId from payload (handles both typed and generic payloads)
    const eventValue = 'event' in payload ? String(payload.event) : 'unknown';
    const deliveryIdValue =
      'deliveryId' in payload ? String(payload.deliveryId) : generateShortId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': eventValue,
      'X-Webhook-Delivery': deliveryIdValue,
      ...webhook.headers,
    };

    try {
      const response = await this.httpClient.post(webhook.url, payload, {
        headers,
        timeout: this.webhookTimeout,
      });

      return {
        attemptNumber,
        timestamp: new Date(),
        statusCode: response.status,
        responseBody: response.body.substring(0, 1000), // Truncate response
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        attemptNumber,
        timestamp: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new Integration Service with in-memory storage.
 */
export function createIntegrationService(
  config?: Partial<IntegrationServiceConfig>
): IntegrationServiceImpl {
  const storage = config?.storage ?? new InMemoryIntegrationStorage();
  return new IntegrationServiceImpl({
    storage,
    httpClient: config?.httpClient,
    webhookTimeout: config?.webhookTimeout,
    maxPayloadSize: config?.maxPayloadSize,
  });
}

/**
 * Default integration service instance.
 */
export const integrationService = createIntegrationService();
