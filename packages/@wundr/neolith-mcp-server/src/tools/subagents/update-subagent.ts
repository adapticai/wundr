/**
 * Update Subagent Tool
 *
 * Update an existing subagent.
 * PATCH /api/subagents/[subagentId]
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { Subagent } from './list-subagents';

// ============================================================================
// Input Schema
// ============================================================================

export const updateSubagentInputSchema = z.object({
  subagentId: z.string().describe('The subagent ID to update'),
  name: z.string().min(1).optional().describe('Updated subagent name'),
  description: z.string().optional().describe('Updated subagent description'),
  type: z.string().optional().describe('Updated subagent type'),
  configuration: z.record(z.unknown()).optional().describe('Updated subagent configuration'),
  capabilities: z.array(z.string()).optional().describe('Updated list of capabilities'),
  orchestratorId: z.string().optional().describe('Updated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BUSY', 'ERROR']).optional().describe('Updated status'),
});

export type UpdateSubagentInput = z.infer<typeof updateSubagentInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface UpdateSubagentResponse {
  data: Subagent;
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

export async function updateSubagent(
  apiClient: NeolithAPIClient,
  input: UpdateSubagentInput
): Promise<McpToolResult> {
  try {
    const { subagentId, ...body } = input;

    // Make API request
    const path = `/api/subagents/${subagentId}`;
    const response = await apiClient.patch<UpdateSubagentResponse>(path, body);

    return {
      success: true,
      message: `Successfully updated subagent ${subagentId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to update subagent: ${errorMessage}`,
      error: {
        code: 'UPDATE_SUBAGENT_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
