'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';

import type { Orchestrator, OrchestratorFilters, CreateOrchestratorInput, UpdateOrchestratorInput } from '@/types/orchestrator';
import type { OrchestratorApiResponse } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for the useOrchestrator hook
 */
export interface UseOrchestratorReturn {
  /** The Orchestrator data, or null if not loaded */
  orchestrator: Orchestrator | null;
  /** Whether the Orchestrator is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the Orchestrator data */
  refetch: () => void;
}

/**
 * Pagination metadata from API
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Return type for the useOrchestrators hook
 */
export interface UseOrchestratorsReturn {
  /** Filtered list of Orchestrators */
  orchestrators: Orchestrator[];
  /** Complete list of Orchestrators (unfiltered) */
  allOrchestrators: Orchestrator[];
  /** Whether Orchestrators are currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the Orchestrators */
  refetch: () => void;
  /** Total count of Orchestrators */
  totalCount: number;
  /** Count of Orchestrators after filtering */
  filteredCount: number;
  /** Pagination metadata from server */
  pagination: PaginationMetadata | null;
}

/**
 * Return type for the useOrchestratorMutations hook
 */
export interface UseOrchestratorMutationsReturn {
  /** Create a new Orchestrator */
  createOrchestrator: (input: CreateOrchestratorInput) => Promise<Orchestrator | null>;
  /** Update an existing Orchestrator */
  updateOrchestrator: (id: string, input: UpdateOrchestratorInput) => Promise<Orchestrator | null>;
  /** Delete an Orchestrator */
  deleteOrchestrator: (id: string) => Promise<boolean>;
  /** Toggle Orchestrator active/inactive status */
  toggleOrchestratorStatus: (id: string, currentStatus: Orchestrator['status']) => Promise<Orchestrator | null>;
  /** Rotate an Orchestrator's API key */
  rotateAPIKey: (id: string) => Promise<{ apiKey: string } | null>;
  /** Whether a mutation is in progress */
  isLoading: boolean;
  /** Error object if mutation failed */
  error: Error | null;
}

// =============================================================================
// useOrchestratorHook
// =============================================================================

