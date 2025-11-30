/**
 * Create Subagent Tool
 *
 * Create a new subagent for a session manager.
 * POST /api/session-managers/[sessionManagerId]/subagents
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { Subagent } from './list-subagents';

// ============================================================================
// Input Schema
// ============================================================================

export const createSubagentInputSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to create subagent for'),
  name: z.string().min(1).describe('Subagent name'),
  description: z.string().optional().describe('Subagent description'),
  type: z.string().describe('Subagent type (e.g., "task-executor", "data-processor", "analyzer")'),
  configuration: z.record(z.unknown()).optional().describe('Subagent configuration'),
  capabilities: z.array(z.string()).optional().describe('List of subagent capabilities'),
  orchestratorId: z.string().optional().describe('Associated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BUSY', 'ERROR']).optional().default('ACTIVE').describe('Initial status'),
});

export type CreateSubagentInput = z.infer<typeof createSubagentInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface CreateSubagentResponse {
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

export async function createSubagent(
  apiClient: NeolithAPIClient,
  input: CreateSubagentInput
): Promise<McpToolResult> {
  try {
    const { sessionManagerId, ...body } = input;

    // Make API request
    const path = `/api/session-managers/${sessionManagerId}/subagents`;
    const response = await apiClient.post<CreateSubagentResponse>(path, body);

    return {
      success: true,
      message: `Successfully created subagent: ${response.data.name}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to create subagent: ${errorMessage}`,
      error: {
        code: 'CREATE_SUBAGENT_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
