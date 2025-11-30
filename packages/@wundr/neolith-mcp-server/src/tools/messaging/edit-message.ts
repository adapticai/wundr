/**
 * Edit Message Tool
 *
 * Edits an existing message (user can only edit their own messages).
 *
 * @module tools/messaging/edit-message
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for editing a message
 */
export const EditMessageSchema = z.object({
  messageId: z.string().describe('ID of the message to edit'),
  content: z.string().min(1).max(4000).describe('Updated message content (1-4000 characters)'),
});

export type EditMessageInput = z.infer<typeof EditMessageSchema>;

/**
 * Edit an existing message
 *
 * @param input - Edit data
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with updated message
 *
 * @example
 * ```typescript
 * const result = await editMessageHandler({
 *   messageId: 'msg_123',
 *   content: 'Updated message content'
 * }, apiClient);
 * ```
 */
export async function editMessageHandler(
  input: EditMessageInput,
  apiClient: { patch: (path: string, data: unknown) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = EditMessageSchema.parse(input);

    // Prepare request body
    const requestBody = {
      content: validatedInput.content,
    };

    // Edit message via API
    const response = await apiClient.patch(
      `/api/messages/${validatedInput.messageId}`,
      requestBody
    );

    return {
      success: true,
      data: response,
      message: 'Message edited successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to edit message',
    };
  }
}
