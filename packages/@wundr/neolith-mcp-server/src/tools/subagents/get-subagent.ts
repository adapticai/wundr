/**
 * Get Subagent Tool
 *
 * Get details for a specific subagent.
 * GET /api/subagents/[subagentId]
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { Subagent } from './list-subagents';

// ============================================================================
// Input Schema
// ============================================================================

export const getSubagentInputSchema = z.object({
  subagentId: z.string().describe('The subagent ID to fetch'),
  includeStatistics: z.boolean().optional().default(true).describe('Include statistics'),
  includeTasks: z.boolean().optional().default(false).describe('Include recent tasks'),
});

export type GetSubagentInput = z.infer<typeof getSubagentInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface GetSubagentResponse {
  data: Subagent & {
    tasks?: Array<{
      id: string;
      name: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>;
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

export async function getSubagent(
  apiClient: NeolithAPIClient,
  input: GetSubagentInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {};
    if (input.includeStatistics !== undefined) params.includeStatistics = input.includeStatistics.toString();
    if (input.includeTasks !== undefined) params.includeTasks = input.includeTasks.toString();

    // Make API request
    const path = `/api/subagents/${input.subagentId}`;
    const response = await apiClient.get<GetSubagentResponse>(path, params);

    return {
      success: true,
      message: `Successfully retrieved subagent ${input.subagentId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get subagent: ${errorMessage}`,
      error: {
        code: 'GET_SUBAGENT_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
