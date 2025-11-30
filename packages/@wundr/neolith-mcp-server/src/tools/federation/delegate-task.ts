/**
 * Delegate Task Tool
 *
 * Delegates a task to another federated orchestrator in the cluster.
 * Useful for load balancing and capability-based routing.
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const delegateTaskInputSchema = z.object({
  targetOrchestratorId: z.string().describe('ID of the target orchestrator to delegate to'),
  task: z.object({
    type: z.string().describe('Task type (e.g., "nlp-analysis", "code-generation")'),
    payload: z.record(z.unknown()).describe('Task-specific data and parameters'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL').describe('Task priority'),
    timeout: z.number().int().min(1000).optional().describe('Task timeout in milliseconds'),
  }).describe('Task to be delegated'),
  context: z.object({
    workspaceId: z.string().optional().describe('Associated workspace ID'),
    userId: z.string().optional().describe('Initiating user ID'),
    metadata: z.record(z.unknown()).optional().describe('Additional context metadata'),
  }).optional().describe('Additional context for task execution'),
});

export type DelegateTaskInput = z.infer<typeof delegateTaskInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface DelegationStatus {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  message?: string;
  estimatedCompletionTime?: string;
}

export interface DelegateTaskResponse {
  delegationId: string;
  targetOrchestratorId: string;
  taskId: string;
  status: DelegationStatus;
  createdAt: string;
  acceptedAt?: string;
  metadata: {
    queuePosition?: number;
    estimatedWaitTime?: number;
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

export async function delegateTask(
  apiClient: NeolithAPIClient,
  input: DelegateTaskInput
): Promise<McpToolResult> {
  try {
    // Prepare request payload
    const payload = {
      targetOrchestratorId: input.targetOrchestratorId,
      task: {
        type: input.task.type,
        payload: input.task.payload,
        priority: input.task.priority ?? 'NORMAL',
        ...(input.task.timeout && { timeout: input.task.timeout }),
      },
      ...(input.context && { context: input.context }),
    };

    // Make API request to delegation endpoint
    const path = '/api/federation/delegate';
    const response = await apiClient.post<DelegateTaskResponse>(path, payload);

    const statusMessage = response.status.message
      ? ` - ${response.status.message}`
      : '';

    return {
      success: true,
      message: `Task delegated successfully (ID: ${response.delegationId}, Status: ${response.status.status})${statusMessage}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to delegate task: ${errorMessage}`,
      error: {
        code: 'DELEGATE_TASK_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
