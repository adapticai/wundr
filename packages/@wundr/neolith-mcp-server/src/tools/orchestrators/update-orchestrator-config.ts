/**
 * Update Orchestrator Configuration Tool
 *
 * Update configuration for a specific orchestrator.
 * PUT /api/orchestrators/[orchestratorId]/config
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { OrchestratorConfig } from './get-orchestrator-config';

// ============================================================================
// Input Schema
// ============================================================================

export const updateOrchestratorConfigInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID'),
  maxConcurrentTasks: z.number().int().min(1).max(50).optional().describe('Maximum concurrent tasks'),
  workingHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().describe('Working hours start time (HH:mm format)'),
  workingHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().describe('Working hours end time (HH:mm format)'),
  timezone: z.string().optional().describe('Timezone (e.g., America/New_York)'),
  autoAssignTasks: z.boolean().optional().describe('Automatically assign tasks to orchestrator'),
  notificationsEnabled: z.boolean().optional().describe('Enable notifications'),
  preferredChannels: z.array(z.string()).optional().describe('List of preferred channel IDs'),
  adminOverrides: z.record(z.unknown()).optional().describe('Admin-only override settings'),
  isLocked: z.boolean().optional().describe('Lock configuration from orchestrator modifications (admin only)'),
});

export type UpdateOrchestratorConfigInput = z.infer<typeof updateOrchestratorConfigInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface UpdateOrchestratorConfigResponse {
  data: OrchestratorConfig;
  message: string;
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

export async function updateOrchestratorConfig(
  apiClient: NeolithAPIClient,
  input: UpdateOrchestratorConfigInput
): Promise<McpToolResult> {
  try {
    const { orchestratorId, ...configData } = input;

    // Make API request
    const path = `/api/orchestrators/${orchestratorId}/config`;
    const response = await apiClient.put<UpdateOrchestratorConfigResponse>(path, configData);

    return {
      success: true,
      message: response.message || `Successfully updated configuration for orchestrator ${orchestratorId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to update orchestrator config: ${errorMessage}`,
      error: {
        code: 'UPDATE_ORCHESTRATOR_CONFIG_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
