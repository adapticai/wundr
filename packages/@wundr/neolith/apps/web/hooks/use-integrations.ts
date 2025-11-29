'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  IntegrationConfig,
  IntegrationProvider,
  IntegrationStatus,
  CreateIntegrationInput,
  UpdateIntegrationInput,
  IntegrationOAuthResponse,
  WebhookConfig,
  WebhookStatus,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '@/types/integration';

// =============================================================================
// Integration Hooks
// =============================================================================

/**
 * Options for the useIntegrations hook
 */
export interface UseIntegrationsOptions {
  /** Filter by integration provider */
  provider?: IntegrationProvider;
  /** Filter by integration status */
  status?: IntegrationStatus;
}

/**
 * Return type for the useIntegrations hook
 */
export interface UseIntegrationsReturn {
  integrations: IntegrationConfig[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  mutate: (integrations: IntegrationConfig[]) => void;
}

/**
 * Hook for managing integrations list
 */
export function useIntegrations(
  workspaceId: string,
  options?: UseIntegrationsOptions,
): UseIntegrationsReturn {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!workspaceId) {
return;
}

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.provider) {
params.set('provider', options.provider);
}
      if (options?.status) {
params.set('status', options.status);
}

      const response = await fetch(
        `/api/workspaces/${workspaceId}/integrations?${params.toString()}`,
        { signal: abortController.signal }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch integrations: ${response.status}`);
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, options?.provider, options?.status]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const refetch = useCallback(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const mutate = useCallback((newIntegrations: IntegrationConfig[]) => {
    setIntegrations(newIntegrations);
  }, []);

  return {
    integrations,
    isLoading,
    error,
    refetch,
    mutate,
  };
}

/**
 * Return type for the useIntegration hook
 */
export interface UseIntegrationReturn {
  /** The integration configuration or null if not found */
  integration: IntegrationConfig | null;
  /** Whether the integration is loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Test the integration connection */
  testConnection: () => Promise<{ success: boolean; message?: string }>;
  /** Sync the integration data */
  syncIntegration: () => Promise<boolean>;
  /** Update the integration configuration */
  updateIntegration: (input: UpdateIntegrationInput) => Promise<IntegrationConfig | null>;
  /** Delete the integration */
  deleteIntegration: () => Promise<boolean>;
  /** Refetch the integration data */
  refetch: () => void;
}

/**
 * Hook for single integration operations
 */
export function useIntegration(workspaceId: string, integrationId: string): UseIntegrationReturn {
  const [integration, setIntegration] = useState<IntegrationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntegration = useCallback(async () => {
    if (!workspaceId || !integrationId) {
return;
}

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/integrations/${integrationId}`,
        { signal: abortController.signal }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setIntegration(null);
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch integration: ${response.status}`);
      }

      const data = await response.json();
      setIntegration(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, integrationId]);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  const testConnection = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/integrations/${integrationId}/test`,
        {
          method: 'POST',
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, message: data.error || `Connection test failed: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, message: data.message };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, message: 'Request cancelled' };
      }
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      };
    }
  }, [workspaceId, integrationId]);

  const syncIntegration = useCallback(async (): Promise<boolean> => {
    const abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/integrations/${integrationId}/sync`,
        {
          method: 'POST',
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to sync integration: ${response.status}`);
      }

      await fetchIntegration();
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      setError(err instanceof Error ? err : new Error('Failed to sync integration'));
      return false;
    }
  }, [workspaceId, integrationId, fetchIntegration]);

  const updateIntegration = useCallback(
    async (input: UpdateIntegrationInput): Promise<IntegrationConfig | null> => {
      const abortController = new AbortController();

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/integrations/${integrationId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to update integration: ${response.status}`);
        }

        const data = await response.json();
        setIntegration(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err : new Error('Failed to update integration'));
        return null;
      }
    },
    [workspaceId, integrationId],
  );

  const deleteIntegration = useCallback(async (): Promise<boolean> => {
    const abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/integrations/${integrationId}`,
        {
          method: 'DELETE',
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete integration: ${response.status}`);
      }

      setIntegration(null);
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      setError(err instanceof Error ? err : new Error('Failed to delete integration'));
      return false;
    }
  }, [workspaceId, integrationId]);

  const refetch = useCallback(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  return {
    integration,
    isLoading,
    error,
    testConnection,
    syncIntegration,
    updateIntegration,
    deleteIntegration,
    refetch,
  };
}

/**
 * Return type for the useIntegrationMutations hook
 */
export interface UseIntegrationMutationsReturn {
  /** Create a new integration */
  createIntegration: (
    workspaceId: string,
    input: CreateIntegrationInput
  ) => Promise<IntegrationConfig | null>;
  /** Initiate OAuth flow for a provider */
  initiateOAuth: (
    workspaceId: string,
    provider: IntegrationProvider
  ) => Promise<IntegrationOAuthResponse | null>;
  /** Whether a mutation is in progress */
  isLoading: boolean;
  /** Error that occurred during mutation */
  error: Error | null;
}

