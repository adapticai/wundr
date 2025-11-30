/**
 * Delete Message Tool
 *
 * Soft-deletes a message (user can only delete their own messages).
 *
 * @module tools/messaging/delete-message
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for deleting a message
 */
export const DeleteMessageSchema = z.object({
  messageId: z.string().describe('ID of the message to delete'),
});

export type DeleteMessageInput = z.infer<typeof DeleteMessageSchema>;

/**
 * Delete a message
 *
 * @param input - Delete parameters
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with deletion confirmation
 *
 * @example
 * ```typescript
 * const result = await deleteMessageHandler({
 *   messageId: 'msg_123'
 * }, apiClient);
 * ```
 */
export async function deleteMessageHandler(
  input: DeleteMessageInput,
  apiClient: { delete: (path: string) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = DeleteMessageSchema.parse(input);

    // Delete message via API
    const response = await apiClient.delete(
      `/api/messages/${validatedInput.messageId}`
    );

    return {
      success: true,
      data: response,
      message: 'Message deleted successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete message',
    };
  }
}
