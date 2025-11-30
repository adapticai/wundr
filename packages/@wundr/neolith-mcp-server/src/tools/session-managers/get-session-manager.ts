/**
 * Get Session Manager Tool
 *
 * Get details for a specific session manager.
 * GET /api/session-managers/[sessionManagerId]
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { SessionManager } from './list-session-managers';

// ============================================================================
// Input Schema
// ============================================================================

export const getSessionManagerInputSchema = z.object({
  sessionManagerId: z.string().describe('The session manager ID to fetch'),
});

export type GetSessionManagerInput = z.infer<typeof getSessionManagerInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface GetSessionManagerResponse {
  data: SessionManager;
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

export async function getSessionManager(
  apiClient: NeolithAPIClient,
  input: GetSessionManagerInput
): Promise<McpToolResult> {
  try {
    // Make API request
    const path = `/api/session-managers/${input.sessionManagerId}`;
    const response = await apiClient.get<GetSessionManagerResponse>(path);

    return {
      success: true,
      message: `Successfully retrieved session manager ${input.sessionManagerId}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get session manager: ${errorMessage}`,
      error: {
        code: 'GET_SESSION_MANAGER_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
