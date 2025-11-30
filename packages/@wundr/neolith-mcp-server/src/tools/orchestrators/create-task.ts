/**
 * Create Task Tool
 *
 * Assign a new task to a specific orchestrator.
 * POST /api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/tasks
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { Task } from './get-orchestrator-tasks';

// ============================================================================
// Input Schema
// ============================================================================

export const createTaskInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug'),
  orchestratorId: z.string().describe('The orchestrator ID to assign the task to'),
  title: z.string().min(1).describe('Task title'),
  description: z.string().optional().describe('Task description'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional().describe('Task priority (default: MEDIUM)'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).optional().describe('Initial task status (default: TODO)'),
  estimatedHours: z.number().min(0).optional().describe('Estimated hours to complete'),
  dueDate: z.string().datetime().optional().describe('Due date (ISO 8601 format)'),
  tags: z.array(z.string()).optional().describe('Task tags'),
  dependsOn: z.array(z.string()).optional().describe('Array of task IDs this task depends on'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata as JSON object'),
  channelId: z.string().optional().describe('Channel ID to associate with the task'),
  assignedToId: z.string().optional().describe('User ID to assign the task to'),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface CreateTaskResponse {
  data: Task;
  message: string;
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

export async function createTask(
  apiClient: NeolithAPIClient,
  input: CreateTaskInput
): Promise<McpToolResult> {
  try {
    const { workspaceSlug, orchestratorId, ...taskData } = input;

    // Make API request
    const path = `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/tasks`;
    const response = await apiClient.post<CreateTaskResponse>(path, taskData);

    return {
      success: true,
      message: response.message || `Successfully created task for orchestrator ${orchestratorId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to create task: ${errorMessage}`,
      error: {
        code: 'CREATE_TASK_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
