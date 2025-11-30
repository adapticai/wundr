/**
 * Get Orchestrator Tasks Tool
 *
 * List tasks assigned to a specific orchestrator.
 * GET /api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/tasks
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getOrchestratorTasksInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug'),
  orchestratorId: z.string().describe('The orchestrator ID'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  cursor: z.string().optional().describe('Cursor for pagination (task ID)'),
  status: z.string().optional().describe('Filter by status (comma-separated: TODO,IN_PROGRESS,BLOCKED,DONE,CANCELLED)'),
  priority: z.string().optional().describe('Filter by priority (comma-separated: CRITICAL,HIGH,MEDIUM,LOW)'),
  includeCompleted: z.boolean().optional().describe('Include completed tasks (default: false)'),
});

export type GetOrchestratorTasksInput = z.infer<typeof getOrchestratorTasksInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface TaskUser {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedHours?: number;
  dueDate?: string;
  tags?: string[];
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
  orchestratorId: string;
  workspaceId: string;
  channelId?: string;
  createdById: string;
  assignedToId?: string;
  createdAt: string;
  updatedAt: string;
  orchestrator: {
    id: string;
    role: string;
    discipline: string;
    user: TaskUser;
  };
  workspace: {
    id: string;
    name: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  createdBy: TaskUser;
  assignedTo?: TaskUser;
}

export interface GetOrchestratorTasksResponse {
  data: Task[];
  pagination: {
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
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

export async function getOrchestratorTasks(
  apiClient: NeolithAPIClient,
  input: GetOrchestratorTasksInput
): Promise<McpToolResult> {
  try {
    const { workspaceSlug, orchestratorId, ...queryParams } = input;

    // Build query parameters
    const params: Record<string, string> = {};

    if (queryParams.limit) params.limit = queryParams.limit.toString();
    if (queryParams.cursor) params.cursor = queryParams.cursor;
    if (queryParams.status) params.status = queryParams.status;
    if (queryParams.priority) params.priority = queryParams.priority;
    if (queryParams.includeCompleted !== undefined) params.includeCompleted = queryParams.includeCompleted.toString();

    // Make API request
    const path = `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/tasks`;
    const response = await apiClient.get<GetOrchestratorTasksResponse>(path, params);

    return {
      success: true,
      message: `Found ${response.data.length} task(s) for orchestrator ${orchestratorId}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get orchestrator tasks: ${errorMessage}`,
      error: {
        code: 'GET_ORCHESTRATOR_TASKS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