/**
 * Hook for fetching and managing a single Orchestrator
 *
 * Fetches Orchestrator data by ID and provides a refetch capability.
 *
 * @param id - The OrchestratorID to fetch
 * @returns Orchestrator data and loading state
 *
 * @example
 * ```tsx
 * function OrchestratorProfile({ orchestratorId }: { orchestratorId: string }) {
 *   const { orchestrator, isLoading, error, refetch } = useOrchestrator(orchestratorId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h1>{orchestrator?.title}</h1>
 *       <p>{orchestrator?.description}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrchestrator(id: string): UseOrchestratorReturn {
  const [orchestrator, setOrchestrator] = useState<Orchestrator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrchestrator = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orchestrators/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Orchestrator');
      }
      const result: { data: OrchestratorApiResponse } = await response.json();

      // Transform the API response to match the Orchestrator type structure
      const apiOrchestrator = result.data;

      // Validate required fields exist
      if (!apiOrchestrator.id || !apiOrchestrator.userId) {
        throw new Error('Invalid Orchestrator response: missing required fields');
      }

      const transformedOrchestrator: Orchestrator = {
        id: apiOrchestrator.id,
        userId: apiOrchestrator.userId,
        title: apiOrchestrator.role || apiOrchestrator.title || 'Untitled Orchestrator',
        description: apiOrchestrator.user?.bio || apiOrchestrator.description || null,
        discipline: apiOrchestrator.discipline || null,
        status: (apiOrchestrator.status as Orchestrator['status']) || 'OFFLINE',
        charter: (apiOrchestrator.charter as unknown as Orchestrator['charter']) || null,
        capabilities: Array.isArray(apiOrchestrator.capabilities) ? apiOrchestrator.capabilities : [],
        modelConfig: (apiOrchestrator.modelConfig as unknown as Orchestrator['modelConfig']) || null,
        systemPrompt: apiOrchestrator.systemPrompt || null,
        organizationId: apiOrchestrator.organizationId || null,
        avatarUrl: apiOrchestrator.user?.avatarUrl || apiOrchestrator.avatarUrl || null,
        lastActivityAt: apiOrchestrator.lastActivityAt ? new Date(apiOrchestrator.lastActivityAt) : apiOrchestrator.updatedAt ? new Date(apiOrchestrator.updatedAt) : null,
        messageCount: apiOrchestrator.messageCount || 0,
        agentCount: apiOrchestrator.agentCount || 0,
        createdAt: apiOrchestrator.createdAt ? new Date(apiOrchestrator.createdAt) : new Date(),
        updatedAt: apiOrchestrator.updatedAt ? new Date(apiOrchestrator.updatedAt) : new Date(),
      };

      setOrchestrator(transformedOrchestrator);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrchestrator();
  }, [fetchOrchestrator]);

  const refetch = useCallback((): void => {
    fetchOrchestrator();
  }, [fetchOrchestrator]);

  return {
    orchestrator,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// useOrchestrators Hook
// =============================================================================

/**
 * Hook for fetching a list of Orchestrators with filtering
 *
 * Fetches Orchestrators for a workspace with optional filtering by discipline,
 * status, and search query.
 *
 * @param workspaceId - The workspace ID to fetch Orchestrators for
 * @param filters - Optional filters to apply
 * @returns Orchestrators list, loading state, and counts
 *
 * @example
 * ```tsx
 * function OrchestratorList() {
 *   const { orchestrators, isLoading, totalCount, filteredCount } = useOrchestrators(
 *     'ws-123',
 *     { status: 'ACTIVE', discipline: 'engineering' }
 *   );
 *
 *   return (
 *     <div>
 *       <p>Showing {filteredCount} of {totalCount} Orchestrators</p>
 *       {orchestrators.map(orchestrator => <OrchestratorCard key={orchestrator.id} orchestrator={orchestrator} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrchestrators(workspaceId: string, filters?: OrchestratorFilters): UseOrchestratorsReturn {
  const [orchestrators, setOrchestrators] = useState<Orchestrator[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrchestrators = useCallback(async (): Promise<void> => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters?.discipline) {
        params.set('discipline', filters.discipline);
      }
      if (filters?.status) {
        params.set('status', filters.status);
      }
      if (filters?.search) {
        params.set('search', filters.search);
      }
      // Add pagination params if provided
      if (filters?.page !== undefined) {
        params.set('page', String(filters.page));
      }
      if (filters?.limit !== undefined) {
        params.set('limit', String(filters.limit));
      }

      const queryString = params.toString();
      const url = queryString
        ? `/api/workspaces/${workspaceId}/orchestrators?${queryString}`
        : `/api/workspaces/${workspaceId}/orchestrators`;

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to fetch Orchestrators');
      }
      const result: { data: OrchestratorApiResponse[]; pagination?: PaginationMetadata } = await response.json();

      // Transform the API response to match the Orchestrator type structure
      // The database schema has 'role' but the frontend expects 'title'
      // Filter out items missing required fields
      const transformedOrchestrators: Orchestrator[] = (result.data || [])
        .filter((apiOrchestrator: OrchestratorApiResponse) => apiOrchestrator.id && apiOrchestrator.userId)
        .map((apiOrchestrator: OrchestratorApiResponse) => ({
          id: apiOrchestrator.id!,
          userId: apiOrchestrator.userId!,
          title: apiOrchestrator.role || apiOrchestrator.title || 'Untitled Orchestrator',
          description: apiOrchestrator.user?.bio || apiOrchestrator.description || null,
          discipline: apiOrchestrator.discipline || null,
          status: (apiOrchestrator.status as Orchestrator['status']) || 'OFFLINE',
          charter: (apiOrchestrator.charter as unknown as Orchestrator['charter']) || null,
          capabilities: Array.isArray(apiOrchestrator.capabilities) ? apiOrchestrator.capabilities : [],
          modelConfig: (apiOrchestrator.modelConfig as unknown as Orchestrator['modelConfig']) || null,
          systemPrompt: apiOrchestrator.systemPrompt || null,
          organizationId: apiOrchestrator.organizationId || null,
          avatarUrl: apiOrchestrator.user?.avatarUrl || apiOrchestrator.avatarUrl || null,
          lastActivityAt: apiOrchestrator.lastActivityAt ? new Date(apiOrchestrator.lastActivityAt) : apiOrchestrator.updatedAt ? new Date(apiOrchestrator.updatedAt) : null,
          messageCount: apiOrchestrator.messageCount || 0,
          agentCount: apiOrchestrator.agentCount || 0,
          createdAt: apiOrchestrator.createdAt ? new Date(apiOrchestrator.createdAt) : new Date(),
          updatedAt: apiOrchestrator.updatedAt ? new Date(apiOrchestrator.updatedAt) : new Date(),
        }));

      setOrchestrators(transformedOrchestrators);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setOrchestrators([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, filters?.discipline, filters?.status, filters?.search, filters?.page, filters?.limit]);

  useEffect(() => {
    fetchOrchestrators();
  }, [fetchOrchestrators]);

  const refetch = useCallback(() => {
    fetchOrchestrators();
  }, [fetchOrchestrators]);

  // Filter Orchestrators locally for immediate feedback
  const filteredOrchestrators = useMemo(() => {
    let result = [...orchestrators];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (orchestrator) =>
          orchestrator.title.toLowerCase().includes(searchLower) ||
          orchestrator.description?.toLowerCase().includes(searchLower) ||
          orchestrator.discipline?.toLowerCase().includes(searchLower),
      );
    }

    if (filters?.discipline) {
      result = result.filter((orchestrator) => orchestrator.discipline === filters.discipline);
    }

    if (filters?.status) {
      result = result.filter((orchestrator) => orchestrator.status === filters.status);
    }

    return result;
  }, [orchestrators, filters]);

  return {
    orchestrators: filteredOrchestrators,
    allOrchestrators: orchestrators,
    isLoading,
    error,
    refetch,
    totalCount: pagination?.totalCount ?? orchestrators.length,
    filteredCount: filteredOrchestrators.length,
    pagination,
  };
}

// =============================================================================
// useOrchestratorMutations Hook
// =============================================================================

/**
 * Hook for Orchestrator mutations (create, update, delete)
 *
 * Provides CRUD operations and additional actions for managing Orchestrators.
 *
 * @returns Mutation functions and loading state
 *
 * @example
 * ```tsx
 * function OrchestratorManager() {
 *   const { createOrchestrator, updateOrchestrator, deleteOrchestrator, isLoading } = useOrchestratorMutations();
 *
 *   const handleCreate = async () => {
 *     const newOrchestrator = await createOrchestrator({
 *       title: 'New Assistant',
 *       discipline: 'support',
 *       organizationId: 'org-123'
 *     });
 *     if (newOrchestrator) {
 *       console.log('Created Orchestrator:', newOrchestrator.id);
 *     }
 *   };
 *
 *   return <button onClick={handleCreate} disabled={isLoading}>Create Orchestrator</button>;
 * }
 * ```
 */
