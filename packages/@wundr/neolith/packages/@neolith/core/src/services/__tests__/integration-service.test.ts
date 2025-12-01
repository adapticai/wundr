/**
 * Integration Service Tests
 *
 * Comprehensive test suite for the Integration and Webhook services covering:
 * - Integration CRUD operations
 * - OAuth token management
 * - Webhook creation and delivery
 * - Retry logic with exponential backoff
 * - Signature verification
 * - Error handling
 *
 * @module @genesis/core/services/__tests__/integration-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  IntegrationServiceImpl,
  InMemoryIntegrationStorage,
  createIntegrationService,
  IntegrationNotFoundError,
  IntegrationValidationError,
  WebhookNotFoundError,
  WebhookDeliveryError,
  OAuthRefreshError,
  type IntegrationStorage,
  type HttpClient,
  type IntegrationServiceConfig,
} from '../integration-service';

import type {
  IntegrationConfig,
  WebhookConfig,
  WebhookDelivery,
  CreateIntegrationInput,
  CreateWebhookInput,
  OAuthToken,
} from '../../types/integration';

// =============================================================================
// TEST UTILITIES
// =============================================================================

let idCounter = 0;

function generateTestId(): string {
  idCounter += 1;
  return `test_${Date.now()}_${idCounter}`;
}

function createMockHttpClient(): HttpClient {
  return {
    post: vi.fn().mockResolvedValue({ status: 200, body: 'OK' }),
    get: vi.fn().mockResolvedValue({ status: 200, body: 'OK' }),
  };
}

function createMockIntegration(
  overrides: Partial<IntegrationConfig> = {}
): IntegrationConfig {
  const id = overrides.id ?? generateTestId();
  const now = new Date();
  return {
    id,
    workspaceId: overrides.workspaceId ?? generateTestId(),
    provider: overrides.provider ?? 'slack',
    name: overrides.name ?? 'Test Integration',
    description: overrides.description,
    status: overrides.status ?? 'active',
    settings: overrides.settings ?? {},
    permissions: overrides.permissions ?? [],
    createdBy: overrides.createdBy ?? generateTestId(),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastSyncAt: overrides.lastSyncAt,
    errorMessage: overrides.errorMessage,
    oauth: overrides.oauth,
    apiKey: overrides.apiKey,
    webhookUrl: overrides.webhookUrl,
    webhookSecret: overrides.webhookSecret,
  };
}

function createMockWebhook(
  overrides: Partial<WebhookConfig> = {}
): WebhookConfig {
  const id = overrides.id ?? generateTestId();
  const now = new Date();
  return {
    id,
    workspaceId: overrides.workspaceId ?? generateTestId(),
    integrationId: overrides.integrationId,
    name: overrides.name ?? 'Test Webhook',
    url: overrides.url ?? 'https://example.com/webhook',
    secret: overrides.secret ?? 'whsec_test_secret_123',
    events: overrides.events ?? ['message.created'],
    status: overrides.status ?? 'active',
    headers: overrides.headers,
    retryPolicy: overrides.retryPolicy ?? {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
    },
    createdBy: overrides.createdBy ?? generateTestId(),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastTriggeredAt: overrides.lastTriggeredAt,
    failureCount: overrides.failureCount ?? 0,
  };
}

function createMockDelivery(
  overrides: Partial<WebhookDelivery> = {}
): WebhookDelivery {
  const id = overrides.id ?? generateTestId();
  return {
    id,
    webhookId: overrides.webhookId ?? generateTestId(),
    event: overrides.event ?? 'message.created',
    payload: overrides.payload ?? { test: 'data' },
    status: overrides.status ?? 'pending',
    attempts: overrides.attempts ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    completedAt: overrides.completedAt,
  };
}

function createTestService(
  httpClient?: HttpClient,
  storage?: IntegrationStorage
): IntegrationServiceImpl {
  const config: IntegrationServiceConfig = {
    storage: storage ?? new InMemoryIntegrationStorage(),
    httpClient: httpClient ?? createMockHttpClient(),
    webhookTimeout: 5000,
    maxPayloadSize: 1024 * 1024,
  };
  return new IntegrationServiceImpl(config);
}

// =============================================================================
// TESTS
// =============================================================================

describe('IntegrationService', () => {
  let storage: InMemoryIntegrationStorage;
  let httpClient: HttpClient;
  let service: IntegrationServiceImpl;

  beforeEach(() => {
    idCounter = 0;
    storage = new InMemoryIntegrationStorage();
    httpClient = createMockHttpClient();
    service = createTestService(httpClient, storage);
  });

  afterEach(() => {
    vi.clearAllMocks();
    storage.clear();
  });

  // ===========================================================================
  // Integration CRUD Tests
  // ===========================================================================

  describe('createIntegration', () => {
    it('creates a new integration with required fields', async () => {
      const input: CreateIntegrationInput = {
        workspaceId: generateTestId(),
        provider: 'slack',
        name: 'My Slack Integration',
      };

      const result = await service.createIntegration(input, 'user_123');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.workspaceId).toBe(input.workspaceId);
      expect(result.provider).toBe(input.provider);
      expect(result.name).toBe(input.name);
      expect(result.status).toBe('pending');
      expect(result.createdBy).toBe('user_123');
    });

    it('creates integration with optional fields', async () => {
      const input: CreateIntegrationInput = {
        workspaceId: generateTestId(),
        provider: 'github',
        name: 'GitHub Integration',
        description: 'Connects to GitHub',
        settings: { repositoryId: 'repo_123' },
        permissions: ['read:messages', 'write:messages'],
      };

      const result = await service.createIntegration(input, 'user_123');

      expect(result.description).toBe(input.description);
      expect(result.settings).toEqual(input.settings);
      expect(result.permissions).toEqual(input.permissions);
    });

    it('throws validation error when workspaceId is missing', async () => {
      const input: CreateIntegrationInput = {
        workspaceId: '',
        provider: 'slack',
        name: 'Test',
      };

      await expect(
        service.createIntegration(input, 'user_123')
      ).rejects.toThrow(IntegrationValidationError);
    });

    it('throws validation error when name is missing', async () => {
      const input: CreateIntegrationInput = {
        workspaceId: generateTestId(),
        provider: 'slack',
        name: '',
      };

      await expect(
        service.createIntegration(input, 'user_123')
      ).rejects.toThrow(IntegrationValidationError);
    });

    it('throws validation error when name is too long', async () => {
      const input: CreateIntegrationInput = {
        workspaceId: generateTestId(),
        provider: 'slack',
        name: 'a'.repeat(101),
      };

      await expect(
        service.createIntegration(input, 'user_123')
      ).rejects.toThrow(IntegrationValidationError);
    });
  });

  describe('getIntegration', () => {
    it('returns integration when found', async () => {
      const mockIntegration = createMockIntegration();
      await storage.createIntegration(mockIntegration);

      const result = await service.getIntegration(mockIntegration.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockIntegration.id);
    });

    it('returns null when integration not found', async () => {
      const result = await service.getIntegration('non_existent_id');

      expect(result).toBeNull();
    });
  });

  describe('listIntegrations', () => {
    it('lists integrations by workspace', async () => {
      const workspaceId = generateTestId();
      const integration1 = createMockIntegration({ workspaceId });
      const integration2 = createMockIntegration({ workspaceId });
      const integration3 = createMockIntegration({
        workspaceId: 'other_workspace',
      });

      await storage.createIntegration(integration1);
      await storage.createIntegration(integration2);
      await storage.createIntegration(integration3);

      const result = await service.listIntegrations(workspaceId);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by provider', async () => {
      const workspaceId = generateTestId();
      await storage.createIntegration(
        createMockIntegration({ workspaceId, provider: 'slack' })
      );
      await storage.createIntegration(
        createMockIntegration({ workspaceId, provider: 'github' })
      );

      const result = await service.listIntegrations(workspaceId, {
        provider: 'slack',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.provider).toBe('slack');
    });

    it('filters by status', async () => {
      const workspaceId = generateTestId();
      await storage.createIntegration(
        createMockIntegration({ workspaceId, status: 'active' })
      );
      await storage.createIntegration(
        createMockIntegration({ workspaceId, status: 'error' })
      );

      const result = await service.listIntegrations(workspaceId, {
        status: 'active',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe('active');
    });

    it('supports pagination', async () => {
      const workspaceId = generateTestId();
      for (let i = 0; i < 5; i++) {
        await storage.createIntegration(createMockIntegration({ workspaceId }));
      }

      const result = await service.listIntegrations(workspaceId, {
        skip: 2,
        take: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('updateIntegration', () => {
    it('updates integration name', async () => {
      const mockIntegration = createMockIntegration();
      await storage.createIntegration(mockIntegration);

      const result = await service.updateIntegration(mockIntegration.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('updates integration settings', async () => {
      const mockIntegration = createMockIntegration({
        settings: { key: 'old' },
      });
      await storage.createIntegration(mockIntegration);

      const result = await service.updateIntegration(mockIntegration.id, {
        settings: { newKey: 'new' },
      });

      expect(result.settings).toEqual({ key: 'old', newKey: 'new' });
    });

    it('throws error when integration not found', async () => {
      await expect(
        service.updateIntegration('non_existent', { name: 'New' })
      ).rejects.toThrow(IntegrationNotFoundError);
    });
  });

  describe('deleteIntegration', () => {
    it('deletes integration', async () => {
      const mockIntegration = createMockIntegration();
      await storage.createIntegration(mockIntegration);

      await service.deleteIntegration(mockIntegration.id);

      const result = await service.getIntegration(mockIntegration.id);
      expect(result).toBeNull();
    });

    it('deletes associated webhooks', async () => {
      const workspaceId = generateTestId();
      const mockIntegration = createMockIntegration({ workspaceId });
      const mockWebhook = createMockWebhook({
        workspaceId,
        integrationId: mockIntegration.id,
      });

      await storage.createIntegration(mockIntegration);
      await storage.createWebhook(mockWebhook);

      await service.deleteIntegration(mockIntegration.id);

      const webhook = await service.getWebhook(mockWebhook.id);
      expect(webhook).toBeNull();
    });

    it('throws error when integration not found', async () => {
      await expect(service.deleteIntegration('non_existent')).rejects.toThrow(
        IntegrationNotFoundError
      );
    });
  });

  // ===========================================================================
  // OAuth Tests
  // ===========================================================================

  describe('setOAuthToken', () => {
    it('sets OAuth token and activates integration', async () => {
      const mockIntegration = createMockIntegration({ status: 'pending' });
      await storage.createIntegration(mockIntegration);

      const token: OAuthToken = {
        accessToken: 'access_123',
        refreshToken: 'refresh_123',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600000),
        scope: ['read', 'write'],
      };

      const result = await service.setOAuthToken(mockIntegration.id, token);

      expect(result.oauth).toEqual(token);
      expect(result.status).toBe('active');
    });

    it('throws error when integration not found', async () => {
      const token: OAuthToken = {
        accessToken: 'access_123',
        tokenType: 'Bearer',
      };

      await expect(
        service.setOAuthToken('non_existent', token)
      ).rejects.toThrow(IntegrationNotFoundError);
    });
  });

  describe('refreshOAuthToken', () => {
    it('refreshes OAuth token', async () => {
      const mockIntegration = createMockIntegration({
        oauth: {
          accessToken: 'old_access',
          refreshToken: 'refresh_123',
          tokenType: 'Bearer',
        },
      });
      await storage.createIntegration(mockIntegration);

      const result = await service.refreshOAuthToken(mockIntegration.id);

      expect(result.oauth?.expiresAt).toBeDefined();
      expect(result.status).toBe('active');
    });

    it('throws error when no refresh token available', async () => {
      const mockIntegration = createMockIntegration({
        oauth: {
          accessToken: 'access_123',
          tokenType: 'Bearer',
        },
      });
      await storage.createIntegration(mockIntegration);

      await expect(
        service.refreshOAuthToken(mockIntegration.id)
      ).rejects.toThrow(OAuthRefreshError);
    });

    it('throws error when integration not found', async () => {
      await expect(service.refreshOAuthToken('non_existent')).rejects.toThrow(
        IntegrationNotFoundError
      );
    });
  });

  // ===========================================================================
  // Connection Test Tests
  // ===========================================================================

  describe('testConnection', () => {
    it('returns success for valid connection', async () => {
      const mockIntegration = createMockIntegration({ provider: 'github' });
      await storage.createIntegration(mockIntegration);

      (httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        body: 'OK',
      });

      const result = await service.testConnection(mockIntegration.id);

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeDefined();
    });

    it('returns failure for failed connection', async () => {
      const mockIntegration = createMockIntegration({ provider: 'github' });
      await storage.createIntegration(mockIntegration);

      (httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 401,
        body: 'Unauthorized',
      });

      const result = await service.testConnection(mockIntegration.id);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('401');
    });

    it('handles network errors', async () => {
      const mockIntegration = createMockIntegration({ provider: 'github' });
      await storage.createIntegration(mockIntegration);

      (httpClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.testConnection(mockIntegration.id);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network error');
    });

    it('throws error when integration not found', async () => {
      await expect(service.testConnection('non_existent')).rejects.toThrow(
        IntegrationNotFoundError
      );
    });
  });

  // ===========================================================================
  // Sync Tests
  // ===========================================================================

  describe('syncIntegration', () => {
    it('syncs integration successfully', async () => {
      const mockIntegration = createMockIntegration();
      await storage.createIntegration(mockIntegration);

      const result = await service.syncIntegration(mockIntegration.id);

      expect(result.integrationId).toBe(mockIntegration.id);
      expect(result.provider).toBe(mockIntegration.provider);
      expect(result.syncedAt).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('updates lastSyncAt on success', async () => {
      const mockIntegration = createMockIntegration();
      await storage.createIntegration(mockIntegration);

      await service.syncIntegration(mockIntegration.id);

      const updated = await service.getIntegration(mockIntegration.id);
      expect(updated?.lastSyncAt).toBeDefined();
    });

    it('throws error when integration not found', async () => {
      await expect(service.syncIntegration('non_existent')).rejects.toThrow(
        IntegrationNotFoundError
      );
    });
  });

  // ===========================================================================
  // Webhook CRUD Tests
  // ===========================================================================

  describe('createWebhook', () => {
    it('creates webhook with required fields', async () => {
      const input: CreateWebhookInput = {
        workspaceId: generateTestId(),
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['message.created'],
      };

      const result = await service.createWebhook(input, 'user_123');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.workspaceId).toBe(input.workspaceId);
      expect(result.name).toBe(input.name);
      expect(result.url).toBe(input.url);
      expect(result.events).toEqual(input.events);
      expect(result.secret).toMatch(/^whsec_/);
      expect(result.status).toBe('active');
    });

    it('creates webhook with custom retry policy', async () => {
      const input: CreateWebhookInput = {
        workspaceId: generateTestId(),
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['message.created'],
        retryPolicy: { maxRetries: 10 },
      };

      const result = await service.createWebhook(input, 'user_123');

      expect(result.retryPolicy.maxRetries).toBe(10);
    });

    it('throws validation error for invalid URL', async () => {
      const input: CreateWebhookInput = {
        workspaceId: generateTestId(),
        name: 'My Webhook',
        url: 'not-a-valid-url',
        events: ['message.created'],
      };

      await expect(service.createWebhook(input, 'user_123')).rejects.toThrow(
        IntegrationValidationError
      );
    });

    it('throws validation error when events are empty', async () => {
      const input: CreateWebhookInput = {
        workspaceId: generateTestId(),
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: [],
      };

      await expect(service.createWebhook(input, 'user_123')).rejects.toThrow(
        IntegrationValidationError
      );
    });
  });

  describe('getWebhook', () => {
    it('returns webhook when found', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      const result = await service.getWebhook(mockWebhook.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockWebhook.id);
    });

    it('returns null when webhook not found', async () => {
      const result = await service.getWebhook('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('listWebhooks', () => {
    it('lists webhooks by workspace', async () => {
      const workspaceId = generateTestId();
      await storage.createWebhook(createMockWebhook({ workspaceId }));
      await storage.createWebhook(createMockWebhook({ workspaceId }));
      await storage.createWebhook(createMockWebhook({ workspaceId: 'other' }));

      const result = await service.listWebhooks(workspaceId);

      expect(result.data).toHaveLength(2);
    });

    it('filters by integration ID', async () => {
      const workspaceId = generateTestId();
      const integrationId = generateTestId();
      await storage.createWebhook(
        createMockWebhook({ workspaceId, integrationId })
      );
      await storage.createWebhook(createMockWebhook({ workspaceId }));

      const result = await service.listWebhooks(workspaceId, { integrationId });

      expect(result.data).toHaveLength(1);
    });

    it('filters by status', async () => {
      const workspaceId = generateTestId();
      await storage.createWebhook(
        createMockWebhook({ workspaceId, status: 'active' })
      );
      await storage.createWebhook(
        createMockWebhook({ workspaceId, status: 'inactive' })
      );

      const result = await service.listWebhooks(workspaceId, {
        status: 'active',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe('active');
    });
  });

  describe('updateWebhook', () => {
    it('updates webhook URL', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      const result = await service.updateWebhook(mockWebhook.id, {
        url: 'https://new-url.com/webhook',
      });

      expect(result.url).toBe('https://new-url.com/webhook');
    });

    it('updates webhook events', async () => {
      const mockWebhook = createMockWebhook({ events: ['message.created'] });
      await storage.createWebhook(mockWebhook);

      const result = await service.updateWebhook(mockWebhook.id, {
        events: ['message.created', 'message.deleted'],
      });

      expect(result.events).toEqual(['message.created', 'message.deleted']);
    });

    it('throws error when webhook not found', async () => {
      await expect(
        service.updateWebhook('non_existent', { name: 'New' })
      ).rejects.toThrow(WebhookNotFoundError);
    });
  });

  describe('deleteWebhook', () => {
    it('deletes webhook', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      await service.deleteWebhook(mockWebhook.id);

      const result = await service.getWebhook(mockWebhook.id);
      expect(result).toBeNull();
    });

    it('throws error when webhook not found', async () => {
      await expect(service.deleteWebhook('non_existent')).rejects.toThrow(
        WebhookNotFoundError
      );
    });
  });

  // ===========================================================================
  // Webhook Delivery Tests
  // ===========================================================================

  describe('triggerWebhook', () => {
    it('triggers webhook delivery', async () => {
      const mockWebhook = createMockWebhook({ events: ['message.created'] });
      await storage.createWebhook(mockWebhook);

      (httpClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        body: 'OK',
      });

      const result = await service.triggerWebhook(
        mockWebhook.id,
        'message.created',
        { message: 'test' }
      );

      expect(result.status).toBe('success');
      expect(result.event).toBe('message.created');
      expect(result.attempts.length).toBeGreaterThan(0);
    });

    it('throws error for inactive webhook', async () => {
      const mockWebhook = createMockWebhook({ status: 'inactive' });
      await storage.createWebhook(mockWebhook);

      await expect(
        service.triggerWebhook(mockWebhook.id, 'message.created', {})
      ).rejects.toThrow(WebhookDeliveryError);
    });

    it('throws error for unsubscribed event', async () => {
      const mockWebhook = createMockWebhook({ events: ['message.created'] });
      await storage.createWebhook(mockWebhook);

      await expect(
        service.triggerWebhook(mockWebhook.id, 'message.deleted', {})
      ).rejects.toThrow(WebhookDeliveryError);
    });

    it('throws error when webhook not found', async () => {
      await expect(
        service.triggerWebhook('non_existent', 'message.created', {})
      ).rejects.toThrow(WebhookNotFoundError);
    });
  });

  describe('deliverWithRetry', () => {
    it('succeeds on first attempt', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      const delivery = createMockDelivery({ webhookId: mockWebhook.id });
      await storage.createDelivery(delivery);

      (httpClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        body: 'OK',
      });

      const result = await service.deliverWithRetry(delivery);

      expect(result.status).toBe('success');
      expect(result.attempts).toHaveLength(1);
    });

    it('retries on failure and succeeds', async () => {
      const mockWebhook = createMockWebhook({
        retryPolicy: {
          maxRetries: 2,
          initialDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2,
        },
      });
      await storage.createWebhook(mockWebhook);

      const delivery = createMockDelivery({ webhookId: mockWebhook.id });
      await storage.createDelivery(delivery);

      (httpClient.post as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ status: 500, body: 'Error' })
        .mockResolvedValueOnce({ status: 200, body: 'OK' });

      const result = await service.deliverWithRetry(delivery);

      expect(result.status).toBe('success');
      expect(result.attempts).toHaveLength(2);
    });

    it('fails after max retries', async () => {
      const mockWebhook = createMockWebhook({
        retryPolicy: {
          maxRetries: 2,
          initialDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2,
        },
      });
      await storage.createWebhook(mockWebhook);

      const delivery = createMockDelivery({ webhookId: mockWebhook.id });
      await storage.createDelivery(delivery);

      (httpClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 500,
        body: 'Error',
      });

      const result = await service.deliverWithRetry(delivery);

      expect(result.status).toBe('failed');
      expect(result.attempts).toHaveLength(3); // 1 initial + 2 retries
    });

    it('increments failure count on failure', async () => {
      const mockWebhook = createMockWebhook({
        retryPolicy: {
          maxRetries: 0,
          initialDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2,
        },
        failureCount: 0,
      });
      await storage.createWebhook(mockWebhook);

      const delivery = createMockDelivery({ webhookId: mockWebhook.id });
      await storage.createDelivery(delivery);

      (httpClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 500,
        body: 'Error',
      });

      await service.deliverWithRetry(delivery);

      const updated = await service.getWebhook(mockWebhook.id);
      expect(updated?.failureCount).toBe(1);
    });

    it('marks webhook as failed after 5 consecutive failures', async () => {
      const mockWebhook = createMockWebhook({
        retryPolicy: {
          maxRetries: 0,
          initialDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2,
        },
        failureCount: 4, // Will become 5 after this failure
      });
      await storage.createWebhook(mockWebhook);

      const delivery = createMockDelivery({ webhookId: mockWebhook.id });
      await storage.createDelivery(delivery);

      (httpClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 500,
        body: 'Error',
      });

      await service.deliverWithRetry(delivery);

      const updated = await service.getWebhook(mockWebhook.id);
      expect(updated?.status).toBe('failed');
    });
  });

  describe('getDeliveryHistory', () => {
    it('returns delivery history for webhook', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      const delivery1 = createMockDelivery({ webhookId: mockWebhook.id });
      const delivery2 = createMockDelivery({ webhookId: mockWebhook.id });
      await storage.createDelivery(delivery1);
      await storage.createDelivery(delivery2);

      const result = await service.getDeliveryHistory(mockWebhook.id);

      expect(result.data).toHaveLength(2);
    });

    it('filters by status', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      await storage.createDelivery(
        createMockDelivery({ webhookId: mockWebhook.id, status: 'success' })
      );
      await storage.createDelivery(
        createMockDelivery({ webhookId: mockWebhook.id, status: 'failed' })
      );

      const result = await service.getDeliveryHistory(mockWebhook.id, {
        status: 'success',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe('success');
    });

    it('throws error when webhook not found', async () => {
      await expect(service.getDeliveryHistory('non_existent')).rejects.toThrow(
        WebhookNotFoundError
      );
    });
  });

  // ===========================================================================
  // Signature Tests
  // ===========================================================================

  describe('generateSignature', () => {
    it('generates consistent signatures', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test_secret';

      const sig1 = service.generateSignature(payload, secret);
      const sig2 = service.generateSignature(payload, secret);

      expect(sig1).toBe(sig2);
    });

    it('generates different signatures for different payloads', () => {
      const secret = 'test_secret';

      const sig1 = service.generateSignature('{"a":1}', secret);
      const sig2 = service.generateSignature('{"b":2}', secret);

      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different secrets', () => {
      const payload = JSON.stringify({ test: 'data' });

      const sig1 = service.generateSignature(payload, 'secret1');
      const sig2 = service.generateSignature(payload, 'secret2');

      expect(sig1).not.toBe(sig2);
    });

    it('generates sha256 prefixed signature', () => {
      const sig = service.generateSignature('test', 'secret');

      expect(sig).toMatch(/^sha256=[a-f0-9]+$/);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test_secret';
      const signature = service.generateSignature(payload, secret);

      const isValid = service.verifyWebhookSignature(
        payload,
        signature,
        secret
      );

      expect(isValid).toBe(true);
    });

    it('rejects invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test_secret';
      const wrongSignature = 'sha256=invalid';

      const isValid = service.verifyWebhookSignature(
        payload,
        wrongSignature,
        secret
      );

      expect(isValid).toBe(false);
    });

    it('rejects empty signature', () => {
      const isValid = service.verifyWebhookSignature('payload', '', 'secret');

      expect(isValid).toBe(false);
    });

    it('rejects empty payload', () => {
      const isValid = service.verifyWebhookSignature(
        '',
        'sha256=abc',
        'secret'
      );

      expect(isValid).toBe(false);
    });

    it('rejects empty secret', () => {
      const isValid = service.verifyWebhookSignature(
        'payload',
        'sha256=abc',
        ''
      );

      expect(isValid).toBe(false);
    });

    it('handles timing-safe comparison for different lengths', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test_secret';
      const shortSignature = 'sha256=short';

      const isValid = service.verifyWebhookSignature(
        payload,
        shortSignature,
        secret
      );

      expect(isValid).toBe(false);
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createIntegrationService', () => {
    it('creates service with default storage', () => {
      const service = createIntegrationService();

      expect(service).toBeInstanceOf(IntegrationServiceImpl);
    });

    it('creates service with custom storage', () => {
      const customStorage = new InMemoryIntegrationStorage();
      const service = createIntegrationService({ storage: customStorage });

      expect(service).toBeInstanceOf(IntegrationServiceImpl);
    });

    it('creates service with custom HTTP client', () => {
      const customHttpClient = createMockHttpClient();
      const service = createIntegrationService({
        httpClient: customHttpClient,
      });

      expect(service).toBeInstanceOf(IntegrationServiceImpl);
    });
  });

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================

  describe('Edge Cases', () => {
    it('handles concurrent webhook deliveries', async () => {
      const mockWebhook = createMockWebhook({ events: ['message.created'] });
      await storage.createWebhook(mockWebhook);

      (httpClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        body: 'OK',
      });

      const deliveries = await Promise.all([
        service.triggerWebhook(mockWebhook.id, 'message.created', { msg: 1 }),
        service.triggerWebhook(mockWebhook.id, 'message.created', { msg: 2 }),
        service.triggerWebhook(mockWebhook.id, 'message.created', { msg: 3 }),
      ]);

      expect(deliveries).toHaveLength(3);
      deliveries.forEach(d => expect(d.status).toBe('success'));
    });

    it('handles large payload correctly', async () => {
      const mockWebhook = createMockWebhook();
      await storage.createWebhook(mockWebhook);

      const delivery = createMockDelivery({
        webhookId: mockWebhook.id,
        payload: { largeData: 'x'.repeat(2 * 1024 * 1024) }, // 2MB payload
      });
      await storage.createDelivery(delivery);

      const result = await service.deliverWithRetry(delivery);

      expect(result.attempts[0]?.errorMessage).toBe(
        'Payload exceeds maximum size'
      );
    });

    it('handles webhook URL with special characters', async () => {
      const input: CreateWebhookInput = {
        workspaceId: generateTestId(),
        name: 'My Webhook',
        url: 'https://example.com/webhook?foo=bar&baz=qux',
        events: ['message.created'],
      };

      const result = await service.createWebhook(input, 'user_123');

      expect(result.url).toBe(input.url);
    });
  });
});
