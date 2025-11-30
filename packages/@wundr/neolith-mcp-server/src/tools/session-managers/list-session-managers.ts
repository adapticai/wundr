/**
 * List Session Managers Tool
 *
 * Lists all session managers in a workspace with filtering and pagination.
 * GET /api/workspaces/[slug]/session-managers
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const listSessionManagersInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug to list session managers from'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional().describe('Filter by session manager status'),
  search: z.string().optional().describe('Search by name or description'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export type ListSessionManagersInput = z.infer<typeof listSessionManagersInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface SessionManagerStatistics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
}

export interface SessionManager {
  id: string;
  name: string;
  description?: string;
  status: string;
  configuration?: unknown;
  workspaceId: string;
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
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  statistics?: SessionManagerStatistics;
}

export interface ListSessionManagersResponse {
  data: SessionManager[];
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
  workspace: {
    id: string;
    name: string;
    organizationId: string;
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

export async function listSessionManagers(
  apiClient: NeolithAPIClient,
  input: ListSessionManagersInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {};

    if (input.status) params.status = input.status;
    if (input.search) params.search = input.search;
    if (input.sortBy) params.sortBy = input.sortBy;
    if (input.sortOrder) params.sortOrder = input.sortOrder;
    if (input.page) params.page = input.page.toString();
    if (input.limit) params.limit = input.limit.toString();
    if (input.cursor) params.cursor = input.cursor;

    // Make API request
    const path = `/api/workspaces/${input.workspaceSlug}/session-managers`;
    const response = await apiClient.get<ListSessionManagersResponse>(path, params);

    return {
      success: true,
      message: `Found ${response.data.length} session manager(s) in workspace ${input.workspaceSlug}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to list session managers: ${errorMessage}`,
      error: {
        code: 'LIST_SESSION_MANAGERS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
