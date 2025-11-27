'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Task type based on the Orchestrator backlog API
 */
export interface OrchestratorTask {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate: Date | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  orchestratorId: string;
  workspaceId: string;
  createdById: string;
  assignedToId: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspace?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    name: string | null;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface OrchestratorTaskMetrics {
  orchestratorId: string;
  total: number;
  byStatus: {
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  completionRate: string;
}

export interface UseOrchestratorTasksOptions {
  status?: string | string[];
  priority?: string | string[];
  includeCompleted?: boolean;
  sortBy?: 'priority' | 'dueDate' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UseOrchestratorTasksReturn {
  tasks: OrchestratorTask[];
  metrics: OrchestratorTaskMetrics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null;
}

/**
 * Hook for fetching tasks assigned to an Orchestrator
 *
 * @param orchestratorId - The OrchestratorID to fetch tasks for
 * @param options - Optional filtering and pagination options
 * @returns Tasks, metrics, and loading state
 *
 * @example
 * ```tsx
 * const { tasks, metrics, isLoading } = useOrchestratorTasks(orchestratorId, {
 *   status: ['TODO', 'IN_PROGRESS'],
 *   limit: 10
 * });
 * ```
 */
export function useOrchestratorTasks(orchestratorId: string, options?: UseOrchestratorTasksOptions): UseOrchestratorTasksReturn {
  const [tasks, setTasks] = useState<OrchestratorTask[]>([]);
  const [metrics, setMetrics] = useState<OrchestratorTaskMetrics | null>(null);
  const [pagination, setPagination] = useState<UseOrchestratorTasksReturn['pagination']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!orchestratorId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (options?.status) {
        const statusArray = Array.isArray(options.status) ? options.status : [options.status];
        statusArray.forEach(s => params.append('status', s));
      }

      if (options?.priority) {
        const priorityArray = Array.isArray(options.priority) ? options.priority : [options.priority];
        priorityArray.forEach(p => params.append('priority', p));
      }

      if (options?.includeCompleted !== undefined) {
        params.set('includeCompleted', String(options.includeCompleted));
      }

      if (options?.sortBy) {
        params.set('sortBy', options.sortBy);
      }

      if (options?.sortOrder) {
        params.set('sortOrder', options.sortOrder);
      }

      if (options?.page !== undefined) {
        params.set('page', String(options.page));
      }

      if (options?.limit !== undefined) {
        params.set('limit', String(options.limit));
      }

      const response = await fetch(`/api/orchestrators/${orchestratorId}/backlog?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch Orchestrator tasks');
      }

      const result = await response.json();
      setTasks(result.data || []);
      setMetrics(result.metrics || null);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTasks([]);
      setMetrics(null);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    orchestratorId,
    options?.status,
    options?.priority,
    options?.includeCompleted,
    options?.sortBy,
    options?.sortOrder,
    options?.page,
    options?.limit,
  ]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const refetch = useCallback(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    metrics,
    isLoading,
    error,
    refetch,
    pagination,
  };
}
