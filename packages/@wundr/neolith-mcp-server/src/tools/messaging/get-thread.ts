/**
 * Get Thread Tool
 *
 * Retrieves thread replies for a parent message.
 *
 * @module tools/messaging/get-thread
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for getting thread replies
 */
export const GetThreadSchema = z.object({
  messageId: z.string().describe('ID of the parent message'),
  limit: z.number().int().min(1).max(100).optional().default(50).describe('Number of replies to fetch (1-100)'),
  cursor: z.string().optional().describe('Cursor for pagination (message ID)'),
});

export type GetThreadInput = z.infer<typeof GetThreadSchema>;

/**
 * Get thread replies for a message
 *
 * @param input - Query parameters
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with thread data including parent message and replies
 *
 * @example
 * ```typescript
 * const result = await getThreadHandler({
 *   messageId: 'msg_123',
 *   limit: 20
 * }, apiClient);
 * ```
 */
export async function getThreadHandler(
  input: GetThreadInput,
  apiClient: { get: (path: string, params?: Record<string, unknown>) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = GetThreadSchema.parse(input);

    // Build query parameters
    const params: Record<string, unknown> = {
      limit: validatedInput.limit,
    };

    if (validatedInput.cursor) {
      params.cursor = validatedInput.cursor;
    }

    // Fetch thread via API
    const response = await apiClient.get(
      `/api/messages/${validatedInput.messageId}/thread`,
      params
    );

    return {
      success: true,
      data: response,
      message: 'Thread retrieved successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve thread',
    };
  }
}
