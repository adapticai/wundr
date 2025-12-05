'use client';

/**
 * @neolith/hooks/use-deployments - Deployment Management Hooks
 *
 * Provides hooks for creating, managing, and monitoring deployments.
 *
 * @packageDocumentation
 * @module @neolith/hooks/use-deployments
 *
 * @example
 * ```typescript
 * // List and create deployments
 * const { deployments, createDeployment } = useDeployments(workspaceId);
 *
 * // Manage a single deployment
 * const { deployment, updateDeployment, deleteDeployment } = useDeployment(
 *   workspaceId,
 *   deploymentId
 * );
 *
 * // View deployment logs
 * const { logs, loadMore } = useDeploymentLogs(workspaceId, deploymentId);
 * ```
 */

import { useCallback, useEffect, useState, useRef } from 'react';

import type {
  Deployment,
  CreateDeploymentInput,
  UpdateDeploymentInput,
  DeploymentLog,
  DeploymentFilters,
} from '@/types/deployment';

// =============================================================================
// useDeployments - Fetch and manage list of deployments
// =============================================================================

/**
 * Return type for the useDeployments hook
 */
export interface UseDeploymentsReturn {
  /** List of deployments */
  deployments: Deployment[];
  /** Whether deployments are loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Total count of deployments */
  totalCount: number;
  /** Create a new deployment */
  createDeployment: (
    input: CreateDeploymentInput
  ) => Promise<Deployment | null>;
  /** Refetch deployments */
  mutate: () => void;
}

/**
 * Hook for fetching and managing deployments in a workspace.
 *
 * @param workspaceId - The workspace ID to fetch deployments for
 * @param filters - Optional filtering options
 * @returns Deployment list and management methods
 */
export function useDeployments(
  workspaceId: string,
  filters?: DeploymentFilters,
): UseDeploymentsReturn {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDeployments = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) {
        params.set('status', filters.status);
      }
      if (filters?.environment) {
        params.set('environment', filters.environment);
      }
      if (filters?.type) {
        params.set('type', filters.type);
      }
      if (filters?.search) {
        params.set('search', filters.search);
      }

      const url = `/api/workspaces/${workspaceId}/deployments?${params.toString()}`;
      const response = await fetch(url, { signal });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Failed to fetch deployments (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.deployments)) {
        throw new Error('Invalid response format: expected deployments array');
      }

      setDeployments(data.deployments);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update error state
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [
    workspaceId,
    filters?.status,
    filters?.environment,
    filters?.type,
    filters?.search,
  ]);

  useEffect(() => {
    fetchDeployments();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDeployments]);

  const createDeployment = useCallback(
    async (input: CreateDeploymentInput): Promise<Deployment | null> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/deployments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          },
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(
            `Failed to create deployment (${response.status}): ${errorText}`,
          );
        }

        const data = await response.json();

        if (!data || !data.deployment) {
          throw new Error(
            'Invalid response format: expected deployment object',
          );
        }

        setDeployments(prev => [data.deployment, ...prev]);
        return data.deployment;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        return null;
      }
    },
    [workspaceId],
  );

  return {
    deployments,
    isLoading,
    error,
    totalCount: deployments.length,
    createDeployment,
    mutate: fetchDeployments,
  };
}

// =============================================================================
// useDeployment - Fetch and manage single deployment
// =============================================================================

/**
 * Return type for the useDeployment hook
 */
export interface UseDeploymentReturn {
  /** The deployment or null if not found */
  deployment: Deployment | null;
  /** Whether the deployment is loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Update the deployment */
  updateDeployment: (
    input: UpdateDeploymentInput
  ) => Promise<Deployment | null>;
  /** Delete the deployment */
  deleteDeployment: () => Promise<boolean>;
  /** Restart the deployment */
  restartDeployment: () => Promise<boolean>;
  /** Stop the deployment */
  stopDeployment: () => Promise<boolean>;
  /** Refetch the deployment data */
  refetch: () => void;
}

/**
 * Hook for managing a single deployment.
 *
 * @param workspaceId - The workspace ID containing the deployment
 * @param deploymentId - The deployment ID to manage
 * @returns Deployment data and management methods
 */
