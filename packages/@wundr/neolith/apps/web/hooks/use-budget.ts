'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';
import useSWRMutation from 'swr/mutation';

// =============================================================================
// Types
// =============================================================================

/**
 * Token budget limits configuration
 */
export interface BudgetLimits {
  /** Daily token limit */
  dailyLimit: number;
  /** Monthly token limit */
  monthlyLimit: number;
  /** Per-request token limit */
  perRequestLimit: number;
}

/**
 * Current budget status and usage
 */
export interface BudgetStatus {
  /** Unique identifier for the budget */
  id: string;
  /** Associated orchestrator ID */
  orchestratorId: string;
  /** Configured budget limits */
  limits: BudgetLimits;
  /** Current token usage */
  usage: {
    /** Tokens used today */
    daily: number;
    /** Tokens used this month */
    monthly: number;
    /** Tokens used in current request/session */
    current: number;
  };
  /** Percentage of daily limit used (0-100) */
  dailyUsagePercent: number;
  /** Percentage of monthly limit used (0-100) */
  monthlyUsagePercent: number;
  /** Whether daily limit has been exceeded */
  isDailyLimitExceeded: boolean;
  /** Whether monthly limit has been exceeded */
  isMonthlyLimitExceeded: boolean;
  /** Whether auto-pause is enabled */
  autoPauseEnabled: boolean;
  /** Whether orchestrator is currently paused due to budget */
  isPaused: boolean;
  /** Estimated tokens remaining for the day */
  dailyRemaining: number;
  /** Estimated tokens remaining for the month */
  monthlyRemaining: number;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Usage history data point for charts
 */
export interface UsageHistoryPoint {
  /** Timestamp of the data point */
  timestamp: Date;
  /** Number of tokens used in this period */
  tokensUsed: number;
  /** Cumulative tokens used up to this point */
  cumulativeTokens: number;
  /** Average tokens per request in this period */
  averagePerRequest: number;
  /** Number of requests in this period */
  requestCount: number;
}

/**
 * Parameters for fetching usage history
 */
export interface HistoryParams {
  /** Start date for the history range */
  startDate?: Date;
  /** End date for the history range */
  endDate?: Date;
  /** Granularity of data points (hourly, daily, weekly) */
  granularity?: 'hourly' | 'daily' | 'weekly';
  /** Maximum number of data points to return */
  limit?: number;
}

/**
 * Budget alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Budget alert
 */
export interface BudgetAlert {
  /** Unique alert identifier */
  id: string;
  /** Orchestrator ID this alert belongs to */
  orchestratorId: string;
  /** Alert severity level */
  severity: AlertSeverity;
  /** Alert title */
  title: string;
  /** Alert description/message */
  message: string;
  /** Alert threshold percentage that triggered this alert */
  threshold: number;
  /** Whether this alert has been acknowledged */
  acknowledged: boolean;
  /** When the alert was created */
  createdAt: Date;
  /** When the alert was acknowledged (if applicable) */
  acknowledgedAt?: Date;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Enable alerts */
  enabled: boolean;
  /** Thresholds for different severity levels (percentage of limit) */
  thresholds: {
    /** Info alert threshold (e.g., 50 = 50% of limit) */
    info: number;
    /** Warning alert threshold (e.g., 75 = 75% of limit) */
    warning: number;
    /** Critical alert threshold (e.g., 90 = 90% of limit) */
    critical: number;
  };
  /** Whether to send email notifications for alerts */
  emailNotifications: boolean;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// Fetcher Functions
// =============================================================================

/**
 * Generic fetcher for GET requests
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        `Request failed: ${response.status} ${response.statusText}`
    );
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

/**
 * Build query string from history parameters
 */
function buildHistoryQueryString(params: HistoryParams): string {
  const searchParams = new URLSearchParams();

  if (params.startDate) {
    searchParams.set('startDate', params.startDate.toISOString());
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate.toISOString());
  }
  if (params.granularity) {
    searchParams.set('granularity', params.granularity);
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  return searchParams.toString();
}

// =============================================================================
// SWR Configuration
// =============================================================================

/**
 * Default SWR configuration for budget data
 */
const DEFAULT_SWR_CONFIG: SWRConfiguration = {
  refreshInterval: 30000, // Poll every 30 seconds for real-time updates
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
};

/**
 * SWR configuration for usage history (less frequent updates)
 */
const HISTORY_SWR_CONFIG: SWRConfiguration = {
  refreshInterval: 60000, // Poll every minute
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 10000,
};

// =============================================================================
// useBudget Hook
// =============================================================================

/**
 * Return type for the useBudget hook
 */
export interface UseBudgetReturn {
  /** Current budget status, or null if not loaded */
  budget: BudgetStatus | null;
  /** Whether the budget data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to manually refetch the budget data */
  refetch: () => void;
  /** Whether the data is being revalidated in the background */
  isValidating: boolean;
}

/**
 * Hook for fetching current budget status with real-time updates
 *
 * Automatically polls every 30 seconds to keep budget data current.
 *
 * @param orchestratorId - The orchestrator ID to fetch budget for
 * @returns Budget status and loading state
 *
 * @example
 * ```tsx
 * function BudgetDisplay({ orchestratorId }: { orchestratorId: string }) {
 *   const { budget, isLoading, error, refetch } = useBudget(orchestratorId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h2>Token Budget</h2>
 *       <p>Daily: {budget?.usage.daily} / {budget?.limits.dailyLimit}</p>
 *       <p>Monthly: {budget?.usage.monthly} / {budget?.limits.monthlyLimit}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBudget(orchestratorId: string): UseBudgetReturn {
  const shouldFetch = Boolean(orchestratorId);
  const url = shouldFetch
    ? `/api/orchestrators/${orchestratorId}/budget`
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<BudgetStatus>(
    url,
    fetcher,
    DEFAULT_SWR_CONFIG
  );

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    budget: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
    isValidating,
  };
}

// =============================================================================
// useUsageHistory Hook
// =============================================================================

/**
 * Return type for the useUsageHistory hook
 */
export interface UseUsageHistoryReturn {
  /** Array of usage history data points */
  history: UsageHistoryPoint[];
  /** Whether the history data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to manually refetch the history data */
  refetch: () => void;
  /** Whether the data is being revalidated in the background */
  isValidating: boolean;
}

/**
 * Hook for fetching usage history for charts
 *
 * Polls every minute for updated historical data.
 *
 * @param orchestratorId - The orchestrator ID to fetch history for
 * @param params - History query parameters
 * @returns Usage history and loading state
 *
 * @example
 * ```tsx
 * function UsageChart({ orchestratorId }: { orchestratorId: string }) {
 *   const { history, isLoading, error } = useUsageHistory(orchestratorId, {
 *     granularity: 'daily',
 *     limit: 30
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return <LineChart data={history} />;
 * }
 * ```
 */
export function useUsageHistory(
  orchestratorId: string,
  params: HistoryParams = {}
): UseUsageHistoryReturn {
  const shouldFetch = Boolean(orchestratorId);

  const queryString = useMemo(() => buildHistoryQueryString(params), [params]);
  const url = shouldFetch
    ? `/api/orchestrators/${orchestratorId}/budget/history?${queryString}`
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    UsageHistoryPoint[]
  >(url, fetcher, HISTORY_SWR_CONFIG);

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    history: data ?? [],
    isLoading,
    error: error ?? null,
    refetch,
    isValidating,
  };
}

// =============================================================================
// useBudgetAlerts Hook
// =============================================================================

/**
 * Return type for the useBudgetAlerts hook
 */
export interface UseBudgetAlertsReturn {
  /** Array of budget alerts */
  alerts: BudgetAlert[];
  /** Acknowledge a specific alert */
  acknowledge: (alertId: string) => Promise<void>;
  /** Update alert configuration */
  configureAlerts: (config: AlertConfig) => Promise<void>;
  /** Whether the alerts data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Whether a mutation is in progress */
  isMutating: boolean;
}

/**
 * Hook for fetching and managing budget alerts
 *
 * Provides real-time updates of budget alerts and functions to acknowledge
 * alerts and configure alert settings.
 *
 * @param orchestratorId - The orchestrator ID to fetch alerts for
 * @returns Alerts and mutation functions
 *
 * @example
 * ```tsx
 * function AlertsPanel({ orchestratorId }: { orchestratorId: string }) {
 *   const { alerts, acknowledge, configureAlerts, isLoading } = useBudgetAlerts(orchestratorId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {alerts.map(alert => (
 *         <Alert
 *           key={alert.id}
 *           severity={alert.severity}
 *           message={alert.message}
 *           onAcknowledge={() => acknowledge(alert.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBudgetAlerts(orchestratorId: string): UseBudgetAlertsReturn {
  const shouldFetch = Boolean(orchestratorId);
  const url = shouldFetch
    ? `/api/orchestrators/${orchestratorId}/budget/alerts`
    : null;

  const { data, error, isLoading, mutate } = useSWR<BudgetAlert[]>(
    url,
    fetcher,
    DEFAULT_SWR_CONFIG
  );

  // Mutation for acknowledging an alert
  const { trigger: triggerAcknowledge, isMutating: isAcknowledging } =
    useSWRMutation(
      url,
      async (url: string, { arg }: { arg: { alertId: string } }) => {
        const response = await fetch(`${url}/${arg.alertId}/acknowledge`, {
          method: 'POST',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 'Failed to acknowledge alert'
          );
        }

        return response.json();
      }
    );

  // Mutation for configuring alerts
  const { trigger: triggerConfigure, isMutating: isConfiguring } =
    useSWRMutation(
      shouldFetch
        ? `/api/orchestrators/${orchestratorId}/budget/alerts/config`
        : null,
      async (url: string, { arg }: { arg: AlertConfig }) => {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(arg),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 'Failed to update alert configuration'
          );
        }

        return response.json();
      }
    );

  const acknowledge = useCallback(
    async (alertId: string): Promise<void> => {
      await triggerAcknowledge({ alertId });
      // Optimistically update the local data
      void mutate(
        currentData =>
          currentData?.map(alert =>
            alert.id === alertId
              ? { ...alert, acknowledged: true, acknowledgedAt: new Date() }
              : alert
          ),
        { revalidate: true }
      );
    },
    [triggerAcknowledge, mutate]
  );

  const configureAlerts = useCallback(
    async (config: AlertConfig): Promise<void> => {
      await triggerConfigure(config);
      // Revalidate alerts after configuration change
      void mutate();
    },
    [triggerConfigure, mutate]
  );

  return {
    alerts: data ?? [],
    acknowledge,
    configureAlerts,
    isLoading,
    error: error ?? null,
    isMutating: isAcknowledging || isConfiguring,
  };
}

// =============================================================================
// useBudgetMutations Hook
// =============================================================================

/**
 * Return type for the useBudgetMutations hook
 */
export interface UseBudgetMutationsReturn {
  /** Update budget limits */
  updateBudget: (limits: BudgetLimits) => Promise<void>;
  /** Enable or disable auto-pause */
  setAutoPause: (enabled: boolean) => Promise<void>;
  /** Whether a mutation is in progress */
  isPending: boolean;
  /** Error object if mutation failed */
  error: Error | null;
}

/**
 * Hook for budget mutations (update limits, configure settings)
 *
 * Provides functions to update budget limits and configure auto-pause settings
 * with optimistic updates.
 *
 * @param orchestratorId - The orchestrator ID to manage budget for
 * @returns Mutation functions and loading state
 *
 * @example
 * ```tsx
 * function BudgetSettings({ orchestratorId }: { orchestratorId: string }) {
 *   const { updateBudget, setAutoPause, isPending } = useBudgetMutations(orchestratorId);
 *
 *   const handleSave = async () => {
 *     await updateBudget({
 *       dailyLimit: 100000,
 *       monthlyLimit: 3000000,
 *       perRequestLimit: 10000
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSave}>
 *       <input name="dailyLimit" type="number" />
 *       <button type="submit" disabled={isPending}>Save</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useBudgetMutations(
  orchestratorId: string
): UseBudgetMutationsReturn {
  const budgetUrl = `/api/orchestrators/${orchestratorId}/budget`;

  // Mutation for updating budget limits
  const {
    trigger: triggerUpdateBudget,
    isMutating: isUpdatingBudget,
    error: updateBudgetError,
  } = useSWRMutation(
    budgetUrl,
    async (url: string, { arg }: { arg: BudgetLimits }) => {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limits: arg }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 'Failed to update budget limits'
        );
      }

      const result: ApiResponse<BudgetStatus> = await response.json();
      return result.data;
    }
  );

  // Mutation for setting auto-pause
  const {
    trigger: triggerSetAutoPause,
    isMutating: isSettingAutoPause,
    error: setAutoPauseError,
  } = useSWRMutation(
    budgetUrl,
    async (url: string, { arg }: { arg: { enabled: boolean } }) => {
      const response = await fetch(`${url}/auto-pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: arg.enabled }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 'Failed to update auto-pause setting'
        );
      }

      const result: ApiResponse<BudgetStatus> = await response.json();
      return result.data;
    }
  );

  const updateBudget = useCallback(
    async (limits: BudgetLimits): Promise<void> => {
      await triggerUpdateBudget(limits);
    },
    [triggerUpdateBudget]
  );

  const setAutoPause = useCallback(
    async (enabled: boolean): Promise<void> => {
      await triggerSetAutoPause({ enabled });
    },
    [triggerSetAutoPause]
  );

  return {
    updateBudget,
    setAutoPause,
    isPending: isUpdatingBudget || isSettingAutoPause,
    error: updateBudgetError || setAutoPauseError || null,
  };
}
