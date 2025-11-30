/**
 * Update Session Manager Tool
 *
 * Update an existing session manager.
 * PATCH /api/session-managers/[sessionManagerId]
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { SessionManager } from './list-session-managers';

// ============================================================================
// Input Schema
// ============================================================================

export const updateSessionManagerInputSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to update'),
  name: z.string().min(1).optional().describe('Updated session manager name'),
  description: z.string().optional().describe('Updated session manager description'),
  configuration: z.record(z.unknown()).optional().describe('Updated session manager configuration'),
  orchestratorId: z.string().optional().describe('Updated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional().describe('Updated status'),
});

export type UpdateSessionManagerInput = z.infer<typeof updateSessionManagerInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface UpdateSessionManagerResponse {
  data: SessionManager;
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

export async function updateSessionManager(
  apiClient: NeolithAPIClient,
  input: UpdateSessionManagerInput
): Promise<McpToolResult> {
  try {
    const { sessionManagerId, ...body } = input;

    // Make API request
    const path = `/api/session-managers/${sessionManagerId}`;
    const response = await apiClient.patch<UpdateSessionManagerResponse>(path, body);

    return {
      success: true,
      message: `Successfully updated session manager ${sessionManagerId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to update session manager: ${errorMessage}`,
      error: {
        code: 'UPDATE_SESSION_MANAGER_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
