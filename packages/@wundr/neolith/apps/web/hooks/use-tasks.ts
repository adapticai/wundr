'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  TaskPriorityType,
  TaskStatusType,
} from '@/lib/validations/task';

/**
 * Task type for workspace tasks
 */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatusType;
  priority: TaskPriorityType;
  dueDate: Date | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  vpId: string;
  workspaceId: string;
  createdById: string;
  assignedToId: string | null;
  estimatedHours: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  vp?: {
    id: string;
    role: string;
    user: {
      name: string | null;
      email: string;
    };
  };
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

export interface UseTasksOptions {
  orchestratorId?: string;
  channelId?: string;
  status?: TaskStatusType | TaskStatusType[];
  priority?: TaskPriorityType | TaskPriorityType[];
  search?: string;
  tags?: string[];
  assignedToId?: string;
  includeCompleted?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'dueDate' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UseTasksReturn {
  tasks: Task[];
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
 * Hook for fetching tasks in a workspace
 *
 * @param workspaceId - The workspace ID to fetch tasks for
 * @param options - Optional filtering and pagination options
 * @returns Tasks and loading state
 *
 * @example
 * ```tsx
 * const { tasks, isLoading } = useTasks(workspaceId, {
 *   status: ['TODO', 'IN_PROGRESS'],
 *   priority: 'HIGH',
 *   limit: 20
 * });
 * ```
 */
export function useTasks(workspaceId: string, options?: UseTasksOptions): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<UseTasksReturn['pagination']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Workspace filter
      params.set('workspaceId', workspaceId);

      // Optional filters
      if (options?.orchestratorId) {
        params.set('orchestratorId', options.orchestratorId);
      }

      if (options?.channelId) {
        params.set('channelId', options.channelId);
      }

      if (options?.status) {
        const statusArray = Array.isArray(options.status) ? options.status : [options.status];
        statusArray.forEach(s => params.append('status', s));
      }

      if (options?.priority) {
        const priorityArray = Array.isArray(options.priority) ? options.priority : [options.priority];
        priorityArray.forEach(p => params.append('priority', p));
      }

      if (options?.search) {
        params.set('search', options.search);
      }

      if (options?.tags && options.tags.length > 0) {
        options.tags.forEach(tag => params.append('tags', tag));
      }

      if (options?.assignedToId) {
        params.set('assignedToId', options.assignedToId);
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

      const response = await fetch(`/api/tasks?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const result = await response.json();
      setTasks(result.data || []);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTasks([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    workspaceId,
    options?.orchestratorId,
    options?.channelId,
    options?.status,
    options?.priority,
    options?.search,
    options?.tags,
    options?.assignedToId,
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
    isLoading,
    error,
    refetch,
    pagination,
  };
}
