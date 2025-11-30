/**
 * Deactivate Session Manager Tool
 *
 * Deactivate a session manager.
 * POST /api/session-managers/[sessionManagerId]/deactivate
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { SessionManager } from './list-session-managers';

// ============================================================================
// Input Schema
// ============================================================================

export const deactivateSessionManagerInputSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to deactivate'),
  reason: z.string().optional().describe('Optional reason for deactivation'),
});

export type DeactivateSessionManagerInput = z.infer<typeof deactivateSessionManagerInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface DeactivateSessionManagerResponse {
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

export async function deactivateSessionManager(
  apiClient: NeolithAPIClient,
  input: DeactivateSessionManagerInput
): Promise<McpToolResult> {
  try {
    const { sessionManagerId, reason } = input;

    // Make API request
    const path = `/api/session-managers/${sessionManagerId}/deactivate`;
    const response = await apiClient.post<DeactivateSessionManagerResponse>(path, { reason });

    return {
      success: true,
      message: `Successfully deactivated session manager ${sessionManagerId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to deactivate session manager: ${errorMessage}`,
      error: {
        code: 'DEACTIVATE_SESSION_MANAGER_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
