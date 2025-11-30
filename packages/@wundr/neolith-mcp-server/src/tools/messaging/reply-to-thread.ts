/**
 * Reply to Thread Tool
 *
 * Sends a reply to a thread (parent message).
 *
 * @module tools/messaging/reply-to-thread
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for replying to a thread
 */
export const ReplyToThreadSchema = z.object({
  messageId: z.string().describe('ID of the parent message to reply to'),
  content: z.string().min(1).max(4000).describe('Reply content (1-4000 characters)'),
  type: z.enum(['TEXT', 'CODE', 'SYSTEM']).optional().default('TEXT').describe('Message type'),
  metadata: z.record(z.unknown()).optional().describe('Optional metadata'),
});

export type ReplyToThreadInput = z.infer<typeof ReplyToThreadSchema>;

/**
 * Reply to a thread
 *
 * @param input - Reply data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with created reply
 *
 * @example
 * ```typescript
 * const result = await replyToThreadHandler({
 *   messageId: 'msg_123',
 *   content: 'This is a reply!'
 * }, apiClient);
 * ```
 */
export async function replyToThreadHandler(
  input: ReplyToThreadInput,
  apiClient: { post: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = ReplyToThreadSchema.parse(input);

    // Prepare request body
    const requestBody = {
      content: validatedInput.content,
      type: validatedInput.type,
      metadata: validatedInput.metadata,
    };

    // Send reply via API
    const response = await apiClient.post(
      `/api/messages/${validatedInput.messageId}/thread`,
      requestBody
    );

    return {
      success: true,
      data: response,
      message: 'Reply sent successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reply',
    };
  }
}
