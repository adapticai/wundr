/**
 * Get Orchestrator Configuration Tool
 *
 * Get configuration for a specific orchestrator.
 * GET /api/orchestrators/[orchestratorId]/config
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getOrchestratorConfigInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID'),
});

export type GetOrchestratorConfigInput = z.infer<typeof getOrchestratorConfigInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface OrchestratorConfig {
  id: string;
  orchestratorId: string;
  maxConcurrentTasks?: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  timezone?: string;
  autoAssignTasks?: boolean;
  notificationsEnabled?: boolean;
  preferredChannels?: string[];
  adminOverrides?: Record<string, unknown>;
  isLocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetOrchestratorConfigResponse {
  data: OrchestratorConfig;
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

export async function getOrchestratorConfig(
  apiClient: NeolithAPIClient,
  input: GetOrchestratorConfigInput
): Promise<McpToolResult> {
  try {
    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/config`;
    const response = await apiClient.get<GetOrchestratorConfigResponse>(path);

    return {
      success: true,
      message: `Successfully retrieved configuration for orchestrator ${input.orchestratorId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get orchestrator config: ${errorMessage}`,
      error: {
        code: 'GET_ORCHESTRATOR_CONFIG_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
