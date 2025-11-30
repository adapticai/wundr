/**
 * Get Charter Constraints Tool
 *
 * Get just the constraints section of the active charter for an orchestrator.
 * GET /api/orchestrators/[orchestratorId]/charter/constraints
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { CharterConstraint } from './get-charter';

// ============================================================================
// Input Schema
// ============================================================================

export const getCharterConstraintsInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to fetch constraints for'),
  category: z.string().optional().describe('Filter by constraint category'),
  type: z.enum(['allowed', 'forbidden', 'required']).optional().describe('Filter by constraint type'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by minimum severity level'),
});

export type GetCharterConstraintsInput = z.infer<typeof getCharterConstraintsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface GetCharterConstraintsResponse {
  data: {
    orchestratorId: string;
    charterId: string;
    charterVersion: number;
    constraints: CharterConstraint[];
    totalCount: number;
    filteredCount: number;
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

export async function getCharterConstraints(
  apiClient: NeolithAPIClient,
  input: GetCharterConstraintsInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, unknown> = {};

    if (input.category !== undefined) {
      params.category = input.category;
    }
    if (input.type !== undefined) {
      params.type = input.type;
    }
    if (input.severity !== undefined) {
      params.severity = input.severity;
    }

    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/charter/constraints`;
    const response = await apiClient.get<GetCharterConstraintsResponse>(path, params);

    const constraintsData = response.data;
    let message = `Successfully retrieved ${constraintsData.filteredCount} constraint(s) for orchestrator ${input.orchestratorId}`;
    if (constraintsData.filteredCount < constraintsData.totalCount) {
      message += ` (${constraintsData.totalCount} total)`;
    }

    return {
      success: true,
      message,
      data: constraintsData,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get charter constraints: ${errorMessage}`,
      error: {
        code: 'GET_CHARTER_CONSTRAINTS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
