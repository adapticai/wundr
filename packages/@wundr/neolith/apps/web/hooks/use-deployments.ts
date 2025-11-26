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

import { useCallback, useEffect, useState } from 'react';

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
  createDeployment: (input: CreateDeploymentInput) => Promise<Deployment | null>;
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

  const fetchDeployments = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch deployments');
      }

      const data = await response.json();
      setDeployments(data.deployments);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, filters?.status, filters?.environment, filters?.type, filters?.search]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  const createDeployment = useCallback(
    async (input: CreateDeploymentInput): Promise<Deployment | null> => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/deployments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to create deployment');
        }

        const data = await response.json();
        setDeployments((prev) => [data.deployment, ...prev]);
        return data.deployment;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
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
  updateDeployment: (input: UpdateDeploymentInput) => Promise<Deployment | null>;
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

  const fetchDeployment = useCallback(async () => {
    if (!workspaceId || !deploymentId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/deployments/${deploymentId}`,
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Deployment not found');
        }
        throw new Error('Failed to fetch deployment');
      }

      const data = await response.json();
      setDeployment(data.deployment);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, deploymentId]);

  useEffect(() => {
    fetchDeployment();
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
          throw new Error('Failed to update deployment');
        }

        const data = await response.json();
        setDeployment(data.deployment);
        return data.deployment;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
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
        throw new Error('Failed to delete deployment');
      }

      setDeployment(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workspaceId, deploymentId]);

  const restartDeployment = useCallback(async (): Promise<boolean> => {
    try {
      // Update status to show restarting
      if (deployment) {
        setDeployment({ ...deployment, status: 'updating' });
      }

      // Simulate restart (would call actual API endpoint in production)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh deployment data
      await fetchDeployment();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [deployment, fetchDeployment]);

  const stopDeployment = useCallback(async (): Promise<boolean> => {
    try {
      // Update status to show stopping
      if (deployment) {
        setDeployment({ ...deployment, status: 'stopped' });
      }

      // Simulate stop (would call actual API endpoint in production)
      await new Promise((resolve) => setTimeout(resolve, 500));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [deployment]);

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
  const [hasMore] = useState(false); // Would be set based on API response

  const fetchLogs = useCallback(async () => {
    if (!workspaceId || !deploymentId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.level) {
        params.set('level', options.level);
      }
      const limit = options?.limit ?? 100;
      params.set('limit', String(limit));

      const url = `/api/workspaces/${workspaceId}/deployments/${deploymentId}/logs?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, deploymentId, options?.level, options?.limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const loadMore = useCallback(() => {
    // In a real implementation, this would fetch the next page of logs
    console.log('Load more logs');
  }, []);

  return {
    logs,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch: fetchLogs,
  };
}
