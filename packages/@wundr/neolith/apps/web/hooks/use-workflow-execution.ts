'use client';

/**
 * @neolith/hooks/use-workflow-execution - Workflow Execution Monitoring
 *
 * Provides real-time monitoring and management of workflow executions with
 * polling or SSE for live updates.
 *
 * @packageDocumentation
 * @module @neolith/hooks/use-workflow-execution
 *
 * @example
 * ```typescript
 * const {
 *   execution,
 *   isLoading,
 *   progress,
 *   retryStep,
 *   cancelExecution,
 *   refreshExecution
 * } = useWorkflowExecution(workspaceId, workflowId, executionId);
 * ```
 */

import { useCallback, useEffect, useState, useRef } from 'react';

import type {
  WorkflowExecution,
  ExecutionStatus,
  ActionResult,
} from '@/types/workflow';

/**
 * Polling interval in milliseconds for checking execution status
 */
const POLL_INTERVAL = 2000;

/**
 * Maximum number of consecutive polling errors before stopping
 */
const MAX_POLL_ERRORS = 3;

/**
 * Execution progress information
 */
export interface ExecutionProgress {
  /** Total number of actions in the workflow */
  totalSteps: number;
  /** Number of completed actions */
  completedSteps: number;
  /** Number of failed actions */
  failedSteps: number;
  /** Number of skipped actions */
  skippedSteps: number;
  /** Current action being executed (if running) */
  currentStep: number | null;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Estimated time remaining in milliseconds (null if unknown) */
  estimatedTimeRemaining: number | null;
}

/**
 * Options for the useWorkflowExecution hook
 */
export interface UseWorkflowExecutionOptions {
  /** Enable real-time polling for running executions */
  enablePolling?: boolean;
  /** Custom polling interval in milliseconds */
  pollingInterval?: number;
  /** Enable Server-Sent Events (SSE) for real-time updates */
  enableSSE?: boolean;
  /** Auto-refresh when execution completes */
  autoRefreshOnComplete?: boolean;
}

/**
 * Return type for the useWorkflowExecution hook
 */
export interface UseWorkflowExecutionReturn {
  /** The workflow execution or null if not found */
  execution: WorkflowExecution | null;
  /** Whether the execution is loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Execution progress information */
  progress: ExecutionProgress | null;
  /** Whether the execution is currently running */
  isRunning: boolean;
  /** Whether the execution can be cancelled */
  canCancel: boolean;
  /** Whether the execution can be retried */
  canRetry: boolean;
  /** Cancel the running execution */
  cancelExecution: () => Promise<boolean>;
  /** Retry a failed step */
  retryStep: (actionId: string) => Promise<boolean>;
  /** Retry the entire execution */
  retryExecution: () => Promise<WorkflowExecution | null>;
  /** Manually refresh the execution data */
  refreshExecution: () => void;
  /** Get action result by action ID */
  getActionResult: (actionId: string) => ActionResult | null;
}

/**
 * Hook for monitoring and managing a single workflow execution.
 *
 * Provides real-time updates on execution progress, the ability to cancel
 * running executions, and retry failed steps.
 *
 * @param workspaceId - The workspace ID containing the workflow
 * @param workflowId - The workflow ID being executed
 * @param executionId - The execution ID to monitor
 * @param options - Optional configuration for polling and SSE
 * @returns Execution data and management methods
 *
 * @example
 * ```typescript
 * const {
 *   execution,
 *   isLoading,
 *   progress,
 *   isRunning,
 *   canCancel,
 *   cancelExecution,
 *   retryStep,
 *   retryExecution,
 *   refreshExecution
 * } = useWorkflowExecution(workspaceId, workflowId, executionId, {
 *   enablePolling: true,
 *   pollingInterval: 3000
 * });
 *
 * // Cancel running execution
 * if (canCancel) {
 *   await cancelExecution();
 * }
 *
 * // Retry a failed step
 * await retryStep(failedActionId);
 * ```
 */
