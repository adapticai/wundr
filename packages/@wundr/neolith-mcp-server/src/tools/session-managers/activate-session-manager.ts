/**
 * Activate Session Manager Tool
 *
 * Activate a session manager.
 * POST /api/session-managers/[sessionManagerId]/activate
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { SessionManager } from './list-session-managers';

// ============================================================================
// Input Schema
// ============================================================================

export const activateSessionManagerInputSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to activate'),
  configuration: z.record(z.unknown()).optional().describe('Optional activation configuration'),
});

export type ActivateSessionManagerInput = z.infer<typeof activateSessionManagerInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface ActivateSessionManagerResponse {
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

export async function activateSessionManager(
  apiClient: NeolithAPIClient,
  input: ActivateSessionManagerInput
): Promise<McpToolResult> {
  try {
    const { sessionManagerId, configuration } = input;

    // Make API request
    const path = `/api/session-managers/${sessionManagerId}/activate`;
    const response = await apiClient.post<ActivateSessionManagerResponse>(path, { configuration });

    return {
      success: true,
      message: `Successfully activated session manager ${sessionManagerId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to activate session manager: ${errorMessage}`,
      error: {
        code: 'ACTIVATE_SESSION_MANAGER_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
