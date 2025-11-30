/**
 * List Universal Subagents Tool
 *
 * Lists all universal subagents available across the platform.
 * These are predefined subagent templates that can be instantiated.
 * GET /api/universal-subagents
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const listUniversalSubagentsInputSchema = z.object({
  category: z.string().optional().describe('Filter by category'),
  type: z.string().optional().describe('Filter by subagent type'),
  search: z.string().optional().describe('Search by name or description'),
  sortBy: z.enum(['name', 'category', 'type', 'popularity']).optional().describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (default: 1)'),
  limit: z.number().int().min(1).max(100).optional().describe('Items per page (default: 20, max: 100)'),
});

export type ListUniversalSubagentsInput = z.infer<typeof listUniversalSubagentsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface UniversalSubagent {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  capabilities: string[];
  defaultConfiguration: unknown;
  requiredCapabilities: string[];
  recommendedFor: string[];
  popularity: number;
  version: string;
  author?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ListUniversalSubagentsResponse {
  data: UniversalSubagent[];
  pagination: {
    page?: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  categories: string[];
  types: string[];
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

export async function listUniversalSubagents(
  apiClient: NeolithAPIClient,
  input: ListUniversalSubagentsInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {};

    if (input.category) params.category = input.category;
    if (input.type) params.type = input.type;
    if (input.search) params.search = input.search;
    if (input.sortBy) params.sortBy = input.sortBy;
    if (input.sortOrder) params.sortOrder = input.sortOrder;
    if (input.page) params.page = input.page.toString();
    if (input.limit) params.limit = input.limit.toString();

    // Make API request
    const path = `/api/universal-subagents`;
    const response = await apiClient.get<ListUniversalSubagentsResponse>(path, params);

    return {
      success: true,
      message: `Found ${response.data.length} universal subagent template(s)`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to list universal subagents: ${errorMessage}`,
      error: {
        code: 'LIST_UNIVERSAL_SUBAGENTS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
