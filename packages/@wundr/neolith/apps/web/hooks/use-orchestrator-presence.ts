'use client';

import { useCallback, useEffect, useState } from 'react';

import type { OrchestratorStatus } from '@/types/orchestrator';

/**
 * Orchestrator presence data including real-time status
 */
export interface OrchestratorPresenceData {
  /** OrchestratorID */
  orchestratorId: string;
  /** Current status */
  status: OrchestratorStatus;
  /** Current task the Orchestrator is working on */
  currentTask: {
    id: string;
    title: string;
    progress: number;
    estimatedMinutes: number;
  } | null;
  /** Last activity timestamp */
  lastActive: Date;
  /** Whether Orchestrator is currently processing */
  isProcessing: boolean;
  /** Current workload (number of active tasks) */
  workload: number;
}

/**
 * Options for the useOrchestratorPresence hook
 */
export interface UseOrchestratorPresenceOptions {
  /** Refresh interval in milliseconds (default: 5000) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh (default: true) */
  enabled?: boolean;
  /** Callback when presence changes */
  onPresenceChange?: (presence: OrchestratorPresenceData) => void;
}

/**
 * Return type for the useOrchestratorPresence hook
 */
export interface UseOrchestratorPresenceReturn {
  /** Current presence data */
  presence: OrchestratorPresenceData | null;
  /** Whether presence data is loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to manually refetch presence */
  refetch: () => void;
  /** Function to update presence locally (optimistic update) */
  updatePresence: (updates: Partial<OrchestratorPresenceData>) => void;
}

/**
 * Hook for real-time Orchestrator presence data
 *
 * Fetches and monitors Orchestrator presence including current status, task, and activity.
 * Auto-refreshes on a configurable interval.
 *
 * @param orchestratorId - The OrchestratorID to monitor
 * @param options - Configuration options
 * @returns Presence data and loading state
 *
 * @example
 * ```tsx
 * function OrchestratorPresenceDisplay({ orchestratorId }: { orchestratorId: string }) {
 *   const { presence, isLoading, error } = useOrchestratorPresence(orchestratorId, {
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
 *       <OrchestratorStatusBadge status={presence?.status} />
 *       {presence?.currentTask && (
 *         <p>Working on: {presence.currentTask.title}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrchestratorPresence(
  orchestratorId: string,
  options: UseOrchestratorPresenceOptions = {}
): UseOrchestratorPresenceReturn {
  const { refreshInterval = 5000, enabled = true, onPresenceChange } = options;

  const [presence, setPresence] = useState<OrchestratorPresenceData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPresence = useCallback(async (): Promise<void> => {
    if (!orchestratorId || !enabled) {
      return;
    }

    try {
      const response = await fetch(
        `/api/orchestrators/${orchestratorId}/presence`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Orchestrator presence');
      }

      const result: { data: OrchestratorPresenceData } = await response.json();
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
  }, [orchestratorId, enabled, onPresenceChange]);

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

  const updatePresence = useCallback(
    (updates: Partial<OrchestratorPresenceData>): void => {
      setPresence(prev => {
        if (!prev) {
          return null;
        }
        return { ...prev, ...updates };
      });
    },
    []
  );

  return {
    presence,
    isLoading,
    error,
    refetch,
    updatePresence,
  };
}

/**
 * Hook for monitoring multiple Orchestrators' presence
 *
 * @param orchestratorIds - Array of OrchestratorIDs to monitor
 * @param options - Configuration options
 * @returns Map of OrchestratorIDs to presence data
 *
 * @example
 * ```tsx
 * function TeamPresence({ orchestratorIds }: { orchestratorIds: string[] }) {
 *   const { presenceMap, isLoading } = useMultipleOrchestratorPresence(orchestratorIds);
 *
 *   return (
 *     <div>
 *       {orchestratorIds.map(orchestratorId => {
 *         const presence = presenceMap.get(orchestratorId);
 *         return (
 *           <OrchestratorStatusBadge
 *             key={orchestratorId}
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
export function useMultipleOrchestratorPresence(
  orchestratorIds: string[],
  options: Omit<UseOrchestratorPresenceOptions, 'onPresenceChange'> = {}
): {
  presenceMap: Map<string, OrchestratorPresenceData>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [presenceMap, setPresenceMap] = useState<
    Map<string, OrchestratorPresenceData>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { refreshInterval = 5000, enabled = true } = options;

  const fetchAllPresence = useCallback(async (): Promise<void> => {
    if (!orchestratorIds.length || !enabled) {
      return;
    }

    try {
      // Fetch all Orchestrator presence data in parallel
      const promises = orchestratorIds.map(orchestratorId =>
        fetch(`/api/orchestrators/${orchestratorId}/presence`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`Failed to fetch presence for ${orchestratorId}`);
            }
            return res.json();
          })
          .then((result: { data: OrchestratorPresenceData }) => ({
            orchestratorId,
            data: {
              ...result.data,
              lastActive: new Date(result.data.lastActive),
            },
          }))
          .catch(() => null)
      );

      const results = await Promise.all(promises);

      const newMap = new Map<string, OrchestratorPresenceData>();
      results.forEach(result => {
        if (result) {
          newMap.set(result.orchestratorId, result.data);
        }
      });

      setPresenceMap(newMap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [orchestratorIds, enabled]);

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
