'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import type { VP, VPFilters, CreateVPInput, UpdateVPInput } from '@/types/vp';

/**
 * Hook for fetching and subscribing to a single VP
 */
export function useVP(id: string) {
  const [vp, setVP] = useState<VP | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVP = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/vps/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch VP');
      }
      const data = await response.json();
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

  const refetch = useCallback(() => {
    fetchVP();
  }, [fetchVP]);

  return {
    vp,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching a list of VPs with filtering
 */
export function useVPs(orgId: string, filters?: VPFilters) {
  const [vps, setVPs] = useState<VP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVPs = useCallback(async () => {
    if (!orgId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      params.set('orgId', orgId);
      if (filters?.discipline) params.set('discipline', filters.discipline);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);

      // TODO: Replace with actual API call
      const response = await fetch(`/api/vps?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch VPs');
      }
      const data = await response.json();
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
          vp.discipline?.toLowerCase().includes(searchLower)
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

/**
 * Hook for VP mutations (create, update, delete)
 */
export function useVPMutations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createVP = useCallback(async (input: CreateVPInput): Promise<VP | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to create VP');
      }

      const data = await response.json();
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
      // TODO: Replace with actual API call
      const response = await fetch(`/api/vps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to update VP');
      }

      const data = await response.json();
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
      // TODO: Replace with actual API call
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
      // TODO: Replace with actual API call
      const response = await fetch(`/api/vps/${id}/rotate-key`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to rotate API key');
      }

      const data = await response.json();
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