export function useDeployment(
  workspaceId: string,
  deploymentId: string,
): UseDeploymentReturn {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDeployment = useCallback(async () => {
    if (!workspaceId || !deploymentId) {
      return;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/deployments/${deploymentId}`,
        { signal },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Deployment not found: ${deploymentId}`);
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Failed to fetch deployment (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();

      if (!data || !data.deployment) {
        throw new Error('Invalid response format: expected deployment object');
      }

      setDeployment(data.deployment);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update error state
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, deploymentId]);

  useEffect(() => {
    fetchDeployment();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDeployment]);

  const updateDeployment = useCallback(
    async (input: UpdateDeploymentInput): Promise<Deployment | null> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/deployments/${deploymentId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          },
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(
            `Failed to update deployment (${response.status}): ${errorText}`,
          );
        }

        const data = await response.json();

        if (!data || !data.deployment) {
          throw new Error(
            'Invalid response format: expected deployment object',
          );
        }

        setDeployment(data.deployment);
        return data.deployment;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        return null;
      }
    },
    [workspaceId, deploymentId],
  );

  const deleteDeployment = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/deployments/${deploymentId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Failed to delete deployment (${response.status}): ${errorText}`,
        );
      }

      setDeployment(null);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return false;
    }
  }, [workspaceId, deploymentId]);

  const restartDeployment = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/deployments/${deploymentId}/restart`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Failed to restart deployment (${response.status}): ${errorText}`,
        );
      }

      // Refresh deployment data to get updated status
      await fetchDeployment();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return false;
    }
  }, [workspaceId, deploymentId, fetchDeployment]);

  const stopDeployment = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/deployments/${deploymentId}/stop`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Failed to stop deployment (${response.status}): ${errorText}`,
        );
      }

      // Refresh deployment data to get updated status
      await fetchDeployment();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return false;
    }
  }, [workspaceId, deploymentId, fetchDeployment]);

  return {
    deployment,
    isLoading,
    error,
    updateDeployment,
    deleteDeployment,
    restartDeployment,
    stopDeployment,
    refetch: fetchDeployment,
  };
}

// =============================================================================
// useDeploymentLogs - Fetch deployment logs
// =============================================================================

/**
 * Options for the useDeploymentLogs hook
 */
export interface UseDeploymentLogsOptions {
  /** Filter by log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Maximum number of logs to fetch */
  limit?: number;
}

/**
 * Return type for the useDeploymentLogs hook
 */
export interface UseDeploymentLogsReturn {
  /** List of log entries */
  logs: DeploymentLog[];
  /** Whether logs are loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Whether there are more logs to load */
  hasMore: boolean;
  /** Load more logs */
  loadMore: () => void;
  /** Refetch the logs */
  refetch: () => void;
}

/**
 * Hook for fetching deployment logs.
 *
 * @param workspaceId - The workspace ID containing the deployment
 * @param deploymentId - The deployment ID to fetch logs for
 * @param options - Optional filtering options
 * @returns Log list and management methods
 */
export function useDeploymentLogs(
  workspaceId: string,
  deploymentId: string,
  options?: UseDeploymentLogsOptions,
): UseDeploymentLogsReturn {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLogs = useCallback(
    async (append: boolean = false) => {
      if (!workspaceId || !deploymentId) {
        return;
      }

      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.level) {
          params.set('level', options.level);
        }
        const limit = options?.limit ?? 100;
        params.set('limit', String(limit));

        // Add cursor for pagination
        if (append && cursor) {
          params.set('cursor', cursor);
        }

        const url = `/api/workspaces/${workspaceId}/deployments/${deploymentId}/logs?${params.toString()}`;
        const response = await fetch(url, { signal });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(
            `Failed to fetch logs (${response.status}): ${errorText}`,
          );
        }

        const data = await response.json();

        if (!data || !Array.isArray(data.logs)) {
          throw new Error('Invalid response format: expected logs array');
        }

        setLogs(prev => (append ? [...prev, ...data.logs] : data.logs));
        setHasMore(data.hasMore ?? false);
        setCursor(data.nextCursor ?? null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, don't update error state
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId, deploymentId, options?.level, options?.limit, cursor],
  );

  useEffect(() => {
    fetchLogs(false);

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [workspaceId, deploymentId, options?.level, options?.limit]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchLogs(true);
    }
  }, [hasMore, isLoading, fetchLogs]);

  return {
    logs,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch: fetchLogs,
  };
}
