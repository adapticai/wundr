/**
 * Set Presence Tool
 *
 * Set the current user's presence status (online, away, dnd, offline).
 * Maps to: PUT /api/presence
 *
 * @module @wundr/neolith-mcp-server/tools/users/set-presence
 */

import { z } from 'zod';
import type { NeolithApiClient } from '../../lib/api-client';
interface McpToolResult<T = unknown> { success: boolean; data?: T; message?: string; error?: string; }

/**
 * Presence status types
 */
export const PresenceStatusSchema = z.enum(['ONLINE', 'AWAY', 'BUSY', 'OFFLINE']);
export type PresenceStatus = z.infer<typeof PresenceStatusSchema>;

/**
 * Input schema for set-presence tool
 */
export const SetPresenceInputSchema = z.object({
  status: PresenceStatusSchema.describe('Presence status to set'),
  customStatus: z.string().optional().describe('Custom status message'),
});

export type SetPresenceInput = z.infer<typeof SetPresenceInputSchema>;

/**
 * User presence response
 */
export interface UserPresenceResponse {
  userId: string;
  status: PresenceStatus;
  customStatus: string | null;
  lastSeen: string;
  isOnline: boolean;
}

/**
 * Set current user's presence status
 *
 * @param apiClient - Neolith API client instance
 * @param input - Presence status and optional custom message
 * @returns Updated presence information
 *
 * @example
 * ```typescript
 * const result = await setPresence(apiClient, {
 *   status: 'BUSY',
 *   customStatus: 'In a meeting'
 * });
 * console.log(result.data.status);
 * ```
 */
export async function setPresence(
  apiClient: NeolithApiClient,
  input: SetPresenceInput,
): Promise<McpToolResult<UserPresenceResponse>> {
  try {
    const { status, customStatus } = input;

    if (!status) {
      return {
        success: false,
        error: 'Status is required',
        message: 'Invalid input',
      };
    }

    const presence = await apiClient.put<UserPresenceResponse>(
      '/api/presence',
      { status, customStatus },
    );

    return {
      success: true,
      message: `Presence status updated to ${status}`,
      data: presence,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to set presence status',
    };
  }
}

/**
 * Tool definition for MCP registration
 */
export const setPresenceTool = {
  name: 'neolith_set_presence',
  description: 'Set the current user\'s presence status (online, away, busy, offline)',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['ONLINE', 'AWAY', 'BUSY', 'OFFLINE'],
        description: 'Presence status to set',
      },
      customStatus: {
        type: 'string',
        description: 'Custom status message',
      },
    },
    required: ['status'],
  },
};