export function useWorkflowExecution(
  workspaceId: string,
  workflowId: string,
  executionId: string,
  options: UseWorkflowExecutionOptions = {}
): UseWorkflowExecutionReturn {
  const {
    enablePolling = true,
    pollingInterval = POLL_INTERVAL,
    enableSSE = false,
    autoRefreshOnComplete = true,
  } = options;

  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pollErrorCount, setPollErrorCount] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate execution progress
  const progress: ExecutionProgress | null = execution
    ? calculateProgress(execution)
    : null;

  const isRunning =
    execution?.status === 'running' || execution?.status === 'pending';
  const canCancel = isRunning;
  const canRetry = execution?.status === 'failed';

  /**
   * Fetch execution data from API
   */
  const fetchExecution = useCallback(
    async (silent = false) => {
      if (!workspaceId || !workflowId || !executionId) {
        return;
      }

      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      if (!silent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions/${executionId}`,
          {
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Execution not found');
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch execution');
        }

        const data = await response.json();
        if (!data.execution) {
          throw new Error('Invalid response format');
        }

        setExecution(data.execution);
        setPollErrorCount(0);

        // Stop polling if execution is complete
        if (
          autoRefreshOnComplete &&
          (data.execution.status === 'completed' ||
            data.execution.status === 'failed' ||
            data.execution.status === 'cancelled')
        ) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setPollErrorCount(prev => prev + 1);

        // Stop polling after too many errors
        if (pollErrorCount >= MAX_POLL_ERRORS && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [
      workspaceId,
      workflowId,
      executionId,
      autoRefreshOnComplete,
      pollErrorCount,
    ]
  );

  /**
   * Setup Server-Sent Events for real-time updates
   */
  const setupSSE = useCallback(() => {
    if (!workspaceId || !workflowId || !executionId || !enableSSE) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions/${executionId}/stream`
    );

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.execution) {
          setExecution(data.execution);
          setError(null);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Fallback to polling on SSE error
      if (enablePolling && !pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(
          () => fetchExecution(true),
          pollingInterval
        );
      }
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [
    workspaceId,
    workflowId,
    executionId,
    enableSSE,
    enablePolling,
    pollingInterval,
    fetchExecution,
  ]);

  /**
   * Setup polling for real-time updates
   */
  const setupPolling = useCallback(() => {
    if (!enablePolling || !isRunning || enableSSE) {
      return;
    }

    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(
      () => fetchExecution(true),
      pollingInterval
    );

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enablePolling, isRunning, enableSSE, pollingInterval, fetchExecution]);

  // Initial fetch
  useEffect(() => {
    fetchExecution();
  }, [fetchExecution]);

  // Setup real-time updates
  useEffect(() => {
    if (enableSSE) {
      return setupSSE();
    } else if (enablePolling && isRunning) {
      return setupPolling();
    }
  }, [enableSSE, enablePolling, isRunning, setupSSE, setupPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Cancel the running execution
   */
  const cancelExecution = useCallback(async (): Promise<boolean> => {
    if (!workspaceId || !workflowId || !executionId) {
      return false;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions/${executionId}/cancel`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to cancel execution');
      }

      // Refresh execution data
      await fetchExecution();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workspaceId, workflowId, executionId, fetchExecution]);

  /**
   * Retry a failed step
   */
  const retryStep = useCallback(
    async (actionId: string): Promise<boolean> => {
      if (!workspaceId || !workflowId || !executionId) {
        return false;
      }

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions/${executionId}/retry-step`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionId }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to retry step');
        }

        // Refresh execution data
        await fetchExecution();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      }
    },
    [workspaceId, workflowId, executionId, fetchExecution]
  );

  /**
   * Retry the entire execution
   */
  const retryExecution =
    useCallback(async (): Promise<WorkflowExecution | null> => {
      if (!workspaceId || !workflowId || !executionId) {
        return null;
      }

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions/${executionId}/retry`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to retry execution');
        }

        const data = await response.json();
        if (!data.execution) {
          throw new Error('Invalid response format');
        }

        setExecution(data.execution);
        return data.execution;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    }, [workspaceId, workflowId, executionId]);

  /**
   * Get action result by action ID
   */
  const getActionResult = useCallback(
    (actionId: string): ActionResult | null => {
      if (!execution) {
        return null;
      }
      return (
        execution.actionResults.find(result => result.actionId === actionId) ||
        null
      );
    },
    [execution]
  );

  return {
    execution,
    isLoading,
    error,
    progress,
    isRunning,
    canCancel,
    canRetry,
    cancelExecution,
    retryStep,
    retryExecution,
    refreshExecution: fetchExecution,
    getActionResult,
  };
}

/**
 * Calculate execution progress from execution data
 * @internal
 */
function calculateProgress(execution: WorkflowExecution): ExecutionProgress {
  const totalSteps = execution.actionResults.length;
  const completedSteps = execution.actionResults.filter(
    r => r.status === 'completed'
  ).length;
  const failedSteps = execution.actionResults.filter(
    r => r.status === 'failed'
  ).length;
  const skippedSteps = execution.actionResults.filter(
    r => r.status === 'skipped'
  ).length;

  const currentStepIndex = execution.actionResults.findIndex(
    r => r.status === 'running'
  );
  const currentStep = currentStepIndex !== -1 ? currentStepIndex + 1 : null;

  const percentage =
    totalSteps > 0
      ? Math.round(
          ((completedSteps + failedSteps + skippedSteps) / totalSteps) * 100
        )
      : 0;

  // Calculate estimated time remaining based on average duration per step
  let estimatedTimeRemaining: number | null = null;
  if (execution.status === 'running' && currentStep !== null) {
    const completedResults = execution.actionResults.filter(
      r => r.status === 'completed' && r.duration
    );
    if (completedResults.length > 0) {
      const averageDuration =
        completedResults.reduce((sum, r) => sum + (r.duration || 0), 0) /
        completedResults.length;
      const remainingSteps =
        totalSteps - completedSteps - failedSteps - skippedSteps;
      estimatedTimeRemaining = averageDuration * remainingSteps;
    }
  }

  return {
    totalSteps,
    completedSteps,
    failedSteps,
    skippedSteps,
    currentStep,
    percentage,
    estimatedTimeRemaining,
  };
}