/**
 * Hook for integration mutations (create, OAuth)
 */
export function useIntegrationMutations(): UseIntegrationMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createIntegration = useCallback(
    async (
      workspaceId: string,
      input: CreateIntegrationInput,
    ): Promise<IntegrationConfig | null> => {
      const abortController = new AbortController();
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/integrations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to create integration: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err : new Error('Failed to create integration'));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const initiateOAuth = useCallback(
    async (
      workspaceId: string,
      provider: IntegrationProvider,
    ): Promise<IntegrationOAuthResponse | null> => {
      const abortController = new AbortController();
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/integrations/oauth/${provider}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to initiate OAuth: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err : new Error('Failed to initiate OAuth'));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    createIntegration,
    initiateOAuth,
    isLoading,
    error,
  };
}

// =============================================================================
// Webhook Hooks
// =============================================================================

/**
 * Options for the useWebhooks hook
 */
export interface UseWebhooksOptions {
  /** Filter by integration ID */
  integrationId?: string;
  /** Filter by webhook status */
  status?: WebhookStatus;
}

/**
 * Return type for the useWebhooks hook
 */
export interface UseWebhooksReturn {
  /** List of webhook configurations */
  webhooks: WebhookConfig[];
  /** Whether webhooks are loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Create a new webhook */
  createWebhook: (input: CreateWebhookInput) => Promise<WebhookConfig | null>;
  /** Refetch the webhooks list */
  refetch: () => void;
}

/**
 * Hook for managing webhooks list
 */
export function useWebhooks(workspaceId: string, options?: UseWebhooksOptions): UseWebhooksReturn {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebhooks = useCallback(async () => {
    if (!workspaceId) {
return;
}

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.integrationId) {
params.set('integrationId', options.integrationId);
}
      if (options?.status) {
params.set('status', options.status);
}

      const response = await fetch(
        `/api/workspaces/${workspaceId}/webhooks?${params.toString()}`,
        { signal: abortController.signal }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch webhooks: ${response.status}`);
      }

      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, options?.integrationId, options?.status]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const createWebhook = useCallback(
    async (input: CreateWebhookInput): Promise<WebhookConfig | null> => {
      const abortController = new AbortController();

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/webhooks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to create webhook: ${response.status}`);
        }

        const data = await response.json();
        setWebhooks((prev) => [...prev, data]);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err : new Error('Failed to create webhook'));
        return null;
      }
    },
    [workspaceId],
  );

  const refetch = useCallback(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  return {
    webhooks,
    isLoading,
    error,
    createWebhook,
    refetch,
  };
}

/**
 * Return type for the useWebhook hook
 */
export interface UseWebhookReturn {
  /** The webhook configuration or null if not found */
  webhook: WebhookConfig | null;
  /** Recent webhook deliveries */
  deliveries: WebhookDelivery[];
  /** Whether the webhook is loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Send a test webhook delivery */
  testWebhook: () => Promise<{ success: boolean; delivery?: WebhookDelivery }>;
  /** Update the webhook configuration */
  updateWebhook: (input: UpdateWebhookInput) => Promise<WebhookConfig | null>;
  /** Delete the webhook */
  deleteWebhook: () => Promise<boolean>;
  /** Rotate the webhook secret */
  rotateSecret: () => Promise<{ secret: string } | null>;
  /** Refetch the webhook data */
  refetch: () => void;
}

/**
 * Hook for single webhook operations
 */
