'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';

import type { Charter } from '@/lib/validations/charter';

// =============================================================================
// Types
// =============================================================================

/**
 * Charter version entity from API
 */
export interface CharterVersion {
  id: string;
  charterId: string;
  orchestratorId: string;
  version: number;
  charterData: Charter;
  changeLog: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator?: {
    id: string;
    name: string | null;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  orchestrator?: {
    id: string;
    organizationId: string;
    role: string | null;
    discipline: string | null;
  };
}

/**
 * Input for creating a new charter version
 */
export interface CreateCharterVersionInput {
  charterId: string;
  charterData: Record<string, unknown>;
  changeLog?: string | null;
  version?: number;
}

/**
 * Input for updating charter version metadata
 */
export interface UpdateCharterVersionInput {
  changeLog?: string | null;
}

/**
 * Input for rolling back to a previous version
 */
export interface RollbackCharterInput {
  targetVersion: number;
  changeLog?: string | null;
}

/**
 * Diff comparison result between two charter versions
 */
export interface CharterDiff {
  charterId: string;
  v1: number;
  v2: number;
  changes: Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
    type: 'added' | 'removed' | 'modified';
  }>;
}

/**
 * Pagination metadata
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
 * Return type for useCharter hook
 */
export interface UseCharterReturn {
  /** Active charter data */
  charter: Charter | null;
  /** Charter version metadata */
  version: CharterVersion | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch charter data */
  refetch: () => void;
}

/**
 * Return type for useCharterVersions hook
 */
export interface UseCharterVersionsReturn {
  /** List of charter versions */
  versions: CharterVersion[];
  /** Whether versions are loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch versions */
  refetch: () => void;
  /** Pagination metadata */
  pagination: PaginationMetadata | null;
}

/**
 * Return type for useCharterMutations hook
 */
export interface UseCharterMutationsReturn {
  /** Create a new charter version */
  createVersion: (charterId: string, input: CreateCharterVersionInput, signal?: AbortSignal) => Promise<CharterVersion | null>;
  /** Update charter version metadata */
  updateVersion: (charterId: string, version: number, input: UpdateCharterVersionInput, signal?: AbortSignal) => Promise<CharterVersion | null>;
  /** Activate a specific version */
  activateVersion: (charterId: string, version: number, signal?: AbortSignal) => Promise<CharterVersion | null>;
  /** Rollback to a previous version */
  rollback: (charterId: string, input: RollbackCharterInput, signal?: AbortSignal) => Promise<CharterVersion | null>;
  /** Get diff between two versions */
  getDiff: (charterId: string, v1: number, v2: number, signal?: AbortSignal) => Promise<CharterDiff | null>;
  /** Whether a mutation is in progress */
  isLoading: boolean;
  /** Error object if mutation failed */
  error: Error | null;
}

// =============================================================================
// useCharter Hook
// =============================================================================