export function useOrchestratorMutations(): UseOrchestratorMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createOrchestrator = useCallback(async (input: CreateOrchestratorInput): Promise<Orchestrator | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orchestrators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to create Orchestrator');
      }

      const result: { data: Orchestrator } = await response.json();
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateOrchestrator = useCallback(async (id: string, input: UpdateOrchestratorInput): Promise<Orchestrator | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orchestrators/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to update Orchestrator');
      }

      const result: { data: Orchestrator } = await response.json();
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteOrchestrator = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orchestrators/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to delete Orchestrator');
      }

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleOrchestratorStatus = useCallback(async (id: string, currentStatus: Orchestrator['status']): Promise<Orchestrator | null> => {
    // Toggle between ONLINE and OFFLINE states
    const newStatus = currentStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    return updateOrchestrator(id, { status: newStatus });
  }, [updateOrchestrator]);

  const rotateAPIKey = useCallback(async (id: string): Promise<{ apiKey: string } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orchestrators/${id}/api-key`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to rotate API key');
      }

      const result: { data: { apiKey: string } } = await response.json();
      return { apiKey: result.data.apiKey };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createOrchestrator,
    updateOrchestrator,
    deleteOrchestrator,
    toggleOrchestratorStatus,
    rotateAPIKey,
    isLoading,
    error,
  };
}
