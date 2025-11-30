/**
 * Create Session Manager Tool
 *
 * Create a new session manager in a workspace.
 * POST /api/workspaces/[slug]/session-managers
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';
import type { SessionManager } from './list-session-managers';

// ============================================================================
// Input Schema
// ============================================================================

export const createSessionManagerInputSchema = z.object({
  workspaceSlug: z.string().describe('The workspace slug to create session manager in'),
  name: z.string().min(1).describe('Session manager name'),
  description: z.string().optional().describe('Session manager description'),
  configuration: z.record(z.unknown()).optional().describe('Session manager configuration'),
  orchestratorId: z.string().optional().describe('Associated orchestrator ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional().default('ACTIVE').describe('Initial status'),
});

export type CreateSessionManagerInput = z.infer<typeof createSessionManagerInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface CreateSessionManagerResponse {
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

export async function createSessionManager(
  apiClient: NeolithAPIClient,
  input: CreateSessionManagerInput
): Promise<McpToolResult> {
  try {
    const { workspaceSlug, ...body } = input;

    // Make API request
    const path = `/api/workspaces/${workspaceSlug}/session-managers`;
    const response = await apiClient.post<CreateSessionManagerResponse>(path, body);

    return {
      success: true,
      message: `Successfully created session manager: ${response.data.name}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to create session manager: ${errorMessage}`,
      error: {
        code: 'CREATE_SESSION_MANAGER_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
