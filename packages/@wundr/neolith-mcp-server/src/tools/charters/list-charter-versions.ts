/**
 * List Charter Versions Tool
 *
 * List all charter versions for a specific orchestrator.
 * GET /api/orchestrators/[orchestratorId]/charters
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { Charter } from './get-charter';

// ============================================================================
// Input Schema
// ============================================================================

export const listCharterVersionsInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to list charters for'),
  includeInactive: z.boolean().optional().default(false).describe('Include inactive charter versions'),
  limit: z.number().int().positive().optional().default(50).describe('Maximum number of charter versions to return'),
  offset: z.number().int().min(0).optional().default(0).describe('Offset for pagination'),
});

export type ListCharterVersionsInput = z.infer<typeof listCharterVersionsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface ListCharterVersionsResponse {
  data: Charter[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
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

export async function listCharterVersions(
  apiClient: NeolithAPIClient,
  input: ListCharterVersionsInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, unknown> = {
      limit: input.limit,
      offset: input.offset,
    };

    if (input.includeInactive !== undefined) {
      params.includeInactive = input.includeInactive;
    }

    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/charters`;
    const response = await apiClient.get<ListCharterVersionsResponse>(path, params);

    return {
      success: true,
      message: `Successfully retrieved ${response.data.length} charter version(s) for orchestrator ${input.orchestratorId}`,
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to list charter versions: ${errorMessage}`,
      error: {
        code: 'LIST_CHARTER_VERSIONS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
