'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';

import type { VP, VPFilters, CreateVPInput, UpdateVPInput } from '@/types/vp';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for the useVP hook
 */
export interface UseVPReturn {
  /** The VP data, or null if not loaded */
  vp: VP | null;
  /** Whether the VP is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the VP data */
  refetch: () => void;
}

/**
 * Return type for the useVPs hook
 */
export interface UseVPsReturn {
  /** Filtered list of VPs */
  vps: VP[];
  /** Complete list of VPs (unfiltered) */
  allVPs: VP[];
  /** Whether VPs are currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the VPs */
  refetch: () => void;
  /** Total count of VPs */
  totalCount: number;
  /** Count of VPs after filtering */
  filteredCount: number;
}

/**
 * Return type for the useVPMutations hook
 */
export interface UseVPMutationsReturn {
  /** Create a new VP */
  createVP: (input: CreateVPInput) => Promise<VP | null>;
  /** Update an existing VP */
  updateVP: (id: string, input: UpdateVPInput) => Promise<VP | null>;
  /** Delete a VP */
  deleteVP: (id: string) => Promise<boolean>;
  /** Toggle VP active/inactive status */
  toggleVPStatus: (id: string, currentStatus: VP['status']) => Promise<VP | null>;
  /** Rotate a VP's API key */
  rotateAPIKey: (id: string) => Promise<{ apiKey: string } | null>;
  /** Whether a mutation is in progress */
  isLoading: boolean;
  /** Error object if mutation failed */
  error: Error | null;
}

// =============================================================================
// useVP Hook
// =============================================================================

/**
 * Hook for fetching and managing a single VP (Virtual Person)
 *
 * Fetches VP data by ID and provides a refetch capability.
 *
 * @param id - The VP ID to fetch
 * @returns VP data and loading state
 *
 * @example
 * ```tsx
 * function VPProfile({ vpId }: { vpId: string }) {
 *   const { vp, isLoading, error, refetch } = useVP(vpId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h1>{vp?.title}</h1>
 *       <p>{vp?.description}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVP(id: string): UseVPReturn {
  const [vp, setVP] = useState<VP | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVP = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vps/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch VP');
      }
      const data: VP = await response.json();
      setVP(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVP();
  }, [fetchVP]);

  const refetch = useCallback((): void => {
    fetchVP();
  }, [fetchVP]);

  return {
    vp,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// useVPs Hook
// =============================================================================

/**
 * Hook for fetching a list of VPs with filtering
 *
 * Fetches VPs for an organization with optional filtering by discipline,
 * status, and search query.
 *
 * @param orgId - The organization ID to fetch VPs for
 * @param filters - Optional filters to apply
 * @returns VPs list, loading state, and counts
 *
 * @example
 * ```tsx
 * function VPList() {
 *   const { vps, isLoading, totalCount, filteredCount } = useVPs(
 *     'org-123',
 *     { status: 'ACTIVE', discipline: 'engineering' }
 *   );
 *
 *   return (
 *     <div>
 *       <p>Showing {filteredCount} of {totalCount} VPs</p>
 *       {vps.map(vp => <VPCard key={vp.id} vp={vp} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVPs(orgId: string, filters?: VPFilters): UseVPsReturn {
  const [vps, setVPs] = useState<VP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVPs = useCallback(async (): Promise<void> => {
    if (!orgId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      params.set('orgId', orgId);
      if (filters?.discipline) {
        params.set('discipline', filters.discipline);
      }
      if (filters?.status) {
        params.set('status', filters.status);
      }
      if (filters?.search) {
        params.set('search', filters.search);
      }

      const response = await fetch(`/api/vps?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch VPs');
      }
      const data: { vps?: VP[] } = await response.json();
      setVPs(data.vps || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [orgId, filters?.discipline, filters?.status, filters?.search]);

  useEffect(() => {
    fetchVPs();
  }, [fetchVPs]);

  const refetch = useCallback(() => {
    fetchVPs();
  }, [fetchVPs]);

  // Filter VPs locally for immediate feedback
  const filteredVPs = useMemo(() => {
    let result = [...vps];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (vp) =>
          vp.title.toLowerCase().includes(searchLower) ||
          vp.description?.toLowerCase().includes(searchLower) ||
          vp.discipline?.toLowerCase().includes(searchLower),
      );
    }

    if (filters?.discipline) {
      result = result.filter((vp) => vp.discipline === filters.discipline);
    }

    if (filters?.status) {
      result = result.filter((vp) => vp.status === filters.status);
    }

    return result;
  }, [vps, filters]);

  return {
    vps: filteredVPs,
    allVPs: vps,
    isLoading,
    error,
    refetch,
    totalCount: vps.length,
    filteredCount: filteredVPs.length,
  };
}

// =============================================================================
// useVPMutations Hook
// =============================================================================

/**
 * Hook for VP mutations (create, update, delete)
 *
 * Provides CRUD operations and additional actions for managing VPs.
 *
 * @returns Mutation functions and loading state
 *
 * @example
 * ```tsx
 * function VPManager() {
 *   const { createVP, updateVP, deleteVP, isLoading } = useVPMutations();
 *
 *   const handleCreate = async () => {
 *     const newVP = await createVP({
 *       title: 'New Assistant',
 *       discipline: 'support',
 *       organizationId: 'org-123'
 *     });
 *     if (newVP) {
 *       console.log('Created VP:', newVP.id);
 *     }
 *   };
 *
 *   return <button onClick={handleCreate} disabled={isLoading}>Create VP</button>;
 * }
 * ```
 */
export function useVPMutations(): UseVPMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createVP = useCallback(async (input: CreateVPInput): Promise<VP | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to create VP');
      }

      const data: VP = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateVP = useCallback(async (id: string, input: UpdateVPInput): Promise<VP | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to update VP');
      }

      const data: VP = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteVP = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vps/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete VP');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleVPStatus = useCallback(async (id: string, currentStatus: VP['status']): Promise<VP | null> => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return updateVP(id, { status: newStatus });
  }, [updateVP]);

  const rotateAPIKey = useCallback(async (id: string): Promise<{ apiKey: string } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vps/${id}/rotate-key`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to rotate API key');
      }

      const data: { apiKey: string } = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createVP,
    updateVP,
    deleteVP,
    toggleVPStatus,
    rotateAPIKey,
    isLoading,
    error,
  };
}
