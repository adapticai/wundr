/**
 * Get Delegation Status Tool
 *
 * Checks the status of a delegated task across the federation.
 * Provides real-time updates on task progress and results.
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getDelegationStatusInputSchema = z.object({
  delegationId: z.string().describe('Delegation ID to check status for'),
  includeResult: z.boolean().optional().default(true).describe('Include task result if completed'),
  includeLogs: z.boolean().optional().default(false).describe('Include execution logs'),
});

export type GetDelegationStatusInput = z.infer<typeof getDelegationStatusInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface TaskExecutionLog {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  output: unknown;
  outputType: string;
  executionTime: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
    tokens?: number;
  };
}

export interface DelegationStatusDetails {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  message?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface GetDelegationStatusResponse {
  delegationId: string;
  taskId: string;
  targetOrchestratorId: string;
  status: DelegationStatusDetails;
  result?: TaskResult;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  logs?: TaskExecutionLog[];
  timing: {
    createdAt: string;
    acceptedAt?: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
  };
  retries?: {
    count: number;
    maxRetries: number;
    lastRetryAt?: string;
  };
}

// ============================================================================
// Tool Result Type
// ============================================================================

export interface McpToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function getDelegationStatus(
  apiClient: NeolithAPIClient,
  input: GetDelegationStatusInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {
      includeResult: input.includeResult.toString(),
      includeLogs: input.includeLogs.toString(),
    };

    // Make API request to delegation status endpoint
    const path = `/api/federation/delegations/${input.delegationId}/status`;
    const response = await apiClient.get<GetDelegationStatusResponse>(path, params);

    // Build status message
    let message = `Delegation ${response.delegationId} is ${response.status.status}`;

    if (response.status.progress) {
      message += ` (${response.status.progress.percentage}% complete)`;
    }

    if (response.timing.duration) {
      message += ` - Duration: ${response.timing.duration}ms`;
    }

    if (response.status.status === 'COMPLETED' && response.result) {
      message += ` - Execution time: ${response.result.executionTime}ms`;
    }

    if (response.error) {
      message += ` - Error: ${response.error.message}`;
    }

    return {
      success: true,
      message,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get delegation status: ${errorMessage}`,
      error: {
        code: 'GET_DELEGATION_STATUS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
