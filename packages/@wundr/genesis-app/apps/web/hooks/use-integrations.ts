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
      );

      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (err) {
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
export function useIntegration(integrationId: string): UseIntegrationReturn {
  const [integration, setIntegration] = useState<IntegrationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntegration = useCallback(async () => {
    if (!integrationId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/${integrationId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setIntegration(null);
          return;
        }
        throw new Error('Failed to fetch integration');
      }

      const data = await response.json();
      setIntegration(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  const testConnection = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, message: data.error || 'Connection test failed' };
      }

      const data = await response.json();
      return { success: true, message: data.message };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      };
    }
  }, [integrationId]);

  const syncIntegration = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync integration');
      }

      await fetchIntegration();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sync integration'));
      return false;
    }
  }, [integrationId, fetchIntegration]);

  const updateIntegration = useCallback(
    async (input: UpdateIntegrationInput): Promise<IntegrationConfig | null> => {
      try {
        const response = await fetch(`/api/integrations/${integrationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to update integration');
        }

        const data = await response.json();
        setIntegration(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update integration'));
        return null;
      }
    },
    [integrationId],
  );

  const deleteIntegration = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete integration');
      }

      setIntegration(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete integration'));
      return false;
    }
  }, [integrationId]);

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
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to create integration');
        }

        const data = await response.json();
        return data;
      } catch (err) {
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
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/integrations/oauth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        });

        if (!response.ok) {
          throw new Error('Failed to initiate OAuth');
        }

        const data = await response.json();
        return data;
      } catch (err) {
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
      );

      if (!response.ok) {
        throw new Error('Failed to fetch webhooks');
      }

      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (err) {
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
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to create webhook');
        }

        const data = await response.json();
        setWebhooks((prev) => [...prev, data]);
        return data;
      } catch (err) {
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
export function useWebhook(webhookId: string): UseWebhookReturn {
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebhook = useCallback(async () => {
    if (!webhookId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const [webhookResponse, deliveriesResponse] = await Promise.all([
        fetch(`/api/webhooks/${webhookId}`),
        fetch(`/api/webhooks/${webhookId}/deliveries?limit=10`),
      ]);

      if (!webhookResponse.ok) {
        if (webhookResponse.status === 404) {
          setWebhook(null);
          return;
        }
        throw new Error('Failed to fetch webhook');
      }

      const webhookData = await webhookResponse.json();
      setWebhook(webhookData);

      if (deliveriesResponse.ok) {
        const deliveriesData = await deliveriesResponse.json();
        setDeliveries(deliveriesData.deliveries || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    fetchWebhook();
  }, [fetchWebhook]);

  const testWebhook = useCallback(async (): Promise<{
    success: boolean;
    delivery?: WebhookDelivery;
  }> => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Test delivery failed');
      }

      const data = await response.json();
      if (data.delivery) {
        setDeliveries((prev) => [data.delivery, ...prev].slice(0, 10));
      }
      return { success: true, delivery: data.delivery };
    } catch (_err) {
      return { success: false };
    }
  }, [webhookId]);

  const updateWebhook = useCallback(
    async (input: UpdateWebhookInput): Promise<WebhookConfig | null> => {
      try {
        const response = await fetch(`/api/webhooks/${webhookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to update webhook');
        }

        const data = await response.json();
        setWebhook(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update webhook'));
        return null;
      }
    },
    [webhookId],
  );

  const deleteWebhook = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      setWebhook(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete webhook'));
      return false;
    }
  }, [webhookId]);

  const rotateSecret = useCallback(async (): Promise<{ secret: string } | null> => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/rotate-secret`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to rotate secret');
      }

      const data = await response.json();
      await fetchWebhook();
      return { secret: data.secret };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to rotate secret'));
      return null;
    }
  }, [webhookId, fetchWebhook]);

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
      if (!webhookId) {
return;
}

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
          `/api/webhooks/${webhookId}/deliveries?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch deliveries');
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
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [webhookId, offset, limit, options?.status],
  );

  useEffect(() => {
    fetchDeliveries();
  }, [webhookId, options?.status]);

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      setOffset((prev) => prev + limit);
      await fetchDeliveries(true);
    }
  }, [hasMore, isLoading, limit, fetchDeliveries]);

  const retryDelivery = useCallback(
    async (deliveryId: string): Promise<WebhookDelivery | null> => {
      try {
        const response = await fetch(
          `/api/webhooks/${webhookId}/deliveries/${deliveryId}/retry`,
          {
            method: 'POST',
          },
        );

        if (!response.ok) {
          throw new Error('Failed to retry delivery');
        }

        const data = await response.json();

        // Update the delivery in the list
        setDeliveries((prev) =>
          prev.map((d) => (d.id === deliveryId ? data : d)),
        );

        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to retry delivery'));
        return null;
      }
    },
    [webhookId],
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