/**
 * Hook for fetching active charter for an orchestrator
 *
 * Fetches the currently active charter version for the specified orchestrator.
 *
 * @param orchestratorId - The orchestrator ID to fetch charter for
 * @returns Active charter data and loading state
 *
 * @example
 * ```tsx
 * function CharterDisplay({ orchestratorId }: { orchestratorId: string }) {
 *   const { charter, version, isLoading, error } = useCharter(orchestratorId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h1>{charter?.identity.name}</h1>
 *       <p>Version: {version?.version}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCharter(orchestratorId: string): UseCharterReturn {
  const [charter, setCharter] = useState<Charter | null>(null);
  const [version, setVersion] = useState<CharterVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCharter = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (!orchestratorId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, get the orchestrator to find its charter
      const orchestratorResponse = await fetch(`/api/orchestrators/${orchestratorId}`, { signal });

      if (!orchestratorResponse.ok) {
        const errorData = await orchestratorResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to fetch orchestrator: ${orchestratorResponse.status}`);
      }

      const orchestratorResult = await orchestratorResponse.json();
      const orchestratorCharter = orchestratorResult.data?.charter;

      if (!orchestratorCharter) {
        setCharter(null);
        setVersion(null);
        setIsLoading(false);
        return;
      }

      // Set charter directly from orchestrator if it's embedded
      if (typeof orchestratorCharter === 'object') {
        setCharter(orchestratorCharter as Charter);
        setVersion(null);
        setIsLoading(false);
        return;
      }

      // Otherwise, fetch active charter version
      // Note: We need charterId to fetch versions, which might not be directly available
      // This is a limitation of the current API structure
      setCharter(null);
      setVersion(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error occurred while fetching charter'));
    } finally {
      setIsLoading(false);
    }
  }, [orchestratorId]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchCharter(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchCharter]);

  const refetch = useCallback((): void => {
    void fetchCharter();
  }, [fetchCharter]);

  return {
    charter,
    version,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// useCharterVersions Hook
// =============================================================================

/**
 * Hook for fetching charter version history
 *
 * Fetches all versions for a specific charter with pagination support.
 *
 * @param charterId - The charter ID to fetch versions for
 * @param options - Optional pagination and filter options
 * @returns Charter versions list and loading state
 *
 * @example
 * ```tsx
 * function CharterHistory({ charterId }: { charterId: string }) {
 *   const { versions, isLoading, pagination } = useCharterVersions(charterId, {
 *     page: 1,
 *     limit: 20
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>Version History</h2>
 *       {versions.map(v => (
 *         <VersionCard key={v.id} version={v} />
 *       ))}
 *       <p>Page {pagination?.page} of {pagination?.totalPages}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCharterVersions(
  charterId: string,
  options?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }
): UseCharterVersionsReturn {
  const [versions, setVersions] = useState<CharterVersion[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVersions = useCallback(async (signal?: AbortSignal): Promise<void> => {
    if (!charterId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.isActive !== undefined) {
        params.set('isActive', String(options.isActive));
      }
      if (options?.page !== undefined) {
        params.set('page', String(options.page));
      }
      if (options?.limit !== undefined) {
        params.set('limit', String(options.limit));
      }

      const queryString = params.toString();
      const url = queryString
        ? `/api/charters/${charterId}/versions?${queryString}`
        : `/api/charters/${charterId}/versions`;

      const response = await fetch(url, { signal });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to fetch charter versions: ${response.status}`);
      }

      const result: { data: CharterVersion[]; pagination?: PaginationMetadata } = await response.json();

      // Transform date strings to Date objects
      const transformedVersions = (result.data || []).map((v) => ({
        ...v,
        createdAt: new Date(v.createdAt),
        updatedAt: new Date(v.updatedAt),
      }));

      setVersions(transformedVersions);
      setPagination(result.pagination || null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err : new Error('Unknown error occurred while fetching charter versions'));
      setVersions([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [charterId, options?.isActive, options?.page, options?.limit]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchVersions(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchVersions]);

  const refetch = useCallback((): void => {
    void fetchVersions();
  }, [fetchVersions]);

  return {
    versions,
    isLoading,
    error,
    refetch,
    pagination,
  };
}

// =============================================================================
// useCharterMutations Hook
// =============================================================================

/**
 * Hook for charter mutations (create, update, activate, rollback)
 *
 * Provides operations for managing charter versions and their lifecycle.
 *
 * @returns Mutation functions and loading state
 *
 * @example
 * ```tsx
 * function CharterManager({ charterId }: { charterId: string }) {
 *   const { createVersion, activateVersion, rollback, isLoading } = useCharterMutations();
 *
 *   const handleCreateVersion = async () => {
 *     const newVersion = await createVersion(charterId, {
 *       charterId,
 *       charterData: { identity: { name: 'New Charter' }, capabilities: { capabilities: ['code'] } },
 *       changeLog: 'Updated charter with new capabilities'
 *     });
 *     if (newVersion) {
 *       console.log('Created version:', newVersion.version);
 *     }
 *   };
 *
 *   const handleRollback = async () => {
 *     await rollback(charterId, { targetVersion: 1 });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleCreateVersion} disabled={isLoading}>Create Version</button>
 *       <button onClick={handleRollback} disabled={isLoading}>Rollback to v1</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCharterMutations(): UseCharterMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createVersion = useCallback(async (
    charterId: string,
    input: CreateCharterVersionInput,
    signal?: AbortSignal
  ): Promise<CharterVersion | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charters/${charterId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to create charter version: ${response.status}`);
      }

      const result: { data: CharterVersion } = await response.json();

      // Invalidate SWR cache for this charter
      mutate(`/api/charters/${charterId}/versions`);

      return result.data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      const error = err instanceof Error ? err : new Error('Unknown error occurred while creating charter version');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateVersion = useCallback(async (
    charterId: string,
    version: number,
    input: UpdateCharterVersionInput,
    signal?: AbortSignal
  ): Promise<CharterVersion | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charters/${charterId}/versions/${version}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to update charter version: ${response.status}`);
      }

      const result: { data: CharterVersion } = await response.json();

      // Invalidate SWR cache
      mutate(`/api/charters/${charterId}/versions`);
      mutate(`/api/charters/${charterId}/versions/${version}`);

      return result.data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      const error = err instanceof Error ? err : new Error('Unknown error occurred while updating charter version');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activateVersion = useCallback(async (
    charterId: string,
    version: number,
    signal?: AbortSignal
  ): Promise<CharterVersion | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charters/${charterId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to activate charter version: ${response.status}`);
      }

      const result: { data: CharterVersion } = await response.json();

      // Invalidate SWR cache
      mutate(`/api/charters/${charterId}/versions`);

      return result.data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      const error = err instanceof Error ? err : new Error('Unknown error occurred while activating charter version');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rollback = useCallback(async (
    charterId: string,
    input: RollbackCharterInput,
    signal?: AbortSignal
  ): Promise<CharterVersion | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/charters/${charterId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to rollback charter: ${response.status}`);
      }

      const result: { data: CharterVersion } = await response.json();

      // Invalidate SWR cache
      mutate(`/api/charters/${charterId}/versions`);

      return result.data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      const error = err instanceof Error ? err : new Error('Unknown error occurred while rolling back charter');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getDiff = useCallback(async (
    charterId: string,
    v1: number,
    v2: number,
    signal?: AbortSignal
  ): Promise<CharterDiff | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ v1: String(v1), v2: String(v2) });
      const response = await fetch(`/api/charters/${charterId}/diff?${params}`, { signal });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to get charter diff: ${response.status}`);
      }

      const result: { data: CharterDiff } = await response.json();
      return result.data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      const error = err instanceof Error ? err : new Error('Unknown error occurred while getting charter diff');
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createVersion,
    updateVersion,
    activateVersion,
    rollback,
    getDiff,
    isLoading,
    error,
  };
}
