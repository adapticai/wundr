/**
 * Get DM Channels Tool
 *
 * Retrieves all DM and group DM conversations for the authenticated user.
 *
 * @module tools/messaging/get-dm-channels
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for getting DM channels
 */
export const GetDMChannelsSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug to fetch DM channels from'),
  limit: z.number().int().min(1).max(100).optional().default(50).describe('Number of channels to fetch (1-100)'),
  cursor: z.string().optional().describe('Cursor for pagination'),
});

export type GetDMChannelsInput = z.infer<typeof GetDMChannelsSchema>;

/**
 * Get DM channels (conversations) for the user
 *
 * @param input - Query parameters
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with list of DM channels
 *
 * @example
 * ```typescript
 * const result = await getDMChannelsHandler({
 *   workspaceSlug: 'my-workspace',
 *   limit: 20
 * }, apiClient);
 * ```
 */
export async function getDMChannelsHandler(
  input: GetDMChannelsInput,
  apiClient: { get: (path: string, params?: Record<string, unknown>) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = GetDMChannelsSchema.parse(input);

    // Build query parameters
    const params: Record<string, unknown> = {
      limit: validatedInput.limit,
      type: 'DM', // Filter for DM channels only
    };

    if (validatedInput.cursor) {
      params.cursor = validatedInput.cursor;
    }

    // Fetch conversations via API
    const response = await apiClient.get('/api/conversations', params);

    return {
      success: true,
      data: response,
      message: 'DM channels retrieved successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve DM channels',
    };
  }
}
