'use client';

import { useCallback, useEffect, useState } from 'react';

import type { VPStatus } from '@/types/vp';

/**
 * VP presence data including real-time status
 */
export interface VPPresenceData {
  /** VP ID */
  vpId: string;
  /** Current status */
  status: VPStatus;
  /** Current task the VP is working on */
  currentTask: {
    id: string;
    title: string;
    progress: number;
    estimatedMinutes: number;
  } | null;
  /** Last activity timestamp */
  lastActive: Date;
  /** Whether VP is currently processing */
  isProcessing: boolean;
  /** Current workload (number of active tasks) */
  workload: number;
}

/**
 * Options for the useVPPresence hook
 */
export interface UseVPPresenceOptions {
  /** Refresh interval in milliseconds (default: 5000) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh (default: true) */
  enabled?: boolean;
  /** Callback when presence changes */
  onPresenceChange?: (presence: VPPresenceData) => void;
}

/**
 * Return type for the useVPPresence hook
 */
export interface UseVPPresenceReturn {
  /** Current presence data */
  presence: VPPresenceData | null;
  /** Whether presence data is loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to manually refetch presence */
  refetch: () => void;
  /** Function to update presence locally (optimistic update) */
  updatePresence: (updates: Partial<VPPresenceData>) => void;
}

/**
 * Hook for real-time VP presence data
 *
 * Fetches and monitors VP presence including current status, task, and activity.
 * Auto-refreshes on a configurable interval.
 *
 * @param vpId - The VP ID to monitor
 * @param options - Configuration options
 * @returns Presence data and loading state
 *
 * @example
 * ```tsx
 * function VPPresenceDisplay({ vpId }: { vpId: string }) {
 *   const { presence, isLoading, error } = useVPPresence(vpId, {
 *     refreshInterval: 3000,
 *     onPresenceChange: (presence) => {
 *       console.log('Presence updated:', presence.status);
 *     }
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <VPStatusBadge status={presence?.status} />
 *       {presence?.currentTask && (
 *         <p>Working on: {presence.currentTask.title}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVPPresence(
  vpId: string,
  options: UseVPPresenceOptions = {},
): UseVPPresenceReturn {
  const {
    refreshInterval = 5000,
    enabled = true,
    onPresenceChange,
  } = options;

  const [presence, setPresence] = useState<VPPresenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPresence = useCallback(async (): Promise<void> => {
    if (!vpId || !enabled) {
      return;
    }

    try {
      const response = await fetch(`/api/vps/${vpId}/presence`);

      if (!response.ok) {
        throw new Error('Failed to fetch VP presence');
      }

      const result: { data: VPPresenceData } = await response.json();
      const newPresence = {
        ...result.data,
        lastActive: new Date(result.data.lastActive),
      };

      setPresence(newPresence);
      setError(null);

      // Call onChange callback if provided
      if (onPresenceChange) {
        onPresenceChange(newPresence);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [vpId, enabled, onPresenceChange]);

  // Initial fetch
  useEffect(() => {
    fetchPresence();
  }, [fetchPresence]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchPresence();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchPresence, enabled, refreshInterval]);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    fetchPresence();
  }, [fetchPresence]);

  const updatePresence = useCallback((updates: Partial<VPPresenceData>): void => {
    setPresence((prev) => {
      if (!prev) {
return null;
}
      return { ...prev, ...updates };
    });
  }, []);

  return {
    presence,
    isLoading,
    error,
    refetch,
    updatePresence,
  };
}

/**
 * Hook for monitoring multiple VPs' presence
 *
 * @param vpIds - Array of VP IDs to monitor
 * @param options - Configuration options
 * @returns Map of VP IDs to presence data
 *
 * @example
 * ```tsx
 * function TeamPresence({ vpIds }: { vpIds: string[] }) {
 *   const { presenceMap, isLoading } = useMultipleVPPresence(vpIds);
 *
 *   return (
 *     <div>
 *       {vpIds.map(vpId => {
 *         const presence = presenceMap.get(vpId);
 *         return (
 *           <VPStatusBadge
 *             key={vpId}
 *             status={presence?.status}
 *             currentTask={presence?.currentTask?.title}
 *           />
 *         );
 *       })}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMultipleVPPresence(
  vpIds: string[],
  options: Omit<UseVPPresenceOptions, 'onPresenceChange'> = {},
): {
  presenceMap: Map<string, VPPresenceData>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [presenceMap, setPresenceMap] = useState<Map<string, VPPresenceData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { refreshInterval = 5000, enabled = true } = options;

  const fetchAllPresence = useCallback(async (): Promise<void> => {
    if (!vpIds.length || !enabled) {
      return;
    }

    try {
      // Fetch all VP presence data in parallel
      const promises = vpIds.map((vpId) =>
        fetch(`/api/vps/${vpId}/presence`)
          .then((res) => {
            if (!res.ok) {
throw new Error(`Failed to fetch presence for ${vpId}`);
}
            return res.json();
          })
          .then((result: { data: VPPresenceData }) => ({
            vpId,
            data: {
              ...result.data,
              lastActive: new Date(result.data.lastActive),
            },
          }))
          .catch(() => null),
      );

      const results = await Promise.all(promises);

      const newMap = new Map<string, VPPresenceData>();
      results.forEach((result) => {
        if (result) {
          newMap.set(result.vpId, result.data);
        }
      });

      setPresenceMap(newMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [vpIds, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchAllPresence();
  }, [fetchAllPresence]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchAllPresence();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchAllPresence, enabled, refreshInterval]);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    fetchAllPresence();
  }, [fetchAllPresence]);

  return {
    presenceMap,
    isLoading,
    error,
    refetch,
  };
}
