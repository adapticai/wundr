/**
 * Get Orchestrator Memory Tool
 *
 * Query memory entries for a specific orchestrator.
 * GET /api/workspaces/[workspaceSlug]/orchestrators/[orchestratorId]/memory
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getOrchestratorMemoryInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug'),
  orchestratorId: z.string().describe('The orchestrator ID'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
  memoryType: z.enum(['conversation', 'task_completion', 'learned_pattern', 'preference']).optional().describe('Filter by memory type'),
  minImportance: z.number().min(0).max(1).optional().describe('Minimum importance score (0.0-1.0)'),
  from: z.string().datetime().optional().describe('Start date (ISO 8601 format)'),
  to: z.string().datetime().optional().describe('End date (ISO 8601 format)'),
  search: z.string().optional().describe('Search in memory content'),
  sortBy: z.enum(['createdAt', 'importance', 'memoryType']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  includeExpired: z.boolean().optional().describe('Include expired memories (default: false)'),
});

export type GetOrchestratorMemoryInput = z.infer<typeof getOrchestratorMemoryInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface OrchestratorMemory {
  id: string;
  orchestratorId: string;
  memoryType: 'conversation' | 'task_completion' | 'learned_pattern' | 'preference';
  content: string;
  metadata?: Record<string, unknown>;
  importance: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetOrchestratorMemoryResponse {
  data: OrchestratorMemory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
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

export async function getOrchestratorMemory(
  apiClient: NeolithAPIClient,
  input: GetOrchestratorMemoryInput
): Promise<McpToolResult> {
  try {
    const { workspaceSlug, orchestratorId, ...queryParams } = input;

    // Build query parameters
    const params: Record<string, string> = {};

    if (queryParams.page) params.page = queryParams.page.toString();
    if (queryParams.limit) params.limit = queryParams.limit.toString();
    if (queryParams.memoryType) params.memoryType = queryParams.memoryType;
    if (queryParams.minImportance !== undefined) params.minImportance = queryParams.minImportance.toString();
    if (queryParams.from) params.from = queryParams.from;
    if (queryParams.to) params.to = queryParams.to;
    if (queryParams.search) params.search = queryParams.search;
    if (queryParams.sortBy) params.sortBy = queryParams.sortBy;
    if (queryParams.sortOrder) params.sortOrder = queryParams.sortOrder;
    if (queryParams.includeExpired !== undefined) params.includeExpired = queryParams.includeExpired.toString();

    // Make API request
    const path = `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/memory`;
    const response = await apiClient.get<GetOrchestratorMemoryResponse>(path, params);

    return {
      success: true,
      message: `Found ${response.data.length} memory entr${response.data.length === 1 ? 'y' : 'ies'} for orchestrator ${orchestratorId}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get orchestrator memory: ${errorMessage}`,
      error: {
        code: 'GET_ORCHESTRATOR_MEMORY_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
