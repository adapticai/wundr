/**
 * List Orchestrators Tool
 *
 * Lists all orchestrators in a workspace with filtering and pagination.
 * GET /api/workspaces/[slug]/orchestrators
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const listOrchestratorsInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug to list orchestrators from'),
  status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']).optional().describe('Filter by orchestrator status'),
  discipline: z.string().optional().describe('Filter by discipline'),
  search: z.string().optional().describe('Search by name, email, role, or discipline'),
  sortBy: z.enum(['createdAt', 'updatedAt', 'discipline', 'role', 'status']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export type ListOrchestratorsInput = z.infer<typeof listOrchestratorsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface OrchestratorStatistics {
  totalTasks: number;
  tasksCompleted: number;
  activeTasks: number;
}

export interface OrchestratorUser {
  id: string;
  name: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  status: string;
  lastActiveAt?: string;
  createdAt: string;
}

export interface Orchestrator {
  id: string;
  discipline: string;
  role: string;
  status: string;
  capabilities?: unknown;
  daemonEndpoint?: string;
  organizationId: string;
  workspaceId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: OrchestratorUser;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  disciplineRef?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  };
  statistics?: OrchestratorStatistics;
}

export interface ListOrchestratorsResponse {
  data: Orchestrator[];
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

export async function listOrchestrators(
  apiClient: NeolithAPIClient,
  input: ListOrchestratorsInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {};

    if (input.status) params.status = input.status;
    if (input.discipline) params.discipline = input.discipline;
    if (input.search) params.search = input.search;
    if (input.sortBy) params.sortBy = input.sortBy;
    if (input.sortOrder) params.sortOrder = input.sortOrder;
    if (input.page) params.page = input.page.toString();
    if (input.limit) params.limit = input.limit.toString();
    if (input.cursor) params.cursor = input.cursor;

    // Make API request
    const path = `/api/workspaces/${input.workspaceSlug}/orchestrators`;
    const response = await apiClient.get<ListOrchestratorsResponse>(path, params);

    return {
      success: true,
      message: `Found ${response.data.length} orchestrator(s) in workspace ${input.workspaceSlug}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to list orchestrators: ${errorMessage}`,
      error: {
        code: 'LIST_ORCHESTRATORS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
