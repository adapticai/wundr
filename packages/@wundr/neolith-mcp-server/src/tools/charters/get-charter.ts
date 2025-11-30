/**
 * Get Charter Tool
 *
 * Get the active charter for a specific orchestrator.
 * GET /api/orchestrators/[orchestratorId]/charter
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getCharterInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to fetch charter for'),
});

export type GetCharterInput = z.infer<typeof getCharterInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface CharterConstraint {
  type: 'allowed' | 'forbidden' | 'required';
  category: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface Charter {
  id: string;
  orchestratorId: string;
  version: number;
  name: string;
  description?: string;
  constraints: CharterConstraint[];
  scope?: {
    workspaces?: string[];
    channels?: string[];
    resources?: string[];
  };
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
}

export interface GetCharterResponse {
  data: Charter;
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

export async function getCharter(
  apiClient: NeolithAPIClient,
  input: GetCharterInput
): Promise<McpToolResult> {
  try {
    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/charter`;
    const response = await apiClient.get<GetCharterResponse>(path);

    return {
      success: true,
      message: `Successfully retrieved charter for orchestrator ${input.orchestratorId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get charter: ${errorMessage}`,
      error: {
        code: 'GET_CHARTER_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
