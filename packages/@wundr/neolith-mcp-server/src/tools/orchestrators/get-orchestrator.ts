/**
 * Get Orchestrator Tool
 *
 * Get details for a specific orchestrator.
 * GET /api/orchestrators/[orchestratorId]
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { Orchestrator } from './list-orchestrators';

// ============================================================================
// Input Schema
// ============================================================================

export const getOrchestratorInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to fetch'),
});

export type GetOrchestratorInput = z.infer<typeof getOrchestratorInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface GetOrchestratorResponse {
  data: Orchestrator;
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

export async function getOrchestrator(
  apiClient: NeolithAPIClient,
  input: GetOrchestratorInput
): Promise<McpToolResult> {
  try {
    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}`;
    const response = await apiClient.get<GetOrchestratorResponse>(path);

    return {
      success: true,
      message: `Successfully retrieved orchestrator ${input.orchestratorId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get orchestrator: ${errorMessage}`,
      error: {
        code: 'GET_ORCHESTRATOR_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
