/**
 * List Subagents Tool
 *
 * Lists all subagents associated with a session manager.
 * GET /api/session-managers/[sessionManagerId]/subagents
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const listSubagentsInputSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to list subagents from'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BUSY', 'ERROR']).optional().describe('Filter by subagent status'),
  type: z.string().optional().describe('Filter by subagent type'),
  search: z.string().optional().describe('Search by name or description'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status', 'type']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export type ListSubagentsInput = z.infer<typeof listSubagentsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface SubagentStatistics {
  totalTasks: number;
  tasksCompleted: number;
  activeTasks: number;
  failedTasks: number;
}

export interface Subagent {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  configuration?: unknown;
  capabilities?: string[];
  sessionManagerId: string;
  orchestratorId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  };
  sessionManager: {
    id: string;
    name: string;
    status: string;
  };
  statistics?: SubagentStatistics;
}

export interface ListSubagentsResponse {
  data: Subagent[];
  pagination: {
    page?: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    cursor?: string;
    nextCursor?: string;
  };
  sessionManager: {
    id: string;
    name: string;
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

export async function listSubagents(
  apiClient: NeolithAPIClient,
  input: ListSubagentsInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {};

    if (input.status) params.status = input.status;
    if (input.type) params.type = input.type;
    if (input.search) params.search = input.search;
    if (input.sortBy) params.sortBy = input.sortBy;
    if (input.sortOrder) params.sortOrder = input.sortOrder;
    if (input.page) params.page = input.page.toString();
    if (input.limit) params.limit = input.limit.toString();
    if (input.cursor) params.cursor = input.cursor;

    // Make API request
    const path = `/api/session-managers/${input.sessionManagerId}/subagents`;
    const response = await apiClient.get<ListSubagentsResponse>(path, params);

    return {
      success: true,
      message: `Found ${response.data.length} subagent(s) for session manager ${input.sessionManagerId}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to list subagents: ${errorMessage}`,
      error: {
        code: 'LIST_SUBAGENTS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
