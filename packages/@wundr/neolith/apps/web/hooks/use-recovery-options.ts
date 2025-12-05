/**
 * Recovery Options Hook
 *
 * Hook for fetching and managing account recovery options.
 *
 * @module hooks/use-recovery-options
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

import type { RecoveryOptions } from '@/app/api/user/recovery-options/route';

export interface UseRecoveryOptionsReturn {
  options: RecoveryOptions | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRecoveryOptions(): UseRecoveryOptionsReturn {
  const [options, setOptions] = useState<RecoveryOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOptions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/recovery-options');

      if (!response.ok) {
        throw new Error('Failed to fetch recovery options');
      }

      const data = await response.json();
      setOptions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setOptions(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const refresh = useCallback(async () => {
    await fetchOptions();
  }, [fetchOptions]);

  return {
    options,
    isLoading,
    error,
    refresh,
  };
}