export function useWebhook(workspaceId: string, webhookId: string): UseWebhookReturn {
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebhook = useCallback(async () => {
    if (!workspaceId || !webhookId) {
return;
}

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const [webhookResponse, deliveriesResponse] = await Promise.all([
        fetch(
          `/api/workspaces/${workspaceId}/webhooks/${webhookId}`,
          { signal: abortController.signal }
        ),
        fetch(
          `/api/workspaces/${workspaceId}/webhooks/${webhookId}/deliveries?limit=10`,
          { signal: abortController.signal }
        ),
      ]);

      if (!webhookResponse.ok) {
        if (webhookResponse.status === 404) {
          setWebhook(null);
          return;
        }
        const errorData = await webhookResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch webhook: ${webhookResponse.status}`);
      }

      const webhookData = await webhookResponse.json();
      setWebhook(webhookData);

      if (deliveriesResponse.ok) {
        const deliveriesData = await deliveriesResponse.json();
        setDeliveries(deliveriesData.deliveries || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, webhookId]);

  useEffect(() => {
    fetchWebhook();
  }, [fetchWebhook]);

  const testWebhook = useCallback(async (): Promise<{
    success: boolean;
    delivery?: WebhookDelivery;
  }> => {
    const abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/webhooks/${webhookId}/test`,
        {
          method: 'POST',
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Test delivery failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.delivery) {
        setDeliveries((prev) => [data.delivery, ...prev].slice(0, 10));
      }
      return { success: true, delivery: data.delivery };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false };
      }
      return { success: false };
    }
  }, [workspaceId, webhookId]);

  const updateWebhook = useCallback(
    async (input: UpdateWebhookInput): Promise<WebhookConfig | null> => {
      const abortController = new AbortController();

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/webhooks/${webhookId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to update webhook: ${response.status}`);
        }

        const data = await response.json();
        setWebhook(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err : new Error('Failed to update webhook'));
        return null;
      }
    },
    [workspaceId, webhookId],
  );

  const deleteWebhook = useCallback(async (): Promise<boolean> => {
    const abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/webhooks/${webhookId}`,
        {
          method: 'DELETE',
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete webhook: ${response.status}`);
      }

      setWebhook(null);
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false;
      }
      setError(err instanceof Error ? err : new Error('Failed to delete webhook'));
      return false;
    }
  }, [workspaceId, webhookId]);

  const rotateSecret = useCallback(async (): Promise<{ secret: string } | null> => {
    const abortController = new AbortController();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/webhooks/${webhookId}/rotate-secret`,
        {
          method: 'POST',
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to rotate secret: ${response.status}`);
      }

      const data = await response.json();
      await fetchWebhook();
      return { secret: data.secret };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      setError(err instanceof Error ? err : new Error('Failed to rotate secret'));
      return null;
    }
  }, [workspaceId, webhookId, fetchWebhook]);

  const refetch = useCallback(() => {
    fetchWebhook();
  }, [fetchWebhook]);

  return {
    webhook,
    deliveries,
    isLoading,
    error,
    testWebhook,
    updateWebhook,
    deleteWebhook,
    rotateSecret,
    refetch,
  };
}

/**
 * Options for the useWebhookDeliveries hook
 */
export interface UseWebhookDeliveriesOptions {
  /** Filter by delivery status */
  status?: WebhookDeliveryStatus;
  /** Number of deliveries to fetch per page */
  limit?: number;
}

/**
 * Return type for the useWebhookDeliveries hook
 */
export interface UseWebhookDeliveriesReturn {
  /** List of webhook deliveries */
  deliveries: WebhookDelivery[];
  /** Total number of deliveries */
  total: number;
  /** Whether deliveries are loading */
  isLoading: boolean;
  /** Whether there are more deliveries to load */
  hasMore: boolean;
  /** Load more deliveries */
  loadMore: () => Promise<void>;
  /** Retry a failed delivery */
  retryDelivery: (deliveryId: string) => Promise<WebhookDelivery | null>;
  /** Error that occurred during fetch */
  error: Error | null;
}

/**
 * Hook for webhook delivery history with pagination
 */
export function useWebhookDeliveries(
  workspaceId: string,
  webhookId: string,
  options?: UseWebhookDeliveriesOptions,
): UseWebhookDeliveriesReturn {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = options?.limit || 20;

  const fetchDeliveries = useCallback(
    async (append = false) => {
      if (!workspaceId || !webhookId) {
return;
}

      const abortController = new AbortController();
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('limit', limit.toString());
        params.set('offset', (append ? offset : 0).toString());
        if (options?.status) {
params.set('status', options.status);
}

        const response = await fetch(
          `/api/workspaces/${workspaceId}/webhooks/${webhookId}/deliveries?${params.toString()}`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch deliveries: ${response.status}`);
        }

        const data = await response.json();

        if (append) {
          setDeliveries((prev) => [...prev, ...(data.deliveries || [])]);
        } else {
          setDeliveries(data.deliveries || []);
        }

        setTotal(data.total || 0);
        setHasMore(data.hasMore || false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }

      return () => {
        abortController.abort();
      };
    },
    [workspaceId, webhookId, offset, limit, options?.status],
  );

  useEffect(() => {
    fetchDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, webhookId, options?.status]);

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      setOffset((prev) => prev + limit);
      await fetchDeliveries(true);
    }
  }, [hasMore, isLoading, limit, fetchDeliveries]);

  const retryDelivery = useCallback(
    async (deliveryId: string): Promise<WebhookDelivery | null> => {
      const abortController = new AbortController();

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/webhooks/${webhookId}/deliveries/${deliveryId}/retry`,
          {
            method: 'POST',
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to retry delivery: ${response.status}`);
        }

        const data = await response.json();

        // Update the delivery in the list
        setDeliveries((prev) =>
          prev.map((d) => (d.id === deliveryId ? data : d)),
        );

        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        setError(err instanceof Error ? err : new Error('Failed to retry delivery'));
        return null;
      }
    },
    [workspaceId, webhookId],
  );

  return {
    deliveries,
    total,
    isLoading,
    hasMore,
    loadMore,
    retryDelivery,
    error,
  };
}
