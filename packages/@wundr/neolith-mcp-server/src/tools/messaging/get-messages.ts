/**
 * Get Messages Tool
 *
 * Retrieves messages from a channel with pagination support.
 *
 * @module tools/messaging/get-messages
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for getting messages
 */
export const GetMessagesSchema = z.object({
  channelId: z.string().describe('ID of the channel to fetch messages from'),
  limit: z.number().int().min(1).max(100).optional().default(50).describe('Number of messages to fetch (1-100)'),
  cursor: z.string().optional().describe('Cursor for pagination (message ID)'),
  order: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort order by creation date'),
});

export type GetMessagesInput = z.infer<typeof GetMessagesSchema>;

/**
 * Get messages from a channel
 *
 * @param input - Query parameters
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with messages list
 *
 * @example
 * ```typescript
 * const result = await getMessagesHandler({
 *   channelId: 'ch_123',
 *   limit: 50,
 *   order: 'desc'
 * }, apiClient);
 * ```
 */
export async function getMessagesHandler(
  input: GetMessagesInput,
  apiClient: { get: (path: string, params?: Record<string, unknown>) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = GetMessagesSchema.parse(input);

    // Build query parameters
    const params: Record<string, unknown> = {
      limit: validatedInput.limit,
      order: validatedInput.order,
    };

    if (validatedInput.cursor) {
      params.cursor = validatedInput.cursor;
    }

    // Fetch messages via API
    const response = await apiClient.get(
      `/api/channels/${validatedInput.channelId}/messages`,
      params
    );

    return {
      success: true,
      data: response,
      message: 'Messages retrieved successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve messages',
    };
  }
}
