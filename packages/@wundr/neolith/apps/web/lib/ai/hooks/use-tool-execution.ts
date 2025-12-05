/**
 * Use Tool Execution Hook
 *
 * React hook for executing AI tools with state management.
 */

'use client';

import { useState, useCallback } from 'react';
import type { ToolResult } from '../tools';

export interface UseToolExecutionOptions {
  workspaceId: string;
  onSuccess?: (result: ToolResult) => void;
  onError?: (error: Error) => void;
}

export interface ToolExecution {
  toolName: string;
  input: unknown;
  result?: ToolResult;
  status: 'idle' | 'executing' | 'success' | 'error' | 'approval_required';
  error?: string;
  executionTime?: number;
}

export interface UseToolExecutionReturn {
  executeTool: (toolName: string, input?: unknown) => Promise<ToolResult>;
  executeParallel: (
    tools: Array<{ name: string; input: unknown }>
  ) => Promise<ToolResult[]>;
  approveTool: (approvalId: string) => Promise<ToolResult>;
  rejectTool: (approvalId: string) => Promise<void>;
  clearHistory: () => void;
  getExecution: (executionId: string) => ToolExecution | undefined;
  executions: ToolExecution[];
}

export function useToolExecution({
  workspaceId,
  onSuccess,
  onError,
}: UseToolExecutionOptions): UseToolExecutionReturn {
  const [executions, setExecutions] = useState<Map<string, ToolExecution>>(
    new Map()
  );

  /**
   * Execute a tool
   */
  const executeTool = useCallback(
    async (toolName: string, input: unknown = {}): Promise<ToolResult> => {
      const executionId = `${toolName}_${Date.now()}`;
      const startTime = Date.now();

      // Set initial state
      setExecutions(prev =>
        new Map(prev).set(executionId, {
          toolName,
          input,
          status: 'executing',
        })
      );

      try {
        const response = await fetch('/api/ai/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: toolName,
            input,
            workspaceId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Tool execution failed: ${response.statusText}`);
        }

        const result: ToolResult = await response.json();
        const executionTime = Date.now() - startTime;

        // Update state
        setExecutions(prev =>
          new Map(prev).set(executionId, {
            toolName,
            input,
            result,
            status: result.metadata?.requiresApproval
              ? 'approval_required'
              : result.success
                ? 'success'
                : 'error',
            error: result.error,
            executionTime,
          })
        );

        if (result.success && onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        setExecutions(prev =>
          new Map(prev).set(executionId, {
            toolName,
            input,
            status: 'error',
            error: errorMessage,
            executionTime: Date.now() - startTime,
          })
        );

        if (onError) {
          onError(error instanceof Error ? error : new Error(errorMessage));
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [workspaceId, onSuccess, onError]
  );

  /**
   * Execute multiple tools in parallel
   */
  const executeParallel = useCallback(
    async (
      tools: Array<{ name: string; input: unknown }>
    ): Promise<ToolResult[]> => {
      return Promise.all(
        tools.map(({ name, input }) => executeTool(name, input))
      );
    },
    [executeTool]
  );

  /**
   * Approve a pending tool execution
   */
  const approveTool = useCallback(
    async (approvalId: string): Promise<ToolResult> => {
      try {
        const response = await fetch('/api/ai/tools/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approvalId,
            action: 'approve',
          }),
        });

        if (!response.ok) {
          throw new Error(`Approval failed: ${response.statusText}`);
        }

        const result: ToolResult = await response.json();

        if (result.success && onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (onError) {
          onError(error instanceof Error ? error : new Error(errorMessage));
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [onSuccess, onError]
  );

  /**
   * Reject a pending tool execution
   */
  const rejectTool = useCallback(async (approvalId: string): Promise<void> => {
    try {
      const response = await fetch('/api/ai/tools/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          action: 'reject',
        }),
      });

      if (!response.ok) {
        throw new Error(`Rejection failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to reject tool:', error);
    }
  }, []);

  /**
   * Clear execution history
   */
  const clearHistory = useCallback(() => {
    setExecutions(new Map());
  }, []);

  /**
   * Get execution by ID
   */
  const getExecution = useCallback(
    (executionId: string) => {
      return executions.get(executionId);
    },
    [executions]
  );

  /**
   * Get all executions as array
   */
  const getAllExecutions = useCallback(() => {
    return Array.from(executions.values());
  }, [executions]);

  return {
    executeTool,
    executeParallel,
    approveTool,
    rejectTool,
    clearHistory,
    getExecution,
    executions: getAllExecutions(),
  };
}
